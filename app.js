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
        const hasContent = row.some(cell => {
            let val = cell;
            if (cell && typeof cell === 'object' && 'value' in cell) {
                val = cell.value;
            }
            return val !== null && val !== undefined && String(val).trim() !== '';
        });

        if (hasContent) {
            lastNonEmptyIndex = i;
            break;
        }
    }

    // 2. Determine safe buffer
    const BUFFER = 5; // Reduced from 50 to 5
    const minRows = 20; // Reduced from 100 to 20

    let targetLength = lastNonEmptyIndex + 1 + BUFFER;

    // Ensure minimum rows
    if (targetLength < minRows) targetLength = minRows;

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
    } else if (window.currentSheet.length < targetLength) {
        // Extend to support minimum scroll height
        const cols = window.currentSheet.length > 0 ? window.currentSheet[0].length : 26;
        while (window.currentSheet.length < targetLength) {
            window.currentSheet.push(new Array(cols).fill(null));
        }
        updateStats(window.currentSheet);
    }
}

// Interactive Grid Logic (Pan, Zoom, Infinite Scroll)
function initializeGridInteractions() {
    const tableWrapper = document.querySelector('.table-wrapper');
    if (!tableWrapper) return;

    // 1. Interactions (Pan & Zoom)
    let isDown = false;
    let isDragging = false;
    let wasDragging = false; // To prevent click after drag
    let startX, startY;
    let scrollLeft, scrollTop;
    let isZooming = false;
    let startZoomY;
    let startZoomLevel;

    tableWrapper.addEventListener('mousedown', (e) => {
        // Only Left Click for Pan
        if (e.button !== 0) return;

        // Prevent Pan on inputs or contentEditable
        if (e.target.tagName !== 'INPUT' && e.target.contentEditable !== 'true') {
            isDown = true;
            isDragging = false; // Reset drag state only

            if (e.ctrlKey) {
                isZooming = true;
                startZoomY = e.pageY;
                startZoomLevel = zoomLevel;
                document.body.style.cursor = 'ns-resize';
            } else {
                // Prepare for Pan
                startX = e.pageX;
                startY = e.pageY;
                scrollLeft = tableWrapper.scrollLeft;
                scrollTop = tableWrapper.scrollTop;
            }
            // Attach document listeners
            document.addEventListener('mouseup', onMouseUp);
            document.addEventListener('mousemove', onMouseMove);
            window.addEventListener('blur', onMouseUp);
        }
    });

    // Capture click to prevent selection if we just dragged
    tableWrapper.addEventListener('click', (e) => {
        if (wasDragging) {
            e.preventDefault();
            e.stopPropagation();
            wasDragging = false;
        }
    }, true);

    const onMouseUp = () => {
        if (isDragging) {
            wasDragging = true;
            setTimeout(() => wasDragging = false, 50); // Reset after click phase
        }
        isDown = false;
        isDragging = false;
        isZooming = false;

        tableWrapper.classList.remove('active');
        document.body.style.cursor = '';

        // Remove document listeners
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('blur', onMouseUp);
    };

    const onMouseMove = (e) => {
        if (!isDown) return;

        if (isZooming) {
            e.preventDefault();
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
            // Panning Logic with Threshold
            const x = e.pageX;
            const y = e.pageY;

            if (!isDragging) {
                const moveX = Math.abs(x - startX);
                const moveY = Math.abs(y - startY);
                if (moveX > 3 || moveY > 3) {
                    isDragging = true;
                    tableWrapper.classList.add('active'); // Activate cursor
                }
            }

            if (isDragging) {
                e.preventDefault(); // Prevent selection

                // Standard Drag Mode (Mouse Down -> Pull Content Down aka View Up)
                const walkX = (x - startX) * 2;
                const walkY = (y - startY) * 2;

                tableWrapper.scrollLeft = scrollLeft - walkX;
                tableWrapper.scrollTop = scrollTop - walkY;
            }
        }
    };

    tableWrapper.addEventListener('mouseleave', () => {
        // Optional: Keep panning even if mouse leaves wrapper
    });

    // Keyboard Navigation is now handled by initializeKeyboardNavigation() at the end of this file

    function selectCell(cell, scrollTo = true) {
        if (!cell) return;
        if (window.selectedCell) window.selectedCell.classList.remove('selected-cell');
        window.selectedCell = cell;
        cell.classList.add('selected-cell');
        if (scrollTo) {
            cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
        checkInfiniteScroll();
    }
    window.selectCell = selectCell;

    // Explicitly handle wheel to ensure scrolling works even if native is blocked
    tableWrapper.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            if (e.deltaY < 0) zoomLevel = Math.min(zoomLevel + 10, 300);
            else zoomLevel = Math.max(zoomLevel - 10, 20);
            applyZoom();
            checkInfiniteScroll();
        } else {
            // Manual Scroll Fallback
            // Normalize deltaY based on deltaMode
            // 0 = Pixels, 1 = Lines, 2 = Pages
            let delta = e.deltaY;
            if (e.deltaMode === 1) {
                delta *= 40; // Approx row height
            } else if (e.deltaMode === 2) {
                delta *= 800; // Page height
            }

            tableWrapper.scrollTop += delta;
            checkInfiniteScroll();
        }
    }, { passive: false });

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

    const visibleHeight = clientHeight;
    const remainingHeight = scrollHeight - scrollTop;

    // Use fixed thresholds to avoid aggressively filling screen on zoom out
    const PIXEL_THRESHOLD = 500;

    if (remainingHeight < PIXEL_THRESHOLD) {
        if (renderedRowCount < window.currentSheet.length) {
            const shortagePx = PIXEL_THRESHOLD - remainingHeight;
            const rowsNeeded = Math.ceil(shortagePx / ESTIMATED_ROW_HEIGHT);
            const rowsToAdd = Math.max(RENDER_CHUNK_SIZE, rowsNeeded);

            const nextChunk = Math.min(window.currentSheet.length - renderedRowCount, rowsToAdd);
            if (nextChunk > 0) renderRows(renderedRowCount, nextChunk);
        }
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

        // Activation Screen Window Controls
        document.getElementById('minimize-activation-btn')?.addEventListener('click', () => {
            window.electronAPI.minimizeWindow();
        });
        document.getElementById('close-activation-btn')?.addEventListener('click', () => {
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

// NOTE: Smart Header Detection is now handled in the backend (DataExtractor.js)
// We simply delegate the file path to the main process.

async function handleFile(file) {
    // Check if we have electronAPI (Desktop app)
    if (window.electronAPI) {
        try {
            // Attempt to get path via webUtils (safest for new Electron versions)
            let filePath;
            try {
                filePath = window.electronAPI.getPathForFile ? window.electronAPI.getPathForFile(file) : file.path;
            } catch (e) {
                console.warn('getPathForFile failed, falling back to file.path', e);
                filePath = file.path;
            }

            if (!filePath) {
                alert("Erreur: Impossible de lire le chemin du fichier. Veuillez réessayer.");
                console.error("File path is missing", file);
                return;
            }

            console.log('Requesting backend import for:', filePath);
            const result = await window.electronAPI.parseFile(filePath);

            if (result.success) {
                console.log('Import successful', result);
                // Data will be refreshed via 'file-imported' event or dashboard refresh
            } else {
                alert('Erreur: ' + result.error);
            }
        } catch (error) {
            console.error('Import error:', error);
            alert('Erreur système lors de l\'import: ' + error.message);
        }
    } else {
        // Fallback for Web Version
        alert("L'importation avec styles nécessite l'application Desktop (Electron).");
    }
}

// Display Data (Progressive)
function displayData(data) {
    if (!data || data.length === 0) {
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';
        return;
    }

    // Reset state
    window.filteredData = data;
    renderedRowCount = 0; // Reset count
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';

    // Get headers (first row)
    const headers = data[0];

    // Create header row
    const headerRow = document.createElement('tr');
    headers.forEach((header, index) => {
        const th = document.createElement('th');
        th.textContent = header || `Colonne ${index + 1}`;
        th.contentEditable = true;

        // Sorting/Title edit logic
        th.addEventListener('blur', (e) => {
            if (typeof data[0][index] === 'object' && data[0][index] !== null) {
                data[0][index].value = e.target.textContent;
            } else {
                data[0][index] = e.target.textContent;
            }
        });
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Update stats
    updateStats(data);

    // Populate modal selects
    populateColumnSelects(headers);

    // Initial Chunk
    renderRows(1, RENDER_CHUNK_SIZE);
}

// Helper to render a chunk of rows
function renderRows(startDataRowIndex, count) {
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

            const cellData = row[colIndex];
            let cellValue = '';
            let cellStyle = null;

            if (cellData && typeof cellData === 'object' && cellData !== null && ('value' in cellData || 'style' in cellData)) {
                cellValue = (cellData.value !== undefined && cellData.value !== null) ? cellData.value : '';
                cellStyle = cellData.style;
            } else {
                cellValue = (cellData !== undefined && cellData !== null) ? cellData : '';
            }

            td.textContent = cellValue;

            if (cellStyle && cellStyle.border) {
                const b = cellStyle.border;
                if (b.top && (b.top.style === 'thick' || b.top.style === 'medium')) td.classList.add('border-top-thick');
                if (b.bottom && (b.bottom.style === 'thick' || b.bottom.style === 'medium')) td.classList.add('border-bottom-thick');
                if (b.left && (b.left.style === 'thick' || b.left.style === 'medium')) td.classList.add('border-left-thick');
                if (b.right && (b.right.style === 'thick' || b.right.style === 'medium')) td.classList.add('border-right-thick');

                if (b.right && b.right.style === 'thin') td.classList.add('border-right-thin');
            }

            // NEW: Apply Rich Styles (Font, Fill, Alignment)
            if (cellStyle) {
                // Font
                if (cellStyle.font) {
                    if (cellStyle.font.bold) td.style.fontWeight = 'bold';
                    if (cellStyle.font.italic) td.style.fontStyle = 'italic';
                    if (cellStyle.font.size) td.style.fontSize = `${cellStyle.font.size}pt`;
                    if (cellStyle.font.name) td.style.fontFamily = cellStyle.font.name;
                    if (cellStyle.font.color && cellStyle.font.color.argb) {
                        // Excel ARGB is FF RRGGBB -> CSS #RRGGBB
                        let hexColor = cellStyle.font.color.argb.substring(2);

                        // Contrast Safety Check
                        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                        // Fix: background is only real if not transparent and not 'none' pattern
                        const isTransparent = (cellStyle.fill && cellStyle.fill.fgColor && cellStyle.fill.fgColor.argb && cellStyle.fill.fgColor.argb.startsWith('00'));
                        const isNone = (cellStyle.fill && cellStyle.fill.pattern === 'none');
                        const hasBackground = cellStyle.fill && cellStyle.fill.fgColor && !isTransparent && !isNone;

                        // 1. Dark Mode Handling: Invert dark text on transparent background
                        if (isDark && !hasBackground) {
                            const r = parseInt(hexColor.substr(0, 2), 16);
                            const g = parseInt(hexColor.substr(2, 2), 16);
                            const b = parseInt(hexColor.substr(4, 2), 16);
                            const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
                            if (brightness < 128) hexColor = 'e8eaed'; // Force white if text is dark
                        }

                        // 2. Light Mode Safety
                        if (!isDark && !hasBackground) {
                            const r = parseInt(hexColor.substr(0, 2), 16);
                            const g = parseInt(hexColor.substr(2, 2), 16);
                            const b = parseInt(hexColor.substr(4, 2), 16);
                            const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
                            if (brightness > 200) hexColor = '1a1a1a'; // Force black if text is too light
                        }

                        td.style.color = `#${hexColor}`;
                    }
                }


                // Background (Fill)
                let bgColor = null;
                if (cellStyle.fill && (cellStyle.fill.type === 'pattern' || !cellStyle.fill.type)) {
                    if (cellStyle.fill.fgColor && cellStyle.fill.fgColor.argb) {
                        const argb = cellStyle.fill.fgColor.argb;
                        if (argb.length === 8 && argb.substring(0, 2) !== '00') { // Not transparent
                            bgColor = argb.substring(2);
                            td.style.backgroundColor = `#${bgColor}`;
                        } else if (argb.length !== 8) {
                            bgColor = argb;
                            td.style.backgroundColor = `#${bgColor}`;
                        }
                    }
                }

                // INTELLIGENT CONTRAST FIX (Robust)
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                const effectiveBg = bgColor ? bgColor : (isDark ? '1a1a1a' : 'ffffff');

                // Determine effecitve text color (use what we set above or default)
                // Fix: ensure we handle 'rgb' or 'rgba' if browser converts it, though usually we set hex
                const currentTextColor = td.style.color || (isDark ? '#e8eaed' : '#1a1a1a');
                let hexText = currentTextColor;

                if (hexText.startsWith('#')) hexText = hexText.substring(1);
                else if (hexText === 'white') hexText = 'ffffff';
                else if (hexText === 'black') hexText = '000000';
                else if (hexText.startsWith('rgb')) {
                    // Quick parse for rgb(r, g, b)
                    const rgb = hexText.match(/\d+/g);
                    if (rgb && rgb.length >= 3) {
                        const r = parseInt(rgb[0]).toString(16).padStart(2, '0');
                        const g = parseInt(rgb[1]).toString(16).padStart(2, '0');
                        const b = parseInt(rgb[2]).toString(16).padStart(2, '0');
                        hexText = r + g + b;
                    }
                }

                const getBrightness = (hex) => {
                    if (!hex || hex === 'initial' || hex === 'inherit') return isDark ? 255 : 0; // Fallback
                    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
                    const r = parseInt(hex.substr(0, 2), 16) || 0;
                    const g = parseInt(hex.substr(2, 2), 16) || 0;
                    const b = parseInt(hex.substr(4, 2), 16) || 0;
                    return ((r * 299) + (g * 587) + (b * 114)) / 1000;
                };

                const txtB = getBrightness(hexText);
                const bgB = getBrightness(effectiveBg);

                // If Contrast is poor (< 120 diff) -> Increased sensitivity to 120
                if (Math.abs(txtB - bgB) < 120) {
                    // Conflict! Enforce visibility
                    if (bgB < 128) {
                        td.style.color = '#e8eaed'; // Dark BG -> White Text
                    } else {
                        td.style.color = '#1a1a1a'; // Light BG -> Black Text
                    }
                }

                // ULTIMATE SAFEGUARD: If Light Mode and No Background (White), FORCE dark text if it looks light
                if (!isDark && !bgColor && txtB > 200) {
                    td.style.color = '#1a1a1a';
                }
                // ULTIMATE SAFEGUARD: If Dark Mode and No Background (Dark), FORCE light text if it looks dark
                if (isDark && !bgColor && txtB < 100) {
                    td.style.color = '#e8eaed';
                }

                // Alignment
                if (cellStyle.alignment) {

                    if (cellStyle.alignment.horizontal) td.style.textAlign = cellStyle.alignment.horizontal;
                    if (cellStyle.alignment.vertical) td.style.verticalAlign = cellStyle.alignment.vertical;
                    if (cellStyle.alignment.wrapText) {
                        td.style.whiteSpace = 'normal';
                        td.style.wordBreak = 'break-word';
                    }
                }
            }

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

                // Update value preserving object structure if exists
                if (typeof data[dataRowIndex][colIndex] === 'object' && data[dataRowIndex][colIndex] !== null) {
                    data[dataRowIndex][colIndex].value = value;
                } else {
                    data[dataRowIndex][colIndex] = value;
                }
            });

            // Click listener for selection
            td.addEventListener('click', (e) => {
                if (window.selectCell) window.selectCell(e.target, false); // No scroll on click
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

    if (statRows) statRows.textContent = rows.toLocaleString();
    if (statCols) statCols.textContent = cols.toLocaleString();
    if (statCells) statCells.textContent = cells.toLocaleString();
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
        // Create extended empty grid for scrolling comfort
        const cols = 26;
        const rows = 200;
        const headers = Array.from({ length: cols }, (_, i) => String.fromCharCode(65 + i));

        const data = [headers];
        for (let i = 0; i < rows; i++) {
            data.push(new Array(cols).fill(''));
        }

        window.workbookData = data;
        window.currentSheet = data;
        window.filteredData = null;

        displayData(data);
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
        let aVal = a[columnIndex];
        let bVal = b[columnIndex];

        // Handle Rich Data Objects (extract value)
        if (aVal && typeof aVal === 'object' && 'value' in aVal) aVal = aVal.value;
        if (bVal && typeof bVal === 'object' && 'value' in bVal) bVal = bVal.value;

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

// Auto Update Logic
function initializeAutoUpdater() {
    if (!window.electronAPI) return;

    const updateModal = document.getElementById('update-modal');
    const updateMessage = document.getElementById('update-message');
    const restartBtn = document.getElementById('restart-btn');
    const downloadProgress = document.getElementById('download-progress');

    // Listen for update check start
    window.electronAPI.onUpdateCheckStarted(() => {
        console.log('✅ [AUTO-UPDATE] Update check initiated from main process!');
    });

    window.electronAPI.onUpdateAvailable(() => {
        console.log('✅ [AUTO-UPDATE] Update available event received!');
        updateMessage.textContent = "Une nouvelle version a été détectée. Téléchargement automatique en cours...";
        updateModal.classList.remove('hidden');
        downloadProgress.style.display = 'block';
    });

    window.electronAPI.onUpdateDownloaded(() => {
        console.log('✅ [AUTO-UPDATE] Update downloaded event received!');
        updateMessage.textContent = "Mise à jour téléchargée ! Redémarrez pour l'appliquer.";
        downloadProgress.style.display = 'none';
        restartBtn.style.display = 'flex';
    });

    restartBtn.addEventListener('click', () => {
        window.electronAPI.quitAndInstall();
    });
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeSplashScreen();
    initializeEventListeners();
    initializeTheme();
    initializeGridInteractions(); // Initialize infinite scroll & interactions
    setupZoomInput(); // Initialize manual zoom input
    initializeKeyboardNavigation(); // Initialize Excel-like keyboard navigation
    if (typeof initializeTabs === 'function') initializeTabs();
    if (typeof initializeFileTabs === 'function') initializeFileTabs();

    // File Loaded Event
    if (window.electronAPI && window.electronAPI.onFileImported) {
        window.electronAPI.onFileImported((response) => {
            if (response.success && response.data) {
                // Handle Multi-Sheet Data
                const sheets = response.sheets || [{ name: 'Données', data: response.data }];

                window.allSheets = sheets;

                // Select first sheet by default
                const activeSheet = sheets[0];
                window.workbookData = activeSheet.data;
                window.currentSheet = activeSheet.data;
                window.filteredData = null; // Reset filters

                // Render Tabs
                if (typeof renderSheetTabs === 'function') {
                    renderSheetTabs(sheets);
                }

                // Trim empty rows BEFORE displaying
                trimTrailingEmptyRows();

                displayData(window.currentSheet);
                showDataSection();
                exportBtn.disabled = false;

                if (typeof dashboardController !== 'undefined') {
                    dashboardController.refreshDashboard();
                }
            } else {
                alert('Erreur lors du traitement du fichier : ' + response.error);
            }
        });

        // Handle File Updates (e.g. external save)
        if (window.electronAPI.onFileUpdated) {
            window.electronAPI.onFileUpdated((response) => {
                if (response.success && response.data) {
                    // Handle Multi-Sheet Data
                    const sheets = response.sheets || [{ name: 'Données', data: response.data }];
                    window.allSheets = sheets;

                    // Select first sheet or keep current index if possible
                    // For safety on update, valid to reset to 0 or keep context if mapped
                    const activeSheet = sheets[0];
                    window.workbookData = activeSheet.data;
                    window.currentSheet = activeSheet.data;
                    window.filteredData = null;

                    // Render Tabs - CRITICAL FIX
                    if (typeof renderSheetTabs === 'function') {
                        renderSheetTabs(sheets);
                    }

                    trimTrailingEmptyRows();
                    displayData(window.currentSheet);

                    if (typeof dashboardController !== 'undefined') {
                        dashboardController.refreshDashboard();
                    }
                }
            });
        }
    }

    initializeAutoUpdater(); // Initialize Auto Updater
    initializeFolderSelection(); // Initialize Folder Selection

    // Ensure we start with a scrollable sheet if empty
    if (!window.currentSheet) {
        createDefaultSheet();
    }
});

function createDefaultSheet() {
    const cols = 26;
    const rows = 200; // Guaranteed scroll
    const headers = Array.from({ length: cols }, (_, i) => String.fromCharCode(65 + i));
    const data = [headers];
    for (let i = 0; i < rows; i++) data.push(new Array(cols).fill(null));

    window.workbookData = data;
    window.currentSheet = data;

    if (typeof displayData === 'function') {
        displayData(data);
    }

    // Force switch to Data view
    const sections = ['import-section', 'charts-section', 'dashboard-section'];
    sections.forEach(id => document.getElementById(id)?.classList.add('hidden'));
    document.getElementById('data-section')?.classList.remove('hidden');

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-tab="data"]')?.classList.add('active');
}

// Function to render sheet tabs at the bottom
function renderSheetTabs(sheets) {
    let tabsBar = document.getElementById('sheet-tabs-bar');
    if (!tabsBar) {
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            tabsBar = document.createElement('div');
            tabsBar.id = 'sheet-tabs-bar';
            tabsBar.className = 'sheet-tabs-bar';
            tableContainer.appendChild(tabsBar);
        } else {
            return;
        }
    }

    tabsBar.innerHTML = '';

    // Hide tabs if only one sheet or less
    // Hide tabs ONLY if no sheets
    if (!sheets || sheets.length === 0) {
        tabsBar.classList.add('hidden');
        tabsBar.style.display = 'none';
        return;
    }

    tabsBar.classList.remove('hidden');
    tabsBar.style.display = 'flex';

    sheets.forEach((sheet, index) => {
        const tab = document.createElement('div');
        tab.className = 'sheet-tab';
        // Add Tooltip for long names
        tab.title = sheet.name || `Feuille ${index + 1}`;

        // Check if this sheet is the currently active one (by reference)
        if (sheet.data === window.currentSheet) {
            tab.classList.add('active');
        } else if (index === 0 && !window.currentSheet) {
            tab.classList.add('active'); // Fallback
        }

        tab.textContent = sheet.name || `Feuille ${index + 1}`;

        tab.addEventListener('click', () => {
            switchSheet(index);
        });

        tabsBar.appendChild(tab);
    });
}

function switchToAdjacentSheet(direction) {
    if (!window.allSheets || window.allSheets.length <= 1) return;

    // Find current index
    const currentIndex = window.allSheets.findIndex(s => s.data === window.currentSheet);
    if (currentIndex === -1) return;

    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < window.allSheets.length) {
        switchSheet(newIndex);
    }
}

function switchSheet(index) {
    if (!window.allSheets || !window.allSheets[index]) return;
    const sheet = window.allSheets[index];

    // 1. Save State of Current Sheet
    const tableWrapper = document.querySelector('.table-wrapper');
    const currentSheetIndex = window.allSheets.findIndex(s => s.data === window.currentSheet);

    if (currentSheetIndex !== -1 && tableWrapper) {
        window.sheetStates[currentSheetIndex] = {
            scrollTop: tableWrapper.scrollTop,
            scrollLeft: tableWrapper.scrollLeft,
            activeRow: window.keyboardState.activeRow,
            activeCol: window.keyboardState.activeCol,
            // selectedCell is DOM, so we store indices
        };
    }

    // 2. Update Active Tab UI
    document.querySelectorAll('.sheet-tab').forEach((t, i) => {
        if (i === index) t.classList.add('active');
        else t.classList.remove('active');
    });

    console.log(`Switching to sheet index: ${index} (${sheet.name})`);

    // 3. Switch Data
    window.currentSheet = sheet.data;
    window.workbookData = sheet.data;
    window.filteredData = null; // Clear filters on switch

    // 4. Re-render
    trimTrailingEmptyRows();
    displayData(window.currentSheet);

    // 5. Restore State (if exists)
    const savedState = window.sheetStates[index];
    if (savedState) {
        requestAnimationFrame(() => {
            const wrapper = document.querySelector('.table-wrapper');
            if (wrapper) {
                wrapper.scrollTop = savedState.scrollTop;
                wrapper.scrollLeft = savedState.scrollLeft;
            }

            // Restore Selection
            const tr = document.getElementById('table-body').children[savedState.activeRow];
            if (tr) {
                const td = tr.children[savedState.activeCol];
                if (td) {
                    window.selectCell(td, false); // Don't force scroll, we just set scrollTop manually
                    window.keyboardState.activeRow = savedState.activeRow;
                    window.keyboardState.activeCol = savedState.activeCol;
                }
            }
        });
    } else {
        // Default to first cell if no state
        window.keyboardState.activeRow = 0;
        window.keyboardState.activeCol = 0;
        requestAnimationFrame(() => {
            const firstCell = document.querySelector('#table-body tr:first-child td:first-child');
            if (firstCell) window.selectCell(firstCell, true);
            const wrapper = document.querySelector('.table-wrapper');
            if (wrapper) {
                wrapper.scrollTop = 0;
                wrapper.scrollLeft = 0;
            }
        });
    }
}

// Helper: Calculate contrast color (Black or White) for a given Hex background
function getContrastColor(hex) {
    if (!hex) return null;
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];

    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // YIQ equation
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#FFFFFF';
}

/* =========================================
   Excel-like Keyboard Navigation System
   ========================================= */

window.keyboardState = {
    activeRow: 0,
    activeCol: 0
};

window.sheetStates = {}; // Stores state for each sheet index: { scrollTop, scrollLeft, activeRow, activeCol }

function initializeKeyboardNavigation() {
    // 1. Click Synchronization
    document.getElementById('table-body').addEventListener('mousedown', (e) => {
        const cell = e.target.closest('td');
        if (!cell) return;
        const row = cell.parentElement;
        const body = row.parentElement;
        if (body.id !== 'table-body') return;

        const rows = Array.from(body.children);
        const cells = Array.from(row.children);
        window.keyboardState.activeRow = rows.indexOf(row);
        window.keyboardState.activeCol = cells.indexOf(cell);

        // Let default selection happen, then ensure we are focused
    });

    // 2. Global Key Listener
    document.addEventListener('keydown', (e) => {
        // Skip if focus is in an input (SearchBar, Zoom, etc)
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (!window.selectedCell) return;

        const isEditing = window.selectedCell.isContentEditable;

        // --- Edit Mode Handling ---
        if (isEditing) {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Commit Change
                window.selectedCell.blur(); // Triggers blur listener which saves data
                // Move selection (Shift+Enter = Up, Enter = Down)
                moveSelection(e.shiftKey ? -1 : 1, 0);
            } else if (e.key === 'Tab') {
                e.preventDefault();
                window.selectedCell.blur();
                moveSelection(0, e.shiftKey ? -1 : 1);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                // Cancel Edit (Restore is harder without history, but at least exit)
                // For now, simple blur. 
                window.selectedCell.blur();
                // Refocus table wrapper to capture next keys
                document.querySelector('.table-wrapper').focus();
            }
            // Allow arrows and text input to work normally inside the cell
            return;
        }

        // --- Navigation Mode Handling ---
        let dRow = 0;
        let dCol = 0;
        let handled = false;

        switch (e.key) {
            case 'ArrowUp': dRow = -1; handled = true; break;
            case 'ArrowDown': dRow = 1; handled = true; break;
            case 'ArrowLeft': dCol = -1; handled = true; break;
            case 'ArrowRight': dCol = 1; handled = true; break;

            case 'Tab':
                dCol = e.shiftKey ? -1 : 1;
                e.preventDefault();
                handled = true;
                break;

            case 'Enter':
                dRow = e.shiftKey ? -1 : 1;
                e.preventDefault();
                handled = true;
                break;

            case 'F2':
                e.preventDefault();
                enterEditMode();
                return;

            case 'Backspace':
                if (!e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    clearCellContent();
                }
                return;

            case 'PageUp':
                if (e.ctrlKey) {
                    e.preventDefault();
                    switchToAdjacentSheet(-1);
                    return;
                }
                break;

            case 'PageDown':
                if (e.ctrlKey) {
                    e.preventDefault();
                    switchToAdjacentSheet(1);
                    return;
                }
                break;
        }

        // Direct Typing (Overwrites cell)
        if (!handled && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            // Check if it's a valid char (letters, numbers, symbols)
            enterEditMode(true); // True = Clear first
            // Note: The first char might be swallowed if we focus immediately. 
            // Better UX: Programmatically set value to the char.
            // But 'keypress' is deprecated. 
            // Simple approach: Clear and Focus. User types char again? No, Excel types it.
            // Advanced: 
            window.selectedCell.textContent = e.key;
            // Move cursor to end
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(window.selectedCell);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
            e.preventDefault(); // Prevent double typing
            return;
        }

        if (handled) {
            e.preventDefault();
            // Handle Ctrl Jump (Not implemented fully, just standard move for now)
            // if (e.ctrlKey) ...

            moveSelection(dRow, dCol);
        }
    });
}

