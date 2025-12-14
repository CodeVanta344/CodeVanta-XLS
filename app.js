// Application State
window.workbookData = null;
window.currentSheet = null;
window.filteredData = null;
window.currentChart = null;
window.zoomLevel = 100; // Current zoom level
window.selectedCell = null; // Currently selected cell

// progressive Rendering State
const RENDER_CHUNK_SIZE = 200;
let renderedRowCount = 0;

// DOM Elements
const splashScreen = document.getElementById('splash-screen');
const appContainer = document.getElementById('app');
const fileInput = document.getElementById('file-input');
const importBtn = document.getElementById('import-btn');
const importSection = document.getElementById('import-section');
const dataSection = document.getElementById('data-section');
const themeToggle = document.getElementById('theme-toggle');
const exportBtn = document.getElementById('export-btn');
const newFileBtn = document.getElementById('new-file-btn');

// Table Elements
const tableHead = document.getElementById('table-head');
const tableBody = document.getElementById('table-body');
const statRows = document.getElementById('stat-rows');
const statCols = document.getElementById('stat-cols');
const statCells = document.getElementById('stat-cells');

// Modal Elements
const sortModal = document.getElementById('sort-modal');
const filterModal = document.getElementById('filter-modal');
const calculateModal = document.getElementById('calculate-modal');
const chartModal = document.getElementById('chart-modal');

// Zoom Functions
const zoomLevels = [50, 75, 90, 100, 110, 125, 150, 200];

function zoomIn() {
    const currentIndex = zoomLevels.indexOf(zoomLevel);
    if (currentIndex < zoomLevels.length - 1) {
        zoomLevel = zoomLevels[currentIndex + 1];
        applyZoom();
    }
}

function zoomOut() {
    const currentIndex = zoomLevels.indexOf(zoomLevel);
    if (currentIndex > 0) {
        zoomLevel = zoomLevels[currentIndex - 1];
        applyZoom();
    }
}

function zoomReset() {
    zoomLevel = 100;
    applyZoom();
}

function applyZoom() {
    const tableWrapper = document.querySelector('.table-wrapper');
    const zoomLabel = document.getElementById('zoom-level');
    const zoomContainer = document.querySelector('.zoom-container');

    if (zoomContainer) {
        // Use CSS zoom property which handles layout reflow and scrollbars correctly in Electron/Chrome
        zoomContainer.style.zoom = `${zoomLevel}%`;
        zoomContainer.style.transform = 'none'; // Ensure no conflict

    } else {
        // Fallback for older structure (should be wrapped now)
        if (tableWrapper) {
            // Try to apply to table directly if wrapper missing
            const table = tableWrapper.querySelector('table');
            if (table) table.style.zoom = `${zoomLevel}%`;
        }
    }

    if (zoomLabel) {
        if (zoomLabel.tagName === 'INPUT') {
            zoomLabel.value = `${Math.round(zoomLevel)}%`;
        } else {
            zoomLabel.textContent = `${Math.round(zoomLevel)}%`;
        }
    }

    // Cleanup empty rows that might have been generated
    trimTrailingEmptyRows();
    checkInfiniteScroll(); // Check if we need to fill valid space
}

function setupZoomInput() {
    const zoomLabel = document.getElementById('zoom-level');
    if (!zoomLabel || zoomLabel.tagName !== 'INPUT') return;

    zoomLabel.addEventListener('change', (e) => {
        let val = parseInt(e.target.value.replace('%', ''));
        if (isNaN(val)) val = 100;

        // Clamp logic
        val = Math.min(Math.max(val, 20), 300);

        window.zoomLevel = val;
        applyZoom();
    });

    zoomLabel.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            zoomLabel.blur(); // Triggers change
        }
    });

    zoomLabel.addEventListener('focus', (e) => {
        // Remove % for easier editing
        e.target.value = e.target.value.replace('%', '');
        e.target.select();
    });
}

