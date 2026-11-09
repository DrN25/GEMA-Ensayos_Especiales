// frontend/src/features/grid/schema/tableValidators.ts
import type { QAQCAlert } from './types';

/**
 * Valida la consistencia relacional de profundidades (Desde vs Hasta) de un registro.
 * - Si ambas están presentes y desde >= hasta -> CRÍTICO.
 * - Si alguna de las dos profundidades está ausente -> AVISO.
 */
export function validateDesdeVsHasta(row: Record<string, any>): QAQCAlert[] {
  const alerts: QAQCAlert[] = [];
  const idd = Number(row.idd) || 0;

  // Si no hay sondaje ni IDD, la fila se considera vacía
  if (!row.sondaje && !row.idd) return alerts;

  const desdeVal = row.desde;
  const hastaVal = row.hasta;

  const desdeNum =
    desdeVal !== undefined && desdeVal !== null && String(desdeVal).trim() !== ''
      ? Number(desdeVal)
      : null;
  const hastaNum =
    hastaVal !== undefined && hastaVal !== null && String(hastaVal).trim() !== ''
      ? Number(hastaVal)
      : null;

  if (desdeNum !== null && hastaNum !== null && !isNaN(desdeNum) && !isNaN(hastaNum)) {
    if (desdeNum >= hastaNum) {
      alerts.push({
        idd,
        field: 'hasta',
        type: 'CRÍTICO',
        message: `La profundidad Desde (${desdeNum} m) debe ser menor que Hasta (${hastaNum} m).`,
        tab: 'registro_maestro',
        value: { desde: desdeNum, hasta: hastaNum }
      });
    }
  } else {
    alerts.push({
      idd,
      field: 'desde',
      type: 'AVISO',
      message: 'Las profundidades Desde y Hasta no están completas.',
      tab: 'registro_maestro',
      value: { desde: desdeVal, hasta: hastaVal }
    });
  }

  return alerts;
}

/**
 * Detecta solapamientos físicos de intervalos [Desde, Hasta] entre probetas del mismo sondaje.
 * Complejidad: O(N log N) por sondaje.
 */
export function validateSampleOverlaps(dataset: Record<string, any>[]): QAQCAlert[] {
  const alerts: QAQCAlert[] = [];
  const bySondaje = new Map<string, Array<{ idd: number; desde: number; hasta: number }>>();

  for (let i = 0; i < dataset.length; i++) {
    const r = dataset[i];
    const sondaje = r.sondaje ? String(r.sondaje).trim() : '';
    if (!sondaje) continue;

    const d = Number(r.desde);
    const h = Number(r.hasta);
    if (!isNaN(d) && !isNaN(h) && d < h && r.desde !== '' && r.hasta !== '') {
      const list = bySondaje.get(sondaje) || [];
      list.push({ idd: Number(r.idd) || 0, desde: d, hasta: h });
      bySondaje.set(sondaje, list);
    }
  }

  for (const [sondaje, intervals] of bySondaje.entries()) {
    intervals.sort((a, b) => a.desde - b.desde);
    for (let i = 1; i < intervals.length; i++) {
      const prev = intervals[i - 1];
      const curr = intervals[i];
      if (curr.desde < prev.hasta) {
        alerts.push({
          idd: curr.idd,
          field: 'desde',
          type: 'AVISO',
          message: `Solapamiento de intervalo [${curr.desde} - ${curr.hasta} m] con probeta previa (IDD ${prev.idd}) [${prev.desde} - ${prev.hasta} m] en sondaje "${sondaje}".`,
          tab: 'registro_maestro',
          value: { current: curr, previous: prev }
        });
      }
    }
  }

  return alerts;
}

/**
 * Detecta códigos de muestra duplicados en el dataset.
 */
export function validateDuplicateSampleCodes(dataset: Record<string, any>[]): QAQCAlert[] {
  const alerts: QAQCAlert[] = [];
  const codeMap = new Map<string, number>();

  for (let i = 0; i < dataset.length; i++) {
    const r = dataset[i];
    const code = r.codigo_muestra ? String(r.codigo_muestra).trim() : '';
    if (!code) continue;

    const idd = Number(r.idd) || 0;
    if (codeMap.has(code)) {
      const originalIdd = codeMap.get(code)!;
      alerts.push({
        idd,
        field: 'codigo_muestra',
        type: 'AVISO',
        message: `Código de muestra duplicado "${code}" (ya registrado en IDD ${originalIdd}).`,
        tab: 'registro_maestro',
        value: code
      });
    } else {
      codeMap.set(code, idd);
    }
  }

  return alerts;
}

