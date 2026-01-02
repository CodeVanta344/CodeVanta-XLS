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
let generateChartsDebounce = null;

function generateAutoCharts() {
    // DEBOUNCE: Prevent rapid firing
    if (generateChartsDebounce) clearTimeout(generateChartsDebounce);
    generateChartsDebounce = setTimeout(doGenerateAutoCharts, 300);
}

function doGenerateAutoCharts() {
    const container = document.getElementById('auto-charts-container');
    if (!container) return;

    console.log('[AutoCharts] Starting Generation...');

    // Clear existing charts
    autoCharts.forEach(chart => chart.destroy());
    autoCharts = [];
    allChartsData = [];
    container.innerHTML = '';

    // Determine sheets to process
    let sheets = window.allSheets && window.allSheets.length > 0
        ? window.allSheets
        : (window.currentSheet ? [{ name: 'Données', data: window.currentSheet }] : []);

    // FIX: Deduplicate sheets based on name to prevent accumulation
    const uniqueNames = new Set();
    sheets = sheets.filter(s => {
        if (uniqueNames.has(s.name)) return false;
        uniqueNames.add(s.name);
        return true;
    });

    console.log('[AutoCharts] Sheets to process:', sheets.length);

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

        // Uniqueness Check (Penalize merged titles repeated across columns)
        const uniqueValues = new Set();
        row.forEach(cell => {
            let val = cell;
            if (val && typeof val === 'object') val = val.value;
            if (val) uniqueValues.add(String(val).trim());
        });
        const uniqueRatio = filledCount > 0 ? uniqueValues.size / filledCount : 0;

        // Score logic: Favor Text + Length + Uniqueness. Heavily penalize duplicates IF they are long (merged titles).
        let score = textCount * (Math.log(avgLen + 1) + 1);

        // Only penalize low uniqueness if the text is LONG (likely a title row like "Suivi des objectifs...")
        if (uniqueRatio < 0.5 && avgLen > 15) {
            score *= 0.1; // Hard penalty for repeated titles
        } else if (uniqueRatio < 0.8) {
            // Mild penalty for other repetitions
            score *= 0.8;
        }

        // KEYWORD BONUS: Strongly favor rows that actually contain the headers we need
        let keywordBonus = 0;
        row.forEach(cell => {
            let val = cell;
            if (val && typeof val === 'object') val = val.value;
            const str = String(val || '').trim().toLowerCase();

            // Only boost SHORT strings (avoid boosting the long title sentence)
            if (str.length > 0 && str.length < 20) {
                if (['ca', 'objectif', 'obj', 'realise', 'réalisé', 'budget', 'prevu', 'prévu'].some(k => str === k || str.includes(k))) {
                    keywordBonus += 20; // Huge bonus per match
                }
            }
        });
        score += keywordBonus;

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
    // Debug Data Dump - REMOVED for clarity

    // BLOCK DETECTION STRATEGY (For Report-style files)
    // Structure detected: 
    // Row N: Store Name ("GRIM PASSION...")
    // Row N+1: "CA REALISE" | Val1 | Val2...
    // Row N+2: "OBJECTIF" | Val1 | Val2...

    let workingData = sheet.data;

    let blockData = [];
    if (sheet.data && sheet.data.length > 0) {
        for (let i = 0; i < sheet.data.length; i++) {
            const row = sheet.data[i];
            // Relaxed Detection: Scan ENTIRE row for keywords
            const rowStr = row.map(cell =>
                String((cell && typeof cell === 'object' ? cell.value : cell) || '').toLowerCase().trim()
            ).join(' ');

            // Trigger on "CA Row" - Using normalize logic for spacing robustness
            const normalizedRow = rowStr.replace(/\s+/g, ' ');
            if (normalizedRow.includes('ca realise') || normalizedRow.includes('ca réalisé')) {
                // Look for Name in previous row(s)
                let name = `Store ${blockData.length + 1}`;
                if (i > 0) {
                    const prevRow = sheet.data[i - 1];
                    const prevCell = (prevRow[0] && typeof prevRow[0] === 'object' ? prevRow[0].value : prevRow[0]);
                    if (prevCell) name = String(prevCell).trim();
                }

                // Extract CA Value (heuristic: max value in row, or last value)
                const extractValue = (r) => {
                    const nums = r.slice(1).map(c => {
                        let v = (c && typeof c === 'object' ? c.value : c);
                        if (typeof v === 'string') v = v.replace(/,/g, '.').replace(/\s/g, '');
                        return parseFloat(v);
                    }).filter(n => !isNaN(n));
                    // FIX: Take FIRST value (usually the Store's value, not the total/meta data at the end)
                    return nums.length > 0 ? nums[0] : 0;
                };

                const caVal = extractValue(row);



                // Look for Objectif in next row
                let objVal = 0;
                if (i + 1 < sheet.data.length) {
                    const nextRow = sheet.data[i + 1];
                    const nextRowStr = nextRow.map(cell =>
                        String((cell && typeof cell === 'object' ? cell.value : cell) || '').toLowerCase().trim()
                    ).join(' ');

                    if (nextRowStr.replace(/\s+/g, ' ').includes('objectif')) {
                        objVal = extractValue(nextRow);
                    }
                }

                if (caVal > 0 || objVal > 0) {
                    blockData.push({
                        name: name,
                        ca: caVal,
                        percent: objVal > 0 ? (caVal / objVal) * 100 : 0,
                        obj: objVal
                    });
                }
            }
        }
    }

    // If blocks found, force formatting and skip standard detection
    if (blockData.length > 0) {
        console.info(`[AutoCharts] Detected ${blockData.length} store blocks in sheet '${sheet.name}'`);
        // Synthesize a clean table for the rest of the app to consume
        // Apply the synthesized table (Local copy only, do not mutate original sheet)
        workingData = [
            ['Magasin', 'CA Réalisé', 'Objectif'], // Header
            ...blockData.map(d => [d.name, d.ca, d.obj])
        ];
        // Continue to standard processing (which will now work perfectly)
    }

    // Dynamic Header Detection
    const headerRowIndex = findHeaderRow(workingData);

    // "System" headers (raw objects from that row)
    const systemHeaders = workingData[headerRowIndex];
    // "User" headers (raw objects from that row)
    const attributeNames = workingData[headerRowIndex];
    // Data Rows (start immediately after header)
    let dataRows = workingData.slice(headerRowIndex + 1);

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

    console.log('Numeric columns found:', numericColumns.length, 'for sheet:', sheetIndex);

    // Render charts for this sheet
    if (numericColumns.length >= 1) {
        // Pass a proxy sheet with the working data to avoid mutating the original
        const proxySheet = { ...sheet, data: workingData };
        renderStoreCharts(proxySheet, container, sheetIndex);
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
    const findCol = (keywords, excludeKeywords = []) => {
        return headers.findIndex(h => {
            const lower = String(h).toLowerCase();
            const matches = keywords.some(k => lower.includes(k.toLowerCase()));
            if (!matches) return false;
            if (excludeKeywords.length > 0) {
                if (excludeKeywords.some(ex => lower.includes(ex.toLowerCase()))) return false;
            }
            return true;
        });
    };

    // Strict Keywords with Exclusion to avoid "Objectif CA" being picked as CA
    const caIndex = findCol(
        ['ca réalisé', "chiffre d'affaires", 'ca', 'realise', 'réalisé'],
        ['objectif', 'budget', 'prevu', 'prévu']
    );
    const objIndex = findCol(
        ['objectif', 'budget', 'prevu', 'prévu', 'obj'],
        ['realise', 'réalisé'] // Optional: usually Objectif doesn't contain Realise
    );

    // SAFETY CHECK: If both detected the same column, force searching for a different Objectif column
    if (caIndex !== -1 && caIndex === objIndex) {
        objIndex = headers.findIndex((h, idx) => {
            if (idx === caIndex) return false; // Skip the CA column
            const lower = String(h).toLowerCase();
            return ['objectif', 'budget', 'prevu', 'prévu', 'obj'].some(k => lower.includes(k));
        });
    }

    if (caIndex === -1 || objIndex === -1) {
        // Suppress error for likely junk/empty sheets (common in Excel files like 'Feuil1')
        console.warn(`[Charts] Skipping sheet '${sheet.name}': Missing CA/Objectif columns.`);

        // Only show message if it looks like a legitimate data sheet (enough rows/cols) but failed detection
        if (sheet.data.length > 5 && sheet.data[0].length > 2) {
            container.innerHTML = `
                <div class="charts-empty-state" style="background: #f8f9fa; border: 1px dashed #ced4da; color: #6c757d;">
                    <h3 style="font-size: 14px; margin: 0;">Données non reconnues pour '${sheet.name}'</h3>
                    <p style="font-size: 12px; margin: 5px 0 0 0;">Colonnes CA/Objectif introuvables. Vérifiez les en-têtes.</p>
                </div>
            `;
        } else {
            // Silent skip for empty/irrelevant sheets
            container.style.display = 'none';
        }
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
        if (!storeName || /ligne\s*\d+/i.test(storeName)) {
            console.log('Skipping row (Invalid Name):', rowIndex, storeName);
            return;
        }

        // Skip Metadata/Header rows disguised as stores
        const lowerName = storeName.toLowerCase();
        if (['objectif', 'total', 'ca realise', 'ca réalisé', '% de realisation', '% de réalisation', 'moyenne'].some(k => lowerName.includes(k))) {
            console.log('Skipping row (Metadata name):', rowIndex, storeName);
            return;
        }

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
            percent = 0; // Avoid division by zero
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
                <span class="badge ${percent >= 100 ? 'badge-success' : 'badge-warning'}" title="Taux de réalisation">
                    % de réalisation : ${percentLabel}
                </span>
            </div>
        `;

        card.appendChild(header);

        // Canvas
        const canvasWrapper = document.createElement('div');
        canvasWrapper.className = 'chart-canvas-wrapper';
        canvasWrapper.style.height = '300px';

        const canvas = document.createElement('canvas');
        canvas.id = `store - chart - ${sheetIndex} -${rowIndex} `;
        canvasWrapper.appendChild(canvas);
        card.appendChild(canvasWrapper);
        storeChartsContainer.appendChild(card);

        // 6. Chart.js Config
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const ctx = canvas.getContext('2d');

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['CA', 'Objectif'],
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
                        borderRadius: 4,
                        maxBarThickness: 50
                    }
                ]
            },
            options: {
                responsive: true,
                resizeDelay: 200, // Debounce resize events
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }, // Hide legend to save space
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                let label = ctx.dataset.label || '';
                                if (label) label += ': ';
                                return label + new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(ctx.raw);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { weight: 'bold' }, autoSkip: false } // Force labels
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
                        ticks: {
                            callback: function (value) {
                                return new Intl.NumberFormat('fr-FR', { notation: "compact", compactDisplay: "short" }).format(value) + ' €';
                            }
                        }
                    }
                }
            }
        });

        autoCharts.push(chart);
    });

    console.log('Total charts generated:', chartsGenerated);
    if (chartsGenerated === 0) {
        container.innerHTML = `
            < div class="charts-empty-state" >
                <h3>Aucune donnée valide trouvée</h3>
                <p>Vérifiez les noms des magasins et les valeurs numériques.</p>
            </div >
            `;
    } else {
        // Check if any charts were actually generated
        if (chartsGenerated === 0) {
            container.innerHTML = `
            < div class="charts-empty-state" >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2"/>
                </svg>
                <h3>Aucune donnée valide</h3>
                <p>Les colonnes ont été trouvées, mais aucune ligne de donnée n'a pu être extraite.</p>
                <p class="text-secondary text-sm">Vérifiez le contenu de vos cellules.</p>
            </div >
            `;
            return;
        }

        container.innerHTML = ''; // FIX: Clear previous content to prevent infinite duplication
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
        const hasError = section.querySelector('.charts-empty-state');
        section.style.display = (visibleCards.length > 0 || hasError) ? 'block' : 'none';
    });


}
