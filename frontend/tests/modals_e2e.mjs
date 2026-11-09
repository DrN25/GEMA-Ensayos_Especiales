// frontend/tests/modals_e2e.mjs
import { chromium, firefox } from 'playwright';
import fs from 'fs';
import path from 'path';

const rawData = JSON.parse(fs.readFileSync(path.resolve('../scratch/realData.json'), 'utf8'));
const realData = rawData.filter(r => !isNaN(Number(r.idd)));

async function runModalsE2E(browserType, browserName) {
  console.log(`\n================================================================`);
  console.log(`EJECUTANDO PRUEBAS E2E DE MODALES EN: ${browserName.toUpperCase()}`);
  console.log(`================================================================`);

  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true
  });
  const page = await context.newPage();
  page.on('console', msg => console.log(`[${browserName} BROWSER]`, msg.text()));
  page.on('pageerror', err => console.error(`[${browserName} PAGE ERROR]`, err));

  // Mocks de aislamiento total
  await page.route('**/api/**', async route => {
    const req = route.request();
    const url = req.url();
    const method = req.method();

    if (url.includes('/api/ensayos/stats') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: realData.length,
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
          items: realData,
          page: 1,
          page_size: 50,
          total_filtered: realData.length,
          total_pages: Math.ceil(realData.length / 50),
          total_global: realData.length,
          kpis: { total_page_records: realData.length, total_anomalies_page: 0 }
        })
      });
      return;
    }
    await route.continue();
  });

  await page.goto('http://127.0.0.1:4173/?grid=v2');
  await page.waitForTimeout(1000);
  const rmBtn = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtn.click();
  await page.waitForTimeout(2000);
  await page.waitForSelector('[data-testid="cell-0-sondaje"]');

  // =========================================================================
  // PRUEBA 1: MODAL DE BLOQUEO DE GUARDADO CON "IR A CELDA"
  // =========================================================================
  console.log(`[${browserName}] 1. Probando Modal de Bloqueo de Guardado...`);
  
  // Detonar el modal de bloqueo con un error crítico simulado en IDD 15 (sondaje)
  await page.evaluate(() => {
    const alerts = [
      {
        idd: 15,
        field: 'sondaje',
        type: 'CRÍTICO',
        message: 'El código de Sondaje es obligatorio y no puede quedar vacío.',
        tab: 'registro_maestro',
        value: ''
      }
    ];
    window.__testTriggerSaveBlocking(alerts);
  });

  // Verificar que el modal se renderizó buscando el contenedor del modal
  await page.waitForSelector('h3:has-text("Guardado Bloqueado por QA/QC")');
  const modalLocator = page.locator('div.fixed.inset-0:has(h3:has-text("Guardado Bloqueado por QA/QC"))');
  const modalText = await modalLocator.textContent();

  if (!modalText.includes('Fila IDD 15') || !modalText.includes('sondaje')) {
    throw new Error(`[${browserName}] Modal de bloqueo no muestra la fila o el campo correcto. Texto encontrado: ${modalText}`);
  }
  console.log(`[${browserName}] Modal de bloqueo visible con alerta de IDD 15 (sondaje).`);

  // Hacer clic en "Ir a Celda" dentro del modal
  const irACeldaBtn = modalLocator.locator('button:has-text("Ir a Celda")');
  await irACeldaBtn.click();
  await page.waitForTimeout(400);

  // Verificar que el modal se cerró
  const modalCount = await page.locator('h3:has-text("Guardado Bloqueado por QA/QC")').count();
  if (modalCount !== 0) {
    throw new Error(`[${browserName}] El modal de bloqueo no se cerró tras hacer clic en 'Ir a Celda'.`);
  }
  console.log(`[${browserName}] Modal de bloqueo cerrado exitosamente tras clic en 'Ir a Celda'.`);

  // =========================================================================
  // PRUEBA 2: MODAL DE COLISIÓN DE IDD CON DESCARGA CSV
  // =========================================================================
  console.log(`[${browserName}] 2. Probando Modal de Colisión de IDD y descarga de CSV...`);

  const mockCollisions = [
    {
      excelRow: 3,
      originalIdd: 50,
      assignedIdd: 9819,
      sondaje: 'DH-01',
      codigo_muestra: 'M-01',
      reason: 'COLISION_BD',
      description: 'IDD existente en base de datos con sondaje diferente'
    },
    {
      excelRow: 7,
      originalIdd: 50,
      assignedIdd: 9820,
      sondaje: 'DH-02',
      codigo_muestra: 'M-02',
      reason: 'DUPLICADO_ARCHIVO',
      description: 'IDD duplicado dentro del mismo archivo Excel'
    }
  ];

  const mockPendingRecords = [
    { idd: 9819, sondaje: 'DH-01', codigo_muestra: 'M-01' },
    { idd: 9820, sondaje: 'DH-02', codigo_muestra: 'M-02' }
  ];

  await page.evaluate(({ collisions, pending }) => {
    window.__testTriggerCollisionModal(collisions, pending);
  }, { collisions: mockCollisions, pending: mockPendingRecords });

  await page.waitForSelector('h3:has-text("Colisiones de IDD Detectadas al Importar")');
  const collisionModalLocator = page.locator('div.fixed.inset-0:has(h3:has-text("Colisiones de IDD Detectadas al Importar"))');
  const collisionModalText = await collisionModalLocator.textContent();

  if (!collisionModalText.includes('9819') || !collisionModalText.includes('9820')) {
    throw new Error(`[${browserName}] Modal de colisiones no muestra los IDDs asignados correlativos.`);
  }
  console.log(`[${browserName}] Modal de colisiones visible con tabla y 2 colisiones reportadas (IDDs 9819 y 9820).`);

  // Descarga de CSV con Promise.all
  console.log(`[${browserName}] Esperando evento de descarga al hacer clic en 'Descargar CSV'...`);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    collisionModalLocator.locator('button:has-text("Descargar CSV")').click()
  ]);

  const downloadName = download.suggestedFilename();
  console.log(`[${browserName}] Descarga interceptada: ${downloadName}`);
  if (!downloadName.startsWith('informe_colisiones_idd_') || !downloadName.endsWith('.csv')) {
    throw new Error(`[${browserName}] Nombre de archivo CSV inesperado: ${downloadName}`);
  }

  // Leer contenido descargado
  const downloadPath = path.resolve(`../scratch/downloaded_${browserName}_${downloadName}`);
  await download.saveAs(downloadPath);
  const csvContent = fs.readFileSync(downloadPath, 'utf8');
  console.log(`[${browserName}] CSV descargado (${csvContent.length} bytes):\n`, csvContent.trim());

  if (!csvContent.includes("Fila Excel,IDD Original,IDD Asignado") ||
      !csvContent.includes('DH-01') ||
      !csvContent.includes('DH-02') ||
      !csvContent.includes('9819') ||
      !csvContent.includes('9820')) {
    throw new Error(`[${browserName}] El contenido del CSV descargado no coincide con el reporte de colisiones.`);
  }
  console.log(`[${browserName}] Validación de contenido CSV: CORRECTA.`);

  // Confirmar y proceder
  const confirmBtn = collisionModalLocator.locator('button:has-text("Aceptar y Continuar a Grilla")');
  await confirmBtn.click();
  await page.waitForTimeout(400);

  const collisionModalCount = await page.locator('h3:has-text("Colisiones de IDD Detectadas al Importar")').count();
  if (collisionModalCount !== 0) {
    throw new Error(`[${browserName}] El modal de colisiones no se cerró tras confirmar.`);
  }
  console.log(`[${browserName}] Modal de colisiones cerrado y registros procedidos exitosamente.`);

  await browser.close();
  console.log(`[${browserName}] TODAS LAS PRUEBAS E2E DE MODALES PASARON EXITOSAMENTE (100% OK).`);
}

async function main() {
  console.log('\n================================================================');
  console.log('EJECUCIÓN DE PRUEBAS E2E CROSS-BROWSER CON MOCKS (Chromium & Firefox)');
  console.log('================================================================');

  await runModalsE2E(chromium, 'chromium');
  await runModalsE2E(firefox, 'firefox');

  console.log('\n================================================================');
  console.log('VERIFICACIÓN E2E DE MODALES COMPLETADA EXITOSAMENTE EN AMBOS NAVEGADORES');
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Error fatal en pruebas E2E de modales:', err);
  process.exit(1);
});
