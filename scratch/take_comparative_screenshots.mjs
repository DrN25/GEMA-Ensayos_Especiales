// scratch/take_comparative_screenshots.mjs
import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';

const rawData = JSON.parse(fs.readFileSync(path.resolve('scratch/realData.json'), 'utf8'));
const realData = rawData.filter(r => !isNaN(Number(r.idd)));

const artifactDir = 'C:/Users/DrN/.gemini/antigravity/brain/5c026e55-3407-478a-9aa0-4d91e4803138';

(async () => {
  console.log('=== GENERANDO NUEVAS CAPTURAS COMPARATIVAS (v1 vs v2) ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

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

  // -------------------------------------------------------------------------
  // 1. CAPTURAS v1 (Grilla Clásica)
  // -------------------------------------------------------------------------
  console.log('1. Navegando a v1...');
  await page.goto('http://127.0.0.1:4173/?grid=v1');
  const rmBtn1 = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtn1.click();
  await page.waitForTimeout(2000);
  await page.waitForSelector('#cell-1-sondaje');

  // A. Scroll intermedio (180px) para ver Proyecto, Desde, Hasta
  await page.evaluate(() => {
    const el = document.querySelector('.overflow-x-auto, .overflow-auto');
    if (el) el.scrollLeft = 180;
  });
  await page.waitForTimeout(400);

  const shotV1Initial = path.resolve('scratch/screenshot_v1_scroll_initial.png');
  await page.screenshot({ path: shotV1Initial });
  fs.copyFileSync(shotV1Initial, path.join(artifactDir, 'screenshot_v1_scroll_initial.png'));
  console.log(`v1 (scroll intermedio) guardada.`);

  // B. Scroll al final (99999px) para ver las columnas finales y fixed right
  await page.evaluate(() => {
    const el = document.querySelector('.overflow-x-auto, .overflow-auto');
    if (el) el.scrollLeft = 99999;
  });
  await page.waitForTimeout(400);

  const shotV1End = path.resolve('scratch/screenshot_v1_scroll_end.png');
  await page.screenshot({ path: shotV1End });
  fs.copyFileSync(shotV1End, path.join(artifactDir, 'screenshot_v1_scroll_end.png'));
  console.log(`v1 (scroll final) guardada.`);

  // -------------------------------------------------------------------------
  // 2. CAPTURAS v2 (Grilla Virtualizada)
  // -------------------------------------------------------------------------
  console.log('2. Navegando a v2...');
  await page.goto('http://127.0.0.1:4173/?grid=v2');
  const rmBtn2 = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtn2.click();
  await page.waitForTimeout(2000);
  await page.waitForSelector('[data-testid="cell-0-sondaje"]');

  // A. Mismo scroll intermedio (180px)
  await page.evaluate(() => {
    const el = document.querySelector('div[tabindex="0"]');
    if (el) el.scrollLeft = 180;
  });
  await page.waitForTimeout(400);

  const shotV2Initial = path.resolve('scratch/screenshot_v2_scroll_initial.png');
  await page.screenshot({ path: shotV2Initial });
  fs.copyFileSync(shotV2Initial, path.join(artifactDir, 'screenshot_v2_scroll_initial.png'));
  console.log(`v2 (scroll intermedio) guardada.`);

  // B. Mismo scroll al final (99999px)
  await page.evaluate(() => {
    const el = document.querySelector('div[tabindex="0"]');
    if (el) el.scrollLeft = 99999;
  });
  await page.waitForTimeout(400);

  const shotV2End = path.resolve('scratch/screenshot_v2_scroll_end.png');
  await page.screenshot({ path: shotV2End });
  fs.copyFileSync(shotV2End, path.join(artifactDir, 'screenshot_v2_scroll_end.png'));
  console.log(`v2 (scroll final) guardada.`);

  await browser.close();
  console.log('Todas las capturas se generaron y copiaron a la carpeta de artefactos.');
})();
