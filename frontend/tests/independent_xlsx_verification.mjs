// frontend/tests/independent_xlsx_verification.mjs
import { chromium } from 'playwright';
import xlsx from 'xlsx';
import path from 'path';

console.log('================================================================');
console.log('VERIFICACIÓN INDEPENDIENTE DIRECTA CONTRA ENSAYOS_ESPECIALES.xlsx');
console.log('Fuente: Material/ENSAYOS_ESPECIALES.xlsx (Completamente fuera de scratch/ y exportador)');
console.log('================================================================\n');

// 1. Cargar directamente el libro Excel de campo
const excelFilePath = path.resolve('../../Material/ENSAYOS_ESPECIALES.xlsx');
console.log(`Leyendo archivo Excel: ${excelFilePath}`);
const wb = xlsx.readFile(excelFilePath);
const ws = wb.Sheets['Base_Datos (2)'];

// Mapeo canónico directo de columnas físicas de Excel (1-based column letters) a atributos de la grilla
const excelColumnMapping = [
  { colLetter: 'A', colId: 'idd', name: 'IDD' },
  { colLetter: 'B', colId: 'sondaje', name: 'Sondaje diamantino' },
  { colLetter: 'C', colId: 'codigo_muestra', name: 'Código de muestra' },
  { colLetter: 'D', colId: 'laboratorio', name: 'Laboratorio' },
  { colLetter: 'E', colId: 'mes', name: 'Mes' },
  { colLetter: 'F', colId: 'anio', name: 'Año' },
  { colLetter: 'G', colId: 'proyecto', name: 'Proyecto' },
  { colLetter: 'H', colId: 'desde', name: 'Desde (m)' },
  { colLetter: 'I', colId: 'hasta', name: 'Hasta (m)' },
  { colLetter: 'J', colId: 'longitud_muestra', name: 'Longitud de muestra (m)' },
  { colLetter: 'K', colId: 'este', name: 'Este (m)' },
  { colLetter: 'L', colId: 'norte', name: 'Norte (m)' },
  { colLetter: 'M', colId: 'elevacion', name: 'Elevación (msnm)' },
  { colLetter: 'N', colId: 'sectores', name: 'SECTORES' },
  { colLetter: 'O', colId: 'lito1', name: 'Lito 1' },
  { colLetter: 'P', colId: 'lito2', name: 'Lito 2' },
  { colLetter: 'Q', colId: 'lito3', name: 'Lito 3' },
  { colLetter: 'R', colId: 'tipo_ensayo', name: 'Tipo de ensayo' },
  { colLetter: 'S', colId: 'ucs_diametro', name: 'Diámetro del testigo (cm)' },
  { colLetter: 'T', colId: 'ucs_carga_rotura', name: 'Carga de rotura (kN)' },
  { colLetter: 'U', colId: 'ucs_resistencia', name: 'Resistencia a la compresión uniaxial (MPa)' },
  { colLetter: 'V', colId: 'ucs_resistencia_calculada', name: 'Resistencia calculada (MPa)' },
  { colLetter: 'W', colId: 'ucs_rotura', name: 'Rotura' },
  { colLetter: 'X', colId: 'elasticas_modulo_young', name: 'Modulo de Young (GPa)' },
  { colLetter: 'Y', colId: 'elasticas_poisson', name: 'Relación de Poisson' },
  { colLetter: 'Z', colId: 'traccion_carga_promedio', name: 'Carga de rotura promedio (kN)' },
  { colLetter: 'AA', colId: 'traccion_resistencia_kgcm2', name: 'Resistencia promedio (kg/cm2)' },
  { colLetter: 'AC', colId: 'traccion_resistencia_mpa', name: 'Resistencia promedio (MPa)' },
  { colLetter: 'AD', colId: 'corte_tipo_fractura', name: 'Tipo de fractura' },
  { colLetter: 'AE', colId: 'corte_area', name: 'Área de ensayo (cm2)' },
  { colLetter: 'AF', colId: 'corte_esf_normal_kpa', name: 'Esf Normal (kPa)' },
  { colLetter: 'AG', colId: 'corte_esf_corte_kpa', name: 'Esf Corte (kPa)' },
  { colLetter: 'AH', colId: 'corte_esf_normal_mpa', name: 'Esfuerzo Normal (MPa)' },
  { colLetter: 'AI', colId: 'corte_esf_corte_mpa', name: 'Esfuerzo de Corte (MPa)' },
  { colLetter: 'AJ', colId: 'corte_cohesion_mpa', name: 'Cohesion (Mpa)' },
  { colLetter: 'AK', colId: 'corte_ang_friccion', name: 'Ang. Friccion (°)' },
  { colLetter: 'AL', colId: 'triaxial_carga_confinamiento', name: 'Carga de confinamiento (MPa)' },
  { colLetter: 'AM', colId: 'triaxial_esf_maximo', name: 'Esfuerzo máximo (MPa)' },
  { colLetter: 'AN', colId: 'triaxial_resistencia', name: 'Resistencia (Mpa)' },
  { colLetter: 'AO', colId: 'triaxial_mi', name: 'mi' },
  { colLetter: 'AP', colId: 'triaxial_cohesion', name: 'Cohesion (Mpa)' },
  { colLetter: 'AQ', colId: 'triaxial_ang_friccion', name: 'Ang. Friccion (°)' },
  { colLetter: 'AR', colId: 'triaxial_rotura', name: 'Rotura' },
  { colLetter: 'AS', colId: 'prop_peso_unitario_geometrico', name: 'Peso unitario geométrico (gr/cm3)' },
  { colLetter: 'AT', colId: 'observacion', name: 'Observación' },
  { colLetter: 'AU', colId: 'campana', name: 'Campaña de Perforación' }
];

