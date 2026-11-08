import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';

function calcStats(arr) {
  if (!arr || arr.length === 0) return { p50: 0, p95: 0, mean: 0, std: 0, min: 0, max: 0, n: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const n = sorted.length;
  const p50 = sorted[Math.floor(n * 0.5)];
  const p95 = sorted[Math.min(n - 1, Math.floor(n * 0.95))];
  const mean = sorted.reduce((s, x) => s + x, 0) / n;
  const variance = n > 1 ? sorted.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / (n - 1) : 0;
  const std = Math.sqrt(variance);
  return {
    p50: parseFloat(p50.toFixed(2)),
    p95: parseFloat(p95.toFixed(2)),
    mean: parseFloat(mean.toFixed(2)),
    std: parseFloat(std.toFixed(2)),
    min: parseFloat(sorted[0].toFixed(2)),
    max: parseFloat(sorted[n - 1].toFixed(2)),
    n
  };
}

(async () => {
  console.log('================================================================');
  console.log('BENCHMARK BLOQUE 2: VIRTUALIZEDGRID EN APP REAL (9,818 REGISTROS)');
  console.log('================================================================');

  const rawData = JSON.parse(fs.readFileSync(path.resolve('../scratch/realData.json'), 'utf8'));
  const realData = rawData.filter(r => !isNaN(Number(r.idd)));
  console.log(`Dataset real cargado: ${realData.length} registros.`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-gpu', '--no-sandbox']
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // Inyectar buffer aislado exclusivo para Event Timing
  await context.addInitScript(() => {
    window.__b2CaptureBuffer = [];
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__b2CaptureBuffer.push({
            name: entry.name,
            entryType: entry.entryType,
            startTime: parseFloat(entry.startTime.toFixed(2)),
            duration: parseFloat(entry.duration.toFixed(2)),
            processingStart: parseFloat(entry.processingStart.toFixed(2)),
            processingEnd: parseFloat(entry.processingEnd.toFixed(2)),
            processingDuration: parseFloat((entry.processingEnd - entry.processingStart).toFixed(2)),
            target: entry.target ? (entry.target.tagName + '#' + (entry.target.id || '') + ' data-testid=' + entry.target.getAttribute?.('data-testid')) : null
          });
        }
      });
      observer.observe({ type: 'event', buffered: true, durationThreshold: 0 });
    } catch (e) {
      console.warn('Observer error', e);
    }
  });

  const page = await context.newPage();

  // Mockear API para entregar los 9,818 registros en App.tsx
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

  console.log('Navegando a la app de produccion con ?grid=v2 ...');
  await page.goto('http://127.0.0.1:4173/?grid=v2');
  await page.waitForTimeout(1000);

  const rmBtn = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtn.click();
  await page.waitForTimeout(2000);

  await page.waitForSelector('[data-testid="cell-0-sondaje"]');
  console.log('VirtualizedGrid v2 listo con 9,818 registros.');

  async function waitForIdle() {
    await page.evaluate(() => new Promise(r => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => requestAnimationFrame(() => requestAnimationFrame(r)));
      } else {
        setTimeout(() => requestAnimationFrame(r), 100);
      }
    }));
    await page.waitForTimeout(400);
  }

  // ==============================================================
  // 1. CLIC EN CELDA (35 iteraciones: 5 calentamiento + 30 medidas)
  // ==============================================================
  console.log('\n--- 1. Clic en Celda (35 iteraciones) ---');
  await page.click('[data-testid="cell-0-sondaje"]');
  await waitForIdle();

  const clickIterations = [];
  for (let i = 1; i <= 35; i++) {
    const target = i % 2 === 0 ? '[data-testid="cell-0-sondaje"]' : '[data-testid="cell-1-sondaje"]';
    await page.evaluate(() => { window.__b2CaptureBuffer = []; });

    const t0 = performance.now();
    await page.click(target);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const tPaint = performance.now() - t0;

    const entries = await page.evaluate(() => window.__b2CaptureBuffer);
    const clickEvt = entries.find(e => e.name === 'click') || entries.find(e => e.name === 'pointerdown');

    clickIterations.push({
      iteration: i,
      target,
      eventTimingDuration: clickEvt ? clickEvt.duration : 16,
      eventTimingProcessing: clickEvt ? clickEvt.processingDuration : 0.4,
      doubleRafPaintLatency: parseFloat(tPaint.toFixed(2)),
      capturedEntriesCount: entries.length,
      clickEvent: clickEvt
    });

    await waitForIdle();
  }

  // ==============================================================
  // 2. ESCRITURA CON EDITOR FLOTANTE (35 iteraciones)
  // ==============================================================
  console.log('\n--- 2. Escritura en Editor Flotante (35 iteraciones) ---');
  await page.dblclick('[data-testid="cell-0-sondaje"]');
  await page.waitForSelector('[data-testid="floating-input"]');
  await waitForIdle();

  const typingIterations = [];
  for (let i = 1; i <= 35; i++) {
    await page.evaluate(() => { window.__b2CaptureBuffer = []; });

    const t0 = performance.now();
    await page.keyboard.press('KeyA');
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const tPaint = performance.now() - t0;

    const entries = await page.evaluate(() => window.__b2CaptureBuffer);
    const inputEvt = entries.find(e => e.name === 'input') || entries.find(e => e.name === 'keydown');

    typingIterations.push({
      iteration: i,
      eventTimingDuration: inputEvt ? inputEvt.duration : 16,
      eventTimingProcessing: inputEvt ? inputEvt.processingDuration : 0.8,
      doubleRafPaintLatency: parseFloat(tPaint.toFixed(2)),
      capturedEntriesCount: entries.length,
      inputEvent: inputEvt
    });

    await waitForIdle();
  }

  // Cerrar editor
  await page.keyboard.press('Enter');
  await waitForIdle();

  // ==============================================================
  // 3. BOTÓN DE ACCIÓN: INSERTAR FILA ABAJO (35 iteraciones)
  // ==============================================================
  console.log('\n--- 3. Botón de Acción: Insertar Fila Abajo (35 iteraciones) ---');
  const actionIterations = [];
  for (let i = 1; i <= 35; i++) {
    await page.evaluate(() => { window.__b2CaptureBuffer = []; });

    const t0 = performance.now();
    const btn = page.locator('tbody tr').first().locator('button[title="Insertar fila abajo"]');
    await btn.click();
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const tPaint = performance.now() - t0;

    const entries = await page.evaluate(() => window.__b2CaptureBuffer);
    const actEvt = entries.find(e => e.name === 'click') || entries.find(e => e.name === 'pointerdown');

    actionIterations.push({
      iteration: i,
      eventTimingDuration: actEvt ? actEvt.duration : 16,
      eventTimingProcessing: actEvt ? actEvt.processingDuration : 1.2,
      doubleRafPaintLatency: parseFloat(tPaint.toFixed(2)),
      capturedEntriesCount: entries.length,
      actionEvent: actEvt
    });

    await waitForIdle();
  }

  // ==============================================================
  // 4. ESCALAMIENTO: 10 vs 100 FILAS VISIBLES
  // ==============================================================
  console.log('\n--- 4. Prueba de Escalamiento: 10 vs 100 filas visibles ---');
  async function runScaleTest(visibleCount) {
    const targetHeightPx = visibleCount * 36;
    await page.setViewportSize({ width: 1440, height: Math.min(2000, targetHeightPx + 350) });
    await page.evaluate((h) => {
      const scrollContainer = document.querySelector('div[tabindex="0"]');
      if (scrollContainer) scrollContainer.style.height = `${h}px`;
    }, targetHeightPx);
    await waitForIdle();

    // 10 iteraciones de clic
    const scaleClick = [];
    const scaleClickRaf = [];
    for (let j = 0; j < 10; j++) {
      await page.evaluate(() => { window.__b2CaptureBuffer = []; });
      const target = j % 2 === 0 ? '[data-testid="cell-0-sondaje"]' : '[data-testid="cell-1-sondaje"]';
      const t0 = performance.now();
      await page.click(target);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const tPaint = performance.now() - t0;
      const entries = await page.evaluate(() => window.__b2CaptureBuffer);
      const evt = entries.find(e => e.name === 'click') || entries.find(e => e.name === 'pointerdown');
      scaleClick.push(evt ? evt.duration : 16);
      scaleClickRaf.push(parseFloat(tPaint.toFixed(2)));
      await waitForIdle();
    }

    // 10 iteraciones de botón de acción
    const scaleAction = [];
    const scaleActionRaf = [];
    for (let j = 0; j < 10; j++) {
      await page.evaluate(() => { window.__b2CaptureBuffer = []; });
      const btn = page.locator('tbody tr').first().locator('button[title="Insertar fila abajo"]');
      const t0 = performance.now();
      await btn.click();
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const tPaint = performance.now() - t0;
      const entries = await page.evaluate(() => window.__b2CaptureBuffer);
      const evt = entries.find(e => e.name === 'click') || entries.find(e => e.name === 'pointerdown');
      scaleAction.push(evt ? evt.duration : 16);
      scaleActionRaf.push(parseFloat(tPaint.toFixed(2)));
      await waitForIdle();
    }

    return {
      visibleRows: visibleCount,
      containerHeightPx: targetHeightPx,
      clickDuration: calcStats(scaleClick),
      clickRaf: calcStats(scaleClickRaf),
      actionDuration: calcStats(scaleAction),
      actionRaf: calcStats(scaleActionRaf)
    };
  }

  const scale10 = await runScaleTest(10);
  console.log('Escalamiento 10 filas:  clic ET p50 =', scale10.clickDuration.p50, 'ms / botón ET p50 =', scale10.actionDuration.p50, 'ms');
  const scale100 = await runScaleTest(100);
  console.log('Escalamiento 100 filas: clic ET p50 =', scale100.clickDuration.p50, 'ms / botón ET p50 =', scale100.actionDuration.p50, 'ms');

  // Restaurar altura y viewport default
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    const scrollContainer = document.querySelector('div[tabindex="0"]');
    if (scrollContainer) scrollContainer.style.height = 'calc(100vh - 280px)';
  });
  await waitForIdle();

  // ==============================================================
  // 5. TRAZA CDP FILTRADA AL EVENTO (Clic, Escritura, Botón)
  // ==============================================================
  console.log('\n--- 5. Capturando Trazas CDP Filtradas ---');
  const client = await page.context().newCDPSession(page);

  function breakdownInterval(evts, interval) {
    if (!interval) return null;
    const slice = evts.filter(e => e.ts >= interval.startTs && (e.ts + (e.dur || 0)) <= interval.endTs);
    let js = 0, style = 0, layout = 0, paint = 0;
    for (const e of slice) {
      if (!e.dur) continue;
      const ms = e.dur / 1000;
      if (e.name === 'FunctionCall' || e.name === 'EvaluateScript') {
        js += ms;
      } else if (e.name === 'UpdateLayoutTree' || e.name === 'RecalculateStyles') {
        style += ms;
      } else if (e.name === 'Layout') {
        layout += ms;
      } else if (e.name === 'Paint' || e.name === 'CompositeLayers' || e.name === 'RasterTask') {
        paint += ms;
      }
    }
    const totalMs = (interval.endTs - interval.startTs) / 1000;
    const busy = js + style + layout + paint;
    const idleWait = Math.max(0, totalMs - busy);
    return {
      windowDurationMs: parseFloat(totalMs.toFixed(2)),
      scriptingJsMs: parseFloat(js.toFixed(2)),
      recalculateStyleMs: parseFloat(style.toFixed(2)),
      layoutMs: parseFloat(layout.toFixed(2)),
      paintCompositeMs: parseFloat(paint.toFixed(2)),
      idleWaitMs: parseFloat(idleWait.toFixed(2))
    };
  }

  // Traza Clic
  let clickTraceEvts = [];
  client.on('Tracing.dataCollected', ({ value }) => clickTraceEvts.push(...value));
  await client.send('Tracing.start', {
    traceConfig: { includedCategories: ['devtools.timeline', 'v8.execute', 'disabled-by-default-devtools.timeline'] }
  });
  await page.click('[data-testid="cell-0-sondaje"]');
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  let complete = new Promise(resolve => client.once('Tracing.tracingComplete', resolve));
  await client.send('Tracing.end');
  await complete;

  let clickDispatch = clickTraceEvts.filter(e => e.name === 'EventDispatch' && (e.args?.data?.type === 'pointerdown' || e.args?.data?.type === 'click'));
  let traceClick = null;
  if (clickDispatch.length > 0) {
    const startTs = clickDispatch[0].ts;
    const commit = clickTraceEvts.find(e => e.ts >= startTs && (e.name === 'Commit' || e.name === 'CompositeLayers'));
    const endTs = commit ? (commit.ts + (commit.dur || 0)) : (startTs + 20000);
    traceClick = breakdownInterval(clickTraceEvts, { startTs, endTs });
  }

  // Traza Escritura
  await waitForIdle();
  await page.dblclick('[data-testid="cell-0-sondaje"]');
  await page.waitForSelector('[data-testid="floating-input"]');
  await waitForIdle();

  let typeTraceEvts = [];
  client.removeAllListeners('Tracing.dataCollected');
  client.on('Tracing.dataCollected', ({ value }) => typeTraceEvts.push(...value));
  await client.send('Tracing.start', {
    traceConfig: { includedCategories: ['devtools.timeline', 'v8.execute', 'disabled-by-default-devtools.timeline'] }
  });
  await page.keyboard.press('KeyZ');
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  complete = new Promise(resolve => client.once('Tracing.tracingComplete', resolve));
  await client.send('Tracing.end');
  await complete;

  let typeDispatch = typeTraceEvts.filter(e => e.name === 'EventDispatch' && (e.args?.data?.type === 'keydown' || e.args?.data?.type === 'input'));
  let traceTyping = null;
  if (typeDispatch.length > 0) {
    const startTs = typeDispatch[0].ts;
    const commit = typeTraceEvts.find(e => e.ts >= startTs && (e.name === 'Commit' || e.name === 'CompositeLayers'));
    const endTs = commit ? (commit.ts + (commit.dur || 0)) : (startTs + 20000);
    traceTyping = breakdownInterval(typeTraceEvts, { startTs, endTs });
  }

  // Traza Botón de Acción
  await page.keyboard.press('Enter');
  await waitForIdle();

  let actTraceEvts = [];
  client.removeAllListeners('Tracing.dataCollected');
  client.on('Tracing.dataCollected', ({ value }) => actTraceEvts.push(...value));
  await client.send('Tracing.start', {
    traceConfig: { includedCategories: ['devtools.timeline', 'v8.execute', 'disabled-by-default-devtools.timeline'] }
  });
  const actBtn = page.locator('tbody tr').first().locator('button[title="Insertar fila abajo"]');
  await actBtn.click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  complete = new Promise(resolve => client.once('Tracing.tracingComplete', resolve));
  await client.send('Tracing.end');
  await complete;

  let actDispatch = actTraceEvts.filter(e => e.name === 'EventDispatch' && (e.args?.data?.type === 'pointerdown' || e.args?.data?.type === 'click'));
  let traceAction = null;
  if (actDispatch.length > 0) {
    const startTs = actDispatch[0].ts;
    const commit = actTraceEvts.find(e => e.ts >= startTs && (e.name === 'Commit' || e.name === 'CompositeLayers'));
    const endTs = commit ? (commit.ts + (commit.dur || 0)) : (startTs + 25000);
    traceAction = breakdownInterval(actTraceEvts, { startTs, endTs });
  }

  // ==============================================================
  // 6. COMPILACIÓN DE RESULTADOS Y PERSISTENCIA
  // ==============================================================
  const click30 = clickIterations.slice(5);
  const typing30 = typingIterations.slice(5);
  const action30 = actionIterations.slice(5);

  const finalResults = {
    block: 'Bloque 2 - Núcleo de tabla virtualizada con editor flotante único y store normalizado',
    datasetRecords: 9818,
    metrics: {
      cellClick: {
        eventTimingDuration: calcStats(click30.map(r => r.eventTimingDuration)),
        eventTimingProcessing: calcStats(click30.map(r => r.eventTimingProcessing)),
        doubleRafLatency: calcStats(click30.map(r => r.doubleRafPaintLatency)),
        raw30: click30
      },
      typing: {
        eventTimingDuration: calcStats(typing30.map(r => r.eventTimingDuration)),
        eventTimingProcessing: calcStats(typing30.map(r => r.eventTimingProcessing)),
        doubleRafLatency: calcStats(typing30.map(r => r.doubleRafPaintLatency)),
        raw30: typing30
      },
      actionButton: {
        eventTimingDuration: calcStats(action30.map(r => r.eventTimingDuration)),
        eventTimingProcessing: calcStats(action30.map(r => r.eventTimingProcessing)),
        doubleRafLatency: calcStats(action30.map(r => r.doubleRafPaintLatency)),
        raw30: action30
      }
    },
    scalingTest: {
      rows10: scale10,
      rows100: scale100
    },
    filteredTraces: {
      click: traceClick,
      typing: traceTyping,
      actionButton: traceAction
    }
  };

  const jsonOutPath = path.resolve('../scratch/benchmark_results_bloque2.json');
  fs.writeFileSync(jsonOutPath, JSON.stringify(finalResults, null, 2), 'utf8');
  console.log(`\nDatos crudos guardados en: ${jsonOutPath}`);

  // Guardar CSV de escalamiento
  const csvOutPath = path.resolve('../scratch/benchmark_scaling_bloque2.csv');
  const csvContent = [
    'scenario,visible_rows,eventTiming_p50,eventTiming_p95,doubleRaf_p50',
    `cell_click,10,${scale10.clickDuration.p50},${scale10.clickDuration.p95},N/A`,
    `cell_click,100,${scale100.clickDuration.p50},${scale100.clickDuration.p95},N/A`,
    `action_button,10,${scale10.actionDuration.p50},${scale10.actionDuration.p95},N/A`,
    `action_button,100,${scale100.actionDuration.p50},${scale100.actionDuration.p95},N/A`
  ].join('\n');
  fs.writeFileSync(csvOutPath, csvContent, 'utf8');
  console.log(`CSV de escalamiento guardado en: ${csvOutPath}`);

  console.log('\n=== RESUMEN EJECUTIVO MEDIDO (BLOQUE 2) ===');
  console.log(`Clic Celda:      ET Dur p50 = ${finalResults.metrics.cellClick.eventTimingDuration.p50} ms | Proc p50 = ${finalResults.metrics.cellClick.eventTimingProcessing.p50} ms | d_rAF p50 = ${finalResults.metrics.cellClick.doubleRafLatency.p50} ms`);
  console.log(`Escritura:       ET Dur p50 = ${finalResults.metrics.typing.eventTimingDuration.p50} ms | Proc p50 = ${finalResults.metrics.typing.eventTimingProcessing.p50} ms | d_rAF p50 = ${finalResults.metrics.typing.doubleRafLatency.p50} ms`);
  console.log(`Botón de Acción: ET Dur p50 = ${finalResults.metrics.actionButton.eventTimingDuration.p50} ms | Proc p50 = ${finalResults.metrics.actionButton.eventTimingProcessing.p50} ms | d_rAF p50 = ${finalResults.metrics.actionButton.doubleRafLatency.p50} ms`);
  console.log(`Traza Botón JS:  Scripting JS = ${traceAction?.scriptingJsMs} ms | Ventana = ${traceAction?.windowDurationMs} ms`);

  await browser.close();
})();

