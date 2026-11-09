import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/DrN/.gemini/antigravity/brain/5c026e55-3407-478a-9aa0-4d91e4803138';

async function main() {
  console.log('[VERIFY] Iniciando verificación en navegador de vistas de ensayo y paginación...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('console', msg => console.log('[BROWSER]', msg.text()));

  // Cargar en puerto 5175 con ?grid=v2
  await page.goto('http://127.0.0.1:5175/?grid=v2');
  await page.waitForTimeout(1500);

  // 1. Registro Maestro
  console.log('[VERIFY] 1. Registro Maestro...');
  const rmBtn = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtn.click();
  await page.waitForTimeout(1500);

  const pathRM = path.join(ARTIFACTS_DIR, 'screenshot_verificacion_maestro_con_paginacion.png');
  await page.screenshot({ path: pathRM });
  console.log('Captura Registro Maestro guardada:', pathRM);

  // Verificar presencia de la barra de paginación
  const hasPagination = await page.locator('[data-testid="grid-pagination-bar"]').isVisible();
  console.log('[VERIFY] ¿Barra de paginación visible en Maestro?:', hasPagination);

  // Verificar que la barra inferior de 28px ya no existe
  const hasOldStatusBar = await page.locator('[data-testid="grid-context-status-bar"]').count();
  console.log('[VERIFY] ¿Barra vieja status-bar eliminada?:', hasOldStatusBar === 0);

  // 2. Tracción Indirecta
  console.log('[VERIFY] 2. Navegando a Tracción Indirecta...');
  const tiBtn = page.locator('button:has-text("Tracción Indirecta")');
  await tiBtn.click();
  await page.waitForTimeout(2000);

  const pathTI = path.join(ARTIFACTS_DIR, 'screenshot_verificacion_traccion_indirecta.png');
  await page.screenshot({ path: pathTI });
  console.log('Captura Tracción Indirecta guardada:', pathTI);

  // Verificar que la columna "Observaciones TI" está en el DOM y visible
  const thObsTI = page.locator('th[data-col-id="traccion_observaciones"]');
  const isObsTIVisible = await thObsTI.isVisible();
  console.log('[VERIFY] ¿Columna Observaciones TI visible en pantalla en Tracción?:', isObsTIVisible);

  // Verificar columnas presentes en Tracción
  const tiHeaders = await page.$$eval('th[data-col-id]', els => els.map(e => e.innerText.trim().replace(/\n/g, ' ')));
  console.log('[VERIFY] Columnas en Tracción Indirecta:', tiHeaders);

  // 3. Compresión Uniaxial (UCS)
  console.log('[VERIFY] 3. Navegando a Compresión Uniaxial (UCS)...');
  const ucsBtn = page.locator('button:has-text("Compresión Uniaxial (UCS)")');
  await ucsBtn.click();
  await page.waitForTimeout(2000);

  const pathUCS = path.join(ARTIFACTS_DIR, 'screenshot_verificacion_ucs.png');
  await page.screenshot({ path: pathUCS });
  console.log('Captura UCS guardada:', pathUCS);

  const ucsHeaders = await page.$$eval('th[data-col-id]', els => els.map(e => e.innerText.trim().replace(/\n/g, ' ')));
  console.log('[VERIFY] Columnas en UCS:', ucsHeaders);

  // 4. Corte Directo
  console.log('[VERIFY] 4. Navegando a Corte Directo...');
  const corteBtn = page.locator('button:has-text("Corte Directo")');
  await corteBtn.click();
  await page.waitForTimeout(2000);

  const pathCorte = path.join(ARTIFACTS_DIR, 'screenshot_verificacion_corte.png');
  await page.screenshot({ path: pathCorte });
  console.log('Captura Corte guardada:', pathCorte);

  await browser.close();
  console.log('[VERIFY] Todas las verificaciones completadas.');
}

main().catch(console.error);

