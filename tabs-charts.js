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
            generateAutoCharts();
        }
    } else if (tabName === 'dashboard') {
        document.getElementById('dashboard-section')?.classList.remove('hidden');
    }
}

// Auto Charts Generation - Enhanced
let autoCharts = [];
let allChartsData = [];

function generateAutoCharts() {
    const container = document.getElementById('auto-charts-container');
    if (!container || !window.currentSheet || window.currentSheet.length < 2) return;

    // Clear existing charts
    autoCharts.forEach(chart => chart.destroy());
    autoCharts = [];
    allChartsData = [];
    container.innerHTML = '';

    const headers = window.currentSheet[0];
    const rows = window.currentSheet.slice(1);

    // Find numeric columns with stats
    const numericColumns = [];
    headers.forEach((header, index) => {
        const values = rows.map(row => parseFloat(row[index])).filter(v => !isNaN(v));
        if (values.length > rows.length * 0.5) {
            const sum = values.reduce((a, b) => a + b, 0);
            const avg = sum / values.length;
            const min = Math.min(...values);
            const max = Math.max(...values);

            numericColumns.push({
                index,
                header: header || `Colonne ${index + 1}`,
                values,
                stats: { sum, avg, min, max, count: values.length }
            });
        }
    });

    allChartsData = numericColumns;
    renderCharts(numericColumns);
    setupChartsControls();
}

function renderCharts(chartsData) {
    const container = document.getElementById('auto-charts-container');
    container.innerHTML = '';

    if (chartsData.length === 0) {
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
        return;
    }

    chartsData.forEach((col, chartIndex) => {
        const chartCard = document.createElement('div');
        chartCard.className = 'chart-card glass-card';
        chartCard.dataset.chartName = col.header.toLowerCase();

        const cardHeader = document.createElement('div');
        cardHeader.className = 'chart-card-header';
        cardHeader.innerHTML = `
            <h3>${col.header}</h3>
            <div class="chart-stats">
                <div class="chart-stat">
                    <span class="chart-stat-label">Moy:</span>
                    <span class="chart-stat-value">${col.stats.avg.toFixed(1)}</span>
                </div>
                <div class="chart-stat">
                    <span class="chart-stat-label">Min:</span>
                    <span class="chart-stat-value">${col.stats.min}</span>
                </div>
                <div class="chart-stat">
                    <span class="chart-stat-label">Max:</span>
                    <span class="chart-stat-value">${col.stats.max}</span>
                </div>
                <div class="chart-stat">
                    <span class="chart-stat-label">Total:</span>
                    <span class="chart-stat-value">${col.stats.count}</span>
                </div>
            </div>
        `;
        chartCard.appendChild(cardHeader);

        const canvasWrapper = document.createElement('div');
        canvasWrapper.className = 'chart-canvas-wrapper';

        const canvas = document.createElement('canvas');
        canvas.id = `auto-chart-${chartIndex}`;
        canvasWrapper.appendChild(canvas);
        chartCard.appendChild(canvasWrapper);

        container.appendChild(chartCard);

        // Create chart with theme-aware colors
        const ctx = canvas.getContext('2d');
        const labels = window.currentSheet.slice(1, 21).map((row, i) => row[0] || `Ligne ${i + 1}`);
        const data = col.values.slice(0, 20);

        // Detect current theme
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        // Theme-aware colors
        const barColor = isDark ? 'rgba(110, 181, 255, 0.7)' : 'rgba(0, 102, 204, 0.6)';
        const barBorderColor = isDark ? 'rgba(110, 181, 255, 1)' : 'rgba(0, 102, 204, 1)';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
        const textColor = isDark ? '#b8bcc4' : '#495057';
        const tooltipBg = isDark ? 'rgba(37, 45, 61, 0.95)' : 'rgba(0, 0, 0, 0.8)';

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: col.header,
                    data: data,
                    backgroundColor: barColor,
                    borderColor: barBorderColor,
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: tooltipBg,
                        padding: 12,
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        titleColor: isDark ? '#e8eaed' : '#ffffff',
                        bodyColor: isDark ? '#b8bcc4' : '#ffffff',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: gridColor,
                            drawBorder: false
                        },
                        ticks: {
                            color: textColor,
                            font: { size: 11 }
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: textColor,
                            font: { size: 11 },
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });

        autoCharts.push(chart);
    });
}

function setupChartsControls() {
    const searchInput = document.getElementById('charts-search');
    const sortSelect = document.getElementById('charts-sort');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterAndSortCharts(e.target.value, sortSelect?.value || 'name-asc');
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            filterAndSortCharts(searchInput?.value || '', e.target.value);
        });
    }
}

function filterAndSortCharts(searchTerm, sortBy) {
    let filtered = allChartsData;

    // Filter by search
    if (searchTerm) {
        filtered = filtered.filter(col =>
            col.header.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    // Sort with all options
    filtered = [...filtered].sort((a, b) => {
        switch (sortBy) {
            case 'name-asc':
                return a.header.localeCompare(b.header);
            case 'name-desc':
                return b.header.localeCompare(a.header);
            case 'avg-desc':
                return b.stats.avg - a.stats.avg;
            case 'avg-asc':
                return a.stats.avg - b.stats.avg;
            case 'sum-desc':
                return b.stats.sum - a.stats.sum;
            case 'sum-asc':
                return a.stats.sum - b.stats.sum;
            case 'max-desc':
                return b.stats.max - a.stats.max;
            case 'max-asc':
                return a.stats.max - b.stats.max;
            case 'min-desc':
                return b.stats.min - a.stats.min;
            case 'min-asc':
                return a.stats.min - b.stats.min;
            case 'count-desc':
                return b.stats.count - a.stats.count;
            case 'count-asc':
                return a.stats.count - b.stats.count;
            case 'range-desc':
                return (b.stats.max - b.stats.min) - (a.stats.max - a.stats.min);
            case 'range-asc':
                return (a.stats.max - a.stats.min) - (b.stats.max - b.stats.min);
            default:
                return 0;
        }
    });

    // Clear and re-render
    autoCharts.forEach(chart => chart.destroy());
    autoCharts = [];
    renderCharts(filtered);
}