function moveSelection(dRow, dCol) {
    if (!window.currentSheet || !window.selectedCell) return;

    let newRow = window.keyboardState.activeRow + dRow;
    let newCol = window.keyboardState.activeCol + dCol;

    // Boundaries
    if (newRow < 0) newRow = 0;
    if (newCol < 0) newCol = 0;

    // Auto Expand Rows
    const currentDataRows = document.getElementById('table-body').children.length;
    if (newRow >= currentDataRows) {
        addMoreRows(1);
        // Wait for render
        setTimeout(() => {
            // Re-fetch because DOM updated
            const tr = document.getElementById('table-body').children[newRow];
            if (tr && tr.children[newCol]) {
                finishMove(newRow, newCol, tr.children[newCol]);
            }
        }, 50);
        return;
    }

    // Auto Expand Columns (Right Arrow) - Excel usually adds cols if you go far right? 
    // User requested "Limits of grid respected" but also "Infinite Scroll".
    // Existing code added cols on ArrowRight. I will keep that.
    const currentCols = window.currentSheet[0].length;
    if (newCol >= currentCols) {
        addMoreCols(1);
        setTimeout(() => {
            const tr = document.getElementById('table-body').children[newRow];
            if (tr && tr.children[newCol]) {
                finishMove(newRow, newCol, tr.children[newCol]);
            }
        }, 50);
        return;
    }

    // Normal Move
    const tr = document.getElementById('table-body').children[newRow];
    if (tr) {
        const td = tr.children[newCol];
        if (td) {
            finishMove(newRow, newCol, td);
        }
    }
}

