const XLSX = require('xlsx');
const path = require('path');

// Données imitant le fichier "Reporting" de l'utilisateur
// Row 0: Title
// Row 1: Empty
// Row 2: Section Title
// Row 3: Numeric Headers (1...5) which are actually the column names for transposed data?
// Row 4: Data start
const data = [
    ['SUIVI OBJECTIF RÉALISATION CA PAR ATELIER', '725000', '', '', '', ''], // Row 0: Title + Total
    ['', '', '', '', '', ''], // Row 1: Empty
    ['GRIM PASSION LATTES', '', '', '', '', ''], // Row 2: Section Title
    [1, 2, 3, 4, 5, 6], // Row 3: Days (Numeric Headers) - TARGET HEADER ROW
    ['CA REALISE', 4224, 8739, 12094, 16018, 22422], // Row 4: Data
    ['OBJECTIF', 5056, 11712, 17560, 23424, 29280], // Row 5: Data
    ['% DE REALISATION', 0.72, 0.75, 0.69, 0.68, 0.77] // Row 6: Data (Percentage)
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(data);

// Fusionner la première ligne pour simuler un vrai titre
if (!ws['!merges']) ws['!merges'] = [];
ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }); // Title merge
ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }); // Section title merge

XLSX.utils.book_append_sheet(wb, ws, "ReportData");

const filePath = path.join(__dirname, 'test_headers_complex.xlsx');
XLSX.writeFile(wb, filePath);

console.log('Fichier test complexe créé :', filePath);
