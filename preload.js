const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Utilities
    getPathForFile: (file) => webUtils.getPathForFile(file),
    log: (msg) => ipcRenderer.send('log', msg),

    // Window controls
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    relaunchApp: () => ipcRenderer.send('relaunch-app'),

    // Folder selection
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    changeFolder: () => ipcRenderer.invoke('change-folder'),
    getWatchFolder: () => ipcRenderer.invoke('get-watch-folder'),

    // Data access
    getAllFiles: () => ipcRenderer.invoke('get-all-files'),
    getGlobalStats: () => ipcRenderer.invoke('get-global-stats'),
    getAllData: (limit, offset) => ipcRenderer.invoke('get-all-data', limit, offset),
    getAllColumns: () => ipcRenderer.invoke('get-all-columns'),
    executeQuery: (sql, params) => ipcRenderer.invoke('execute-query', sql, params),

    // Import
    parseFile: (path) => ipcRenderer.invoke('parse-excel-file', path),

    // License management
    getLicense: () => ipcRenderer.invoke('get-license'),
    saveLicense: (licenseData) => ipcRenderer.invoke('save-license', licenseData),
    removeLicense: () => ipcRenderer.invoke('remove-license'),

    // External links
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // Events
    onRequestFolderSelection: (callback) => ipcRenderer.on('request-folder-selection', callback),
    onFolderSelected: (callback) => ipcRenderer.on('folder-selected', (event, path) => callback(path)),
    onFileImported: (callback) => ipcRenderer.on('file-imported', (event, data) => callback(data)),
    onFileUpdated: (callback) => ipcRenderer.on('file-updated', (event, data) => callback(data)),
    onFileRemoved: (callback) => ipcRenderer.on('file-removed', (event, data) => callback(data)),
    onFileRemoved: (callback) => ipcRenderer.on('file-removed', (event, data) => callback(data)),
    onRefreshDashboard: (callback) => ipcRenderer.on('refresh-dashboard', callback),

    // Auto Update
    onUpdateCheckStarted: (callback) => ipcRenderer.on('update-check-started', callback),
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install')
});

