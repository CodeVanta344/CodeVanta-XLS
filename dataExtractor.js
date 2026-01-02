const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

class DataExtractor {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    // Helper: Normalize ExcelJS cell value
    extractCellValue(cell) {
        if (!cell) return null;
        let val = cell.value;

        // 1. Handle Object Values
        if (val && typeof val === 'object') {
            // Formula
            if (val.formula) {
                return (val.result && typeof val.result === 'object' && val.result.error) ? null : val.result;
            }
            // Hyperlink
            if (val.hyperlink) {
                return val.text || val.hyperlink;
            }
            // RichText
            if (val.richText && Array.isArray(val.richText)) {
                return val.richText.map(rt => rt.text).join('');
            }
            // Date
            if (val instanceof Date) {
                return val;
            }
            if (val.sharedFormula) {
                return (val.result && typeof val.result === 'object' && val.result.error) ? null : val.result;
            }
        }
        return val;
    }

    // Process all existing Excel files in the folder
    async processExistingFiles(folderPath, onFileProcessed) {
        console.log('Scanning folder for existing Excel files:', folderPath);
        try {
            const files = fs.readdirSync(folderPath);
            const excelFiles = files.filter(file =>
                file.toLowerCase().endsWith('.xlsx') || file.toLowerCase().endsWith('.xls')
            );

            console.log(`Found ${excelFiles.length} Excel files`);

            for (const filename of excelFiles) {
                const filePath = path.join(folderPath, filename);
                console.log(`Processing existing file: ${filename}`);
                const result = await this.processFile(filePath);

                if (onFileProcessed && typeof onFileProcessed === 'function') {
                    onFileProcessed(result);
                }
            }

            console.log('Finished processing existing files');
        } catch (error) {
            console.error('Error processing existing files:', error);
        }
    }

    // Helper: Find the real header row (ignore titles/metadata)
    findHeaderRow(data) {
        if (!data || data.length === 0) return 0;

        const searchLimit = Math.min(data.length, 20);
        const rowDensities = [];
        let maxDensity = 0;

        for (let i = 0; i < searchLimit; i++) {
            const row = data[i];
            if (!row || row.length === 0) {
                rowDensities.push(0);
                continue;
            }

            let filledCount = 0;
            row.forEach(cell => {
                const val = cell ? cell.value : null;
                if (val !== undefined && val !== null && val !== '') {
                    filledCount++;
                }
            });

            rowDensities.push(filledCount);
            if (filledCount > maxDensity) {
                maxDensity = filledCount;
            }
        }

        if (maxDensity <= 1) return 0;

        const threshold = maxDensity * 0.75;
        for (let i = 0; i < searchLimit; i++) {
            if (rowDensities[i] >= threshold) {
                console.log(`Smart Header Detection: Found best header at row ${i} (Density: ${rowDensities[i]}/${maxDensity})`);
                return i;
            }
        }

        return 0;
    }

    // Missing method implementation
    trimTrailingEmptyRows(grid) {
        if (!grid) return;
        for (let i = grid.length - 1; i >= 0; i--) {
            const row = grid[i];
            const isEmpty = !row || row.length === 0 || row.every(cell => !cell || cell.value === null || cell.value === '');
            if (isEmpty) {
                grid.pop();
            } else {
                break;
            }
        }
    }

