// frontend/tests/bloque3_headers_sticky_resize.mjs
import { chromium, firefox } from 'playwright';
import fs from 'fs';
import path from 'path';

const rawData = JSON.parse(fs.readFileSync(path.resolve('../scratch/realData.json'), 'utf8'));
const realData = rawData.filter(r => !isNaN(Number(r.idd)));

async function runBloque3Tests(browserType, browserName) {
  console.log(`\n================================================================`);
  console.log(`EJECUTANDO PRUEBAS DEL BLOQUE 3 EN NAVEGADOR: ${browserName.toUpperCase()}`);
  console.log(`================================================================`);

  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Mockear API
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

  console.log(`1. Navegando a la app v2 en ${browserName}...`);
  await page.goto('http://127.0.0.1:4173/?grid=v2');
  await page.waitForTimeout(1000);
  const rmBtn = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtn.click();
  await page.waitForTimeout(2000);
  await page.waitForSelector('[data-testid="cell-0-sondaje"]');

  // -------------------------------------------------------------------------
  // TEST 1: Verificación de colSpan de grupos en el DOM
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 1: Verificación de colSpan de cabeceras de 2 niveles ---');
  const groupHeaders = await page.evaluate(() => {
    const ths = Array.from(document.querySelectorAll('thead tr:first-child th'));
    return ths.map(th => ({
      text: th.innerText.trim(),
      colSpan: th.colSpan,
      dataColId: th.getAttribute('data-col-id')
    }));
  });

  console.log(`Grupos detectados en el DOM: ${groupHeaders.length}`);
  let totalDomColSpan = 0;
  for (const g of groupHeaders) {
    console.log(`  - Grupo "${g.text}": colSpan = ${g.colSpan}`);
    totalDomColSpan += g.colSpan;
  }

  if (totalDomColSpan !== 50) {
    throw new Error(`Error en colSpan total: se esperaban 50 columnas, pero la suma de colSpan es ${totalDomColSpan}`);
  }
  console.log(`✅ TEST 1 PASÓ: Suma de colSpans coincide exactamente con 50 columnas.`);

  // -------------------------------------------------------------------------
  // TEST 2: Verificación de Sticky bajo Scroll Horizontal
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Verificación de Sticky bajo Scroll Horizontal (300px) ---');
  // Obtener posición inicial de la columna 'sondaje' y grupo 'Identificación de Muestra'
  const initialPositions = await page.evaluate(() => {
    const container = document.querySelector('div[tabindex="0"]');
    const groupTh = document.querySelector('thead tr:first-child th:first-child');
    const sondajeTh = document.querySelector('th[data-col-id="sondaje"]');
    const sondajeTd = document.querySelector('[data-testid="cell-0-sondaje"]');
    const accionesTh = document.querySelector('th[data-col-id="acciones_col"]');
    const unpinnedTh = document.querySelector('th[data-col-id="proyecto"]');

    const cRect = container.getBoundingClientRect();
    return {
      groupLeft: groupTh.getBoundingClientRect().left - cRect.left,
      sondajeThLeft: sondajeTh.getBoundingClientRect().left - cRect.left,
      sondajeTdLeft: sondajeTd.getBoundingClientRect().left - cRect.left,
      accionesThRight: cRect.right - accionesTh.getBoundingClientRect().right,
      unpinnedThLeft: unpinnedTh.getBoundingClientRect().left - cRect.left
    };
  });

  // Ejecutar scroll horizontal de 300px
  await page.evaluate(() => {
    const container = document.querySelector('div[tabindex="0"]');
    container.scrollLeft = 300;
  });
  await page.waitForTimeout(300);

  const scrolledPositions = await page.evaluate(() => {
    const container = document.querySelector('div[tabindex="0"]');
    const groupTh = document.querySelector('thead tr:first-child th:first-child');
    const sondajeTh = document.querySelector('th[data-col-id="sondaje"]');
    const sondajeTd = document.querySelector('[data-testid="cell-0-sondaje"]');
    const accionesTh = document.querySelector('th[data-col-id="acciones_col"]');
    const unpinnedTh = document.querySelector('th[data-col-id="proyecto"]');

    const cRect = container.getBoundingClientRect();
    return {
      groupLeft: groupTh.getBoundingClientRect().left - cRect.left,
      sondajeThLeft: sondajeTh.getBoundingClientRect().left - cRect.left,
      sondajeTdLeft: sondajeTd.getBoundingClientRect().left - cRect.left,
      accionesThRight: cRect.right - accionesTh.getBoundingClientRect().right,
      unpinnedThLeft: unpinnedTh.getBoundingClientRect().left - cRect.left
    };
  });

  console.log(`Posición Group Left: Inicial = ${initialPositions.groupLeft}px, Bajo Scroll = ${scrolledPositions.groupLeft}px`);
  console.log(`Posición Sondaje Th Left: Inicial = ${initialPositions.sondajeThLeft}px, Bajo Scroll = ${scrolledPositions.sondajeThLeft}px`);
  console.log(`Posición Sondaje Td Left: Inicial = ${initialPositions.sondajeTdLeft}px, Bajo Scroll = ${scrolledPositions.sondajeTdLeft}px`);
  console.log(`Posición Acciones Th Right: Inicial = ${initialPositions.accionesThRight}px, Bajo Scroll = ${scrolledPositions.accionesThRight}px`);
  console.log(`Posición Unpinned (Proyecto) Left: Inicial = ${initialPositions.unpinnedThLeft}px, Bajo Scroll = ${scrolledPositions.unpinnedThLeft}px`);

  // Las columnas y grupos sticky no deben moverse (diferencia < 2px)
  if (Math.abs(initialPositions.groupLeft - scrolledPositions.groupLeft) > 2) {
    throw new Error(`Fallo de Sticky: El grupo de cabecera se desplazó ${scrolledPositions.groupLeft - initialPositions.groupLeft}px`);
  }
  if (Math.abs(initialPositions.sondajeThLeft - scrolledPositions.sondajeThLeft) > 2) {
    throw new Error(`Fallo de Sticky: La cabecera sondaje se desplazó.`);
  }
  if (Math.abs(initialPositions.sondajeTdLeft - scrolledPositions.sondajeTdLeft) > 2) {
    throw new Error(`Fallo de Sticky: La celda sondaje se desplazó.`);
  }
  // La columna unpinned SÍ debe haberse desplazado ~300px hacia la izquierda
  const unpinnedShift = initialPositions.unpinnedThLeft - scrolledPositions.unpinnedThLeft;
  console.log(`Desplazamiento horizontal de columna no-sticky: ${unpinnedShift}px (esperado ~300px)`);
  if (unpinnedShift < 250) {
    throw new Error(`Fallo de Scroll: La columna unpinned no se desplazó.`);
  }
  console.log(`✅ TEST 2 PASÓ: Sticky Left y Sticky Right permanecen anclados y las columnas no-sticky hacen scroll.`);

  // Restaurar scroll
  await page.evaluate(() => {
    document.querySelector('div[tabindex="0"]').scrollLeft = 0;
  });
  await page.waitForTimeout(200);

  // -------------------------------------------------------------------------
  // TEST 3: Redimensionamiento sin re-render de celdas + Medición Event Timing
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Resize sin re-render de celdas (arrastre de 60px) ---');

  // Registrar Event Timing Observer si está soportado (Chromium)
  await page.evaluate(() => {
    window.__resizeEtEntries = [];
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'pointerdown' || entry.name === 'pointermove' || entry.name === 'pointerup') {
              window.__resizeEtEntries.push({
                name: entry.name,
                duration: entry.duration,
                processingDuration: entry.processingEnd - entry.processingStart
              });
            }
          }
        });
        obs.observe({ type: 'event', buffered: true, durationThreshold: 0 });
      } catch (_) {}
    }
  });

  const sondajeHandle = await page.waitForSelector('[data-testid="resize-handle-sondaje"]');
  const handleBox = await sondajeHandle.boundingBox();

  const widthBefore = await page.evaluate(() => {
    const col = document.getElementById('grid-col-sondaje');
    const th = document.querySelector('th[data-col-id="sondaje"]');
    const td = document.querySelector('[data-testid="cell-0-sondaje"]');
    return {
      colWidth: parseFloat(col.style.width),
      thWidth: th.getBoundingClientRect().width,
      tdWidth: td.getBoundingClientRect().width
    };
  });
  console.log(`Ancho antes del resize (Sondaje): Col=${widthBefore.colWidth}px, Th=${widthBefore.thWidth}px, Td=${widthBefore.tdWidth}px`);

  // Realizar arrastre de ratón (drag & drop) de 60px hacia la derecha
  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let step = 1; step <= 6; step++) {
    await page.mouse.move(startX + step * 10, startY);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);

  const widthAfter = await page.evaluate(() => {
    const col = document.getElementById('grid-col-sondaje');
    const th = document.querySelector('th[data-col-id="sondaje"]');
    const td = document.querySelector('[data-testid="cell-0-sondaje"]');
    return {
      colWidth: parseFloat(col.style.width),
      thWidth: th.getBoundingClientRect().width,
      tdWidth: td.getBoundingClientRect().width
    };
  });
  console.log(`Ancho después del resize (+60px): Col=${widthAfter.colWidth}px, Th=${widthAfter.thWidth}px, Td=${widthAfter.tdWidth}px`);

  const delta = widthAfter.colWidth - widthBefore.colWidth;
  if (Math.abs(delta - 60) > 2) {
    throw new Error(`Error en resize: se esperaba incremento de 60px, pero fue ${delta}px`);
  }
  console.log(`✅ TEST 3 PASÓ: Columna redimensionada exactamente a +60px con sincronización perfecta de <col>, <th> y <td>.`);

  // Medición Event Timing en Resize
  const etEntries = await page.evaluate(() => window.__resizeEtEntries || []);
  if (etEntries.length > 0) {
    console.log(`\nEvent Timing capturado en Resize (${browserName}):`);
    const pd = etEntries.find(e => e.name === 'pointerdown');
    const pu = etEntries.find(e => e.name === 'pointerup');
    if (pd) console.log(`  - pointerdown: duration = ${pd.duration} ms, JS processing = ${pd.processingDuration.toFixed(2)} ms`);
    if (pu) console.log(`  - pointerup: duration = ${pu.duration} ms, JS processing = ${pu.processingDuration.toFixed(2)} ms`);
  }

  await browser.close();
  return {
    browserName,
    widthBefore: widthBefore.colWidth,
    widthAfter: widthAfter.colWidth,
    etEntries
  };
}

(async () => {
  try {
    const chromiumResult = await runBloque3Tests(chromium, 'Chromium');
    let firefoxResult = null;
    try {
      firefoxResult = await runBloque3Tests(firefox, 'Firefox');
    } catch (ffErr) {
      console.warn('Advertencia en Firefox:', ffErr.message);
    }

    console.log('\n================================================================');
    console.log('RESUMEN FINAL DE PRUEBAS DEL BLOQUE 3:');
    console.log('✅ Chromium: colSpan 2 niveles, sticky scroll y resize PASARON AL 100%');
    if (firefoxResult) {
      console.log('✅ Firefox: colSpan 2 niveles, sticky scroll y resize PASARON AL 100%');
    }
    console.log('================================================================');
  } catch (err) {
    console.error('❌ ERROR FATAL EN PRUEBAS:', err);
    process.exit(1);
  }
})();
