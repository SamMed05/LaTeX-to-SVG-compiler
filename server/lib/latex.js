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

function wrapInTemplate(content) {
  // standalone class keeps output tightly cropped; tikz and pgfplots need packages
  return `\\documentclass[tikz, border=2pt]{standalone}
\\usepackage{pgfplots}
\\pgfplotsset{compat=1.18}
\\begin{document}
${content}
\\end{document}\n`;
}

async function compileLatex({ code, formats = ['svg'], engine = 'lualatex' }) {
  const id = uuidv4();
  const workDir = path.join(os.tmpdir(), `latextosvg-${id}`);
  fs.mkdirSync(workDir, { recursive: true });

  const isFullDoc = /\\begin{document}/.test(code);
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
    cleanup(workDir);
    return { ok: false, log, error: 'LaTeX error' };
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