function trimTrailingEmptyRows() {
    if (!window.currentSheet || window.currentSheet.length === 0) return;

    // 1. Find the last row with content
    let lastNonEmptyIndex = -1;
    for (let i = window.currentSheet.length - 1; i >= 0; i--) {
        const row = window.currentSheet[i];
        const hasContent = row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
        if (hasContent) {
            lastNonEmptyIndex = i;
            break;
        }
    }

    // 2. Determine safe buffer
    const BUFFER = 50;
    const minRows = 50;

    let targetLength = Math.max(lastNonEmptyIndex + 1 + BUFFER, minRows);

    // 3. Trim if current length exceeds target
    if (window.currentSheet.length > targetLength) {
        window.currentSheet.splice(targetLength);

        if (renderedRowCount > targetLength) {
            requestAnimationFrame(() => {
                const rowsToRemove = renderedRowCount - targetLength;
                let removed = 0;
                while (removed < rowsToRemove && tableBody.lastElementChild) {
                    tableBody.removeChild(tableBody.lastElementChild);
                    removed++;
                }
                renderedRowCount = targetLength;
                updateStats(window.currentSheet);
            });
        } else {
            updateStats(window.currentSheet);
        }
    }
}

// Interactive Grid Logic (Pan, Zoom, Infinite Scroll)
function initializeGridInteractions() {
    const tableWrapper = document.querySelector('.table-wrapper');
    if (!tableWrapper) return;

    // 1. Interactions (Pan & Zoom)
    let isDown = false;
    let isZooming = false;
    let startX, startY;
    let scrollLeft, scrollTop;
    let startZoomY;
    let startZoomLevel;

    tableWrapper.addEventListener('mousedown', (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.contentEditable !== 'true') {
            isDown = true;
            if (e.ctrlKey) {
                isZooming = true;
                startZoomY = e.pageY;
                startZoomLevel = zoomLevel;
                document.body.style.cursor = 'ns-resize';
            } else {
                tableWrapper.classList.add('active');
                startX = e.pageX - tableWrapper.offsetLeft;
                startY = e.pageY - tableWrapper.offsetTop;
                scrollLeft = tableWrapper.scrollLeft;
                scrollTop = tableWrapper.scrollTop;
            }
        }
    });

    const stopInteraction = () => {
        isDown = false;
        isZooming = false;
        tableWrapper.classList.remove('active');
        document.body.style.cursor = '';
    };

    tableWrapper.addEventListener('mouseleave', stopInteraction);
    tableWrapper.addEventListener('mouseup', stopInteraction);

    tableWrapper.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();

        if (isZooming) {
            const deltaY = startZoomY - e.pageY;
            const sensitivity = 0.5;
            let newZoom = startZoomLevel + (deltaY * sensitivity);
            newZoom = Math.min(Math.max(newZoom, 20), 300);

            if (Math.abs(newZoom - zoomLevel) > 1) {
                zoomLevel = newZoom;
                applyZoom();
                checkInfiniteScroll();
            }
        } else {
            const x = e.pageX - tableWrapper.offsetLeft;
            const y = e.pageY - tableWrapper.offsetTop;
            const walkX = (x - startX) * 1.5;
            const walkY = (y - startY) * 1.5;
            tableWrapper.scrollLeft = scrollLeft - walkX;
            tableWrapper.scrollTop = scrollTop - walkY;
        }
    });

    // Keyboard Nav
    document.addEventListener('keydown', (e) => {
        if (!window.selectedCell || window.selectedCell.contentEditable === 'true') return;
        const currentRow = window.selectedCell.parentElement;
        if (!currentRow) return;
        const currentTable = currentRow.parentElement;
        const rows = Array.from(currentTable.querySelectorAll('tr'));
        const cells = Array.from(currentRow.querySelectorAll('td'));
        const rowIndex = rows.indexOf(currentRow);
        const colIndex = cells.indexOf(window.selectedCell);
        let nextCell = null;

        switch (e.key) {
            case 'ArrowUp': if (rowIndex > 0) nextCell = rows[rowIndex - 1].querySelectorAll('td')[colIndex]; break;
            case 'ArrowDown':
                if (rowIndex < rows.length - 1) nextCell = rows[rowIndex + 1].querySelectorAll('td')[colIndex];
                else { addMoreRows(1); setTimeout(() => { const newR = currentTable.querySelectorAll('tr'); selectCell(newR[newR.length - 1].querySelectorAll('td')[colIndex]); }, 50); return; }
                break;
            case 'ArrowLeft': if (colIndex > 0) nextCell = cells[colIndex - 1]; break;
            case 'ArrowRight':
                if (colIndex < cells.length - 1) nextCell = cells[colIndex + 1];
                else { addMoreCols(1); setTimeout(() => { selectCell(rows[rowIndex].querySelectorAll('td')[colIndex + 1]); }, 50); return; }
                break;
        }
        if (nextCell) { e.preventDefault(); selectCell(nextCell); }
    });

    function selectCell(cell) {
        if (!cell) return;
        if (window.selectedCell) window.selectedCell.classList.remove('selected-cell');
        window.selectedCell = cell;
        cell.classList.add('selected-cell');
        cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
    window.selectCell = selectCell;

    tableWrapper.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            if (e.deltaY < 0) zoomLevel = Math.min(zoomLevel + 10, 300);
            else zoomLevel = Math.max(zoomLevel - 10, 20);
            applyZoom();
            checkInfiniteScroll();
        }
    });

    tableWrapper.addEventListener('scroll', () => {
        checkInfiniteScroll();
    });
}

