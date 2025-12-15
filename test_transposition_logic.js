const DataExtractor = require('./dataExtractor');
const path = require('path');

// Mock DataManager
const mockDataManager = {
    calculateFileHash: () => 'hash123',
    fileExists: () => false,
    addFile: (name, path, hash, rows) => {
        console.log(`[MockDB] Adding file: ${name} with ${rows} rows`);
        return 1;
    },
    addColumnsMetadata: (fileId, columns) => {
        console.log(`[MockDB] Columns detected:`, columns.map(c => c.name));
    },
    addDataRows: (fileId, rows) => {
        console.log(`[MockDB] Added ${rows.length} rows of data`);
        if (rows.length > 0) {
            console.log('Sample Row 1:', rows[0].data);
        }
    },
    deleteFileData: () => { },
    updateFile: () => { }
};

const extractor = new DataExtractor(mockDataManager);
const testFile = path.join(__dirname, 'test_transpose.xlsx');

console.log('--- Testing Transposition Logic ---');
extractor.processFile(testFile).then(result => {
    console.log('--- Result ---');
    console.log(result);
});
