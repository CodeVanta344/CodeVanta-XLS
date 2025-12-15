const XLSX = require('xlsx');
const path = require('path');

// Données transposées (En-têtes en colonne A)
// Name, Alice, Bob
// Age, 25, 30
const data = [
    ['Name', 'Alice', 'Bob', 'Charlie'],
    ['Age', 25, 30, 35],
    ['City', 'Paris', 'London', 'NY']
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(data);

XLSX.utils.book_append_sheet(wb, ws, "TransposedData");

const filePath = path.join(__dirname, 'test_transpose.xlsx');
XLSX.writeFile(wb, filePath);

console.log('Fichier de test créé :', filePath);