function checkInfiniteScroll() {
    const tableWrapper = document.querySelector('.table-wrapper');
    if (!tableWrapper || !window.currentSheet) return;

    const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = tableWrapper;

    const zoomFactor = window.zoomLevel / 100;
    const ESTIMATED_ROW_HEIGHT = 25 * zoomFactor;
    const ESTIMATED_COL_WIDTH = 100 * zoomFactor;

    const visibleHeight = clientHeight;
    const visibleWidth = clientWidth;

    const remainingHeight = scrollHeight - scrollTop;
    const remainingWidth = scrollWidth - scrollLeft;

    // Correctly calculate distance to the end (hidden content)
    const distanceToBottom = scrollHeight - scrollTop - visibleHeight;
    const distanceToRight = scrollWidth - scrollLeft - visibleWidth;

    // Use fixed thresholds to avoid aggressively filling screen on zoom out
    const PIXEL_THRESHOLD = 500;

    if (remainingHeight < PIXEL_THRESHOLD) {
        // ... existing row logic ...
        const shortagePx = PIXEL_THRESHOLD - remainingHeight;
        const rowsNeeded = Math.ceil(shortagePx / ESTIMATED_ROW_HEIGHT);
        const rowsToAdd = Math.max(RENDER_CHUNK_SIZE, rowsNeeded);

        if (renderedRowCount < window.currentSheet.length) {
            const nextChunk = Math.min(window.currentSheet.length - renderedRowCount, rowsToAdd);
            if (nextChunk > 0) renderRows(renderedRowCount, nextChunk);
        } else {
            addMoreRows(rowsToAdd);
        }
    }

    // Restore Column Infinite Scroll (Fixed Threshold)
    if (distanceToRight < PIXEL_THRESHOLD) {
        const shortagePx = PIXEL_THRESHOLD - distanceToRight;
        const colsNeeded = Math.ceil(shortagePx / ESTIMATED_COL_WIDTH);
        const colsToAdd = Math.max(5, colsNeeded);
        addMoreCols(colsToAdd);
    }
}

function addMoreRows(count) {
    if (!window.currentSheet) return;
    const cols = window.currentSheet[0] ? window.currentSheet[0].length : 5;
    const startingRowIndex = window.currentSheet.length;

    for (let i = 0; i < count; i++) {
        const newRow = new Array(cols).fill('');
        window.currentSheet.push(newRow);
    }

    if (tableBody) {
        if (renderedRowCount >= startingRowIndex) {
            renderRows(startingRowIndex, count);
        }
        updateStats(window.currentSheet);
    }
}

