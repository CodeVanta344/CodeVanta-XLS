const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

class DataExtractor {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    // Process all existing Excel files in the folder
    async processExistingFiles(folderPath) {
        console.log('Scanning folder for existing Excel files:', folderPath);

        try {
            const files = fs.readdirSync(folderPath);
            const excelFiles = files.filter(file =>
                file.endsWith('.xlsx') || file.endsWith('.xls')
            );

            console.log(`Found ${excelFiles.length} Excel files`);

            for (const filename of excelFiles) {
                const filePath = path.join(folderPath, filename);
                console.log(`Processing existing file: ${filename}`);
                await this.processFile(filePath);
            }

            console.log('Finished processing existing files');
        } catch (error) {
            console.error('Error processing existing files:', error);
        }
    }

    async processFile(filePath) {
        try {
            console.log(`Processing file: ${path.basename(filePath)}`);

            // Calculer le hash du fichier
            const fileHash = this.dataManager.calculateFileHash(filePath);
            const filename = path.basename(filePath);

            // Vérifier si le fichier existe déjà
            const existingFile = this.dataManager.fileExists(filePath);

            if (existingFile) {
                // Vérifier si le fichier a changé
                if (existingFile.file_hash === fileHash) {
                    console.log(`File unchanged, skipping: ${filename}`);
                    return { success: true, skipped: true };
                }

                console.log(`File modified, updating: ${filename}`);
                // Supprimer les anciennes données
                this.dataManager.deleteFileData(existingFile.id);
            }

            // Lire le fichier Excel
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Convertir en JSON avec en-têtes
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length === 0) {
                console.log(`File is empty: ${filename}`);
                return { success: false, error: 'Empty file' };
            }

            // Extraire les en-têtes (première ligne)
            const headers = jsonData[0];
            const dataRows = jsonData.slice(1);

            // Détecter les types de données
            const columns = headers.map((header, index) => ({
                name: header || `Column_${index + 1}`,
                index: index,
                type: this.detectColumnType(dataRows, index)
            }));

            // Ajouter ou mettre à jour le fichier
            let fileId;
            if (existingFile) {
                this.dataManager.updateFile(existingFile.id, fileHash, dataRows.length);
                fileId = existingFile.id;
            } else {
                fileId = this.dataManager.addFile(filename, filePath, fileHash, dataRows.length);
            }

            // Ajouter les métadonnées des colonnes
            this.dataManager.addColumnsMetadata(fileId, columns);

            // Préparer les données pour insertion
            const rows = dataRows.map((row, index) => {
                // Créer un objet avec les noms de colonnes
                const rowObject = {};
                headers.forEach((header, colIndex) => {
                    const columnName = header || `Column_${colIndex + 1}`;
                    rowObject[columnName] = row[colIndex];
                });

                return {
                    index: index,
                    data: rowObject
                };
            });

            // Ajouter les données
            this.dataManager.addDataRows(fileId, rows);

            console.log(`Successfully processed: ${filename} (${dataRows.length} rows)`);

            return {
                success: true,
                fileId: fileId,
                filename: filename,
                rowCount: dataRows.length,
                columns: columns
            };

        } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    detectColumnType(rows, columnIndex) {
        // Échantillonner les 10 premières lignes non vides
        const samples = rows
            .slice(0, 10)
            .map(row => row[columnIndex])
            .filter(val => val !== undefined && val !== null && val !== '');

        if (samples.length === 0) return 'text';

        // Vérifier si toutes les valeurs sont des nombres
        const allNumbers = samples.every(val => !isNaN(parseFloat(val)) && isFinite(val));
        if (allNumbers) return 'number';

        // Vérifier si ce sont des dates
        const allDates = samples.every(val => {
            const date = new Date(val);
            return date instanceof Date && !isNaN(date);
        });
        if (allDates) return 'date';

        return 'text';
    }

    async processFolder(folderPath) {
        const files = fs.readdirSync(folderPath)
            .filter(file => file.endsWith('.xlsx'))
            .map(file => path.join(folderPath, file));

        console.log(`Found ${files.length} Excel files in folder`);

        const results = [];
        for (const file of files) {
            const result = await this.processFile(file);
            results.push(result);
        }

        return results;
    }
}

module.exports = DataExtractor;
