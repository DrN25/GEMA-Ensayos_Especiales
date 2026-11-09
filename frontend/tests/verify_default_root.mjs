import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/DrN/.gemini/antigravity/brain/5c026e55-3407-478a-9aa0-4d91e4803138';

async function verifyDefaultAccess() {
  console.log('[VERIFY] Accediendo directamente a http://127.0.0.1:5175/ sin ?grid=v2...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Limpiar localStorage de cualquier override
  await page.goto('http://127.0.0.1:5175/');
  await page.evaluate(() => {
    localStorage.removeItem('sigeg_grid_version');
  });
  await page.reload();
  await page.waitForTimeout(1000);

  // Navegar a Registro Maestro
  const rmBtn = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtn.click();
  await page.waitForTimeout(2000);

  // Verificar si está montado VirtualizedGrid
  const isVirtualizedGridPresent = await page.locator('[data-testid="grid-pagination-bar"]').isVisible();
  console.log('¿VirtualizedGrid (v2) activo por defecto en ruta raíz?:', isVirtualizedGridPresent);

  const screenshotPath = path.join(ARTIFACTS_DIR, 'screenshot_verificacion_default_sin_query.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Captura guardada en:', screenshotPath);

  await browser.close();
  if (!isVirtualizedGridPresent) {
    throw new Error('VirtualizedGrid no está activo por defecto en /');
  }
}

verifyDefaultAccess().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});