function finishMove(row, col, cell) {
    window.keyboardState.activeRow = row;
    window.keyboardState.activeCol = col;
    if (window.selectCell) window.selectCell(cell, true);
}

function enterEditMode(clear = false) {
    if (!window.selectedCell) return;
    const cell = window.selectedCell;
    cell.contentEditable = true;
    cell.focus();
    cell.classList.add('editing');
    if (clear) {
        cell.textContent = '';
    }
}

function clearCellContent() {
    if (!window.selectedCell) return;
    window.selectedCell.textContent = '';

    // Update data model manually since blur won't trigger if we don't focus/blur
    // But usually we just update DOM and let the separate blur handler do it? 
    // The existing blur handler (line 784) listens to 'blur' on td.
    // If we simply change textContentprogrammatically, blur IS NOT triggered.
    // So we must update data manually.
    const rowIdx = window.keyboardState.activeRow; // Data index starts at 0 (Row 1 in sheet)
    const colIdx = window.keyboardState.activeCol;

    // window.currentSheet[0] is Header.
    // window.currentSheet[1] is Data Row 0.
    const sheetRowIdx = rowIdx + 1;

    if (window.currentSheet[sheetRowIdx]) {
        const cellData = window.currentSheet[sheetRowIdx][colIdx];
        if (typeof cellData === 'object' && cellData !== null) {
            cellData.value = '';
        } else {
            window.currentSheet[sheetRowIdx][colIdx] = '';
        }
    }
}

