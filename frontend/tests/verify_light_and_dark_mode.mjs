import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/DrN/.gemini/antigravity/brain/5c026e55-3407-478a-9aa0-4d91e4803138';

async function verifyThemeModes() {
  console.log('[VERIFY] Probando modo claro y modo oscuro en VirtualizedGrid v2...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('[BROWSER]', msg.text()));
  page.on('pageerror', err => console.log('[BROWSER ERROR]', err));

  // 1. Ir a la app y forzar modo claro via localStorage
  await page.goto('http://127.0.0.1:5175/?grid=v2');
  await page.evaluate(() => {
    localStorage.setItem('sigeg_theme', 'light');
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  });
  await page.reload();
  await page.waitForTimeout(1500);

  // Navegar a Registro Maestro usando el botón con texto exacto
  const rmBtn = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtn.click();
  await page.waitForTimeout(2000);

  // Tomar captura de pantalla inmediata para ver qué se ve
  const lightScreenshotPath = path.join(ARTIFACTS_DIR, 'screenshot_verificacion_modo_claro.png');
  await page.screenshot({ path: lightScreenshotPath });
  console.log('Captura Modo Claro guardada:', lightScreenshotPath);

  // Inspeccionar celdas presentes en el DOM
  const cells = await page.$$eval('td', tds => tds.slice(0, 10).map(t => ({
    text: t.innerText.trim(),
    testId: t.getAttribute('data-testid'),
    bg: window.getComputedStyle(t).backgroundColor,
    color: window.getComputedStyle(t).color
  })));
  console.log('[VERIFY MODO CLARO CELDAS]:', cells);

  // Cambiar a modo oscuro
  await page.evaluate(() => {
    localStorage.setItem('sigeg_theme', 'dark');
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
  });
  await page.reload();
  await page.waitForTimeout(1500);

  const rmBtnDark = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtnDark.click();
  await page.waitForTimeout(2000);

  const darkScreenshotPath = path.join(ARTIFACTS_DIR, 'screenshot_verificacion_modo_oscuro.png');
  await page.screenshot({ path: darkScreenshotPath });
  console.log('Captura Modo Oscuro guardada:', darkScreenshotPath);

  const darkCells = await page.$$eval('td', tds => tds.slice(0, 10).map(t => ({
    text: t.innerText.trim(),
    testId: t.getAttribute('data-testid'),
    bg: window.getComputedStyle(t).backgroundColor,
    color: window.getComputedStyle(t).color
  })));
  console.log('[VERIFY MODO OSCURO CELDAS]:', darkCells);

  await browser.close();
  console.log('[VERIFY] Completado.');
}

verifyThemeModes().catch(err => {
  console.error('[VERIFY ERROR]', err);
  process.exit(1);
});
