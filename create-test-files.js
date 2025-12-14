const XLSX = require('xlsx');
const path = require('path');

// Créer des fichiers Excel de test

// Fichier 1: Ventes 2024
const ventes2024 = [
    ['Date', 'Produit', 'Quantité', 'Prix Unitaire', 'Total'],
    ['2024-01-15', 'Ordinateur', 5, 899.99, 4499.95],
    ['2024-01-20', 'Souris', 25, 29.99, 749.75],
    ['2024-02-10', 'Clavier', 15, 79.99, 1199.85],
    ['2024-02-25', 'Écran', 8, 299.99, 2399.92],
    ['2024-03-05', 'Webcam', 12, 89.99, 1079.88],
    ['2024-03-18', 'Casque', 20, 59.99, 1199.80],
    ['2024-04-12', 'Ordinateur', 3, 899.99, 2699.97],
    ['2024-04-28', 'Tablette', 10, 399.99, 3999.90],
    ['2024-05-15', 'Souris', 30, 29.99, 899.70],
    ['2024-05-22', 'Clavier', 18, 79.99, 1439.82]
];

const wb1 = XLSX.utils.book_new();
const ws1 = XLSX.utils.aoa_to_sheet(ventes2024);
XLSX.utils.book_append_sheet(wb1, ws1, 'Ventes');
XLSX.writeFile(wb1, path.join(__dirname, 'test-excel', 'Ventes_2024.xlsx'));

// Fichier 2: Inventaire
const inventaire = [
    ['Référence', 'Nom', 'Catégorie', 'Stock', 'Prix'],
    ['REF001', 'Ordinateur Portable', 'Informatique', 45, 899.99],
    ['REF002', 'Souris Sans Fil', 'Accessoires', 150, 29.99],
    ['REF003', 'Clavier Mécanique', 'Accessoires', 78, 79.99],
    ['REF004', 'Écran 27 pouces', 'Informatique', 32, 299.99],
    ['REF005', 'Webcam HD', 'Accessoires', 64, 89.99],
    ['REF006', 'Casque Audio', 'Audio', 95, 59.99],
    ['REF007', 'Tablette 10 pouces', 'Informatique', 28, 399.99],
    ['REF008', 'Disque Dur Externe', 'Stockage', 120, 119.99],
    ['REF009', 'Clé USB 64GB', 'Stockage', 200, 19.99],
    ['REF010', 'Imprimante', 'Bureautique', 15, 199.99]
];

const wb2 = XLSX.utils.book_new();
const ws2 = XLSX.utils.aoa_to_sheet(inventaire);
XLSX.utils.book_append_sheet(wb2, ws2, 'Inventaire');
XLSX.writeFile(wb2, path.join(__dirname, 'test-excel', 'Inventaire.xlsx'));

// Fichier 3: Employés
const employes = [
    ['ID', 'Nom', 'Prénom', 'Département', 'Salaire', 'Date Embauche'],
    [1, 'Dupont', 'Jean', 'Ventes', 3500, '2020-03-15'],
    [2, 'Martin', 'Sophie', 'Marketing', 3800, '2019-06-20'],
    [3, 'Bernard', 'Luc', 'IT', 4200, '2018-09-10'],
    [4, 'Dubois', 'Marie', 'RH', 3600, '2021-01-05'],
    [5, 'Thomas', 'Pierre', 'Ventes', 3400, '2022-04-12'],
    [6, 'Robert', 'Claire', 'IT', 4500, '2017-11-30'],
    [7, 'Petit', 'Antoine', 'Marketing', 3700, '2020-08-22'],
    [8, 'Durand', 'Emma', 'Finance', 4000, '2019-02-14']
];

const wb3 = XLSX.utils.book_new();
const ws3 = XLSX.utils.aoa_to_sheet(employes);
XLSX.utils.book_append_sheet(wb3, ws3, 'Employés');
XLSX.writeFile(wb3, path.join(__dirname, 'test-excel', 'Employes.xlsx'));

console.log('✅ Fichiers Excel de test créés dans d:\\PJL\\test-excel\\');
console.log('   - Ventes_2024.xlsx (10 lignes)');
console.log('   - Inventaire.xlsx (10 lignes)');
console.log('   - Employes.xlsx (8 lignes)');
