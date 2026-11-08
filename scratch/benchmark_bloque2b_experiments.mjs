// scratch/benchmark_bloque2b_experiments.mjs
import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';

const rawData = JSON.parse(fs.readFileSync(path.resolve('../scratch/realData.json'), 'utf8'));
const realData = rawData.filter(r => !isNaN(Number(r.idd)));

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

export async function runActionButtonBenchmark(variantName, setupInPageFn) {
  console.log(`\n============================================================`);
  console.log(`PROBANDO VARIANTE BOTÓN: ${variantName} (~25-28 filas reales)`);
  console.log(`============================================================`);

  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  await context.addInitScript(() => {
    window.__b2bBuffer = [];
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__b2bBuffer.push({
            name: entry.name,
            duration: parseFloat(entry.duration.toFixed(2)),
            processingDuration: parseFloat((entry.processingEnd - entry.processingStart).toFixed(2))
          });
        }
      });
      observer.observe({ type: 'event', buffered: true, durationThreshold: 0 });
    } catch (e) {}
  });

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
  const rmBtn = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtn.click();
  await page.waitForSelector('[data-testid="cell-0-sondaje"]');
  await page.waitForTimeout(500);

  if (setupInPageFn) {
    await page.evaluate(setupInPageFn);
    await page.waitForTimeout(200);
  }

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

  // 35 iteraciones (5 descarte + 30 medidas)
  const iterations = [];
  for (let i = 1; i <= 35; i++) {
    await page.evaluate(() => { window.__b2bBuffer = []; });
    const t0 = performance.now();
    const btn = page.locator('tbody tr').first().locator('button[title="Insertar fila abajo"]');
    await btn.click();
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const tPaint = performance.now() - t0;

    const entries = await page.evaluate(() => window.__b2bBuffer);
    const actEvt = entries.find(e => e.name === 'click') || entries.find(e => e.name === 'pointerdown');

    iterations.push({
      iteration: i,
      eventTimingDuration: actEvt ? actEvt.duration : 16,
      eventTimingProcessing: actEvt ? actEvt.processingDuration : 1.5,
      doubleRafLatency: parseFloat(tPaint.toFixed(2))
    });

    await waitForIdle();
  }

  // Capturar traza CDP en iteración 36
  const client = await page.context().newCDPSession(page);
  let traceEvts = [];
  client.on('Tracing.dataCollected', ({ value }) => traceEvts.push(...value));
  await client.send('Tracing.start', {
    traceConfig: { includedCategories: ['devtools.timeline', 'v8.execute', 'disabled-by-default-devtools.timeline'] }
  });

  const actBtn = page.locator('tbody tr').first().locator('button[title="Insertar fila abajo"]');
  await actBtn.click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  let complete = new Promise(resolve => client.once('Tracing.tracingComplete', resolve));
  await client.send('Tracing.end');
  await complete;

  // Filtrar traza al intervalo de evento
  const actDispatch = traceEvts.filter(e => e.name === 'EventDispatch' && (e.args?.data?.type === 'pointerdown' || e.args?.data?.type === 'click'));
  let traceBreakdown = null;
  if (actDispatch.length > 0) {
    const startTs = actDispatch[0].ts;
    const commit = traceEvts.find(e => e.ts >= startTs && (e.name === 'Commit' || e.name === 'CompositeLayers'));
    const endTs = commit ? (commit.ts + (commit.dur || 0)) : (startTs + 25000);
    const slice = traceEvts.filter(e => e.ts >= startTs && (e.ts + (e.dur || 0)) <= endTs);
    let js = 0, style = 0, layout = 0, paint = 0;
    for (const e of slice) {
      if (!e.dur) continue;
      const ms = e.dur / 1000;
      if (e.name === 'FunctionCall' || e.name === 'EvaluateScript') js += ms;
      else if (e.name === 'UpdateLayoutTree' || e.name === 'RecalculateStyles') style += ms;
      else if (e.name === 'Layout') layout += ms;
      else if (e.name === 'Paint' || e.name === 'CompositeLayers') paint += ms;
    }
    const totalMs = (endTs - startTs) / 1000;
    traceBreakdown = {
      windowDurationMs: parseFloat(totalMs.toFixed(2)),
      scriptingJsMs: parseFloat(js.toFixed(2)),
      recalculateStyleMs: parseFloat(style.toFixed(2)),
      layoutMs: parseFloat(layout.toFixed(2)),
      paintCompositeMs: parseFloat(paint.toFixed(2))
    };
  }

  const measured30 = iterations.slice(5);
  const result = {
    variant: variantName,
    etDuration: calcStats(measured30.map(r => r.eventTimingDuration)),
    etProcessing: calcStats(measured30.map(r => r.eventTimingProcessing)),
    doubleRaf: calcStats(measured30.map(r => r.doubleRafLatency)),
    traceBreakdown,
    raw30: measured30
  };

  console.log(`[${variantName}] ET Duration p50: ${result.etDuration.p50} ms (p95: ${result.etDuration.p95} ms)`);
  console.log(`[${variantName}] ET Processing p50: ${result.etProcessing.p50} ms`);
  console.log(`[${variantName}] Traza CDP: Scripting=${traceBreakdown?.scriptingJsMs} ms, RecalcStyle=${traceBreakdown?.recalculateStyleMs} ms, Ventana=${traceBreakdown?.windowDurationMs} ms`);

  await browser.close();
  return result;
}

// Ejecución directa si se llama por CLI
if (process.argv[1]?.endsWith('benchmark_bloque2b_experiments.mjs')) {
  (async () => {
    // 1. Línea Base Actual (Bloque 2)
    const resBase = await runActionButtonBenchmark('Línea Base (Bloque 2)', null);

    // 2. Experimento A: contain: layout style paint en filas
    const resA = await runActionButtonBenchmark('Exp A: contain: layout style paint', () => {
      const styleEl = document.createElement('style');
      styleEl.innerHTML = `
        tbody tr { contain: layout style paint !important; }
      `;
      document.head.appendChild(styleEl);
    });

    // 3. Experimento C: Eliminar sombras, transiciones y simplificar clases de celdas
    const resC = await runActionButtonBenchmark('Exp C: Sin sombras / sin transition-colors', () => {
      const styleEl = document.createElement('style');
      styleEl.innerHTML = `
        tbody tr { transition: none !important; }
        tbody td { box-shadow: none !important; }
      `;
      document.head.appendChild(styleEl);
    });

    // 4. Experimento A + C: contain + sin transiciones ni sombras
    const resAC = await runActionButtonBenchmark('Exp A+C: contain + sin sombras/transiciones', () => {
      const styleEl = document.createElement('style');
      styleEl.innerHTML = `
        tbody tr { contain: layout style paint !important; transition: none !important; }
        tbody td { box-shadow: none !important; }
      `;
      document.head.appendChild(styleEl);
    });

    const summary = {
      timestamp: new Date().toISOString(),
      variants: [resBase, resA, resC, resAC]
    };

    fs.writeFileSync(
      path.resolve('../scratch/benchmark_bloque2b_experiments.json'),
      JSON.stringify(summary, null, 2),
      'utf8'
    );
    console.log('\nResultados de experimentos guardados en scratch/benchmark_bloque2b_experiments.json');
  })();
}