function addMoreCols(count) {
    if (!window.currentSheet) return;

    // Header update
    for (let i = 0; i < count; i++) {
        const colName = `Colonne ${window.currentSheet[0].length + 1}`;
        window.currentSheet[0].push(colName);

        // Dom update header
        const th = document.createElement('th');
        th.textContent = colName;
        th.contentEditable = true;
        tableHead.querySelector('tr').appendChild(th);
    }

    // Rows update
    const rows = window.currentSheet.slice(1);
    const domRows = tableBody.querySelectorAll('tr');

    rows.forEach((row, rowIndex) => {
        for (let i = 0; i < count; i++) {
            row.push('');
            // Dom update
            if (domRows[rowIndex]) {
                const td = document.createElement('td');
                td.contentEditable = false;
                td.textContent = '';

                td.addEventListener('dblclick', (e) => {
                    e.target.contentEditable = true;
                    e.target.focus();
                });

                td.addEventListener('blur', (e) => {
                    const value = e.target.textContent;
                    if (!window.currentSheet[rowIndex + 1]) window.currentSheet[rowIndex + 1] = [];
                    window.currentSheet[rowIndex + 1][row.length - count + i] = value;
                });
                domRows[rowIndex].appendChild(td);
            }
        }
    });
    updateStats(window.currentSheet);
}

// Splash Screen
function initializeSplashScreen() {
    // License manager will control when to hide splash and show activation/app
}

// Theme Management
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('svg path');
    if (theme === 'dark') {
        // Moon icon
        icon.setAttribute('d', 'M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z');
    } else {
        // Sun icon
        icon.setAttribute('d', 'M10 2.5V4.5M10 15.5V17.5M4.5 10H2.5M17.5 10H15.5M15.3 15.3L13.9 13.9M15.3 4.7L13.9 6.1M4.7 15.3L6.1 13.9M4.7 4.7L6.1 6.1');
    }
}

// Event Listeners
function initializeEventListeners() {
    // Import
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileImport);

    // Drag & Drop
    const importCard = document.querySelector('.import-card');
    importCard.addEventListener('dragover', (e) => {
        e.preventDefault();
        importCard.style.borderColor = 'var(--accent-primary)';
    });
    importCard.addEventListener('dragleave', () => {
        importCard.style.borderColor = 'var(--glass-border)';
    });
    importCard.addEventListener('drop', (e) => {
        e.preventDefault();
        importCard.style.borderColor = 'var(--glass-border)';
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });

    // Theme
    themeToggle.addEventListener('click', toggleTheme);

    // Export
    exportBtn.addEventListener('click', exportData);

    // New File
    newFileBtn.addEventListener('click', createNewFile);

    // Toolbar
    document.getElementById('sort-btn')?.addEventListener('click', () => openModal(sortModal));
    document.getElementById('filter-btn')?.addEventListener('click', () => openModal(filterModal));
    document.getElementById('calculate-btn')?.addEventListener('click', () => {
        openModal(calculateModal);
        updateCalculations();
    });
    document.getElementById('chart-btn')?.addEventListener('click', () => openModal(chartModal));
    document.getElementById('new-file-btn')?.addEventListener('click', createNewFile);

    // Modal Actions
    document.getElementById('apply-sort')?.addEventListener('click', applySort);
    document.getElementById('apply-filter')?.addEventListener('click', applyFilter);
    document.getElementById('generate-chart')?.addEventListener('click', generateChart);
    document.getElementById('reset-filter-btn')?.addEventListener('click', resetFilter);

    // Close Modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            closeModal(modal);
        });
    });

    // Close modal on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });

    // Calculate column change
    document.getElementById('calc-column').addEventListener('change', updateCalculations);

    // Zoom controls
    document.getElementById('zoom-in-btn')?.addEventListener('click', () => zoomIn());
    document.getElementById('zoom-out-btn')?.addEventListener('click', () => zoomOut());
    document.getElementById('zoom-reset-btn')?.addEventListener('click', () => zoomReset());

    // Search
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');

    searchInput?.addEventListener('input', (e) => {
        const query = e.target.value;
        if (query) {
            clearSearchBtn.style.display = 'flex';
            performSearch(query);
        } else {
            clearSearchBtn.style.display = 'none';
            displayData(currentSheet);
        }
    });

    clearSearchBtn?.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        displayData(currentSheet);
    });

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (typeof switchTab === 'function') switchTab(btn.dataset.tab);
        });
    });

    // Window Controls (Electron)
    if (window.electronAPI) {
        document.getElementById('minimize-btn')?.addEventListener('click', () => {
            window.electronAPI.minimizeWindow();
        });
        document.getElementById('maximize-btn')?.addEventListener('click', () => {
            window.electronAPI.maximizeWindow();
        });
        document.getElementById('close-btn')?.addEventListener('click', () => {
            window.electronAPI.closeWindow();
        });

        // Folder selection
        document.getElementById('select-folder-btn')?.addEventListener('click', async () => {
            if (typeof dashboardController !== 'undefined') {
                await dashboardController.selectFolder();
            }
        });

        document.getElementById('change-folder-btn')?.addEventListener('click', async () => {
            if (typeof dashboardController !== 'undefined') {
                await dashboardController.changeFolder();
            }
        });
    }
}

