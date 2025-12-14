/* File Tabs System - Visual tabs for each imported Excel file */

let openFiles = []; // Array of {id, name, data, active}
let activeFileId = null;

// Initialize file tabs system
function initializeFileTabs() {
    // Listen for file imports from dashboard
    if (window.electronAPI) {
        window.electronAPI.onFileImported((fileInfo) => {
            addFileTab(fileInfo);
        });
    }
}

// Add a new file tab
function addFileTab(fileInfo) {
    // Check if file already exists
    const existingFile = openFiles.find(f => f.name === fileInfo.filename);
    if (existingFile) {
        console.log(`File tab already exists: ${fileInfo.filename}`);
        switchToFile(existingFile.id);
        return;
    }

    const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    openFiles.push({
        id: fileId,
        name: fileInfo.filename || 'Nouveau fichier',
        data: fileInfo.data || null,
        active: true
    });

    // Deactivate other tabs
    openFiles.forEach(f => {
        if (f.id !== fileId) f.active = false;
    });

    activeFileId = fileId;
    renderFileTabs();

    // Switch to data view
    if (typeof switchTab === 'function') {
        switchTab('data');
    }

    // Display file data
    if (fileInfo.data) {
        workbookData = fileInfo.data;
        window.currentSheet = fileInfo.data;
        displayData(fileInfo.data);
        showDataSection();
    }
}

// Render file tabs UI
function renderFileTabs() {
    let tabsContainer = document.getElementById('file-tabs-container');

    if (!tabsContainer) {
        // Create tabs container if it doesn't exist
        const dataSection = document.getElementById('data-section');
        if (!dataSection) return;

        tabsContainer = document.createElement('div');
        tabsContainer.id = 'file-tabs-container';
        tabsContainer.className = 'file-tabs-container';
        dataSection.insertBefore(tabsContainer, dataSection.firstChild);
    }

    tabsContainer.innerHTML = '';

    // Render each file tab
    openFiles.forEach(file => {
        const tab = document.createElement('div');
        tab.className = `file-tab ${file.active ? 'active' : ''}`;
        tab.dataset.fileId = file.id;

        const icon = document.createElement('span');
        icon.className = 'file-tab-icon';
        icon.textContent = '📄';

        const name = document.createElement('span');
        name.className = 'file-tab-name';
        name.textContent = file.name;
        name.title = file.name;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'file-tab-close';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            closeFileTab(file.id);
        };

        tab.appendChild(icon);
        tab.appendChild(name);
        tab.appendChild(closeBtn);

        tab.onclick = () => switchToFile(file.id);

        tabsContainer.appendChild(tab);
    });

    // Add "New File" button
    const newFileBtn = document.createElement('button');
    newFileBtn.className = 'file-tab-new';
    newFileBtn.innerHTML = '+';
    newFileBtn.title = 'Nouveau fichier';
    newFileBtn.onclick = () => {
        // Create empty 20x5 grid
        const emptyData = [
            ['Colonne A', 'Colonne B', 'Colonne C', 'Colonne D', 'Colonne E'],
            ...Array(20).fill(null).map(() => Array(5).fill(''))
        ];

        addFileTab({
            filename: `Sans titre ${openFiles.length + 1}`,
            data: emptyData
        });
    };
    tabsContainer.appendChild(newFileBtn);
}

// Switch to a specific file
function switchToFile(fileId) {
    const file = openFiles.find(f => f.id === fileId);
    if (!file) return;

    // Update active states
    openFiles.forEach(f => f.active = (f.id === fileId));
    activeFileId = fileId;

    // Update UI
    renderFileTabs();

    // Load file data
    if (file.data) {
        workbookData = file.data;
        currentSheet = file.data;
        displayData(file.data);
    }
}

// Close a file tab
function closeFileTab(fileId) {
    const index = openFiles.findIndex(f => f.id === fileId);
    if (index === -1) return;

    const wasActive = openFiles[index].active;
    openFiles.splice(index, 1);

    // If closed tab was active, activate another
    if (wasActive && openFiles.length > 0) {
        const newActiveIndex = Math.min(index, openFiles.length - 1);
        openFiles[newActiveIndex].active = true;
        activeFileId = openFiles[newActiveIndex].id;
        switchToFile(activeFileId);
    } else if (openFiles.length === 0) {
        activeFileId = null;
        showImportSection();
    }

    renderFileTabs();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initializeFileTabs, addFileTab, switchToFile, closeFileTab };
}
