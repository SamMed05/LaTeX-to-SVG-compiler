const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { compileLatex } = require('../server/lib/latex');

let mainWindow;

function createWindow() {
  // Remove the default application menu
  Menu.setApplicationMenu(null);

  // Resolve icon by platform
  const iconPath = path.join(__dirname, '..', 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
    },
    show: false,
    autoHideMenuBar: true,
    icon: iconPath,
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Load the local index.html
  mainWindow.loadFile(path.join(__dirname, '..', 'public', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handler to compile LaTeX using existing server logic
ipcMain.handle('compile-latex', async (_event, payload) => {
  const { code, formats = ['svg'], engine = 'lualatex' } = payload || {};
  try {
    const result = await compileLatex({ code, formats, engine });
    return result;
  } catch (err) {
    return { ok: false, error: 'Compilation failed', detail: String(err && err.message || err) };
  }
});

app.whenReady().then(() => {
  // Ensure proper app identity on Windows so taskbar icon groups correctly
  try { app.setAppUserModelId('com.samuel.latextosvg'); } catch {}
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