// File Import
function handleFileImport(e) {
    const file = e.target.files[0];
    if (file) handleFile(file);
}

function handleFile(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // Get first sheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            window.workbookData = jsonData;
            window.currentSheet = jsonData;
            window.filteredData = null;

            displayData(jsonData);
            showDataSection();

            // Re-initialize grid interactions after loading data
            setTimeout(() => {
                initializeGridInteractions();
            }, 100);

            exportBtn.disabled = false;

        } catch (error) {
            alert('Erreur lors de la lecture du fichier: ' + error.message);
        }
    };

    reader.readAsArrayBuffer(file);
}

// Display Data (Progressive)
function displayData(data) {
    if (!data || data.length === 0) return;

    // Clear table
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';
    renderedRowCount = 0; // Reset count

    // Get headers (first row)
    const headers = data[0];

    // Create header row
    const headerRow = document.createElement('tr');
    headers.forEach((header, index) => {
        const th = document.createElement('th');
        th.textContent = header || `Colonne ${index + 1}`;
        th.contentEditable = true;
        th.addEventListener('blur', (e) => {
            data[0][index] = e.target.textContent;
        });
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Initial Render of first chunk
    const totalDataRows = data.length - 1;
    const initialLoad = Math.min(totalDataRows, RENDER_CHUNK_SIZE);

    if (initialLoad > 0) {
        renderRows(0, initialLoad);
    }

    // Update stats
    updateStats(data);

    // Populate modal selects
    populateColumnSelects(headers);
}

// Helper to render a chunk of rows
function renderRows(startDataRowIndex, count) {
    // startDataRowIndex is 0-based index of DATA rows (so actually matches data[index + 1])
    const data = window.filteredData || window.currentSheet;
    if (!data) return;

    const headers = data[0];

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
        const actualRowIndex = startDataRowIndex + i;
        const dataRowIndex = actualRowIndex + 1; // +1 to skip header in data array

        if (dataRowIndex >= data.length) break;

        const row = data[dataRowIndex];
        const tr = document.createElement('tr');

        // Ensure row has cells for all headers
        headers.forEach((_, colIndex) => {
            const td = document.createElement('td');
            td.contentEditable = false;
            td.textContent = row[colIndex] !== undefined ? row[colIndex] : '';

            // Double click to edit
            td.addEventListener('dblclick', (e) => {
                e.target.contentEditable = true;
                e.target.focus();
                e.target.classList.add('editing');
            });

            // Update data on edit
            td.addEventListener('blur', (e) => {
                e.target.contentEditable = false;
                e.target.classList.remove('editing');

                const value = e.target.textContent;
                if (!data[dataRowIndex]) data[dataRowIndex] = [];
                data[dataRowIndex][colIndex] = value;
            });

            // Click listener for selection
            td.addEventListener('click', (e) => {
                if (window.selectCell) window.selectCell(e.target);
            });

            tr.appendChild(td);
        });
        fragment.appendChild(tr);
    }

    tableBody.appendChild(fragment);
    renderedRowCount += count;
}

function updateStats(data) {
    const rows = data.length - 1; // Exclude header
    const cols = data[0] ? data[0].length : 0;
    const cells = rows * cols;

    statRows.textContent = rows.toLocaleString();
    statCols.textContent = cols.toLocaleString();
    statCells.textContent = cells.toLocaleString();
}

function populateColumnSelects(headers) {
    const selects = [
        document.getElementById('sort-column'),
        document.getElementById('filter-column'),
        document.getElementById('calc-column'),
        document.getElementById('chart-x'),
        document.getElementById('chart-y')
    ];

    selects.forEach(select => {
        if (!select) return;
        select.innerHTML = '';
        headers.forEach((header, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = header || `Colonne ${index + 1}`;
            select.appendChild(option);
        });
    });
}

function showDataSection() {
    importSection.classList.add('hidden');
    dataSection.classList.remove('hidden');
}

function showImportSection() {
    importSection.classList.remove('hidden');
    dataSection.classList.add('hidden');
}

// Create New File
function createNewFile() {
    if (confirm('Créer un nouveau fichier vide ? Les données actuelles seront perdues.')) {
        // Create empty 10x10 grid
        const emptyData = [
            ['Colonne A', 'Colonne B', 'Colonne C', 'Colonne D', 'Colonne E'],
            ...Array(20).fill(null).map(() => Array(5).fill(''))
        ];

        window.workbookData = emptyData;
        window.currentSheet = emptyData;
        window.filteredData = null;

        displayData(emptyData);
        showDataSection();
        exportBtn.disabled = false;
    }
}

// Sort
function applySort() {
    const columnIndex = parseInt(document.getElementById('sort-column').value);
    const order = document.getElementById('sort-order').value;

    const data = window.filteredData || window.currentSheet;
    const headers = data[0];
    const rows = data.slice(1);

    // Sort rows
    rows.sort((a, b) => {
        const aVal = a[columnIndex];
        const bVal = b[columnIndex];

        // Try numeric comparison
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);

        if (!isNaN(aNum) && !isNaN(bNum)) {
            return order === 'asc' ? aNum - bNum : bNum - aNum;
        }

        // String comparison
        const aStr = String(aVal || '');
        const bStr = String(bVal || '');

        if (order === 'asc') {
            return aStr.localeCompare(bStr);
        } else {
            return bStr.localeCompare(aStr);
        }
    });

    const sortedData = [headers, ...rows];
    displayData(sortedData);

    if (window.filteredData) {
        window.filteredData = sortedData;
    } else {
        window.currentSheet = sortedData;
    }

    closeModal(sortModal);
}

