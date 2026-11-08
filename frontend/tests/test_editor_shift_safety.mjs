// frontend/tests/test_editor_shift_safety.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const rawData = JSON.parse(fs.readFileSync(path.resolve('../scratch/realData.json'), 'utf8'));
const realData = rawData.filter(r => !isNaN(Number(r.idd)));

(async () => {
  console.log('=== TEST DE SEGURIDAD: EDITOR ABIERTO CON INSERCIÓN / ELIMINACIÓN ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

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
  await page.waitForTimeout(1000);

  // 1. Obtener valores iniciales de fila 0 y fila 1
  const origRow0Text = await page.$eval('[data-testid="cell-0-sondaje"]', el => el.innerText);
  const origRow1Text = await page.$eval('[data-testid="cell-1-sondaje"]', el => el.innerText);
  console.log(`Fila 0 original: "${origRow0Text}" | Fila 1 original: "${origRow1Text}"`);

  // 2. Abrir editor en fila 1 y escribir nuevo valor sin presionar Enter
  console.log('Abriendo editor en Fila 1...');
  await page.dblclick('[data-testid="cell-1-sondaje"]');
  const input = await page.waitForSelector('[data-testid="floating-input"]');
  await input.fill('SONDAJE-FILA1-EDITADO');

  // 3. Con el editor ABIERTO, hacer clic en "Insertar fila abajo" en la FILA 0
  console.log('Haciendo clic en "Insertar fila abajo" en Fila 0 con el editor abierto...');
  const insertBtnRow0 = page.locator('tbody tr').first().locator('button[title="Insertar fila abajo"]');
  await insertBtnRow0.click();
  await page.waitForTimeout(300);

  // 4. Verificar qué hay ahora en el DOM:
  // Fila 0: debe ser origRow0Text
  // Fila 1: debe ser la NUEVA FILA (hereda sondaje de fila 0, NO debe tener "SONDAJE-FILA1-EDITADO")
  // Fila 2: debe ser la fila 1 original desplazada, con "SONDAJE-FILA1-EDITADO"
  const newRow0Text = await page.$eval('[data-testid="cell-0-sondaje"]', el => el.innerText);
  const newRow1Text = await page.$eval('[data-testid="cell-1-sondaje"]', el => el.innerText);
  const newRow2Text = await page.$eval('[data-testid="cell-2-sondaje"]', el => el.innerText);

  console.log(`Estado tras inserción:`);
  console.log(`  Fila 0: "${newRow0Text}" (esperado: "${origRow0Text}")`);
  console.log(`  Fila 1 (nueva): "${newRow1Text}" (esperado: hereda "${origRow0Text}", NO texto editado)`);
  console.log(`  Fila 2 (antigua 1): "${newRow2Text}" (esperado: "SONDAJE-FILA1-EDITADO")`);

  if (newRow0Text !== origRow0Text) throw new Error('Fila 0 fue corrompida');
  if (newRow1Text === 'SONDAJE-FILA1-EDITADO') throw new Error('ERROR CRÍTICO: La edición cayó en la fila insertada equivocada');
  if (newRow2Text !== 'SONDAJE-FILA1-EDITADO') throw new Error('ERROR: La fila original no recibió el valor editado');

  console.log('✅ TEST SUPERADO CON ÉXITO: El editor confirmó en la fila correcta y no apuntó a la fila equivocada.');
  await browser.close();
})();

