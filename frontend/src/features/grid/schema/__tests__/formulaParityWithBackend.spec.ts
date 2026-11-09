// frontend/src/features/grid/schema/__tests__/formulaParityWithBackend.spec.ts
import { describe, it, expect } from 'vitest';
import realDataRaw from './realData.json';
import { COLUMNS_SCHEMA_MAP } from '../columns';

const realData = realDataRaw as Record<string, any>[];

describe('Auditoría de Fórmulas Frontend vs Valores Reales Backend (9.818 registros)', () => {
  it('1. longitud_muestra: coincide con el backend en 9.812 filas (discrepancia máx <= 0.004 m en 6 filas)', () => {
    const col = COLUMNS_SCHEMA_MAP.get('longitud_muestra')!;
    let exactMatches = 0;
    let slightRoundingDiffs = 0;
    let maxDelta = 0;

    for (let i = 0; i < realData.length; i++) {
      const r = realData[i];
      if (r.desde !== null && r.hasta !== null && r.desde !== '' && r.hasta !== '') {
        const frontVal = col.calculate?.(r);
        const backVal = r.longitud_muestra !== null && r.longitud_muestra !== '' ? Number(r.longitud_muestra) : null;

        if (frontVal !== null && backVal !== null) {
          const delta = Math.abs(frontVal - backVal);
          if (delta < 1e-4) {
            exactMatches++;
          } else {
            slightRoundingDiffs++;
            if (delta > maxDelta) maxDelta = delta;
          }
        }
      }
    }

    // [MEDIDO]: 9.812 coincidencias exactas. Solo 6 filas tienen diferencia de redondeo de 2 vs 3 decimales
    expect(exactMatches).toBe(9812);
    expect(slightRoundingDiffs).toBe(6);
    expect(maxDelta).toBeLessThanOrEqual(0.004); // Máximo 4 milímetros de diferencia
  });

  it('2. ucs_resistencia_calculada: 0 diferencias numéricas en todos los registros poblados por backend', () => {
    const col = COLUMNS_SCHEMA_MAP.get('ucs_resistencia_calculada')!;
    let exactMatches = 0;
    let discrepancies = 0;

    for (let i = 0; i < realData.length; i++) {
      const r = realData[i];
      const p = Number(r.ucs_carga_rotura);
      const d = Number(r.ucs_diametro);

      if (p > 0 && d > 0 && r.ucs_carga_rotura !== '' && r.ucs_diametro !== '') {
        const frontVal = col.calculate?.(r);
        const backVal =
          r.ucs_resistencia_calculada !== null && r.ucs_resistencia_calculada !== ''
            ? Number(r.ucs_resistencia_calculada)
            : null;

        if (frontVal !== null && backVal !== null) {
          const delta = Math.abs(frontVal - backVal);
          if (delta <= 0.01) {
            exactMatches++;
          } else {
            discrepancies++;
          }
        }
      }
    }

    // [MEDIDO]: 0 discrepancias donde el backend tenía valor guardado
    expect(discrepancies).toBe(0);
    expect(exactMatches).toBeGreaterThan(0);
  });

  it('3. corte_esf_normal_mpa y corte_esf_corte_mpa: 0 diferencias numéricas contra el backend', () => {
    const colNormal = COLUMNS_SCHEMA_MAP.get('corte_esf_normal_mpa')!;
    const colCorte = COLUMNS_SCHEMA_MAP.get('corte_esf_corte_mpa')!;
    let normalDiscrepancies = 0;
    let corteDiscrepancies = 0;

    for (let i = 0; i < realData.length; i++) {
      const r = realData[i];

      // Normal
      if (r.corte_esf_normal_kpa !== null && r.corte_esf_normal_kpa !== '') {
        const frontVal = colNormal.calculate?.(r);
        const backVal =
          r.corte_esf_normal_mpa !== null && r.corte_esf_normal_mpa !== '' ? Number(r.corte_esf_normal_mpa) : null;
        if (frontVal !== null && backVal !== null) {
          if (Math.abs(frontVal - backVal) > 1e-4) {
            normalDiscrepancies++;
          }
        }
      }

      // Corte
      if (r.corte_esf_corte_kpa !== null && r.corte_esf_corte_kpa !== '') {
        const frontVal = colCorte.calculate?.(r);
        const backVal =
          r.corte_esf_corte_mpa !== null && r.corte_esf_corte_mpa !== '' ? Number(r.corte_esf_corte_mpa) : null;
        if (frontVal !== null && backVal !== null) {
          if (Math.abs(frontVal - backVal) > 1e-4) {
            corteDiscrepancies++;
          }
        }
      }
    }

    // [MEDIDO]: Coincidencia exacta de 4 decimales
    expect(normalDiscrepancies).toBe(0);
    expect(corteDiscrepancies).toBe(0);
  });
});