// Filter
window.activeFilters = [];

function applyFilter() {
    const columnIndex = parseInt(document.getElementById('filter-column').value);
    const filterValue = document.getElementById('filter-value').value.toLowerCase();
    const headers = window.currentSheet[0];
    const columnName = headers[columnIndex];

    if (!filterValue) {
        closeModal(filterModal);
        return;
    }

    // Add to active filters
    window.activeFilters.push({
        columnIndex: columnIndex,
        value: filterValue,
        columnName: columnName
    });

    // Clear input
    document.getElementById('filter-value').value = '';

    reapplyFilters();
    closeModal(filterModal);
}

function reapplyFilters() {
    if (!window.activeFilters || window.activeFilters.length === 0) {
        window.filteredData = null;
        displayData(window.currentSheet);
        updateFilterBadges();
        return;
    }

    const headers = window.currentSheet[0];
    const rows = window.currentSheet.slice(1);

    const filtered = rows.filter(row => {
        return window.activeFilters.every(filter => {
            const cellValue = String(row[filter.columnIndex] || '').toLowerCase();
            return cellValue.includes(filter.value);
        });
    });

    window.filteredData = [headers, ...filtered];
    displayData(window.filteredData);
    updateFilterBadges();
}

function updateFilterBadges() {
    const container = document.getElementById('active-filters-container');
    if (!container) return;

    container.innerHTML = '';

    if (window.activeFilters.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    window.activeFilters.forEach((filter, index) => {
        const badge = document.createElement('div');
        badge.className = 'filter-badge';
        badge.innerHTML = `
            <span>${filter.columnName}: "${filter.value}"</span>
            <button class="reset-filter-x" onclick="removeFilter(${index})">×</button>
        `;
        container.appendChild(badge);
    });
}
window.removeFilter = function (index) {
    window.activeFilters.splice(index, 1);
    reapplyFilters();
}

function resetFilter() {
    window.activeFilters = [];
    reapplyFilters();
}


// Search
function performSearch(query) {
    if (!window.currentSheet || window.currentSheet.length === 0) return;

    const searchTerm = query.toLowerCase().trim();
    if (!searchTerm) {
        displayData(window.currentSheet);
        return;
    }

    const headers = window.currentSheet[0];
    const rows = window.currentSheet.slice(1);

    // Search in all cells
    const matchedRows = rows.filter(row => {
        return row.some(cell => {
            const cellValue = String(cell || '').toLowerCase();
            return cellValue.includes(searchTerm);
        });
    });

    const searchResults = [headers, ...matchedRows];
    displayData(searchResults);

    // Update stats to show search results
    const searchStats = document.getElementById('stat-rows');
    if (searchStats) {
        searchStats.textContent = `${matchedRows.length} / ${rows.length}`;
    }
}

// Calculate
function updateCalculations() {
    const columnIndex = parseInt(document.getElementById('calc-column').value);
    const data = window.filteredData || window.currentSheet;
    const rows = data.slice(1);

    // Extract numeric values
    const values = rows
        .map(row => parseFloat(row[columnIndex]))
        .filter(val => !isNaN(val));

    if (values.length === 0) {
        document.getElementById('calc-sum').textContent = '-';
        document.getElementById('calc-avg').textContent = '-';
        document.getElementById('calc-min').textContent = '-';
        document.getElementById('calc-max').textContent = '-';
        document.getElementById('calc-count').textContent = '0';
        return;
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    document.getElementById('calc-sum').textContent = sum.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    document.getElementById('calc-avg').textContent = avg.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    document.getElementById('calc-min').textContent = min.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    document.getElementById('calc-max').textContent = max.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    document.getElementById('calc-count').textContent = values.length.toLocaleString();
}

// Chart
function generateChart() {
    const chartType = document.getElementById('chart-type').value;
    const xIndex = parseInt(document.getElementById('chart-x').value);
    const yIndex = parseInt(document.getElementById('chart-y').value);

    const data = window.filteredData || window.currentSheet;
    const headers = data[0];
    const rows = data.slice(1);

    // Extract data
    const labels = rows.map(row => row[xIndex]).slice(0, 20); // Limit to 20 points
    const values = rows.map(row => parseFloat(row[yIndex]) || 0).slice(0, 20);

    // Destroy previous chart
    if (window.currentChart) {
        window.currentChart.destroy();
    }

    // Create chart
    const ctx = document.getElementById('chart-canvas').getContext('2d');

    const chartConfig = {
        type: chartType,
        data: {
            labels: labels,
            datasets: [{
                label: headers[yIndex],
                data: values,
                backgroundColor: chartType === 'pie'
                    ? generateColors(values.length)
                    : 'rgba(0, 122, 255, 0.5)',
                borderColor: 'rgba(0, 122, 255, 1)',
                borderWidth: 2,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: chartType === 'pie' ? 'right' : 'top',
                    align: 'center',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            const value = context.raw;

                            if (context.chart.config.type === 'pie') {
                                const total = context.chart._metasets[context.datasetIndex].total;
                                const percentage = total > 0 ? parseFloat(((value / total) * 100).toFixed(1)) + '%' : '0%';
                                return `${context.label}: ${value} (${percentage})`;
                            }

                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y;
                            } else {
                                label += value;
                            }
                            return label;
                        }
                    }
                }
            },
            layout: {
                padding: 10
            },
            scales: chartType !== 'pie' ? {
                y: {
                    beginAtZero: true
                }
            } : {
                x: {
                    display: false
                },
                y: {
                    display: false
                }
            }
        }
    };

    window.currentChart = new Chart(ctx, chartConfig);
}

