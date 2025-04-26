const { contextBridge, ipcRenderer } = require('electron');

const validChannels = [
  'select-app',
  'handle-drop',
  'load-directory',
  'open-folder',
  'get-app-icon',
  'extract-asar',
  'restore-asar',
  'get-theme',
  'theme-changed',
  'console-log'
];

contextBridge.exposeInMainWorld('electron', {
  selectApp: () => ipcRenderer.invoke('select-app'),
  handleDrop: (filePath) => ipcRenderer.invoke('handle-drop', filePath),
  loadDirectory: (dirPath) => ipcRenderer.invoke('load-directory', dirPath),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  getAppIcon: (iconPath) => ipcRenderer.invoke('get-app-icon', iconPath),
  extractAsar: (asarPath) => ipcRenderer.invoke('extract-asar', asarPath),
  restoreAsar: (originalPath) => ipcRenderer.invoke('restore-asar', originalPath),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  onThemeChange: (callback) => {
    ipcRenderer.on('theme-changed', callback);
    return () => ipcRenderer.removeListener('theme-changed', callback);
  },
  onLog: (callback) => {
    ipcRenderer.on('console-log', callback);
    return () => ipcRenderer.removeListener('console-log', callback);
  },
  removeLogListener: (callback) => {
    ipcRenderer.removeListener('console-log', callback);
  }
}); 