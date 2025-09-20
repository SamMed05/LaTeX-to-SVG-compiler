const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const rimraf = require('rimraf');

function execCmd(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 60_000, windowsHide: true, ...opts }, (error, stdout, stderr) => {
      if (error) {
        const err = new Error(`Command failed: ${cmd}\n${stderr || stdout}`);
        err.stdout = stdout; err.stderr = stderr; err.code = error.code;
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
  });
}

// Build the LaTeX wrapper as header + footer so we can map log line numbers back to user code
const TEMPLATE_HEADER = [
  '\\documentclass[tikz, border=2pt]{standalone}',
  '% Core packages for TikZ/pgfplots snippets',
  '\\usepackage{tikz}',
  '\\usetikzlibrary{positioning,calc}',
  '\\usepackage{pgfplots}',
  '\\pgfplotsset{compat=1.18}',
  '\\usepackage{amsmath}',
  '\\begin{document}'
].join('\n') + '\n';
const TEMPLATE_FOOTER = '\n\\end{document}\n';

function wrapInTemplate(content) {
  // standalone class keeps output tightly cropped; tikz and pgfplots need packages
  return TEMPLATE_HEADER + content + TEMPLATE_FOOTER;
}

function getHeaderLineOffset() {
  // Number of lines before user content starts
  const nlCount = (TEMPLATE_HEADER.match(/\n/g) || []).length; // equals number of header lines
  return nlCount; // content starts at headerLines + 1
}

function parseLatexLog(log, headerOffsetLines = 0) {
  // Minimal parser to extract concise errors with line numbers similar to Overleaf
  // Looks for lines starting with '! ' and captures following context and l.<num>
  if (!log || typeof log !== 'string') return [];
  const lines = log.split(/\r?\n/);
  const errors = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (line.startsWith('! ')) {
      // Error message line. Collect until blank line or another '! '
      const message = line.replace(/^!\s+/, '').trim();
      let detail = '';
      let foundLine = null;
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const l = lines[j];
        if (!l) break;
        // Capture the TeX l.<num> indicator
        const m = l.match(/\bl\.(\d+)\b/);
        if (m) {
          foundLine = parseInt(m[1], 10);
        }
        // Accumulate a short detail, but avoid too long lines
        if (detail.length < 300) {
          detail += (detail ? ' ' : '') + l.trim();
        }
        // stop if another error starts
        if (l.startsWith('! ')) break;
      }
      // Map to user-visible line number
      let userLine = foundLine != null ? (foundLine - headerOffsetLines) : null;
      if (userLine != null && userLine < 1) userLine = 1;
      errors.push({
        message,
        line: userLine,
        rawLine: foundLine || null,
        context: detail.trim(),
      });
    }
  }
  // De-duplicate similar messages
  const seen = new Set();
  return errors.filter(e => {
    const key = `${e.line}|${e.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function compileLatex({ code, formats = ['svg'], engine = 'lualatex' }) {
  const id = uuidv4();
  const workDir = path.join(os.tmpdir(), `latextosvg-${id}`);
  fs.mkdirSync(workDir, { recursive: true });

  const isFullDoc = /\\begin{document}/.test(code);
  const headerOffset = isFullDoc ? 0 : getHeaderLineOffset();
  const texSource = isFullDoc ? code : wrapInTemplate(code);
  const texPath = path.join(workDir, 'input.tex');
  fs.writeFileSync(texPath, texSource, 'utf8');

  const safeEngine = ['pdflatex', 'xelatex', 'lualatex'].includes(engine) ? engine : 'lualatex';

  // Run latexmk to produce PDF; quiet where possible
  const latexmkCmd = `latexmk -pdf -pdflatex="${safeEngine} -interaction=nonstopmode" -f -quiet input.tex`;
  try {
    await execCmd(latexmkCmd, { cwd: workDir });
  } catch (e) {
    const log = safeRead(path.join(workDir, 'input.log'));
    const errors = parseLatexLog(log, headerOffset);
    cleanup(workDir);
    return { ok: false, error: 'LaTeX error', log, errors };
  }

  const pdfPath = path.join(workDir, 'input.pdf');
  const result = { ok: true };

  if (formats.includes('svg')) {
    const svgPath = path.join(workDir, 'output.svg');
    // Use dvisvgm to convert from PDF via ghostscript
    const dvisvgmCmd = `dvisvgm --no-fonts --exact --pdf --output=output.svg input.pdf`;
    try {
      await execCmd(dvisvgmCmd, { cwd: workDir });
      result.svg = fs.readFileSync(svgPath, 'utf8');
    } catch (e) {
      const stderr = (e && (e.stderr || e.stdout)) || '';
      // Keep ok=true for PDF success; surface svgError but don't block
      result.svg = null;
      result.svgError = 'SVG conversion error';
      result.svgDetail = stderr;
    }
  }

  // PNG export removed by request

  // Always provide PDF as base64 (small previews; client can download)
  const pdfBuf = fs.readFileSync(pdfPath);
  result.pdfBase64 = pdfBuf.toString('base64');

  // Attach .log for debugging on errors
  result.log = safeRead(path.join(workDir, 'input.log'));
  // Parse errors even on success in case there are non-fatal errors (rare)
  const parsed = parseLatexLog(result.log, headerOffset);
  if (parsed.length) result.errors = parsed;

  // Clean temporary directory
  cleanup(workDir);
  return result;
}

function safeRead(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

function cleanup(dir) {
  try { rimraf.sync(dir); } catch { /* ignore */ }
}

module.exports = { compileLatex };
