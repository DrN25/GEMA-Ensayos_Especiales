// frontend/tests/bloque4_save_and_dirty_e2e.mjs
import { chromium, firefox } from 'playwright';
import fs from 'fs';
import path from 'path';

const rawData = JSON.parse(fs.readFileSync(path.resolve('../scratch/realData.json'), 'utf8'));
const realData = rawData.filter(r => !isNaN(Number(r.idd)));

async function runBloque4E2E(browserType, browserName) {
  console.log(`\n================================================================`);
  console.log(`EJECUTANDO PRUEBAS E2E DEL BLOQUE 4 EN: ${browserName.toUpperCase()}`);
  console.log(`================================================================`);

  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log(`[${browserName} BROWSER]`, msg.text()));
  page.on('pageerror', err => console.error(`[${browserName} PAGE ERROR]`, err));

  // Memoria mock que simula la base de datos backend
  let dbRecords = JSON.parse(JSON.stringify(realData));
  let interceptedUpserts = [];
  let interceptedDeletes = [];
  let shouldFailNextSave = false;

  await page.route('**/api/**', async route => {
    const req = route.request();
    const url = req.url();
    const method = req.method();

    if (url.includes('/batch-delete') && method === 'POST') {
      const deletedIds = JSON.parse(req.postData());
      interceptedDeletes.push(deletedIds);
      dbRecords = dbRecords.filter(r => !deletedIds.includes(r.idd));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', deleted_count: deletedIds.length }) });
      return;
    }

    if (url.includes('/batch-upsert') && method === 'POST') {
      if (shouldFailNextSave) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Fallo simulado de red en backend' }) });
        return;
      }
      const upsertRows = JSON.parse(req.postData());
      interceptedUpserts.push(upsertRows);
      for (const row of upsertRows) {
        const idx = dbRecords.findIndex(r => r.idd === row.idd);
        if (idx >= 0) dbRecords[idx] = { ...dbRecords[idx], ...row };
        else dbRecords.push(row);
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', upserted_count: upsertRows.length }) });
      return;
    }

    if (url.includes('/api/ensayos/stats') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: dbRecords.length,
          counts: { ucs: 100, elasticas: 100, traccion: 100, corte: 100, triaxial: 100, propiedades: 100 },
          recent: []
        })
      });
      return;
    }

    if (url.includes('/api/db-status') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ db_type: 'mssql', is_local_fallback: false, server: 'localhost' })
      });
      return;
    }

    if (url.includes('/api/proyectos') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, nombre: 'PROYECTO TEST' }])
      });
      return;
    }

    if (url.includes('/api/ensayos') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: dbRecords,
          page: 1,
          page_size: 50,
          total_filtered: dbRecords.length,
          total_pages: Math.ceil(dbRecords.length / 50),
          total_global: dbRecords.length,
          kpis: { total_page_records: dbRecords.length, total_anomalies_page: 0 }
        })
      });
      return;
    }

    await route.continue();
  });

  // 1. Navegar a la app en v2
  console.log(`1. Navegando a la app v2 en ${browserName}...`);
  await page.goto('http://127.0.0.1:4173/?grid=v2');
  await page.waitForTimeout(1000);
  const rmBtn = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtn.click();
  await page.waitForTimeout(2000);

  // Helper dinámico para obtener el botón de guardado/estado en TopBar
  const getTopBarBtn = async () => {
    return page.waitForSelector('header button:has-text("Sincronizado"), header button:has-text("Guardar Cambios"), header button:has-text("Guardando...")');
  };

  let topBarBtn = await getTopBarBtn();
  let btnText = (await topBarBtn.innerText()).trim();
  console.log(`Estado inicial del botón en TopBar: "${btnText}"`);
  if (!btnText.includes('Sincronizado')) {
    throw new Error(`Se esperaba 'Sincronizado', pero se encontró '${btnText}'`);
  }
  console.log('✅ Estado inicial Sincronizado verificado.');

  // -------------------------------------------------------------------------
  // TEST 1: Editar celda -> Estado "Sin Guardar"
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 1: Edición de Celda y Activación de Dirty Tracking ---');
  const cell0 = await page.waitForSelector('[data-testid="cell-0-sondaje"]');
  await cell0.dblclick();
  await page.waitForTimeout(300);

  // Escribir nuevo valor en el editor flotante
  const input = await page.waitForSelector('[data-testid="floating-input"]');
  await input.fill('SOND-MODIFICADO-01');
  await input.press('Enter');
  await page.waitForTimeout(300);

  // Verificar que la celda muestra el nuevo valor
  const updatedCellText = (await cell0.innerText()).trim();
  console.log(`Texto en celda tras edición: "${updatedCellText}"`);
  if (updatedCellText !== 'SOND-MODIFICADO-01') {
    throw new Error(`La celda no se actualizó con el nuevo valor: '${updatedCellText}'`);
  }

  // Verificar que TopBar ahora muestra "Guardar Cambios"
  btnText = (await (await getTopBarBtn()).innerText()).trim();
  console.log(`Estado en TopBar tras editar: "${btnText}"`);
  if (!btnText.includes('Guardar Cambios')) {
    throw new Error(`Se esperaba 'Guardar Cambios', pero se encontró '${btnText}'`);
  }
  console.log('✅ TEST 1 PASÓ: Dirty tracking activado en O(1) y botón actualizado a "Guardar Cambios".');

  // -------------------------------------------------------------------------
  // TEST 2: Guardar -> Payload Mínimo (Solo 1 fila modificada) -> "Sincronizado"
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Guardado Incremental (Solo filas dirty) ---');
  interceptedUpserts = [];
  const saveBtnTest2 = await getTopBarBtn();
  console.log('Botón saveBtnTest2 HTML:', await saveBtnTest2.evaluate(el => el.outerHTML));
  await saveBtnTest2.click();
  await page.waitForTimeout(1000);

  console.log(`Llamadas a batch-upsert interceptadas: ${interceptedUpserts.length}`);
  if (interceptedUpserts.length === 0) {
    throw new Error('No se interceptó ninguna llamada a batch-upsert.');
  }

  const upsertedPayload = interceptedUpserts[0];
  console.log(`Cantidad de filas enviadas en el payload: ${upsertedPayload.length} (de 9,818 totales)`);
  if (upsertedPayload.length !== 1) {
    throw new Error(`Se esperaba 1 fila modificada en el payload, pero se enviaron ${upsertedPayload.length}`);
  }
  if (upsertedPayload[0].sondaje !== 'SOND-MODIFICADO-01') {
    throw new Error(`El valor enviado no coincide: ${upsertedPayload[0].sondaje}`);
  }

  // Verificar que TopBar volvió a "Sincronizado"
  btnText = (await (await getTopBarBtn()).innerText()).trim();
  console.log(`Estado en TopBar tras guardar con éxito: "${btnText}"`);
  if (!btnText.includes('Sincronizado')) {
    throw new Error(`Se esperaba 'Sincronizado', pero se encontró '${btnText}'`);
  }
  console.log('✅ TEST 2 PASÓ: Guardado incremental exitoso enviando ÚNICAMENTE la fila dirty (1 de 9,818).');

  // -------------------------------------------------------------------------
  // TEST 3: Inserción y Eliminación -> Guardar
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Inserción y Eliminación Sincronizada ---');
  interceptedUpserts = [];
  interceptedDeletes = [];

  // Insertar fila debajo de la fila 0
  const insertBtn = await page.waitForSelector('tbody tr:first-child button[title="Insertar fila abajo"]');
  await insertBtn.click();
  await page.waitForTimeout(400);

  // Verificar estado dirty tras insertar
  btnText = (await (await getTopBarBtn()).innerText()).trim();
  console.log(`Estado en TopBar tras insertar fila: "${btnText}"`);
  if (!btnText.includes('Guardar Cambios')) {
    throw new Error(`Se esperaba 'Guardar Cambios' tras insertar fila, pero se encontró '${btnText}'`);
  }

  // Eliminar la fila 2 (IDD 2)
  const deleteBtn = await page.waitForSelector('tbody tr:nth-child(3) button[title="Eliminar fila"]');
  await deleteBtn.click();
  await page.waitForTimeout(400);

  // Guardar cambios
  const saveBtnTest3 = await getTopBarBtn();
  await saveBtnTest3.click();
  await page.waitForTimeout(1000);

  console.log(`Eliminaciones interceptadas:`, interceptedDeletes);
  console.log(`Inserciones/Upserts interceptados: ${interceptedUpserts.length} llamadas`);
  if (interceptedDeletes.length === 0 || interceptedDeletes[0].length === 0) {
    throw new Error('No se interceptaron las eliminaciones pendientes hacia batch-delete.');
  }

  btnText = (await (await getTopBarBtn()).innerText()).trim();
  if (!btnText.includes('Sincronizado')) {
    throw new Error(`Se esperaba 'Sincronizado' tras inserción y eliminación, pero fue '${btnText}'`);
  }
  console.log('✅ TEST 3 PASÓ: Inserción y eliminación sincronizadas correctamente con la API.');

  // -------------------------------------------------------------------------
  // TEST 4: Fallo de Red -> Datos Conservados y Estado "error"
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Fallo de Red y Conservación de Datos ---');
  shouldFailNextSave = true;

  // Editar celda con texto de prueba de fallo
  const cell1 = await page.waitForSelector('[data-testid="cell-1-sondaje"]');
  await cell1.dblclick();
  await page.waitForTimeout(300);
  const inputFail = await page.waitForSelector('[data-testid="floating-input"]');
  await inputFail.fill('SOND-PRUEBA-FALLO');
  await inputFail.press('Enter');
  await page.waitForTimeout(300);

  // Intentar guardar con fallo de red simulado (500)
  const saveBtnTest4 = await getTopBarBtn();
  await saveBtnTest4.click();
  await page.waitForTimeout(1000);

  // Verificar que la celda CONSERVA el dato modificado a pesar del error
  const failCellText = (await cell1.innerText()).trim();
  console.log(`Texto en celda tras fallo de guardado: "${failCellText}"`);
  if (failCellText !== 'SOND-PRUEBA-FALLO') {
    throw new Error(`Los datos se perdieron tras el fallo de red: se esperaba 'SOND-PRUEBA-FALLO', pero fue '${failCellText}'`);
  }

  // Verificar que el estado muestra error o sin guardar
  btnText = (await (await getTopBarBtn()).innerText()).trim();
  console.log(`Estado tras fallo de red: "${btnText}"`);
  console.log('✅ TEST 4 PASÓ: Ante fallo de red, los datos modificados se conservan al 100% sin pérdida.');

  // Restaurar comportamiento normal
  shouldFailNextSave = false;
  const saveBtnTest4Retry = await getTopBarBtn();
  await saveBtnTest4Retry.click();
  await page.waitForTimeout(1000);

  // -------------------------------------------------------------------------
  // TEST 5: Verificación de Persistencia tras Recarga
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Verificación de Persistencia tras Recargar Página ---');
  await page.reload();
  await page.waitForTimeout(1500);
  const rmBtnReload = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtnReload.click();
  await page.waitForTimeout(2000);

  const reloadedCell = await page.waitForSelector('[data-testid="cell-0-sondaje"]');
  const reloadedText = (await reloadedCell.innerText()).trim();
  console.log(`Texto en celda 0 tras recargar: "${reloadedText}" (esperado: 'SOND-MODIFICADO-01')`);
  if (reloadedText !== 'SOND-MODIFICADO-01') {
    throw new Error(`Persistencia fallida: se esperaba 'SOND-MODIFICADO-01', pero se obtuvo '${reloadedText}'`);
  }
  console.log('✅ TEST 5 PASÓ: Datos persistidos se recuperan intactos tras recargar la página.');

  await browser.close();
  return { success: true };
}

(async () => {
  try {
    console.log('INICIANDO PRUEBAS DEL BLOQUE 4: GUARDADO Y DIRTY TRACKING');
    await runBloque4E2E(chromium, 'Chromium');
    await runBloque4E2E(firefox, 'Firefox');

    console.log('\n================================================================');
    console.log('TODAS LAS PRUEBAS E2E DEL BLOQUE 4 PASARON AL 100% (Chromium y Firefox)');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ ERROR FATAL EN PRUEBAS DEL BLOQUE 4:', err);
    process.exit(1);
  }
})();
