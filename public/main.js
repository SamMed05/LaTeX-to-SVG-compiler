const editorContainer = document.getElementById('editor');
const compileBtn = document.getElementById('compileBtn');
const autoCompile = document.getElementById('autoCompile');
const svgPane = document.getElementById('svgPane');
const pdfPane = document.getElementById('pdfPane');
const errorsEl = document.getElementById('errors');
const engineSel = document.getElementById('engine');
const examplesSel = document.getElementById('examples');
const downloadPdf = document.getElementById('downloadPdf');
const downloadSvg = document.getElementById('downloadSvg');
const themeToggle = document.getElementById('themeToggle');
const splitRoot = document.getElementById('splitRoot');
const gutter = document.getElementById('gutter');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const zoomResetBtn = document.getElementById('zoomReset');
const svgWrap = document.getElementById('svgWrap');
const footerInfo = document.getElementById('footerInfo');
const footerHide = document.getElementById('footerHide');

const DEFAULT_EXAMPLES = {
  'TikZ simple': `\\begin{tikzpicture}
  \\draw[->] (-2,0) -- (2,0) node[right]{x};
  \\draw[->] (0,-2) -- (0,2) node[above]{y};
  \\draw[blue, thick] (0,0) circle (1.2cm);
  \\draw[red] (-1,-1) rectangle (1,1);
\\end{tikzpicture}`,
  'pgfplots sin(x)': `\\begin{tikzpicture}
  \\begin{axis}[
    width=9cm, height=6cm,
    xlabel=$x$, ylabel={$\\sin x$},
    samples=100
  ]
    \\addplot[domain=-6.283:6.283, blue, thick] {sin(deg(x))};
  \\end{axis}
\\end{tikzpicture}`,
  'Graph example': `\\begin{tikzpicture}[>=stealth]
  \\node (A) at (0,0) [circle,draw] {A};
  \\node (B) at (2,1) [circle,draw] {B};
  \\node (C) at (2,-1) [circle,draw] {C};
  \\draw[->] (A) -- (B);
  \\draw[->] (A) -- (C);
  \\draw[->] (B) -- (C);
\\end{tikzpicture}`
};

function populateExamples() {
  examplesSel.innerHTML = '';
  for (const key of Object.keys(DEFAULT_EXAMPLES)) {
    const opt = document.createElement('option');
    opt.value = key; opt.textContent = key; examplesSel.appendChild(opt);
  }
  examplesSel.value = 'pgfplots sin(x)';
}

let monacoEditor;
function setEditorDefault() {
  if (monacoEditor) {
    monacoEditor.setValue(DEFAULT_EXAMPLES[examplesSel.value]);
  }
}

populateExamples();

examplesSel.addEventListener('change', () => {
  setEditorDefault();
  if (autoCompile.checked) debouncedCompile();
});

let timer;
function debouncedCompile() {
  clearTimeout(timer);
  timer = setTimeout(doCompile, 400);
}

async function doCompile() {
  clearEditorMarkers();
  errorsEl.classList.add('hidden');
  errorsEl.textContent = '';
  const code = monacoEditor ? monacoEditor.getValue() : '';
  const engine = engineSel.value;
  compileBtn.disabled = true;
  compileBtn.textContent = 'Compiling…\u00A0\u00A0\u00A0\u00A0\u00A0';
  compileBtn.classList.add('is-compiling');
  let data = null;
  try {
    if (window.LatexAPI && typeof window.LatexAPI.compile === 'function') {
      // Electron path
      data = await window.LatexAPI.compile({ code, formats: ['svg'], engine });
    } else {
      // Web server path
      const res = await fetch('./api/compile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, formats: ['svg'], engine })
      });
      data = await res.json();
    }
    if (!data.ok) {
      renderErrors(data);
      return null;
    }
    // SVG preview
    if (data.svg) {
      svgWrap.innerHTML = data.svg;
      const svgBlob = new Blob([data.svg], { type: 'image/svg+xml' });
      downloadSvg.href = URL.createObjectURL(svgBlob);
      resetZoom();
    } else if (data.svgError) {
      errorsEl.textContent = `${data.svgError}. ${data.svgDetail || ''}`;
      errorsEl.classList.remove('hidden');
    }
    // PDF preview
    if (data.pdfBase64) {
      const pdfUrl = 'data:application/pdf;base64,' + data.pdfBase64;
      pdfPane.src = pdfUrl;
      downloadPdf.href = pdfUrl;
    }
    // Show warnings/errors if present even on success
    if (data.errors && data.errors.length) {
      renderErrors(data);
    } else {
      errorsEl.classList.add('hidden');
      errorsEl.textContent = '';
    }
  } catch (e) {
    errorsEl.textContent = 'Runtime error: ' + e;
    errorsEl.classList.remove('hidden');
    return null;
  } finally {
    compileBtn.disabled = false;
    compileBtn.textContent = 'Compile';
    compileBtn.classList.remove('is-compiling');
  }
  return data;
}