// --- SHEET TABS (Bottom Bar) ---
window.renderSheetTabs = function (sheets) {
    try {
        if (!sheets || !Array.isArray(sheets) || sheets.length === 0) return;

        // 1. Find or Create Container
        let container = document.getElementById('sheet-tabs-container');
        if (!container) {
            // Try to insert after table-wrapper inside table-container
            const tableContainer = document.querySelector('.table-container');
            if (tableContainer) {
                container = document.createElement('div');
                container.id = 'sheet-tabs-container';
                container.className = 'sheet-tabs-container';
                tableContainer.appendChild(container);
            } else {
                // Fallback: append to data-section
                const dataSection = document.getElementById('data-section');
                if (dataSection) {
                    container = document.createElement('div');
                    container.id = 'sheet-tabs-container';
                    container.className = 'sheet-tabs-container';
                    dataSection.appendChild(container);
                }
            }
        }

        if (!container) {
            console.error('[SheetTabs] Failed to create container');
            return;
        }

        console.log('[SheetTabs] Rendering tabs into container:', container.id);

        // 2. Clear and Render
        container.innerHTML = '';

        // Ensure global state
        window.allSheets = sheets;

        sheets.forEach((sheet, index) => {
            const btn = document.createElement('button');
            btn.className = 'sheet-tab';
            btn.textContent = sheet.name || `Feuille ${index + 1}`;

            // Active State
            if (sheet.data === window.currentSheet) {
                btn.classList.add('active');
            }

            btn.onclick = () => {
                if (typeof switchSheet === 'function') {
                    switchSheet(index);
                }
            };

            container.appendChild(btn);
        });
    } catch (e) {
        console.error('[SheetTabs] Critical Error rendering tabs:', e);
    }
};
