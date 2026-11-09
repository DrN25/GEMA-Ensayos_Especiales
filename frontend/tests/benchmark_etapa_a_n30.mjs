// frontend/tests/benchmark_etapa_a_n30.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const rawData = JSON.parse(fs.readFileSync(path.resolve('../scratch/realData.json'), 'utf8'));
const realData = rawData.filter(r => !isNaN(Number(r.idd)));
console.log(`[BENCHMARK N=30 RE-MEDICIÓN] Dataset cargado: ${realData.length} registros.`);

function calcStats(arr) {
  if (!arr || arr.length === 0) return { p50: null, p95: null, mean: null, std: null, min: null, max: null, n: 0 };
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

async function runBenchmark() {
  console.log(`\n================================================================`);
  console.log(`INICIANDO BENCHMARK n=30 VALIDADO (Threshold: 16ms, Idle: 300ms)`);
  console.log(`================================================================`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-gpu', '--no-sandbox']
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  await context.addInitScript(() => {
    window.__eventTimingEntries = [];
    window.__inBrowserMeasurements = [];

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__eventTimingEntries.push({
          name: entry.name,
          entryType: entry.entryType,
          startTime: parseFloat(entry.startTime.toFixed(2)),
          duration: parseFloat(entry.duration.toFixed(2)),
          processingStart: parseFloat(entry.processingStart.toFixed(2)),
          processingEnd: parseFloat(entry.processingEnd.toFixed(2)),
          processingDuration: parseFloat((entry.processingEnd - entry.processingStart).toFixed(2)),
          targetTag: entry.target ? entry.target.tagName : null
        });
      }
    });
    // Configuración oficial según directiva: durationThreshold 16ms
    observer.observe({ type: 'event', buffered: true, durationThreshold: 16 });

    // Medición física independiente double_rAF en el hilo de render
    window.addEventListener('pointerdown', (evt) => {
      const isAction = evt.target.closest('button[title*="Insertar"]');
      const isCell = evt.target.closest('td, [data-testid^="cell-"]');
      if (isAction || isCell) {
        const t0 = performance.now();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const rafDur = performance.now() - t0;
            window.__inBrowserMeasurements.push({
              type: isAction ? 'button' : 'cell',
              duration: parseFloat(rafDur.toFixed(2))
            });
          });
        });
      }
    }, true);

    window.addEventListener('keydown', (evt) => {
      const isInput = evt.target.closest('input, textarea');
      if (isInput) {
        const t0 = performance.now();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const rafDur = performance.now() - t0;
            window.__inBrowserMeasurements.push({
              type: 'typing',
              duration: parseFloat(rafDur.toFixed(2))
            });
          });
        });
      }
    }, true);
  });

  const page = await context.newPage();

  // Mock de rutas backend idéntico a Bloque 4
  await page.route('**/api/**', async route => {
    const req = route.request();
    const url = req.url();
    const method = req.method();

    if (url.includes('/api/ensayos/stats') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: realData.length,
          counts: { ucs: 100, elasticas: 100, traccion: 100, corte: 100, triaxial: 100, propiedades: 100 },
          recent: []
        })
      });
      return;
    }
    if (url.includes('/api/db-status') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ db_type: 'mssql', is_local_fallback: false, server: 'localhost' })
      });
      return;
    }
    if (url.includes('/api/proyectos') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, nombre: 'PROYECTO TEST' }])
      });
      return;
    }
    if (url.includes('/api/ensayos') && method === 'GET') {
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
      return;
    }
    await route.continue();
  });

  await page.goto(`http://127.0.0.1:4173/?grid=v2`);
  await page.waitForTimeout(1000);

  const rmBtn = await page.waitForSelector('button:has-text("Registro Maestro")');
  await rmBtn.click();
  await page.waitForTimeout(2500);

  async function waitForIdle() {
    await page.evaluate(() => new Promise(r => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => requestAnimationFrame(() => requestAnimationFrame(r)));
      } else {
        setTimeout(() => requestAnimationFrame(r), 100);
      }
    }));
    await page.waitForTimeout(300);
  }

  // --- 1. CLIC EN CELDA (35 corridas: 5 warmup + 30 medidos) ---
  console.log(`Midiendo Clic en Celda (35 corridas: 5 warmup + 30 medidos)...`);
  const clickRuns = [];
  for (let i = 1; i <= 35; i++) {
    const beforeEtIdx = await page.evaluate(() => window.__eventTimingEntries.length);
    const beforeRafIdx = await page.evaluate(() => window.__inBrowserMeasurements.length);

    const selector = i % 2 === 0 ? '[data-testid="cell-0-sondaje"]' : '[data-testid="cell-1-sondaje"]';

    const t0 = performance.now();
    await page.click(selector);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const localElapsed = performance.now() - t0;

    const newEtEntries = await page.evaluate((from) => window.__eventTimingEntries.slice(from), beforeEtIdx);
    const newRafEntries = await page.evaluate((from) => window.__inBrowserMeasurements.slice(from), beforeRafIdx);

    const pd = newEtEntries.find(e => e.name === 'pointerdown');
    const clk = newEtEntries.find(e => e.name === 'click');
    const etEntry = pd || clk || null;
    const rafEntry = newRafEntries.find(e => e.type === 'cell') || null;

    clickRuns.push({
      iteration: i,
      isWarmup: i <= 5,
      entriesCount: newEtEntries.length,
      hasEtEntry: etEntry !== null,
      etDuration: etEntry ? etEntry.duration : null,
      etProcessing: etEntry ? etEntry.processingDuration : null,
      doubleRafDuration: rafEntry ? rafEntry.duration : null,
      localElapsed: parseFloat(localElapsed.toFixed(2))
    });
    await waitForIdle();
  }

  // --- 2. ESCRITURA EN CELDA (35 corridas: 5 warmup + 30 medidos) ---
  console.log(`Midiendo Escritura en Celda (35 corridas: 5 warmup + 30 medidos)...`);
  const typingRuns = [];
  const c0 = await page.waitForSelector('[data-testid="cell-0-sondaje"]');
  await c0.dblclick();
  await page.waitForTimeout(300);
  const inp = await page.waitForSelector('[data-testid="floating-input"]');

  for (let i = 1; i <= 35; i++) {
    const beforeEtIdx = await page.evaluate(() => window.__eventTimingEntries.length);
    const beforeRafIdx = await page.evaluate(() => window.__inBrowserMeasurements.length);

    const t0 = performance.now();
    await inp.press('KeyA');
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const localElapsed = performance.now() - t0;

    const newEtEntries = await page.evaluate((from) => window.__eventTimingEntries.slice(from), beforeEtIdx);
    const newRafEntries = await page.evaluate((from) => window.__inBrowserMeasurements.slice(from), beforeRafIdx);

    const kd = newEtEntries.find(e => e.name === 'keydown');
    const inpEntry = newEtEntries.find(e => e.name === 'input');
    const etEntry = kd || inpEntry || null;
    const rafEntry = newRafEntries.find(e => e.type === 'typing') || null;

    typingRuns.push({
      iteration: i,
      isWarmup: i <= 5,
      entriesCount: newEtEntries.length,
      hasEtEntry: etEntry !== null,
      etDuration: etEntry ? etEntry.duration : null,
      etProcessing: etEntry ? etEntry.processingDuration : null,
      doubleRafDuration: rafEntry ? rafEntry.duration : null,
      localElapsed: parseFloat(localElapsed.toFixed(2))
    });
    await page.waitForTimeout(100);
  }
  await page.keyboard.press('Escape');
  await waitForIdle();

  // --- 3. BOTÓN DE ACCIÓN (35 corridas: 5 warmup + 30 medidos) ---
  console.log(`Midiendo Botón de Acción (35 corridas: 5 warmup + 30 medidos)...`);
  const buttonRuns = [];
  for (let i = 1; i <= 35; i++) {
    const beforeEtIdx = await page.evaluate(() => window.__eventTimingEntries.length);
    const beforeRafIdx = await page.evaluate(() => window.__inBrowserMeasurements.length);

    const addBtn = page.locator('tbody tr').first().locator('button[title="Insertar fila abajo"]');

    const t0 = performance.now();
    await addBtn.click();
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const localElapsed = performance.now() - t0;

    const newEtEntries = await page.evaluate((from) => window.__eventTimingEntries.slice(from), beforeEtIdx);
    const newRafEntries = await page.evaluate((from) => window.__inBrowserMeasurements.slice(from), beforeRafIdx);

    const pd = newEtEntries.find(e => e.name === 'pointerdown');
    const clk = newEtEntries.find(e => e.name === 'click');
    const etEntry = pd || clk || null;
    const rafEntry = newRafEntries.find(e => e.type === 'button') || null;

    buttonRuns.push({
      iteration: i,
      isWarmup: i <= 5,
      entriesCount: newEtEntries.length,
      hasEtEntry: etEntry !== null,
      etDuration: etEntry ? etEntry.duration : null,
      etProcessing: etEntry ? etEntry.processingDuration : null,
      doubleRafDuration: rafEntry ? rafEntry.duration : null,
      localElapsed: parseFloat(localElapsed.toFixed(2))
    });
    await waitForIdle();
  }

  await browser.close();

  // --- ANÁLISIS ESTADÍSTICO RIGUROSO ---
  const validClicks = clickRuns.slice(5);
  const validTypings = typingRuns.slice(5);
  const validButtons = buttonRuns.slice(5);

  function processMetricStats(runs, name) {
    const capturedEtRuns = runs.filter(r => r.etDuration !== null);
    const capturedRafRuns = runs.filter(r => r.doubleRafDuration !== null);
    const avgEntries = runs.reduce((s, r) => s + r.entriesCount, 0) / runs.length;

    console.log(`\n--- ESTADÍSTICAS PARA: ${name.toUpperCase()} (n=30) ---`);
    console.log(`  Entradas capturadas / iteración: ${avgEntries.toFixed(2)}`);
    console.log(`  Iteraciones con captura Event Timing: ${capturedEtRuns.length} / ${runs.length}`);
    console.log(`  Iteraciones con captura double_rAF: ${capturedRafRuns.length} / ${runs.length}`);

    const etDurStats = calcStats(capturedEtRuns.map(r => r.etDuration));
    const etProcStats = calcStats(capturedEtRuns.map(r => r.etProcessing));
    const rafStats = calcStats(capturedRafRuns.map(r => r.doubleRafDuration));

    console.log(`  Event Timing Duration: p50=${etDurStats.p50}ms, p95=${etDurStats.p95}ms, mean=${etDurStats.mean}ms`);
    console.log(`  Event Timing Scripting JS: p50=${etProcStats.p50}ms, p95=${etProcStats.p95}ms`);
    console.log(`  inBrowser double_rAF: p50=${rafStats.p50}ms, p95=${rafStats.p95}ms, mean=${rafStats.mean}ms`);

    return {
      entriesCountAvg: parseFloat(avgEntries.toFixed(2)),
      capturedEtIterations: capturedEtRuns.length,
      etDuration: etDurStats,
      etProcessing: etProcStats,
      doubleRaf: rafStats
    };
  }

  const results = {
    stats: {
      clic: processMetricStats(validClicks, 'clic'),
      escritura: processMetricStats(validTypings, 'escritura'),
      boton: processMetricStats(validButtons, 'boton')
    },
    clickRuns,
    typingRuns,
    buttonRuns
  };

  fs.writeFileSync(path.resolve('../scratch/benchmark_results_etapa_a_validated.json'), JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nResultados guardados en scratch/benchmark_results_etapa_a_validated.json`);
}

runBenchmark().catch(err => {
  console.error('Error ejecutando benchmark:', err);
  process.exit(1);
});
