# LaTeX TikZ/pgfplots to SVG & PDF <img src="public/favicon.svg" type="image/svg+xml" alt="Icon" width="130" align="right" />

A simple local tool to compile LaTeX snippets (TikZ, pgfplots, etc.) and preview/download the resulting SVG and PDF.

Now supports a zero-config desktop app (Electron) and a classic local web server.

## Features

- Desktop app (no separate server needed)
- Side-by-side editor and preview
- Engines: LuaLaTeX, XeLaTeX, pdfLaTeX
- Wraps snippets in a minimal `standalone` document when needed
- Returns inline SVG and base64 PDF for preview and download

## Requirements (both modes)

- LaTeX distribution (MiKTeX/TeX Live)
- Tools in PATH: `latexmk`, `lualatex`/`xelatex`/`pdflatex`, `dvisvgm`, and Ghostscript (`gswin64c`) for PDF→SVG
- Node.js 18+ (required to run from source or build the installer; not required for end users once installed)

## Run as a desktop app (Electron)

The desktop build compiles LaTeX locally within the app. No server to start.

1. Install dependencies

```pwsh
npm install
```

2. Launch the desktop app (dev)

```pwsh
npm run electron:dev
```

3. Build a one‑click Windows installer

```pwsh
npm run electron:build
```

This produces the installer: `dist\\LaTeX to SVG Setup 0.1.0.exe`

To build a standalone portable EXE (no install):

```pwsh
npm run electron:build:portable
```

This produces the single-file portable exe: `dist\\LaTeX-to-SVG-<version>-win-x64-exe`

Notes:

- The app menu bar is removed; the window/taskbar icon is generated from `public/favicon.svg`.
- Icons are generated automatically during build. You can regenerate them manually with:

```pwsh
npm run icons
```

### Monaco editor

Monaco is bundled locally under `public/monaco` and is loaded from `./monaco`. If you want to refresh Monaco to a new version, either commit updated files or add a script to copy from `node_modules/monaco-editor/min` into `public/monaco` and run it before packaging.

## Run as a local web server

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

## Troubleshooting

- `latexmk`/`dvisvgm` not found: ensure your LaTeX distribution added its bin folders to PATH (you may need to restart your shell). On Windows, Ghostscript adds `gswin64c.exe` to PATH.
- MiKTeX missing packages: allow on‑the‑fly installation in MiKTeX Console, or preinstall required packages.
- Offline Monaco editor: Monaco is bundled locally in `public/monaco` and loads from `./monaco` folder.

## Security notes

- LaTeX can execute shell commands. This app does NOT enable `--shell-escape`. Keep usage local/trusted.
- No user code is persisted; temporary directories are cleaned after each compile.

## License

MIT
