# LaTeX TikZ/pgfplots to SVG & PDF <img src="public/favicon.svg" type="image/svg+xml" alt="Icon" width="130" align="right" />

A simple local web app to compile LaTeX snippets (TikZ, pgfplots, etc.) and preview/download the resulting SVG and PDF.

Note: The server must have a LaTeX distribution installed with `latexmk` and `dvisvgm` available in PATH. On Windows, install MiKTeX and MikTeX Console to add packages on first run; also install Ghostscript for dvisvgm PDF support.

## Features

- Side-by-side editor and preview
- Supports engines: LuaLaTeX, XeLaTeX, pdfLaTeX
- Wraps snippets in a minimal `standalone` document if needed
- Returns inline SVG and base64 PDF for preview and download

## Requirements

- Node.js 18+
- LaTeX distribution (MiKTeX/TeX Live)
- Tools in PATH: `latexmk`, `lualatex`/`xelatex`/`pdflatex`, `dvisvgm`, and Ghostscript (`gswin64c`) for PDF→SVG

## Run locally

1. Install dependencies

```pwsh
npm install
```

2. Start the server

```pwsh
npm run start
```

Open <http://localhost:3000> in your browser.

If MiKTeX prompts for package installation the first time, allow it. If `dvisvgm` complains about Ghostscript, install it and ensure `gswin64c.exe` is on PATH.

## Security notes

- This server executes LaTeX, which can run dangerous shell-escape commands. We do not enable `--shell-escape`. Keep this app local or behind a trusted network.
- Requests are not persisted; temporary directories are cleaned after each compile.

## License
MIT