compileBtn.addEventListener('click', () => { void doCompile(); });
autoCompile.addEventListener('change', () => { if (autoCompile.checked) debouncedCompile(); localStorage.setItem('autoCompile', autoCompile.checked ? '1':'0'); });

// Tab switching
const tabs = Array.from(document.querySelectorAll('.tab'));
tabs.forEach(btn => btn.addEventListener('click', () => {
  tabs.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const tab = btn.dataset.tab;
  if (tab === 'svg') {
    document.getElementById('svgPane').classList.remove('hidden');
    document.getElementById('pdfPane').classList.add('hidden');
  } else {
    document.getElementById('svgPane').classList.add('hidden');
    document.getElementById('pdfPane').classList.remove('hidden');
  }
  localStorage.setItem('activeTab', tab);
}));

// PNG removed

// Resizable split logic
(function initSplit() {
  const saved = Number(localStorage.getItem('splitPct') || 50);
  applySplit(saved);
  let dragging = false;
  function onMove(clientX) {
    const rect = splitRoot.getBoundingClientRect();
    const pct = Math.max(20, Math.min(80, ((clientX - rect.left) / rect.width) * 100));
    applySplit(pct);
    localStorage.setItem('splitPct', String(pct));
  }
  gutter.addEventListener('mousedown', (e) => { dragging = true; e.preventDefault(); });
  window.addEventListener('mousemove', (e) => { if (dragging) onMove(e.clientX); });
  window.addEventListener('mouseup', () => { dragging = false; });
  gutter.addEventListener('keydown', (e) => {
    const current = Number(localStorage.getItem('splitPct') || 50);
    if (e.key === 'ArrowLeft') { applySplit(Math.max(20, current - 2)); }
    if (e.key === 'ArrowRight') { applySplit(Math.min(80, current + 2)); }
  });
  function applySplit(pct) {
    splitRoot.style.gridTemplateColumns = `${pct}% 6px ${100 - pct}%`;
    // layout change -> relayout monaco
    if (monacoEditor) monacoEditor.layout();
  }
})();

// Theme toggle
function setTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  if (window.monaco) monaco.editor.setTheme(dark ? 'vs-dark' : 'vs');
}
themeToggle.addEventListener('click', () => setTheme(!document.documentElement.classList.contains('dark')));

// Monaco setup via AMD loader
require.config({ paths: { 'vs': window.MONACO_BASE_URL + '/vs' } });
require(['vs/editor/editor.main'], () => {
  // Minimal LaTeX language registration for highlighting
  monaco.languages.register({ id: 'latex' });
  monaco.languages.setMonarchTokensProvider('latex', {
    tokenizer: {
      root: [
        [/%.*/, 'comment'],
        [/\\\[/, 'delimiter.square'],
        [/\\\]/, 'delimiter.square'],
        [/\\\(/, 'delimiter.parenthesis'],
        [/\\\)/, 'delimiter.parenthesis'],
        [/\\[a-zA-Z@]+\*?/, 'keyword'],
        [/\{[^}]*\}/, 'string'],
        [/\$\$|\$|\\\(|\\\)/, 'delimiter'],
      ]
    }
  });
  monaco.languages.setLanguageConfiguration('latex', {
    comments: { lineComment: '%' },
    brackets: [ ['{','}'], ['[',']'], ['(',')'] ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '"', close: '"', notIn: ['string'] },
      { open: "'", close: "'", notIn: ['string'] }
    ]
  });
  const initialTheme = (localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light')) === 'dark';
  setTheme(initialTheme);
  const savedCode = localStorage.getItem('code');
  monacoEditor = monaco.editor.create(editorContainer, {
    value: savedCode || DEFAULT_EXAMPLES['pgfplots sin(x)'],
    language: 'latex',
    automaticLayout: true,
    fontSize: 14,
    minimap: { enabled: false },
    wordWrap: 'on'
  });
  // engine
  const savedEngine = localStorage.getItem('engine');
  if (savedEngine) engineSel.value = savedEngine;
  // auto
  autoCompile.checked = (localStorage.getItem('autoCompile') || '1') === '1';
  // tab
  const savedTab = localStorage.getItem('activeTab') || 'svg';
  const btn = document.querySelector(`.tab[data-tab="${savedTab}"]`);
  if (btn) btn.click();
  // Editor change
  monacoEditor.onDidChangeModelContent(() => {
    localStorage.setItem('code', monacoEditor.getValue());
    if (autoCompile.checked) debouncedCompile();
  });
  engineSel.addEventListener('change', () => { localStorage.setItem('engine', engineSel.value); if (autoCompile.checked) debouncedCompile(); });
  // Examples
  examplesSel.addEventListener('change', () => {
    setEditorDefault(); localStorage.setItem('code', monacoEditor.getValue());
  });
  // First compile
  doCompile();
});