function generateColors(count) {
    const colors = [
        'rgba(0, 122, 255, 0.7)',
        'rgba(90, 200, 250, 0.7)',
        'rgba(52, 199, 89, 0.7)',
        'rgba(255, 149, 0, 0.7)',
        'rgba(255, 59, 48, 0.7)',
        'rgba(175, 82, 222, 0.7)',
        'rgba(255, 204, 0, 0.7)',
        'rgba(142, 142, 147, 0.7)'
    ];

    return Array(count).fill(null).map((_, i) => colors[i % colors.length]);
}

// Export
function exportData() {
    const data = window.filteredData || window.currentSheet;

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Feuille1');

    // Generate file
    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `ExcelFlow_Export_${timestamp}.xlsx`);
}

// Modal Management
function openModal(modal) {
    modal.classList.remove('hidden');

    // Update calculations if calculate modal
    if (modal === calculateModal) {
        updateCalculations();
    }
}

function closeModal(modal) {
    modal.classList.add('hidden');
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('hidden');
    });
}

// Auto Update Logic
function initializeAutoUpdater() {
    if (!window.electronAPI) return;

    const updateModal = document.getElementById('update-modal');
    const updateMessage = document.getElementById('update-message');
    const restartBtn = document.getElementById('restart-btn');
    const downloadProgress = document.getElementById('download-progress');

    window.electronAPI.onUpdateAvailable(() => {
        updateMessage.textContent = "Une nouvelle version a été détectée. Téléchargement automatique en cours...";
        updateModal.classList.remove('hidden');
        downloadProgress.style.display = 'block';
    });

    window.electronAPI.onUpdateDownloaded(() => {
        updateMessage.textContent = "Mise à jour téléchargée ! Redémarrez pour l'appliquer.";
        downloadProgress.style.display = 'none';
        restartBtn.style.display = 'flex';
    });

    restartBtn.addEventListener('click', () => {
        window.electronAPI.quitAndInstall();
    });
}

