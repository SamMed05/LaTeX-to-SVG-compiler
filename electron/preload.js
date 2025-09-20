const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('LatexAPI', {
  compile: async ({ code, formats = ['svg'], engine = 'lualatex' }) => {
    return await ipcRenderer.invoke('compile-latex', { code, formats, engine });
  }
});