// Formateador esperado según la regla de negocio de v1
function formatExpectedFromExcel(cellVal, colId) {
  if (cellVal === undefined || cellVal === null || cellVal === '') return '—';
  if (typeof cellVal === 'number') {
    if (colId === 'idd' || colId === 'dia' || colId === 'anio') {
      return String(Math.round(cellVal));
    }
    return Number.isInteger(cellVal) ? String(cellVal) : String(parseFloat(cellVal.toFixed(2)));
  }
  const s = String(cellVal).trim();
  if (s === '' || s === 'None') return '—';
  const num = Number(s);
  if (!isNaN(num) && (colId === 'desde' || colId === 'hasta' || colId === 'longitud_muestra' || colId === 'este' || colId === 'norte' || colId === 'elevacion' || colId.startsWith('ucs_') || colId.startsWith('elasticas_') || colId.startsWith('traccion_') || colId.startsWith('corte_') || colId.startsWith('triaxial_') || colId === 'prop_peso_unitario_geometrico')) {
    return Number.isInteger(num) ? String(num) : String(parseFloat(num.toFixed(2)));
  }
  return s;
}

// Convertir hoja Excel directamente a array de objetos JSON para la API
console.log('Convirtiendo filas de Excel para mock de API...');
const range = xlsx.utils.decode_range(ws['!ref']);
const excelRecords = [];
for (let R = 2; R <= range.e.r; ++R) { // fila 3 en adelante (0-indexed R = 2)
  const iddVal = ws[xlsx.utils.encode_cell({ r: R, c: 0 })]?.v;
  if (!iddVal || isNaN(Number(iddVal))) continue;

  const rec = {};
  for (let c = 0; c < excelColumnMapping.length; ++c) {
    const col = excelColumnMapping[c];
    const cellRef = `${col.colLetter}${R + 1}`;
    const v = ws[cellRef]?.v;
    rec[col.colId] = v !== undefined && v !== null ? v : null;
  }
  excelRecords.push(rec);
}
console.log(`Registros extraídos directamente de Excel: ${excelRecords.length}`);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Mockear API con los datos extraídos de Excel
  await page.route('**/api/ensayos*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: excelRecords,
        page: 1,
        page_size: 50,
        total_filtered: excelRecords.length,
        total_pages: Math.ceil(excelRecords.length / 50),
        total_global: excelRecords.length,
        kpis: { total_page_records: excelRecords.length, total_anomalies_page: 0 }
      })
    });
  });

  console.log('Navegando a la aplicación v2 (http://127.0.0.1:4173/?grid=v2)...');
  await page.goto('http://127.0.0.1:4173/?grid=v2');
  await page.waitForTimeout(1000);
  const rmBtn = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtn.click();
  await page.waitForTimeout(2000);
  await page.waitForSelector('[data-testid="cell-0-sondaje"]');

  console.log('\n--- VERIFICANDO 20 FILAS EN PANTALLA CONTRA CELDAS DIRECTAS DE EXCEL ---');
  let totalChecked = 0;
  let matches = 0;
  let errors = [];

  const scrollPositions = [0, 180, 500, 1200, 2000, 99999];

  for (const scrollX of scrollPositions) {
    await page.evaluate((sx) => {
      const container = document.querySelector('div[tabindex="0"]');
      if (container) container.scrollLeft = sx;
    }, scrollX);
    await page.waitForTimeout(250);

    // Iterar las primeras 20 filas
    for (let rowIdx = 0; rowIdx < 20; rowIdx++) {
      const excelRow = rowIdx + 3; // En Excel los datos empiezan en la fila 3 (fila 1 y 2 son cabeceras)

      for (const col of excelColumnMapping) {
        const cellSelector = `[data-testid="cell-${rowIdx}-${col.colId}"]`;
        const cellHandle = await page.$(cellSelector);
        if (!cellHandle) continue; // Columna fuera del viewport virtual/horizontal

        const isVisible = await cellHandle.isVisible();
        if (!isVisible) continue;

        const renderedText = (await cellHandle.innerText()).trim();

        // Obtener valor bruto DIRECTO de la celda de Excel por coordenada física
        const cellCoord = `${col.colLetter}${excelRow}`;
        const rawExcelVal = ws[cellCoord]?.v;
        const expectedText = formatExpectedFromExcel(rawExcelVal, col.colId);

        totalChecked++;
        if (renderedText === expectedText) {
          matches++;
        } else {
          errors.push({
            rowIdx,
            excelRow,
            colId: col.colId,
            cellCoord,
            rawExcelVal,
            expectedText,
            renderedText
          });
        }
      }
    }
  }

  console.log(`\nCeldas comparadas directamente contra Excel: ${totalChecked}`);
  console.log(`Coincidencias exactas: ${matches}`);
  console.log(`Discrepancias: ${errors.length}`);

  if (errors.length > 0) {
    console.error('❌ DISCREPANCIAS ENCONTRADAS CONTRA EL ARCHIVO .XLSX:');
    errors.slice(0, 10).forEach(e => {
      console.error(`- Fila ${e.rowIdx} (Excel ${e.cellCoord}): Esperado '${e.expectedText}' (bruto: ${e.rawExcelVal}), Renderizado '${e.renderedText}'`);
    });
    await browser.close();
    process.exit(1);
  } else {
    console.log('✅ VERIFICACIÓN INDEPENDIENTE EXITOSA: 100% de celdas coinciden directamente con el archivo .xlsx original.');
  }

  await browser.close();
})();
