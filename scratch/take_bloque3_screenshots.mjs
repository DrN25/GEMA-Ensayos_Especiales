import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';

const rawData = JSON.parse(fs.readFileSync('scratch/realData.json', 'utf8'));
const realData = rawData.filter(r => !isNaN(Number(r.idd)));

const artifactDir = 'C:/Users/DrN/.gemini/antigravity/brain/5c026e55-3407-478a-9aa0-4d91e4803138';

(async () => {
  console.log('=== GENERANDO CAPTURAS VISUALES DEL BLOQUE 3 ===');
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

  await page.goto('http://127.0.0.1:4173/?grid=v2');
  await page.waitForTimeout(1000);
  const rmBtn = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtn.click();
  await page.waitForTimeout(2000);
  await page.waitForSelector('[data-testid="cell-0-sondaje"]');

  // 1. Captura Normal Inicial (Cabecera 2 niveles sin scroll)
  const shotNormal = path.resolve('scratch/screenshot_bloque3_v2_header_normal.png');
  await page.screenshot({ path: shotNormal });
  fs.copyFileSync(shotNormal, path.join(artifactDir, 'screenshot_bloque3_v2_header_normal.png'));
  console.log('Captura Normal guardada.');

  // 2. Captura con Scroll Horizontal (300px) mostrando grupo sticky fijado a la izquierda sin cortarse
  await page.evaluate(() => {
    document.querySelector('div[tabindex="0"]').scrollLeft = 300;
  });
  await page.waitForTimeout(400);

  const shotScroll = path.resolve('scratch/screenshot_bloque3_v2_header_scroll.png');
  await page.screenshot({ path: shotScroll });
  fs.copyFileSync(shotScroll, path.join(artifactDir, 'screenshot_bloque3_v2_header_scroll.png'));
  console.log('Captura Scroll guardada.');

  // 3. Captura después de Resize (+80px en Sondaje)
  await page.evaluate(() => {
    document.querySelector('div[tabindex="0"]').scrollLeft = 0;
  });
  await page.waitForTimeout(200);

  const handle = await page.waitForSelector('[data-testid="resize-handle-sondaje"]');
  const box = await handle.boundingBox();
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 80, startY);
  await page.mouse.up();
  await page.waitForTimeout(400);

  const shotResized = path.resolve('scratch/screenshot_bloque3_v2_resized.png');
  await page.screenshot({ path: shotResized });
  fs.copyFileSync(shotResized, path.join(artifactDir, 'screenshot_bloque3_v2_resized.png'));
  console.log('Captura Resized guardada.');

  await browser.close();
  console.log('Todas las capturas del Bloque 3 han sido guardadas y transferidas a artefactos.');
})();
