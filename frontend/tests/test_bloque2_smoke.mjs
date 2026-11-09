import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));

  // Cargar realData
  const rawData = JSON.parse(fs.readFileSync(path.resolve('../scratch/realData.json'), 'utf8'));
  const realData = rawData.filter(r => !isNaN(Number(r.idd)));
  console.log(`Cargando dataset real de ${realData.length} registros...`);

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

  console.log('Navigating to http://127.0.0.1:4173/?grid=v2 ...');
  await page.goto('http://127.0.0.1:4173/?grid=v2');
  await page.waitForTimeout(1000);

  // Navigate to Registro Maestro
  const rmBtn = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtn.click();
  await page.waitForTimeout(2000);

  // Check if cell-0-sondaje exists
  const cell0 = await page.waitForSelector('[data-testid="cell-0-sondaje"]', { timeout: 5000 });
  console.log('cell-0-sondaje found:', !!cell0);

  if (cell0) {
    const text = await cell0.innerText();
    console.log('cell-0-sondaje text:', text);
  }

  // Check button "Insertar fila abajo"
  const insertBtn = await page.$('button[title="Insertar fila abajo"]');
  console.log('insertBtn found:', !!insertBtn);

  // Check total row count in virtualizer / tbody
  const rowCount = await page.evaluate(() => {
    const tbody = document.querySelector('tbody');
    return {
      tbodyHeight: tbody?.style.height,
      renderedRows: tbody?.querySelectorAll('tr').length
    };
  });
  console.log('Row count info:', rowCount);

  await browser.close();
})();
