const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store').default || require('electron-store');
const DataManager = require('./database');
const FileWatcher = require('./fileWatcher');
const DataExtractor = require('./dataExtractor');

const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

const store = new Store();

let mainWindow;
let dataManager;
let fileWatcher;
let dataExtractor;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        frame: false,
        backgroundColor: '#f5f5f7',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'logo.png'),
        show: false,
        titleBarStyle: 'hidden',
        roundedCorners: true
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();

        // Vérifier si un dossier est configuré
        const watchFolder = store.get('watchFolder');
        if (!watchFolder) {
            // Demander à l'utilisateur de sélectionner un dossier
            setTimeout(() => {
                mainWindow.webContents.send('request-folder-selection');
            }, 3500); // Après le splash screen
        } else {
            // Démarrer la surveillance
            startWatching(watchFolder);
            mainWindow.webContents.send('folder-selected', watchFolder);
        }
    });

    // Window controls
    ipcMain.on('window-minimize', () => mainWindow.minimize());
    ipcMain.on('window-maximize', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });
    ipcMain.on('window-close', () => mainWindow.close());

    // Relaunch app
    ipcMain.on('relaunch-app', () => {
        app.relaunch();
        app.exit(0);
    });

    // Open external URLs
    ipcMain.handle('open-external', async (event, url) => {
        const { shell } = require('electron');
        await shell.openExternal(url);
        return { success: true };
    });

    mainWindow.on('closed', () => {
        if (fileWatcher) fileWatcher.stop();
        if (dataManager) dataManager.close();
        mainWindow = null;
    });
}

// Sélection de dossier
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Sélectionner le dossier contenant vos fichiers Excel'
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        store.set('watchFolder', folderPath);

        // Démarrer la surveillance
        startWatching(folderPath);

        return { success: true, path: folderPath };
    }

    return { success: false };
});

// Changer de dossier
ipcMain.handle('change-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Sélectionner un nouveau dossier'
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        store.set('watchFolder', folderPath);

        // Redémarrer la surveillance
        if (fileWatcher) {
            fileWatcher.changeFolder(folderPath);
        } else {
            startWatching(folderPath);
        }

        return { success: true, path: folderPath };
    }

    return { success: false };
});

// Démarrer la surveillance du dossier
function startWatching(folderPath) {
    console.log(`Starting to watch folder: ${folderPath}`);

    // Initialiser le gestionnaire de base de données
    if (!dataManager) {
        dataManager = new DataManager();
    }

    // Initialiser l'extracteur de données
    if (!dataExtractor) {
        dataExtractor = new DataExtractor(dataManager);
    }

    // Callbacks pour le file watcher
    const onFileAdded = async (filePath) => {
        console.log(`File added: ${filePath}`);
        const result = await dataExtractor.processFile(filePath);

        if (result.success && !result.skipped) {
            mainWindow.webContents.send('file-imported', result);
            mainWindow.webContents.send('refresh-dashboard');
        }
    };

    const onFileChanged = async (filePath) => {
        console.log(`File changed: ${filePath}`);
        const result = await dataExtractor.processFile(filePath);

        if (result.success && !result.skipped) {
            mainWindow.webContents.send('file-updated', result);
            mainWindow.webContents.send('refresh-dashboard');
        }
    };

    const onFileRemoved = (filePath) => {
        console.log(`File removed: ${filePath}`);
        mainWindow.webContents.send('file-removed', { filepath: filePath });
    };

    // Démarrer le file watcher
    if (fileWatcher) {
        fileWatcher.stop();
    }

    fileWatcher = new FileWatcher(folderPath, onFileAdded, onFileChanged, onFileRemoved);
    fileWatcher.start();

    // Process existing files immediately
    console.log('Processing existing Excel files...');
    dataExtractor.processExistingFiles(folderPath).then(() => {
        console.log('Initial file processing complete');
        mainWindow.webContents.send('refresh-dashboard');
    });
}

// API pour obtenir les données
ipcMain.handle('get-all-files', () => {
    if (!dataManager) return [];
    return dataManager.getAllFiles();
});

ipcMain.handle('get-global-stats', () => {
    if (!dataManager) return { total_files: 0, total_rows: 0 };
    return dataManager.getGlobalStats();
});

ipcMain.handle('get-all-data', (event, limit, offset) => {
    if (!dataManager) return [];
    return dataManager.getAllData(limit, offset);
});

ipcMain.handle('get-all-columns', () => {
    if (!dataManager) return [];
    return dataManager.getAllColumns();
});

ipcMain.handle('execute-query', (event, sql, params) => {
    if (!dataManager) return [];
    return dataManager.executeQuery(sql, params);
});

ipcMain.handle('get-watch-folder', () => {
    return store.get('watchFolder', null);
});

// License Management IPC Handlers
ipcMain.handle('get-license', async () => {
    return store.get('license', null);
});

ipcMain.handle('save-license', async (event, licenseData) => {
    store.set('license', licenseData);
    return { success: true };
});

ipcMain.handle('remove-license', async () => {
    store.delete('license');
    return { success: true };
});

// Auto-updater events
autoUpdater.on('update-available', () => {
    log.info('Update available.');
    mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
    log.info('Update downloaded.');
    mainWindow.webContents.send('update-downloaded');
});

autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater. ' + err);
});

// Auto-updater IPC
ipcMain.handle('check-for-updates', () => {
    if (process.env.NODE_ENV !== 'development') {
        autoUpdater.checkForUpdatesAndNotify();
    }
});

ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall();
});

// App lifecycle
app.whenReady().then(() => {
    createWindow();
    if (process.env.NODE_ENV !== 'development') {
        autoUpdater.checkForUpdatesAndNotify();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
