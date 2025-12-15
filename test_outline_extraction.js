const ExcelJS = require('exceljs');

async function testBorderExtraction() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Test Sheet');

    // Add data and styles
    const cell = sheet.getCell('B2');
    cell.value = 'Thick Border Cell';
    cell.border = {
        top: { style: 'thick' },
        left: { style: 'thick' },
        bottom: { style: 'thick' },
        right: { style: 'thick' }
    };

    const cell2 = sheet.getCell('C2');
    cell2.value = 'Thin Border Cell';
    cell2.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };

    await workbook.xlsx.writeFile('temp_borders.xlsx');
    console.log('Created temp_borders.xlsx');

    // Read it back
    const workbook2 = new ExcelJS.Workbook();
    await workbook2.xlsx.readFile('temp_borders.xlsx');
    const sheet2 = workbook2.getWorksheet(1);

    const b2 = sheet2.getCell('B2');
    console.log('B2 Border:', JSON.stringify(b2.border, null, 2));

    const c2 = sheet2.getCell('C2');
    console.log('C2 Border:', JSON.stringify(c2.border, null, 2));
}

testBorderExtraction().catch(console.error);
