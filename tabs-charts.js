// Tabs Management
function initializeTabs() {
    // Attach click listeners to tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    // Show data tab by default if data is loaded
    if (window.currentSheet) {
        switchTab('data');
    }
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });

    // Hide all sections
    document.getElementById('data-section')?.classList.add('hidden');
    document.getElementById('charts-section')?.classList.add('hidden');
    document.getElementById('dashboard-section')?.classList.add('hidden');
    document.getElementById('import-section')?.classList.add('hidden');

    // Show selected section
    if (tabName === 'data') {
        if (window.currentSheet) {
            document.getElementById('data-section')?.classList.remove('hidden');
        } else {
            document.getElementById('import-section')?.classList.remove('hidden');
        }
    } else if (tabName === 'charts') {
        document.getElementById('charts-section')?.classList.remove('hidden');
        if (window.currentSheet) {
            // Wait for layout to be computed to avoid 0-width charts
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    generateAutoCharts();
                });
            });
        }
    } else if (tabName === 'dashboard') {
        document.getElementById('dashboard-section')?.classList.remove('hidden');
    }
}

// Auto Charts Generation - Enhanced
// Multi-Sheet Charts Generation
let autoCharts = [];
let allChartsData = []; // Now stores { sheetIndex, sheetName, colData }

function generateAutoCharts() {
    const container = document.getElementById('auto-charts-container');
    if (!container) return;

    // Clear existing charts
    autoCharts.forEach(chart => chart.destroy());
    autoCharts = [];
    allChartsData = [];
    container.innerHTML = '';

    // Determine sheets to process
    const sheets = window.allSheets && window.allSheets.length > 0
        ? window.allSheets
        : (window.currentSheet ? [{ name: 'Données', data: window.currentSheet }] : []);

    if (sheets.length === 0) {
        renderEmptyState(container);
        return;
    }

    // Generate specific section for each sheet
    sheets.forEach((sheet, index) => {
        // Skip empty sheets if any OR sheets with insufficient data
        // Check for at least 2 rows (Headers + Data)
        if (!sheet.data || sheet.data.length < 2) return;

        // Create Section ID
        const sectionId = `charts-section-${index}`;

        // Create Section Container
        const section = document.createElement('div');
        section.className = 'sheet-charts-section';
        section.dataset.sheetIndex = index;

        // Add Section Header
        const header = document.createElement('h2');
        header.className = 'sheet-charts-title';
        header.textContent = sheet.name;
        section.appendChild(header);

        // Add Charts Container for this sheet
        const chartsWrapper = document.createElement('div');
        chartsWrapper.className = 'sheet-charts-wrapper';
        chartsWrapper.id = sectionId;
        section.appendChild(chartsWrapper);

        container.appendChild(section);

        // Generate charts for this specific sheet
        generateChartsForSheet(sheet, chartsWrapper, index);
    });

    if (allChartsData.length === 0) {
        renderEmptyState(container);
    }
    setupChartsControls();
}

function renderEmptyState(container) {
    container.innerHTML = `
        <div class="charts-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 3v18h18" stroke-width="2"/>
                <path d="M18 17V9M13 17v-6M8 17v-3" stroke-width="2"/>
            </svg>
            <h3>Aucune colonne numérique</h3>
            <p>Importez des données contenant des valeurs numériques pour générer des graphiques</p>
        </div>
    `;
}

// Helper: Find best header row dynamically
function findHeaderRow(data) {
    if (!data || data.length === 0) return 0;

    // Scan first 10 rows
    const limit = Math.min(data.length, 10);
    let bestRow = 0;
    let maxScore = -1; // Combined score

    for (let r = 0; r < limit; r++) {
        const row = data[r];
        if (!row) continue;

        let textCount = 0;
        let filledCount = 0;
        let totalLen = 0;

        row.forEach(cell => {
            // Handle both raw values and rich objects
            let val = cell;
            if (val && typeof val === 'object' && !Array.isArray(val)) val = val.value;

            if (val !== undefined && val !== null && val !== '') {
                filledCount++;
                // Check if string and not numeric
                const str = String(val).trim();
                const isNum = !isNaN(parseFloat(str.replace(/,/g, '.')));
                if (!isNum && isNaN(Number(str))) {
                    textCount++;
                    totalLen += str.length;
                }
            }
        });

        const avgLen = textCount > 0 ? totalLen / textCount : 0;
        // Score logic
        const score = textCount * (Math.log(avgLen + 1) + 1);

        if (score > maxScore) {
            maxScore = score;
            bestRow = r;
        }
    }

    // Safety: If no good text row found, fallback to 0
    if (maxScore <= 0) return 0;

    return bestRow;
}

