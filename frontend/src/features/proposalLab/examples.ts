import type { ProposalColumn, ProposalRow } from './formats';

/**
 * Explicit, user-triggered example fixtures. Values are transcribed from laboratory
 * report screenshots / README. They are never loaded automatically nor saved.
 * mode 'replace': the table takes the fixture's row count.
 * mode 'first-row': values are merged into row 1 only (README verification case).
 */
export type AssayExample = { label: string; source: string; mode: 'replace' | 'first-row'; rows: ProposalRow[] };

const s = (v: number | string) => String(v);
const zip = (keys: Record<string, (number | string)[]>, extra: ProposalRow = {}): ProposalRow[] => {
  const n = Math.max(...Object.values(keys).map((a) => a.length));
  return Array.from({ length: n }, (_, i) => {
    const o: ProposalRow = { ...extra };
    for (const [k, a] of Object.entries(keys)) o[k] = s(a[i]);
    return o;
  });
};

const UNI = 'UNI (LGM)';

const EXAMPLES: Record<string, Record<string, AssayExample>> = {
  [UNI]: {
    UCS: { label: 'Ejemplo UCS UNI', source: 'Informe UNI (LGM), compresión uniaxial', mode: 'replace', rows: [{ d: '6.1', h: '12.58', p: '206', rotura: '3 Corte por discontinuidad' }] },
    CE: { label: 'Ejemplo CE UNI', source: 'Informe UNI (LGM), constantes elásticas', mode: 'replace', rows: [{ d: '6.05', h: '13.12', p: '279.85', e: '21.23', nu: '0.26', rotura: '1 Corte plano diagonal' }] },
    TI: {
      label: 'Ejemplo TI UNI',
      source: 'Informe UNI (LGM), tracción indirecta',
      mode: 'replace',
      rows: zip({ probeta: [1, 2, 3, 4, 5], d: [6.1, 6.1, 6.1, 6.1, 6.1], t: [3.53, 3.54, 3.48, 3.5, 3.59], p: [40.31, 38.4, 40.16, 41.5, 40.4] }, { excluir: false }),
    },
    TX: {
      label: 'Ejemplo TX UNI',
      source: 'Informe UNI (LGM), compresión triaxial',
      mode: 'replace',
      rows: zip({ d: [6.09, 6.09, 6.09], h: [12.45, 12.63, 12.55], s3: [6, 8, 12], s1: [135.6, 148.2, 170.9] }, { p: '', excluir: false }),
    },
    CD: {
      label: 'Ejemplo CD UNI',
      source: 'Informe UNI (LGM), corte directo',
      mode: 'replace',
      rows: zip({ sn: [0.63, 1.26, 1.89, 2.52, 3.15], tau: [0.43, 0.76, 1.09, 1.42, 1.74] }, { excluir: false }),
    },
    PF: { label: 'Ejemplo PF UNI', source: 'Informe UNI (LGM), propiedades físicas', mode: 'replace', rows: [{ probeta: '1', m_nat: '250', m_seca: '248', m_sat: '252', m_sum: '155', vol: '' }] },
  },
  Geomec: {
    TI: { label: 'Ejemplo de verificación (README: TI Geomec)', source: 'README: d 60.8 mm, h 31.1 mm, P 29.89 kN', mode: 'first-row', rows: [{ d: '60.8', t: '31.1', p: '29.89' }] },
  },
};

export function getExample(lab: string, test: string, columns: ProposalColumn[]): AssayExample | null {
  const ex = EXAMPLES[lab]?.[test];
  if (!ex) return null;
  const editable = new Set(columns.filter((c) => !c.calc).map((c) => c.key));
  // Only offer an example whose keys all exist in the current schema.
  return ex.rows.every((r) => Object.keys(r).every((k) => editable.has(k))) ? ex : null;
}

/** Applies an example over rows built from schema defaults so dropdowns stay valid. */
export function applyExample(ex: AssayExample, current: ProposalRow[], blank: () => ProposalRow): ProposalRow[] {
  if (ex.mode === 'first-row') {
    const base = current.length ? current : [blank()];
    return base.map((r, i) => (i === 0 ? { ...r, ...ex.rows[0] } : r));
  }
  return ex.rows.map((r) => ({ ...blank(), ...r }));
}

/** Empty row: clears numeric/text values, keeps valid dropdown defaults, unchecks flags. */
export function clearedRow(columns: ProposalColumn[], index: number): ProposalRow {
  const o: ProposalRow = {};
  columns.forEach((c) => {
    if (c.calc) return;
    if (c.tipo === 'bool') o[c.key] = false;
    else if (c.tipo === 'sel') o[c.key] = String(c.defecto ?? '');
    else if (c.key === 'probeta' && c.tipo === 'txt') o[c.key] = String(index + 1);
    else o[c.key] = '';
  });
  return o;
}

/** True when a row holds user-entered measurements (any non-empty numeric value). */
export function rowHasMeasurements(columns: ProposalColumn[], r: ProposalRow): boolean {
  return columns.some((c) => !c.calc && c.tipo === 'num' && r[c.key] !== '' && r[c.key] != null);
}
