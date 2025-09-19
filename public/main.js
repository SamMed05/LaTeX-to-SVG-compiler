const editor = document.getElementById('editor');
const compileBtn = document.getElementById('compileBtn');
const autoCompile = document.getElementById('autoCompile');
const svgPane = document.getElementById('svgPane');
const pdfPane = document.getElementById('pdfPane');
const errorsEl = document.getElementById('errors');
const engineSel = document.getElementById('engine');
const examplesSel = document.getElementById('examples');
const downloadPdf = document.getElementById('downloadPdf');
const downloadSvg = document.getElementById('downloadSvg');

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

function setEditorDefault() {
  editor.value = DEFAULT_EXAMPLES[examplesSel.value];
}

populateExamples();
setEditorDefault();

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
  errorsEl.classList.add('hidden');
  errorsEl.textContent = '';
  const code = editor.value;
  const engine = engineSel.value;
  compileBtn.disabled = true;
  compileBtn.textContent = 'Compiling…';
  try {
    const res = await fetch('/api/compile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, format: 'svg', engine })
    });
    const data = await res.json();
    if (!data.ok) {
      errorsEl.textContent = (data.error || 'Error') + '\n' + (data.log || data.detail || '');
      errorsEl.classList.remove('hidden');
      return;
    }
    // SVG preview
    if (data.svg) {
      svgPane.innerHTML = data.svg;
      const svgBlob = new Blob([data.svg], { type: 'image/svg+xml' });
      downloadSvg.href = URL.createObjectURL(svgBlob);
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
  } catch (e) {
    errorsEl.textContent = 'Network or server error: ' + e;
    errorsEl.classList.remove('hidden');
  } finally {
    compileBtn.disabled = false;
    compileBtn.textContent = 'Compile';
  }
}

compileBtn.addEventListener('click', doCompile);
editor.addEventListener('input', () => { if (autoCompile.checked) debouncedCompile(); });
autoCompile.addEventListener('change', () => { if (autoCompile.checked) debouncedCompile(); });

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
}));

// Initial compile
doCompile();
