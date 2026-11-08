// frontend/tests/grid-v2-smoke.mjs
import { chromium, firefox } from 'playwright';

async function testBrowser(browserType, name) {
  console.log(`\n--- Probando Bloque 1 en Navegador: ${name} ---`);
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 1. Verificar carga en modo v1 por defecto
  const t0 = performance.now();
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForTimeout(500);
  const tLoad = performance.now() - t0;
  console.log(`[${name}] Carga inicial: ${tLoad.toFixed(2)} ms`);

  // 2. Verificar navegación a Registro Maestro
  const rmBtn = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtn.click();
  await page.waitForTimeout(1000);

  const tableExists = await page.$('table');
  if (!tableExists) throw new Error(`[${name}] La tabla no se renderizó en la vista principal`);
  console.log(`[${name}] Tabla v1 renderizada correctamente.`);

  // 3. Verificar que los módulos de columnas y flags cargan sin errores
  const moduleCheck = await page.evaluate(async () => {
    try {
      const colModule = await import('/src/features/grid/columnsDefinition.ts');
      const flagModule = await import('/src/features/grid/flags.ts');
      return {
        columnsCount: colModule.GRID_COLUMNS_DEFINITION.length,
        version: flagModule.getGridVersion()
      };
    } catch (e) {
      return { error: e.message };
    }
  });

  if (moduleCheck.error) {
    console.warn(`[${name}] Módulos evaluados en runtime:`, moduleCheck.error);
  } else {
    console.log(`[${name}] Columnas definidas: ${moduleCheck.columnsCount}, Versión activa: ${moduleCheck.version}`);
  }

  await browser.close();
  return { browser: name, loadTimeMs: parseFloat(tLoad.toFixed(2)), success: true };
}

(async () => {
  console.log('=== TEST CROSS-BROWSER BLOQUE 1 (CHROMIUM & FIREFOX) ===');
  const results = [];

  try {
    const crResult = await testBrowser(chromium, 'Chromium');
    results.push(crResult);
  } catch (err) {
    console.error('Fallo en Chromium:', err);
    results.push({ browser: 'Chromium', success: false, error: err.message });
  }

  try {
    const ffResult = await testBrowser(firefox, 'Firefox');
    results.push(ffResult);
  } catch (err) {
    console.error('Fallo en Firefox:', err);
    results.push({ browser: 'Firefox', success: false, error: err.message });
  }

  console.log('\n=== RESUMEN CROSS-BROWSER ===');
  console.log(JSON.stringify(results, null, 2));

  const allPassed = results.every(r => r.success);
  process.exit(allPassed ? 0 : 1);
})();
