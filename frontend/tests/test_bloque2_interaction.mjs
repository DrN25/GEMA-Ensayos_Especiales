import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const rawData = JSON.parse(fs.readFileSync(path.resolve('../scratch/realData.json'), 'utf8'));
  const realData = rawData.filter(r => !isNaN(Number(r.idd)));

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
  const rmBtn = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtn.click();

  const cell0 = await page.waitForSelector('[data-testid="cell-0-sondaje"]');
  console.log('1. Click en cell-0-sondaje...');
  await cell0.click();

  console.log('2. Doble click para abrir FloatingEditor...');
  await cell0.dblclick();
  const input = await page.waitForSelector('[data-testid="floating-input"]', { timeout: 2000 });
  console.log('FloatingEditor input found:', !!input);

  console.log('3. Escribir en editor...');
  await input.fill('TEST-123');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  const updatedText = await cell0.innerText();
  console.log('Texto actualizado en celda:', updatedText);

  console.log('4. Click en Boton de accion (Insertar fila abajo)...');
  const insertBtn = await page.$('button[title="Insertar fila abajo"]');
  await insertBtn.click();
  await page.waitForTimeout(200);

  const rowCountAfter = await page.evaluate(() => {
    const tbody = document.querySelector('tbody');
    return tbody?.style.height;
  });
  console.log('Altura tbody despues de insertar:', rowCountAfter);

  await browser.close();
})();

