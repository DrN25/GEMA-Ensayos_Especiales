// frontend/tests/bloque4_extended_coverage_e2e.mjs
import { chromium } from 'playwright';
import path from 'path';

const BACKEND_URL = 'http://127.0.0.1:8002';
const FRONTEND_URL = 'http://127.0.0.1:4173/?grid=v2';

(async () => {
  console.log('================================================================');
  console.log('PRUEBAS E2E EXTENDIDAS BLOQUE 4: BACKEND REAL, MODULOS, VACIAR BD E IMPORTAR');
  console.log('================================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('dialog', async dialog => {
    console.log(`[DIALOG] "${dialog.message().slice(0, 60)}..." -> Aceptando automáticamente.`);
    await dialog.accept();
  });

  // -------------------------------------------------------------------------
  // 1. PRUEBA DE PERSISTENCIA CONTRA EL BACKEND REAL (Sin Mocks)
  // -------------------------------------------------------------------------
  console.log('\n--- 1. VERIFICACIÓN DE PERSISTENCIA EN SQL SERVER REAL ---');
  // Sembrar registro inicial en la base de datos real
  const seedRes = await fetch(`${BACKEND_URL}/api/ensayos/batch-upsert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      idd: 1,
      sondaje: 'SOND-INITIAL-SQL',
      codigo_muestra: 'M-001',
      laboratorio: 'LAB-CENTRAL',
      desde: 10,
      hasta: 12,
      proyecto: 'PROYECTO TEST'
    }])
  });
  console.log('Seed backend response status:', seedRes.status);

  // Navegar a la app SIN interceptar rutas (tráfico directo al backend real)
  console.log('Navegando a la aplicación real con backend en vivo...');
  await page.goto(FRONTEND_URL);
  await page.waitForTimeout(1000);
  const rmBtn = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtn.click();
  await page.waitForTimeout(2000);

  // Comprobar que cargó el registro del backend real
  const cell0 = await page.waitForSelector('[data-testid="cell-0-sondaje"]');
  const initialText = (await cell0.innerText()).trim();
  console.log(`Texto cargado desde SQL Server: "${initialText}"`);

  // Modificar celda a nuevo valor
  await cell0.dblclick();
  await page.waitForTimeout(300);
  const input = await page.waitForSelector('[data-testid="floating-input"]');
  const targetValue = 'SOND-REAL-BACKEND-OK';
  await input.fill(targetValue);
  await input.press('Enter');
  await page.waitForTimeout(300);

  // Guardar cambios
  const saveBtn = await page.waitForSelector('header button:has-text("Guardar Cambios")');
  await saveBtn.click();
  await page.waitForTimeout(2000);

  // Verificar que UI dice Sincronizado
  const syncedBtn = await page.waitForSelector('header button:has-text("Sincronizado")');
  console.log('Estado en UI tras guardar:', (await syncedBtn.innerText()).trim());

  // VERIFICACIÓN INDEPENDIENTE HTTP DIRECTA AL BACKEND (sin browser, sin localStorage)
  console.log('Consultando backend SQL Server directamente con fetch HTTP independiente...');
  const verifyRes = await fetch(`${BACKEND_URL}/api/ensayos?page=1&page_size=10`);
  const verifyData = await verifyRes.json();
  const persistedRow = verifyData.items.find(r => r.idd === 1);
  console.log(`Valor retornado directamente por SQL Server: "${persistedRow?.sondaje}"`);
  if (!persistedRow || persistedRow.sondaje !== targetValue) {
    throw new Error(`Persistencia real falló: se esperaba '${targetValue}', pero SQL Server devolvió '${persistedRow?.sondaje}'`);
  }
  console.log('✅ TEST 1 PASÓ: Persistencia real confirmada en base de datos SQL Server.');

  // -------------------------------------------------------------------------
  // 2. PRUEBA DE CAMBIO DE MÓDULO CON CAMBIOS SIN GUARDAR
  // -------------------------------------------------------------------------
  console.log('\n--- 2. CAMBIO DE MÓDULO CON CAMBIOS SIN GUARDAR ---');
  // Editar celda en Registro Maestro
  await cell0.dblclick();
  await page.waitForTimeout(300);
  const inputMod = await page.waitForSelector('[data-testid="floating-input"]');
  await inputMod.fill('SOND-MODULO-SWITCH');
  await inputMod.press('Enter');
  await page.waitForTimeout(300);

  // Verificar que TopBar muestra Guardar Cambios en Registro Maestro
  let saveBtnCheck = await page.waitForSelector('header button:has-text("Guardar Cambios")');
  console.log('Estado en Registro Maestro antes de cambiar de módulo: "Guardar Cambios"');

  // Cambiar al módulo UCS en Sidebar
  const ucsNavBtn = await page.waitForSelector('button:has-text("Compresión Uniaxial (UCS)"), button:has-text("UCS")');
  await ucsNavBtn.click();
  await page.waitForTimeout(1500);

  // En UCS, las columnas de UCS están sincronizadas, pero el módulo Maestro tiene cambios sin guardar
  console.log('Navegado con éxito a Compresión Uniaxial (UCS).');

  // Regresar a Registro Maestro
  await rmBtn.click();
  await page.waitForTimeout(1500);

  // Comprobar que el valor editado se conserva en celda 0 y el estado sigue siendo "Guardar Cambios"
  const reloadedCell = await page.waitForSelector('[data-testid="cell-0-sondaje"]');
  const preservedVal = (await reloadedCell.innerText()).trim();
  console.log(`Texto en celda 0 al regresar a Registro Maestro: "${preservedVal}"`);
  if (preservedVal !== 'SOND-MODULO-SWITCH') {
    throw new Error(`El valor editado se perdió al cambiar de módulo: '${preservedVal}'`);
  }
  saveBtnCheck = await page.waitForSelector('header button:has-text("Guardar Cambios")');
  console.log('Estado en Registro Maestro tras regresar: "Guardar Cambios" confirmado.');
  console.log('✅ TEST 2 PASÓ: Datos sin guardar se conservan íntegros al navegar entre módulos.');

  // Guardar cambios para limpiar estado
  const saveBtnClean = await page.waitForSelector('header button:has-text("Guardar Cambios")');
  await saveBtnClean.click();
  await page.waitForTimeout(1500);

  // -------------------------------------------------------------------------
  // 3. PRUEBA DE VACIAR BASE DE DATOS CON V2 ACTIVO
  // -------------------------------------------------------------------------
  console.log('\n--- 3. VACIAR BASE DE DATOS CON V2 ACTIVO ---');
  const clearDbBtn = await page.waitForSelector('button:has-text("Vaciar BD (Pruebas)")');
  await clearDbBtn.click();
  await page.waitForTimeout(2000);

  // Verificar que el indicador de filas en la UI muestre 0
  const rowCountText = await page.locator('text=/Filas:\\s*0/').first();
  await rowCountText.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Indicador de UI muestra: "Filas: 0"');

  // Verificar en backend SQL Server que la base de datos está vacía
  const emptyRes = await fetch(`${BACKEND_URL}/api/ensayos`);
  const emptyData = await emptyRes.json();
  console.log(`Conteo en SQL Server tras Vaciar BD: ${emptyData.total_global}`);
  if (emptyData.total_global !== 0) {
    throw new Error(`Se esperaba 0 registros en backend, pero hay ${emptyData.total_global}`);
  }
  console.log('✅ TEST 3 PASÓ: Vaciar BD limpia store v2 y base de datos SQL Server.');

  // -------------------------------------------------------------------------
  // 4. PRUEBA DE IMPORTAR EXCEL CON V2 ACTIVO
  // -------------------------------------------------------------------------
  console.log('\n--- 4. IMPORTAR EXCEL CON V2 ACTIVO ---');
  const importModalBtn = await page.waitForSelector('button:has-text("Importar Excel")');
  await importModalBtn.click();
  await page.waitForTimeout(1000);

  // Verificar que el modal de importación se abrió
  await page.waitForSelector('h3:has-text("Importación de Ensayos Especiales")');
  console.log('Modal de importación abierto.');

  // Subir archivo Excel real existente
  const excelPath = path.resolve('../../Material/ENSAYOS_ESPECIALES.xlsx');
  const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached' });
  await fileInput.setInputFiles(excelPath);
  console.log(`Archivo Excel cargado en el input: ${excelPath}`);
  await page.waitForTimeout(2000);

  // Seleccionar "Planilla Completa" para ingesta masiva
  const allBtn = await page.waitForSelector('button:has-text("Planilla Completa")');
  await allBtn.click();
  await page.waitForTimeout(500);

  // Cargar en Grilla
  const loadGridBtn = await page.waitForSelector('button:has-text("Cargar en Grilla")');
  await loadGridBtn.click();
  await page.waitForTimeout(1000);

  // Confirmar si sale advertencia volumétrica
  const confirmMasivo = await page.$('button:has-text("Confirmar Ingesta")');
  if (confirmMasivo) {
    console.log('Confirmando ingesta volumétrica...');
    await confirmMasivo.click();
    await page.waitForTimeout(2000);
  }

  // Cerrar overlay de éxito en ExcelImportModal si aparece
  const finishLocator = page.locator('button:has-text("Finalizar")');
  if (await finishLocator.count() > 0) {
    console.log('Cerrando overlay de importación con botón Finalizar...');
    await finishLocator.first().click({ force: true });
    await page.waitForTimeout(1500);
  }

  // Si aparece el modal decisorio de proyecto no reconocido, resolverlo
  const unrecogLocator = page.locator('button:has-text("1. Importar registros con el campo Proyecto vacío.")');
  if (await unrecogLocator.count() > 0) {
    console.log('Resolviendo proyecto no reconocido: importando con proyecto vacío...');
    await unrecogLocator.first().click({ force: true });
    await page.waitForTimeout(2000);
  }

  // Verificar que los registros se cargaron en el grid v2
  const firstImportedCell = await page.waitForSelector('[data-testid="cell-0-sondaje"]', { timeout: 15000 });
  const importedSondaje = (await firstImportedCell.innerText()).trim();
  console.log(`Primer sondaje importado en el grid v2: "${importedSondaje}"`);
  if (!importedSondaje) {
    throw new Error('El grid v2 no cargó registros tras importar Excel.');
  }

  // Verificar que el estado pasa a "Guardar Cambios" (los importados quedan listos para sincronizar)
  const unsavedBtn = await page.waitForSelector('header button:has-text("Guardar Cambios")');
  console.log('Estado en TopBar tras importar Excel:', (await unsavedBtn.innerText()).trim());

  console.log('✅ TEST 4 PASÓ: Importar Excel pobla correctamente el store v2 y activa dirty tracking.');

  await browser.close();
  console.log('\n================================================================');
  console.log('TODAS LAS PRUEBAS E2E EXTENDIDAS PASARON EXITOSAMENTE (100%)');
  console.log('================================================================');
})();
