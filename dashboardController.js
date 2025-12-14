// Dashboard Controller
class DashboardController {
    constructor() {
        this.currentView = 'dashboard';
        this.watchFolder = null;
        this.files = [];
        this.stats = { total_files: 0, total_rows: 0 };
    }

    async initialize() {
        // Écouter les événements Electron
        if (window.electronAPI) {
            window.electronAPI.onRequestFolderSelection(() => {
                this.showFolderSelectionModal();
            });

            window.electronAPI.onFolderSelected((path) => {
                this.watchFolder = path;
                this.hideFolderSelectionModal();
                this.loadDashboard();
            });

            window.electronAPI.onFileImported((data) => {
                this.showNotification(`Fichier importé: ${data.filename}`, 'success');
                this.refreshDashboard();
            });

            window.electronAPI.onFileUpdated((data) => {
                this.showNotification(`Fichier mis à jour: ${data.filename}`, 'info');
                this.refreshDashboard();
            });

            window.electronAPI.onRefreshDashboard(() => {
                this.refreshDashboard();
            });

            // Vérifier si un dossier est déjà configuré
            const folder = await window.electronAPI.getWatchFolder();
            if (folder) {
                this.watchFolder = folder;
                this.loadDashboard();
            }
        }
    }

    showFolderSelectionModal() {
        const modal = document.getElementById('folder-selection-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    hideFolderSelectionModal() {
        const modal = document.getElementById('folder-selection-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    async selectFolder() {
        const folder = await window.electronAPI.selectFolder();
        if (folder) {
            this.watchFolder = folder;
            this.loadDashboard();
        }
    }

    async changeFolder() {
        const folder = await window.electronAPI.changeFolder();
        if (folder) {
            this.watchFolder = folder;
            this.refreshDashboard();
        }
    }

    async loadDashboard() {
        try {
            await this.refreshDashboard();
        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showNotification('Erreur lors du chargement du dashboard', 'error');
        }
    }

    async refreshDashboard() {
        if (!window.electronAPI) return;

        try {
            // Charger les fichiers
            this.files = await window.electronAPI.getAllFiles();

            // Charger les statistiques
            this.stats = await window.electronAPI.getGlobalStats();

            // Mettre à jour l'interface
            this.updateStatsCards();
            this.updateFilesList();

            // Charger les fichiers dans les onglets
            await this.loadFilesIntoTabs();

            // Charger les données pour les graphiques
            await this.updateCharts();

            // Mettre à jour le chemin du dossier
            this.updateFolderPath();

        } catch (error) {
            console.error('Error refreshing dashboard:', error);
            this.showNotification(`Erreur chargement: ${error.message}`, 'error');
        }
    }

    async loadFilesIntoTabs() {
        // Charger chaque fichier dans un onglet
        if (this.files.length > 0 && typeof addFileTab === 'function') {
            for (const file of this.files) {
                // Charger les données du fichier
                const allData = await window.electronAPI.getAllData(1000, 0);
                const fileData = allData.filter(row => row.filename === file.filename);

                if (fileData.length > 0) {
                    // Transformer en format tableau
                    const firstRow = fileData[0].row_data;
                    const headers = Object.keys(firstRow);
                    const rows = fileData.map(d => Object.values(d.row_data));
                    const formattedData = [headers, ...rows];

                    // Ajouter l'onglet
                    addFileTab({
                        filename: file.filename,
                        data: formattedData
                    });
                }
            }
        }
    }

    updateStatsCards() {
        const totalFilesEl = document.getElementById('stat-total-files');
        const totalRowsEl = document.getElementById('stat-total-rows');
        const lastImportEl = document.getElementById('stat-last-import');

        if (totalFilesEl) {
            totalFilesEl.textContent = (this.stats.total_files || 0).toLocaleString();
        }

        if (totalRowsEl) {
            totalRowsEl.textContent = (this.stats.total_rows || 0).toLocaleString();
        }

        if (lastImportEl && this.stats.last_import) {
            const date = new Date(this.stats.last_import);
            lastImportEl.textContent = date.toLocaleDateString('fr-FR');
        }
    }

    updateFilesList() {
        const filesListEl = document.getElementById('files-list');
        if (!filesListEl) return;

        if (this.files.length === 0) {
            filesListEl.innerHTML = '<p class="empty-state">Aucun fichier importé. Ajoutez des fichiers .xlsx dans le dossier surveillé.</p>';
            return;
        }

        filesListEl.innerHTML = this.files.map(file => `
            <div class="file-item">
                <div class="file-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="file-info">
                    <div class="file-name">${file.filename}</div>
                    <div class="file-meta">${file.row_count} lignes • Importé le ${new Date(file.import_date).toLocaleDateString('fr-FR')}</div>
                </div>
                <div class="file-status ${file.status}">${file.status === 'imported' ? 'Importé' : file.status}</div>
            </div>
        `).join('');
    }

    async updateCharts() {
        // Pour l'instant, créer un graphique simple montrant le nombre de lignes par fichier
        const chartCanvas = document.getElementById('files-chart');
        if (!chartCanvas) return;

        const ctx = chartCanvas.getContext('2d');

        // Détruire le graphique existant
        if (this.filesChart) {
            this.filesChart.destroy();
        }

        // Préparer les données
        const labels = this.files.slice(0, 10).map(f => f.filename.substring(0, 20));
        const data = this.files.slice(0, 10).map(f => f.row_count);

        try {
            this.filesChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Nombre de lignes',
                        data: data,
                        backgroundColor: 'rgba(0, 122, 255, 0.5)',
                        borderColor: 'rgba(0, 122, 255, 1)',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        } catch (err) {
            console.error('Failed to create chart:', err);
        }
    }

    updateFolderPath() {
        const folderPathEl = document.getElementById('current-folder-path');
        if (folderPathEl && this.watchFolder) {
            folderPathEl.textContent = this.watchFolder;
        }
    }

    showNotification(message, type = 'info') {
        // Créer une notification toast
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Animation d'entrée
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Retirer après 3 secondes
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    switchView(view) {
        this.currentView = view;

        // Mettre à jour la navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-view="${view}"]`)?.classList.add('active');

        // Afficher la vue correspondante
        document.querySelectorAll('section[id$="-section"]').forEach(section => {
            section.classList.add('hidden');
        });
        document.getElementById(`${view}-section`)?.classList.remove('hidden');

        if (view === 'dashboard') {
            this.refreshDashboard();
        } else if (view === 'data') {
            this.loadDataView();
        }
    }

    async loadDataView() {
        // Charger les données brutes dans le tableau
        if (!window.electronAPI) return;

        const data = await window.electronAPI.getAllData(100, 0);

        // Utiliser la fonction existante displayData
        if (data.length > 0) {
            // Transformer les données pour le format attendu
            const firstRow = data[0].row_data;
            const headers = Object.keys(firstRow);
            const rows = data.map(d => Object.values(d.row_data));

            const formattedData = [headers, ...rows];
            // Update global state for app.js functions (sort, filter, etc.)
            if (typeof window !== 'undefined') {
                window.currentSheet = formattedData;
                window.workbookData = formattedData; // Also update workbookData for consistency
            }

            if (typeof displayData === 'function') {
                displayData(formattedData);
            }
        }
    }
}

// Initialiser le dashboard au chargement
const dashboardController = new DashboardController();
