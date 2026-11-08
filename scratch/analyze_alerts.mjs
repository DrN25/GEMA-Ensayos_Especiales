import fs from 'fs';
import path from 'path';

const rawData = JSON.parse(fs.readFileSync('scratch/realData.json', 'utf8')).filter(r => !isNaN(Number(r.idd)));

// Read COLUMNS_CONFIG from frontend/src/utils/columnsConfig.ts
// or implement the validation rules directly:
// Rule 1: desde >= hasta -> CRÍTICO
// Rule 2: desde/hasta missing -> AVISO
// Rule 3: negative numeric fields -> CRÍTICO
// Rule 4: out of bounds (min/max) -> AVISO

console.log('Total records:', rawData.length);

let criticos = 0;
let avisos = 0;
const fieldCounts = {};
const samples = [];

for (const rec of rawData) {
  const idd = Number(rec.idd) || 0;
  if (!rec.sondaje) continue;

  const desde = rec.desde !== undefined && rec.desde !== null && rec.desde !== '' ? Number(rec.desde) : null;
  const hasta = rec.hasta !== undefined && rec.hasta !== null && rec.hasta !== '' ? Number(rec.hasta) : null;

  if (desde !== null && hasta !== null) {
    if (desde >= hasta) {
      criticos++;
      fieldCounts['hasta'] = (fieldCounts['hasta'] || 0) + 1;
      samples.push({ idd, field: 'hasta', type: 'CRÍTICO', msg: `Desde (${desde}) >= Hasta (${hasta})` });
    }
  } else {
    avisos++;
    fieldCounts['desde'] = (fieldCounts['desde'] || 0) + 1;
    samples.push({ idd, field: 'desde', type: 'AVISO', msg: 'Desde/Hasta incompletos' });
  }

  // Check specific field limits:
  // ucs_diametro: min 1.0, max 20.0
  // ucs_carga_rotura: min 0.1
  // ucs_resistencia: min 0.1
  // elasticas_modulo_young: min 1.0, max 150.0
  // elasticas_poisson: min 0.05, max 0.45
  // traccion_carga_promedio: min 0.1
  // traccion_resistencia_kgcm2: min 0.1
  // traccion_resistencia_mpa: min 0.01
  // corte_area: min 1.0
  // corte_esf_normal_kpa: min 0
  // corte_esf_corte_kpa: min 0
  const checks = [
    { field: 'ucs_diametro', min: 1.0, max: 20.0 },
    { field: 'ucs_carga_rotura', min: 0.1 },
    { field: 'ucs_resistencia', min: 0.1 },
    { field: 'elasticas_modulo_young', min: 1.0, max: 150.0 },
    { field: 'elasticas_poisson', min: 0.05, max: 0.45 },
    { field: 'traccion_carga_promedio', min: 0.1 },
    { field: 'traccion_resistencia_kgcm2', min: 0.1 },
    { field: 'traccion_resistencia_mpa', min: 0.01 },
    { field: 'corte_area', min: 1.0 },
  ];

  for (const c of checks) {
    const val = rec[c.field];
    if (val !== undefined && val !== null && val !== '') {
      const num = Number(val);
      if (isNaN(num)) {
        criticos++;
        fieldCounts[c.field] = (fieldCounts[c.field] || 0) + 1;
        samples.push({ idd, field: c.field, type: 'CRÍTICO', msg: `Valor no numérico: ${val}` });
      } else {
        if (num < 0) {
          criticos++;
          fieldCounts[c.field] = (fieldCounts[c.field] || 0) + 1;
          samples.push({ idd, field: c.field, type: 'CRÍTICO', msg: `Valor negativo: ${num}` });
        }
        if (c.min !== undefined && num < c.min) {
          avisos++;
          fieldCounts[c.field] = (fieldCounts[c.field] || 0) + 1;
          samples.push({ idd, field: c.field, type: 'AVISO', msg: `Valor ${num} < min ${c.min}` });
        }
        if (c.max !== undefined && num > c.max) {
          avisos++;
          fieldCounts[c.field] = (fieldCounts[c.field] || 0) + 1;
          samples.push({ idd, field: c.field, type: 'AVISO', msg: `Valor ${num} > max ${c.max}` });
        }
      }
    }
  }
}

console.log(`TOTAL ALERTAS: ${criticos + avisos} (Críticos: ${criticos}, Avisos: ${avisos})`);
console.log('Conteo por campo:', fieldCounts);
console.log('Muestras detalladas de las alertas:');
for (let i = 0; i < Math.min(samples.length, 25); i++) {
  console.log(`- IDD ${samples[i].idd} [${samples[i].type}] ${samples[i].field}: ${samples[i].msg}`);
}