// Folder Selection Logic
function initializeFolderSelection() {
    if (!window.electronAPI) return;

    const modal = document.getElementById('folder-selection-modal');
    const selectBtn = document.getElementById('select-folder-btn');

    // Show modal when requested
    window.electronAPI.onRequestFolderSelection(() => {
        // Hide other main views to focus on selection
        document.getElementById('main-app').classList.remove('hidden'); // Ensure wrapper is visible
        document.getElementById('import-section').classList.add('hidden');
        document.getElementById('dashboard-section').classList.add('hidden');
        document.getElementById('data-section').classList.add('hidden');
        document.getElementById('charts-section').classList.add('hidden');

        // Show the modal
        modal.classList.remove('hidden');
    });

    // Handle selection click
    selectBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.selectFolder();
        if (result && result.success) {
            modal.classList.add('hidden');

            // Restore Dashboard View
            const dashboardTab = document.querySelector('.tab-btn[data-tab="dashboard"]');
            if (dashboardTab) {
                dashboardTab.click();
            } else {
                document.getElementById('dashboard-section').classList.remove('hidden');
            }
        }
    });
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeSplashScreen();
    initializeEventListeners();
    initializeTheme();
    initializeGridInteractions(); // Initialize infinite scroll & interactions
    setupZoomInput(); // Initialize manual zoom input
    if (typeof initializeTabs === 'function') initializeTabs();
    if (typeof initializeFileTabs === 'function') initializeFileTabs();
    initializeAutoUpdater(); // Initialize Auto Updater
    initializeFolderSelection(); // Initialize Folder Selection
});
