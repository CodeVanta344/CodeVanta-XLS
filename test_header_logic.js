const DataExtractor = require('./dataExtractor');
const path = require('path');

// Mock DataManager
const mockDataManager = {
    calculateFileHash: () => 'hashHeaderComplex123',
    fileExists: () => false,
    addFile: (name, path, hash, rows) => { 1; },
    addColumnsMetadata: () => { },
    addDataRows: () => { },
    deleteFileData: () => { },
    updateFile: () => { }
};

const extractor = new DataExtractor(mockDataManager);
const testFile = path.join(__dirname, 'test_headers_complex.xlsx');

console.log('--- Testing Header Detection Logic on Complex File ---');
extractor.processFile(testFile).then(result => {
    console.log('--- Result ---');
    if (result.success) {
        console.log('Columns found:', result.columns.map(c => c.name));
        console.log('Row Count:', result.rowCount);
    } else {
        console.error('Failed:', result.error);
    }
});