function generateChartsForSheet(sheet, container, sheetIndex) {
    // Dynamic Header Detection
    const headerRowIndex = findHeaderRow(sheet.data);

    // "System" headers (raw objects from that row)
    const systemHeaders = sheet.data[headerRowIndex];
    // "User" headers (raw objects from that row)
    const attributeNames = sheet.data[headerRowIndex];
    // Data Rows (start immediately after header)
    let dataRows = sheet.data.slice(headerRowIndex + 1);

    // FILTER: Remove rows where ANY of the first 5 columns contain "Ligne XX"
    dataRows = dataRows.filter(row => {
        if (!row) return false;
        const limit = Math.min(row.length, 20);
        for (let i = 0; i < limit; i++) {
            let label = row[i];
            let strLabel = '';
            if (label === null || label === undefined) {
                strLabel = '';
            } else if (typeof label === 'object') {
                if (label.richText) {
                    strLabel = label.richText.map(rt => rt.text).join('');
                } else if (label.result !== undefined) {
                    strLabel = String(label.result);
                } else if (label.value !== undefined) {
                    strLabel = String(label.value);
                } else {
                    strLabel = String(label);
                }
            } else {
                strLabel = String(label);
            }
            strLabel = strLabel.trim();
            const upper = strLabel.toUpperCase();
            if (upper.includes('LIGNE')) {
                return false;
            }
        }
        return true;
    });

    // Find numeric columns
    const numericColumns = [];

    if (!systemHeaders) return;

    systemHeaders.forEach((systemH, index) => {
        let rawHeaderVal = attributeNames[index];
        if (rawHeaderVal && typeof rawHeaderVal === 'object' && !Array.isArray(rawHeaderVal)) {
            rawHeaderVal = rawHeaderVal.value;
        }

        let displayHeader = rawHeaderVal;
        if (displayHeader === null || displayHeader === undefined || displayHeader === '') {
            displayHeader = (sheet.columns && sheet.columns[index]) ? sheet.columns[index].name : `Column ${index + 1}`;
        }

        const isLigne = /^Ligne\s*\d+/i.test(String(displayHeader).trim());
        if (isLigne) return;

        const values = dataRows.map(row => {
            if (!row) return NaN;
            let val = row[index];
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                val = val.value;
            }
            if (typeof val === 'number') return val;
            if (!val) return NaN;
            val = String(val).replace(/,/g, '.').replace(/[^\d.-]/g, '');
            return parseFloat(val);
        }).filter(v => !isNaN(v));

        const isValid = values.length > 0 && values.length > dataRows.length * 0.1;

        if (isValid) {
            const sum = values.reduce((a, b) => a + b, 0);
            const avg = sum / values.length;
            const min = Math.min(...values);
            const max = Math.max(...values);
            const count = values.length;

            const colData = {
                index,
                header: displayHeader,
                values,
                stats: { sum, avg, min, max, count },
                sheetIndex: sheetIndex,
                sheetName: sheet.name,
                chartId: `chart-${sheetIndex}-${index}`
            };

            numericColumns.push(colData);
            allChartsData.push(colData);
        }
    });

    // Render charts for this sheet
    if (numericColumns.length >= 1) {
        renderStoreCharts(sheet, container, sheetIndex);
    }
}

