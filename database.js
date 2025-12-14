const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const crypto = require('crypto');

class DataManager {
    constructor() {
        const userDataPath = app.getPath('userData');
        this.dbPath = path.join(userDataPath, 'excelflow-data.json');
        this.data = {
            files: [],
            dataRows: []
        };
        this.loadData();
    }

    loadData() {
        try {
            if (fs.existsSync(this.dbPath)) {
                const fileContent = fs.readFileSync(this.dbPath, 'utf8');
                this.data = JSON.parse(fileContent);
                console.log('Data loaded from file');
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.data = { files: [], dataRows: [] };
        }
    }

    saveData() {
        try {
            fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    calculateFileHash(filePath) {
        const fileBuffer = fs.readFileSync(filePath);
        const hashSum = crypto.createHash('md5');
        hashSum.update(fileBuffer);
        return hashSum.digest('hex');
    }

    fileExists(filePath) {
        return this.data.files.find(f => f.filepath === filePath);
    }

    addFile(filename, filepath, fileHash, rowCount) {
        const file = {
            id: this.data.files.length + 1,
            filename,
            filepath,
            file_hash: fileHash,
            import_date: new Date().toISOString(),
            last_modified: new Date().toISOString(),
            row_count: rowCount,
            status: 'imported'
        };
        this.data.files.push(file);
        this.saveData();
        return file.id;
    }

    updateFile(fileId, fileHash, rowCount) {
        const file = this.data.files.find(f => f.id === fileId);
        if (file) {
            file.file_hash = fileHash;
            file.row_count = rowCount;
            file.last_modified = new Date().toISOString();
            this.saveData();
        }
    }

    addColumnsMetadata(fileId, columns) {
        // Stored with data rows
    }

    addDataRows(fileId, rows) {
        rows.forEach(row => {
            this.data.dataRows.push({
                file_id: fileId,
                row_index: row.index,
                row_data: row.data
            });
        });
        this.saveData();
    }

    deleteFileData(fileId) {
        this.data.dataRows = this.data.dataRows.filter(row => row.file_id !== fileId);
        this.saveData();
    }

    getAllFiles() {
        return this.data.files;
    }

    getGlobalStats() {
        const total_files = this.data.files.length;
        const total_rows = this.data.files.reduce((sum, f) => sum + (f.row_count || 0), 0);
        const last_import = this.data.files.length > 0
            ? this.data.files[this.data.files.length - 1].import_date
            : null;

        return {
            total_files,
            total_rows,
            last_import
        };
    }

    getAllData(limit = 1000, offset = 0) {
        const rows = this.data.dataRows.slice(offset, offset + limit);
        return rows.map(row => {
            const file = this.data.files.find(f => f.id === row.file_id);
            return {
                filename: file ? file.filename : 'Unknown',
                import_date: file ? file.import_date : null,
                row_index: row.row_index,
                row_data: row.row_data
            };
        });
    }

    getAllColumns() {
        const columns = new Set();
        this.data.dataRows.forEach(row => {
            Object.keys(row.row_data).forEach(key => columns.add(key));
        });
        return Array.from(columns).map(name => ({ column_name: name, data_type: 'text' }));
    }

    executeQuery(sql, params = []) {
        // Simple query support
        return [];
    }

    close() {
        this.saveData();
    }
}

module.exports = DataManager;