function renderErrors(payload) {
  const errs = (payload && payload.errors) || [];
  if (errs.length && monacoEditor) {
    // Create markers
    const model = monacoEditor.getModel();
    const markers = errs.filter(e => Number.isInteger(e.line) && e.line > 0).map(e => ({
      severity: monaco.MarkerSeverity.Error,
      message: e.message,
      startLineNumber: e.line,
      startColumn: 1,
      endLineNumber: e.line,
      endColumn: 1000,
      source: 'LaTeX'
    }));
    monaco.editor.setModelMarkers(model, 'latex-compile', markers);
  }
  // Build concise HTML list similar to Overleaf
  const list = document.createElement('div');
  // normal flow wrapping for readable messages
  list.style.whiteSpace = 'normal';
  const cleanText = (s) => {
    if (!s || typeof s !== 'string') return '';
    // collapse all whitespace (including newlines) and trim
    let t = s.replace(/\s+/g, ' ').trim();
    // remove stray spaces before punctuation
    t = t.replace(/\s+([),.;:])/g, '$1');
    return t;
  };
  if (errs.length) {
    const ul = document.createElement('ul');
    ul.style.paddingLeft = '1rem';
    errs.slice(0, 10).forEach((e, idx) => {
      const li = document.createElement('li');
      const lineText = Number.isInteger(e.line) ? ` (line ${e.line})` : (e.rawLine ? ` (log line ${e.rawLine})` : '');
      const msg = document.createElement('div');
      msg.textContent = cleanText(e.message) + lineText;
      li.appendChild(msg);
      if (e.context) {
        const ctx = document.createElement('div');
        ctx.style.opacity = '0.8';
        ctx.style.fontSize = '0.9em';
        ctx.textContent = cleanText(e.context).slice(0, 300);
        li.appendChild(ctx);
      }
      ul.appendChild(li);
    });
    list.appendChild(ul);
  }
  errorsEl.innerHTML = '';
  if (errs.length === 0) {
    // Fallback to raw log if provided
    const pre = document.createElement('pre');
    pre.style.margin = '0';
    const title = (payload && payload.error) ? (payload.error + '\n') : '';
    pre.textContent = title + (payload.log || payload.detail || '');
    errorsEl.appendChild(pre);
  } else {
    errorsEl.appendChild(list);
  }
  errorsEl.classList.remove('hidden');
}

function clearEditorMarkers() {
  if (!monacoEditor || !window.monaco) return;
  const model = monacoEditor.getModel();
  monaco.editor.setModelMarkers(model, 'latex-compile', []);
}

// Zoom and pan for SVG pane
let zoom = 1;
let panX = 0, panY = 0;
function applyTransform() {
  svgWrap.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  if (zoomResetBtn) zoomResetBtn.textContent = Math.round(zoom * 100) + '%';
}
function resetZoom() { zoom = 1; panX = 0; panY = 0; applyTransform(); }
if (zoomInBtn && zoomOutBtn && zoomResetBtn) {
  zoomInBtn.addEventListener('click', () => { zoom = Math.min(5, zoom * 1.2); applyTransform(); });
  zoomOutBtn.addEventListener('click', () => { zoom = Math.max(0.2, zoom / 1.2); applyTransform(); });
  zoomResetBtn.addEventListener('click', () => { resetZoom(); });
}
svgPane.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return; // require ctrl+wheel to zoom
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  zoom = Math.min(5, Math.max(0.2, zoom * factor));
  applyTransform();
}, { passive: false });
let dragging = false; let lastX=0, lastY=0;
svgPane.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; svgPane.style.cursor = 'grabbing'; });
window.addEventListener('mousemove', (e) => { if (!dragging) return; panX += (e.clientX - lastX); panY += (e.clientY - lastY); lastX = e.clientX; lastY = e.clientY; applyTransform(); });
window.addEventListener('mouseup', () => { dragging = false; svgPane.style.cursor = 'default'; });

// Footer hide
if (footerHide) footerHide.addEventListener('click', () => {
  footerInfo.classList.add('hidden');
  document.body.classList.add('footer-hidden');
});
