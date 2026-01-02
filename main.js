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
console.log('[AUTO-UPDATE] Initializing auto-updater...');

// Remote Logging Configuration
const SUPABASE_URL = 'https://achepsojutmuctpmedxg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjaGVwc29qdXRtdWN0cG1lZHhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NTY0NTEsImV4cCI6MjA4MTEzMjQ1MX0.MvIga1zaVsl4qADTIhHpPpaSQ99PpVitcAH0io6fVoE';

async function sendToRemoteLog(logData) {
    try {
        // Use global fetch (available in modern Electron)
        await fetch(`${SUPABASE_URL}/rest/v1/app_debug_logs`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                level: logData.level || 'info',
                message: logData.message || '',
                stack: logData.stack || null,
                version: app.getVersion(),
                machine_id: process.platform,
                context: {
                    arch: process.arch,
                    time: logData.time,
                    ...logData.context
                }
            })
        });
    } catch (error) {
        console.error('[REMOTE-LOG] Error sending log:', error);
    }
}

// Configure update feed (GitHub Releases)
autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'CodeVanta344',
    repo: 'CodeVanta-XLS'
});
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
console.log('[AUTO-UPDATE] Feed URL configured for CodeVanta344/CodeVanta-XLS');

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

        // TEMPORAIRE: Ouvrir DevTools pour déboguer l'auto-update
        mainWindow.webContents.openDevTools();

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

    // DEBUG & Client Logging (Forwarded to Supabase)
    ipcMain.on('log', (event, data) => {
        const { level, message } = data;
        const formattedMessage = `[RENDERER] ${message}`;

        // Log to console for dev
        console.log(formattedMessage);

        // Log to file using electron-log for local debug if needed, 
        // but primary focus is remote for "rouge" errors
        if (level === 'error') {
            log.error(formattedMessage);
            sendToRemoteLog(data); // Send critical errors to remote
        } else if (level === 'warn') {
            log.warn(formattedMessage);
            sendToRemoteLog(data); // Send warnings to remote
        } else {
            log.info(formattedMessage);
        }
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
        properties: ['openDirectory', 'createDirectory'],
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
        properties: ['openDirectory', 'createDirectory'],
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
    dataExtractor.processExistingFiles(folderPath, (result) => {
        if (result.success) {
            console.log(`[STARTUP] Emitting data for: ${result.filename}`);
            mainWindow.webContents.send('file-imported', result);
            mainWindow.webContents.send('refresh-dashboard');
        }
    }).then(() => {
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

// Parse Excel file manually (from Import Button)
ipcMain.handle('parse-excel-file', async (event, filePath) => {
    console.log('[IPC] Manual file parse requested:', filePath);

    // Ensure DataManager is initialized
    if (!dataManager) {
        dataManager = new DataManager();
    }

    // Ensure DataExtractor is initialized
    if (!dataExtractor) {
        dataExtractor = new DataExtractor(dataManager);
    }

    try {
        const result = await dataExtractor.processFile(filePath);
        if (result.success) {
            // Notify frontend
            mainWindow.webContents.send('file-imported', result);
            mainWindow.webContents.send('refresh-dashboard');
            return { success: true };
        } else {
            return { success: false, error: result.error };
        }
    } catch (error) {
        console.error('IPC parse error:', error);
        return { success: false, error: error.message };
    }
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
autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...');
    console.log('[AUTO-UPDATE] Checking for update...');
    sendToRemoteLog({ level: 'info', message: 'Checking for update...', context: { event: 'checking-for-update' } });
});

autoUpdater.on('update-available', (info) => {
    log.info('Update available.', info);
    console.log('[AUTO-UPDATE] Update available:', info);
    sendToRemoteLog({ level: 'info', message: `Update available: ${info.version}`, context: { event: 'update-available', info } });
    mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available.', info);
    console.log('[AUTO-UPDATE] No update available:', info);
    sendToRemoteLog({ level: 'info', message: 'No update available', context: { event: 'update-not-available', info } });
});

autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded.', info);
    console.log('[AUTO-UPDATE] Update downloaded:', info);
    sendToRemoteLog({ level: 'info', message: `Update downloaded: ${info.version}`, context: { event: 'update-downloaded', info } });
    mainWindow.webContents.send('update-downloaded');
});

autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater:', err);
    console.error('[AUTO-UPDATE] Error:', err);
    sendToRemoteLog({
        level: 'error',
        message: `Auto-updater error: ${err.message || err}`,
        stack: err.stack,
        context: { event: 'error' }
    });
});

// Auto-updater IPC
ipcMain.handle('check-for-updates', () => {
    // TEMPORAIRE: Activé pour tester les mises à jour en dev
    // if (process.env.NODE_ENV !== 'development') {
    autoUpdater.checkForUpdatesAndNotify();
    // }
});

ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall();
});

// App lifecycle
app.whenReady().then(() => {
    createWindow();

    // Connectivity Test
    sendToRemoteLog({
        level: 'info',
        message: 'App started and testing Supabase connectivity',
        context: { event: 'startup-test' }
    }).then(() => console.log('[REMOTE-LOG] Startup test sent'));

    // Check for updates after window is ready
    setTimeout(() => {
        console.log('[AUTO-UPDATE] Starting update check...');
        log.info('Starting update check...');

        // Send visible message to renderer
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('update-check-started');
        }

        try {
            autoUpdater.checkForUpdatesAndNotify();
            console.log('[AUTO-UPDATE] checkForUpdatesAndNotify() called successfully');
        } catch (error) {
            console.error('[AUTO-UPDATE] Error calling checkForUpdatesAndNotify():', error);
            log.error('Error calling checkForUpdatesAndNotify():', error);
        }
    }, 3000); // Wait 3 seconds after window creation
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