    async processFile(filePath) {
        try {
            console.log(`Processing file (ExcelJS): ${path.basename(filePath)}`);
            const fileHash = this.dataManager.calculateFileHash(filePath);
            const filename = path.basename(filePath);
            const existingFile = this.dataManager.fileExists(filePath);

            if (existingFile) {
                console.log(`File processing forced/updated: ${filename}`);
                this.dataManager.deleteFileData(existingFile.id);
            }

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);

            const sheets = [];

            // Process ALL worksheets
            workbook.eachSheet((worksheet, sheetId) => {
                const sheetResult = this.extractWorksheetData(worksheet);
                if (sheetResult) {
                    sheets.push(sheetResult);
                }
            });

            // Automatically export to CSV
            await this.exportToCSV(workbook, filePath);

            if (sheets.length === 0) {
                return { success: false, error: 'No content found in Excel file' };
            }

            // Use the first sheet as primary for DB/Compatibility
            const primarySheet = sheets[0];

            let fileId;
            if (existingFile) {
                this.dataManager.updateFile(existingFile.id, fileHash, primarySheet.rowCount, sheets);
                fileId = existingFile.id;
            } else {
                fileId = this.dataManager.addFile(filename, filePath, fileHash, primarySheet.rowCount, sheets);
            }

            this.dataManager.addColumnsMetadata(fileId, primarySheet.columns);

            // Save Primary Sheet Rows to DB
            const headers = primarySheet.columns.map(c => c.name);
            const dbRows = primarySheet.data.map((row, index) => {
                const rowDataObj = {};
                const rowStylesObj = {};
                headers.forEach((header, colIndex) => {
                    const cell = row[colIndex];
                    rowDataObj[header] = cell ? cell.value : null;
                    rowStylesObj[header] = cell ? cell.style : null;
                });
                return { index: index, data: rowDataObj, styles: rowStylesObj };
            });

            this.dataManager.addDataRows(fileId, dbRows);

            return {
                success: true,
                fileId: fileId,
                filename: filename,
                rowCount: primarySheet.rowCount,
                columns: primarySheet.columns,
                data: primarySheet.data, // Legacy support (displays first sheet by default)
                sheets: sheets // FULL Multi-sheet data
            };

        } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
            return { success: false, error: error.message };
        }
    }

    extractWorksheetData(worksheet) {
        let grid = [];
        worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
            const rowData = [];
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                rowData[colNumber - 1] = {
                    value: this.extractCellValue(cell),
                    style: {
                        border: cell.border,
                        font: cell.font,
                        fill: cell.fill,
                        alignment: cell.alignment,
                        numFmt: cell.numFmt
                    }
                };
            });
            // Fill gaps
            for (let k = 0; k < rowData.length; k++) {
                if (!rowData[k]) rowData[k] = { value: null, style: null };
            }
            grid[rowNumber - 1] = rowData;
        });

        // Fill empty start rows
        for (let k = 0; k < grid.length; k++) {
            if (!grid[k]) grid[k] = [];
        }

        if (grid.length === 0) {
            // Return empty sheet instead of null
            return {
                name: worksheet.name,
                data: [['A']], // Minimal valid data
                columns: [{ name: 'A', index: 0, type: 'text' }],
                rowCount: 0
            };
        }

        this.trimTrailingEmptyRows(grid);

        if (this.shouldTranspose(grid)) {
            grid = this.transposeMatrix(grid);
        }

        const numCols = grid[0] ? grid[0].length : 0;
        const headers = Array.from({ length: numCols }, (_, i) => this.getExcelColumnName(i));

        const typeSampleStart = grid.length > 1 ? 1 : 0;
        const columns = headers.map((name, index) => ({
            name: name,
            index: index,
            type: this.detectColumnType(grid.slice(typeSampleStart), index)
        }));

        return {
            name: worksheet.name,
            data: grid,
            columns: columns,
            rowCount: grid.length
        };
    }

    detectColumnType(rows, columnIndex) {
        const samples = rows
            .slice(0, 10)
            .map(row => row[columnIndex] ? row[columnIndex].value : null) // Access .value because rows are objects now
            .filter(val => val !== undefined && val !== null && val !== '');

        if (samples.length === 0) return 'text';

        const allNumbers = samples.every(val => !isNaN(parseFloat(val)) && isFinite(val));
        if (allNumbers) return 'number';

        const allDates = samples.every(val => {
            const date = new Date(val);
            return date instanceof Date && !isNaN(date);
        });
        if (allDates) return 'date';

        return 'text';
    }

    transposeMatrix(matrix) {
        if (!matrix || matrix.length === 0) return matrix;
        return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
    }

    shouldTranspose(data) {
        if (!data || data.length < 2) return false;

        const numRows = data.length;
        const numCols = data[0].length;

        if (numRows < 2 || numCols < 2) return false;

        const isConsistent = (vector) => {
            if (vector.length < 2) return true;
            const values = vector.slice(1).map(item => item ? item.value : null);

            const types = values.map(val => {
                if (val === null || val === undefined || val === '') return 'empty';
                return isNaN(parseFloat(val)) ? 'string' : 'number';
            }).filter(t => t !== 'empty');

            if (types.length === 0) return true;
            const firstType = types[0];
            return types.every(t => t === firstType);
        };

        let consistentCols = 0;
        for (let j = 0; j < numCols; j++) {
            const col = data.map(row => row[j]);
            if (isConsistent(col)) consistentCols++;
        }
        const colScore = consistentCols / numCols;

        let consistentRows = 0;
        for (let i = 0; i < numRows; i++) {
            const row = data[i];
            if (isConsistent(row)) consistentRows++;
        }
        const rowScore = consistentRows / numRows;

        if (rowScore > colScore + 0.1) {
            console.log('Heuristic hit: Rows are significantly more consistent than Cols -> Transpose');
            return true;
        }

        return false;
    }

    getExcelColumnName(colIndex) {
        let temp, letter = '';
        while (colIndex >= 0) {
            temp = (colIndex) % 26;
            letter = String.fromCharCode(temp + 65) + letter;
            colIndex = Math.floor((colIndex) / 26) - 1;
        }
        return letter;
    }

    async exportToCSV(workbook, sourceFilePath) {
        try {
            const baseDir = path.dirname(sourceFilePath);
            const baseName = path.basename(sourceFilePath, path.extname(sourceFilePath));

            console.log(`[CSV-EXPORT] Exporting ${baseName} to CSV...`);

            for (const worksheet of workbook.worksheets) {
                // Skip empty or hidden sheets if desired? For now, export all named sheets
                if (worksheet.rowCount === 0) continue;

                let csvPath;
                if (workbook.worksheets.length === 1 || worksheet.name === workbook.worksheets[0].name) {
                    csvPath = path.join(baseDir, `${baseName}.csv`);
                } else {
                    csvPath = path.join(baseDir, `${baseName}-${worksheet.name}.csv`);
                }

                // Simple CSV Generation using ExcelJS integrated CSV writer
                // Using .csv.writeFile directly is efficient
                await workbook.csv.writeBuffer({
                    sheetId: worksheet.id,
                    encoding: 'utf8',
                    dateFormat: 'YYYY-MM-DD HH:mm:ss'
                }).then(buffer => {
                    fs.writeFileSync(csvPath, buffer);
                });

                console.log(`[CSV-EXPORT] Saved: ${path.basename(csvPath)}`);
            }
        } catch (error) {
            console.error('[CSV-EXPORT] Error exporting to CSV:', error);
        }
    }
}

module.exports = DataExtractor;
