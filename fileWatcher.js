const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');

class FileWatcher {
    constructor(folderPath, onFileAdded, onFileChanged, onFileRemoved) {
        this.folderPath = folderPath;
        this.onFileAdded = onFileAdded;
        this.onFileChanged = onFileChanged;
        this.onFileRemoved = onFileRemoved;
        this.watcher = null;
        this.processingFiles = new Set();
    }

    start() {
        console.log(`Starting file watcher for: ${this.folderPath}`);

        this.watcher = chokidar.watch(path.join(this.folderPath, '*.{xlsx,xls}'), {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: false, // Process existing files on start
            awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 100
            }
        });

        this.watcher
            .on('add', (filePath) => this.handleFileAdded(filePath))
            .on('change', (filePath) => this.handleFileChanged(filePath))
            .on('unlink', (filePath) => this.handleFileRemoved(filePath))
            .on('error', (error) => console.error('Watcher error:', error))
            .on('ready', () => console.log('Initial scan complete. Watching for changes...'));
    }

    async handleFileAdded(filePath) {
        // Éviter le traitement multiple
        if (this.processingFiles.has(filePath)) {
            return;
        }

        this.processingFiles.add(filePath);

        try {
            // Vérifier que le fichier existe et est accessible
            if (!fs.existsSync(filePath)) {
                console.log(`File no longer exists: ${filePath}`);
                return;
            }

            const stats = fs.statSync(filePath);
            if (stats.size === 0) {
                console.log(`File is empty: ${filePath}`);
                return;
            }

            console.log(`New file detected: ${path.basename(filePath)}`);

            if (this.onFileAdded) {
                await this.onFileAdded(filePath);
            }
        } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
        } finally {
            // Retirer après un délai pour éviter les doublons
            setTimeout(() => {
                this.processingFiles.delete(filePath);
            }, 5000);
        }
    }

    async handleFileChanged(filePath) {
        // Éviter le traitement multiple
        if (this.processingFiles.has(filePath)) {
            return;
        }

        this.processingFiles.add(filePath);

        try {
            console.log(`File modified: ${path.basename(filePath)}`);

            if (this.onFileChanged) {
                await this.onFileChanged(filePath);
            }
        } catch (error) {
            console.error(`Error processing changed file ${filePath}:`, error);
        } finally {
            setTimeout(() => {
                this.processingFiles.delete(filePath);
            }, 5000);
        }
    }

    handleFileRemoved(filePath) {
        console.log(`File removed: ${path.basename(filePath)}`);

        if (this.onFileRemoved) {
            this.onFileRemoved(filePath);
        }
    }

    stop() {
        if (this.watcher) {
            console.log('Stopping file watcher...');
            this.watcher.close();
            this.watcher = null;
        }
    }

    changeFolder(newFolderPath) {
        this.stop();
        this.folderPath = newFolderPath;
        this.start();
    }
}

module.exports = FileWatcher;