function renderStoreCharts(sheet, container, sheetIndex) {
    // 1. Header Analysis
    const headerRowIndex = findHeaderRow(sheet.data);
    const headers = sheet.data[headerRowIndex].map(h => {
        if (!h) return '';
        if (typeof h === 'object') return h.value || '';
        return String(h).trim();
    });

    // 2. Column Identification Handlers
    const findCol = (keywords) => {
        return headers.findIndex(h => {
            const lower = String(h).toLowerCase();
            return keywords.some(k => lower.includes(k.toLowerCase()));
        });
    };

    // Strict Keywords based on "CA Réalisé" and "Objectif"
    const caIndex = findCol(['ca réalisé', "chiffre d'affaires", 'ca', 'realise', 'réalisé']);
    const objIndex = findCol(['objectif', 'budget', 'prevu', 'prévu', 'obj']);

    if (caIndex === -1 || objIndex === -1) {
        container.innerHTML = `
            <div class="charts-empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke-width="2"/>
                </svg>
                <h3>Colonnes manquantes</h3>
                <p>Pour générer les graphiques, le fichier doit contenir des colonnes explicites :<br>
                <strong>"CA Réalisé"</strong> et <strong>"Objectif"</strong>.</p>
                <p class="text-secondary text-sm">Colonnes détectées : ${headers.join(', ')}</p>
            </div>
        `;
        return;
    }

    // 3. Data Extraction (Rows)
    const dataRows = sheet.data.slice(headerRowIndex + 1);

    // Find Store Name Column (First non-numeric/empty column that isn't CA or Obj)
    const nameIndex = 0;

    const storeChartsContainer = document.createElement('div');
    storeChartsContainer.className = 'store-charts-grid';
    // Removed inline styles to use CSS class instead

    let chartsGenerated = 0;

    dataRows.forEach((row, rowIndex) => {
        if (!row) return;

        // Extract Store Name
        let storeName = row[nameIndex];
        if (storeName && typeof storeName === 'object') storeName = storeName.value;
        storeName = String(storeName || '').trim();

        // Skip "Ligne X" or empty names
        if (!storeName || /ligne\s*\d+/i.test(storeName)) return;

        // Skip Metadata/Header rows disguised as stores
        const lowerName = storeName.toLowerCase();
        if (['objectif', 'total', 'ca realise', 'ca réalisé', '% de realisation', '% de réalisation', 'moyenne'].some(k => lowerName.includes(k))) return;

        // Extract Values
        const getVal = (idx) => {
            let val = row[idx];
            if (val && typeof val === 'object') val = val.value;
            if (typeof val === 'string') val = val.replace(/\s/g, '').replace(',', '.');
            const num = parseFloat(val);
            return isNaN(num) ? 0 : num;
        };

        const ca = getVal(caIndex);
        const obj = getVal(objIndex);

        // 4. Calculation Rules
        // % = (CA / Objectif) * 100
        let percent = 0;
        let percentLabel = 'N/A';

        if (obj && obj > 0) {
            percent = (ca / obj) * 100;
            percentLabel = percent.toFixed(1) + '%';
        } else {
            percent = 0;
        }

        chartsGenerated++;

        // 5. Chart Card Creation
        const card = document.createElement('div');
        card.className = 'chart-card glass-card';
        card.dataset.storeName = storeName.toLowerCase();
        card.dataset.ca = ca;
        card.dataset.percent = percent;

        // Header
        const header = document.createElement('div');
        header.className = 'chart-card-header';
        header.innerHTML = `
            <h3 class="store-name" title="${storeName}">${storeName}</h3>
            <div class="store-metrics">
                <span class="badge ${percent >= 100 ? 'badge-success' : 'badge-warning'}">
                    % Réal: ${percentLabel}
                </span>
            </div>
        `;
        card.appendChild(header);

        // Canvas
        const canvasWrapper = document.createElement('div');
        canvasWrapper.className = 'chart-canvas-wrapper';
        canvasWrapper.style.height = '300px';

        const canvas = document.createElement('canvas');
        canvas.id = `store-chart-${sheetIndex}-${rowIndex}`;
        canvasWrapper.appendChild(canvas);
        card.appendChild(canvasWrapper);
        storeChartsContainer.appendChild(card);

        // 6. Chart.js Config
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const ctx = canvas.getContext('2d');

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['CA Réalisé', 'Objectif'],
                datasets: [
                    {
                        label: 'Montant (€)',
                        data: [ca, obj],
                        backgroundColor: [
                            'rgba(75, 192, 192, 0.7)',
                            'rgba(54, 162, 235, 0.7)'
                        ],
                        borderColor: [
                            'rgba(75, 192, 192, 1)',
                            'rgba(54, 162, 235, 1)'
                        ],
                        borderWidth: 1,
                        yAxisID: 'y',
                        order: 2
                    },
                    {
                        label: '% Réalisation',
                        type: 'line',
                        data: [percent, percent],
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        borderWidth: 2,
                        pointRadius: 4,
                        yAxisID: 'y1',
                        order: 1,
                        borderDash: [5, 5]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                let label = ctx.dataset.label || '';
                                if (label) label += ': ';
                                if (ctx.dataset.yAxisID === 'y1') {
                                    return label + ctx.raw.toFixed(1) + '%';
                                }
                                return label + new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(ctx.raw);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Montant (€)' },
                        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: '% Réalisation' },
                        grid: { drawOnChartArea: false },
                        suggestedMax: 120, // Give some headroom
                        suggestedMin: 0
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
        autoCharts.push(chart);
    });

    if (chartsGenerated === 0) {
        container.innerHTML = `
            <div class="charts-empty-state">
                <h3>Aucune donnée valide trouvée</h3>
                <p>Vérifiez les noms des magasins et les valeurs numériques.</p>
            </div>
        `;
    } else {
        container.appendChild(storeChartsContainer);
    }
}

function setupChartsControls() {
    const searchInput = document.getElementById('charts-search');
    const sortSelect = document.getElementById('charts-sort');

    if (searchInput) {
        searchInput.oninput = (e) => filterAndSortCharts(e.target.value, sortSelect?.value);
    }

    if (sortSelect) {
        sortSelect.onchange = (e) => filterAndSortCharts(searchInput?.value, e.target.value);
    }

    // Trigger initial sort
    filterAndSortCharts(searchInput?.value || '', sortSelect?.value || 'name-asc');
}

function filterAndSortCharts(searchTerm, sortBy) {
    const term = (searchTerm || '').toLowerCase();
    const sortParams = (sortBy || 'name-asc').split('-');
    const criteria = sortParams[0]; // name, sum (ca), avg (percent)
    const direction = sortParams[1]; // asc, desc

    // 1. Filter Visibility (Global)
    const cards = document.querySelectorAll('.chart-card');
    cards.forEach(card => {
        const name = card.dataset.storeName || '';
        const visible = !term || name.includes(term);
        // Use setProperty for priority if needed, but standard style works with our CSS fix
        card.style.display = visible ? 'flex' : 'none';
    });

    // 2. Sort Per Sheet/Grid
    const grids = document.querySelectorAll('.store-charts-grid');
    grids.forEach(grid => {
        const gridCards = Array.from(grid.children);

        gridCards.sort((a, b) => {
            let valA, valB;

            if (criteria === 'name') {
                valA = a.dataset.storeName || '';
                valB = b.dataset.storeName || '';
                return direction === 'asc'
                    ? valA.localeCompare(valB)
                    : valB.localeCompare(valA);
            }

            // Numeric Sorts
            if (criteria === 'sum') { // Mapped to CA
                valA = parseFloat(a.dataset.ca || 0);
                valB = parseFloat(b.dataset.ca || 0);
            } else if (criteria === 'avg') { // Mapped to Percent
                valA = parseFloat(a.dataset.percent || 0);
                valB = parseFloat(b.dataset.percent || 0);
            } else {
                return 0;
            }

            return direction === 'asc' ? valA - valB : valB - valA;
        });

        // Re-append in order
        gridCards.forEach(card => grid.appendChild(card));
    });

    // 3. Hide Empty Sections
    const sections = document.querySelectorAll('.sheet-charts-section');
    sections.forEach(section => {
        const visibleCards = section.querySelectorAll('.chart-card:not([style*="display: none"])');
        section.style.display = visibleCards.length > 0 ? 'block' : 'none';
    });


}
