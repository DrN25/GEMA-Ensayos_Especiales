// frontend/tests/grid-v2-crossbrowser.mjs
import { chromium, firefox } from 'playwright';
import fs from 'fs';
import path from 'path';

const rawData = JSON.parse(fs.readFileSync(path.resolve('../scratch/realData.json'), 'utf8'));
const realData = rawData.filter(r => !isNaN(Number(r.idd)));

async function testBrowser(browserType, name) {
  console.log(`\n--- Probando Bloque 2 en: ${name} ---`);
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('pageerror', err => console.error(`[${name}] ERROR EN PÁGINA:`, err.message));

  await page.route('**/api/ensayos*', async route => {
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
  });

  const t0 = performance.now();
  await page.goto('http://127.0.0.1:4173/?grid=v2');
  const rmBtn = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtn.click();

  // 1. Verificar render de celda
  const cell0 = await page.waitForSelector('[data-testid="cell-0-sondaje"]', { timeout: 10000 });
  const initialText = await cell0.innerText();
  console.log(`[${name}] Celda inicial 0-sondaje: "${initialText}"`);

  // 2. Probar doble clic y editor flotante
  await cell0.dblclick();
  const input = await page.waitForSelector('[data-testid="floating-input"]', { timeout: 5000 });
  await input.fill('TEST-CROSS');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  const updatedText = await page.$eval('[data-testid="cell-0-sondaje"]', el => el.innerText);
  console.log(`[${name}] Celda tras edición con FloatingEditor: "${updatedText}"`);
  if (updatedText !== 'TEST-CROSS') throw new Error(`[${name}] Falló actualización en celda`);

  // 3. Probar botón de acción (insertar fila abajo)
  const initialHeight = await page.$eval('tbody', el => el.style.height);
  const insertBtn = page.locator('tbody tr').first().locator('button[title="Insertar fila abajo"]');
  await insertBtn.click();
  await page.waitForTimeout(200);

  const newHeight = await page.$eval('tbody', el => el.style.height);
  console.log(`[${name}] Altura tbody antes: ${initialHeight} -> después: ${newHeight}`);

  const totalTime = performance.now() - t0;
  await browser.close();

  return {
    browser: name,
    success: true,
    initialText,
    updatedText,
    heightDelta: parseInt(newHeight) - parseInt(initialHeight),
    elapsedMs: parseFloat(totalTime.toFixed(2))
  };
}

(async () => {
  console.log('=== TEST CROSS-BROWSER BLOQUE 2 (CHROMIUM & FIREFOX) ===');
  const results = [];

  try {
    const cr = await testBrowser(chromium, 'Chromium');
    results.push(cr);
  } catch (err) {
    console.error('Fallo en Chromium:', err);
    results.push({ browser: 'Chromium', success: false, error: err.message });
  }

  try {
    const ff = await testBrowser(firefox, 'Firefox');
    results.push(ff);
  } catch (err) {
    console.error('Fallo en Firefox:', err);
    results.push({ browser: 'Firefox', success: false, error: err.message });
  }

  console.log('\n=== RESUMEN CROSS-BROWSER BLOQUE 2 ===');
  console.log(JSON.stringify(results, null, 2));

  const allPassed = results.every(r => r.success);
  process.exit(allPassed ? 0 : 1);
})();

