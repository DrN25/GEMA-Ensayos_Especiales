// frontend/src/features/grid/__tests__/gridContentParity.spec.ts
import { describe, it, expect } from 'vitest';
import { getGridColumnsForModule } from '../columnsDefinition';
import { formatDisplayValue } from '../VirtualizedGrid';
import rawData from './mockRealData20.json';

const realData: Record<string, any>[] = rawData.filter(r => !isNaN(Number(r.idd)));

describe('Test de Contenido y Paridad de Datos (20 filas x Todas las columnas)', () => {
  it('debe cargar al menos 20 registros reales del dataset geomecánico', () => {
    expect(realData.length).toBeGreaterThanOrEqual(20);
  });

  describe('Módulo: Registro Maestro', () => {
    const columns = getGridColumnsForModule('registro_maestro');

    it('debe contener todas las 50 columnas del módulo maestro', () => {
      expect(columns.length).toBe(50);
    });

    it('debe verificar para 20 filas que cada celda coincida exactamente con la clave de su registro', () => {
      const testRows = realData.slice(0, 20);

      // Columnas a verificar con su accessorKey correspondiente
      const dataCols = columns.filter(c => c.id !== 'acciones_col' && c.id !== 'qaqc_validacion');

      for (let rIdx = 0; rIdx < testRows.length; rIdx++) {
        const record = testRows[rIdx];

        for (const col of dataCols) {
          const rawVal = record[col.accessorKey];
          const displayVal = formatDisplayValue(rawVal, col);

          // 1. Verificación del bug específico de desalineación reportado
          if (col.id === 'proyecto') {
            // "Proyecto" NO debe contener valores numéricos de profundidad (170.95, 181.69)
            expect(displayVal).not.toMatch(/^\d+\.\d+$/);
            expect(displayVal).toBe(String(record.proyecto || '—').trim());
          }

          if (col.id === 'desde') {
            // "Desde" debe ser el valor de profundidad inicial
            if (rawVal !== '') {
              expect(displayVal).toBe(String(parseFloat(Number(rawVal).toFixed(2))));
            }
          }

          if (col.id === 'hasta') {
            // "Hasta" NO debe contener valores de longitud de muestra (0.2199...)
            if (rawVal !== '') {
              expect(displayVal).toBe(String(parseFloat(Number(rawVal).toFixed(2))));
              expect(Number(displayVal)).toBeGreaterThanOrEqual(Number(record.desde || 0));
            }
          }

          if (col.id === 'longitud_muestra') {
            // "Longitud Muestra" NO debe ser una coordenada UTM (786769...)
            if (rawVal !== '') {
              expect(Number(displayVal)).toBeLessThan(100); // Probetas < 100m
              expect(displayVal).toBe(String(parseFloat(Number(rawVal).toFixed(2))));
            }
          }

          if (col.id === 'este') {
            // "Este" debe ser la coordenada UTM Este (~700,000 - 800,000 m)
            if (rawVal !== '') {
              expect(Number(displayVal)).toBeGreaterThan(500000);
            }
          }

          if (col.id === 'elevacion') {
            // "Elevación" debe tener formato de 2 decimales (no 4451.667525)
            if (rawVal !== '') {
              expect(displayVal).toBe(String(parseFloat(Number(rawVal).toFixed(2))));
            }
          }

          // 2. Comprobación general: formatDisplayValue coincide con el valor esperado formateado
          if (rawVal === '' || rawVal === null || rawVal === undefined) {
            expect(displayVal).toBe('—');
          } else if (typeof rawVal === 'number') {
            const exp = Number.isInteger(rawVal) ? String(rawVal) : String(parseFloat(rawVal.toFixed(2)));
            expect(displayVal).toBe(exp);
          } else if (col.type === 'number') {
            const num = parseFloat(String(rawVal));
            if (!isNaN(num)) {
              const exp = Number.isInteger(num) ? String(num) : String(parseFloat(num.toFixed(2)));
              expect(displayVal).toBe(exp);
            } else {
              expect(displayVal).toBe(String(rawVal).trim());
            }
          } else {
            expect(displayVal).toBe(String(rawVal).trim());
          }
        }
      }
    });
  });

  describe('Módulo: Compresión Uniaxial (UCS)', () => {
    const ucsColumns = getGridColumnsForModule('ucs');

    it('debe filtrar exclusivamente columnas comunes + ensayo UCS + validación + observación', () => {
      const ucsColIds = ucsColumns.map(c => c.id);

      // Debe incluir datos comunes
      expect(ucsColIds).toContain('idd');
      expect(ucsColIds).toContain('sondaje');
      expect(ucsColIds).toContain('codigo_muestra');
      expect(ucsColIds).toContain('proyecto');
      expect(ucsColIds).toContain('desde');
      expect(ucsColIds).toContain('hasta');
      expect(ucsColIds).toContain('tipo_ensayo');

      // Debe incluir columnas propias de UCS
      expect(ucsColIds).toContain('ucs_diametro');
      expect(ucsColIds).toContain('ucs_carga_rotura');
      expect(ucsColIds).toContain('ucs_resistencia');
      expect(ucsColIds).toContain('ucs_resistencia_calculada');
      expect(ucsColIds).toContain('ucs_rotura');

      // Debe incluir Validación y Observación
      expect(ucsColIds).toContain('qaqc_validacion');
      expect(ucsColIds).toContain('observacion');

      // NO debe incluir columnas de otros ensayos ni campaña/acciones de maestro
      expect(ucsColIds).not.toContain('elasticas_modulo_young');
      expect(ucsColIds).not.toContain('triaxial_resistencia_mpa');
      expect(ucsColIds).not.toContain('corte_cohesion_mpa');
      expect(ucsColIds).not.toContain('traccion_resistencia_mpa');
      expect(ucsColIds).not.toContain('campana');
      expect(ucsColIds).not.toContain('acciones_col');
    });

    it('debe verificar para 20 filas que cada celda de UCS coincida con la clave del registro', () => {
      const testRows = realData.slice(0, 20);
      const dataCols = ucsColumns.filter(c => c.id !== 'qaqc_validacion' && c.id !== 'acciones_col');

      for (let rIdx = 0; rIdx < testRows.length; rIdx++) {
        const record = testRows[rIdx];

        for (const col of dataCols) {
          const rawVal = record[col.accessorKey];
          const displayVal = formatDisplayValue(rawVal, col);

          // Verificar mapeo específico de UCS
          if (col.id === 'ucs_diametro' && rawVal !== '') {
            expect(Number(displayVal)).toBeGreaterThanOrEqual(1.0);
            expect(Number(displayVal)).toBeLessThanOrEqual(20.0);
            expect(displayVal).toBe(String(parseFloat(Number(rawVal).toFixed(2))));
          }

          if (col.id === 'ucs_carga_rotura' && rawVal !== '') {
            expect(displayVal).toBe(String(parseFloat(Number(rawVal).toFixed(2))));
          }

          if (col.id === 'ucs_resistencia' && rawVal !== '') {
            expect(displayVal).toBe(String(parseFloat(Number(rawVal).toFixed(2))));
          }

          // Comprobación general
          if (rawVal === '' || rawVal === null || rawVal === undefined) {
            expect(displayVal).toBe('—');
          } else if (typeof rawVal === 'number') {
            const exp = Number.isInteger(rawVal) ? String(rawVal) : String(parseFloat(rawVal.toFixed(2)));
            expect(displayVal).toBe(exp);
          } else if (col.type === 'number') {
            const num = parseFloat(String(rawVal));
            if (!isNaN(num)) {
              const exp = Number.isInteger(num) ? String(num) : String(parseFloat(num.toFixed(2)));
              expect(displayVal).toBe(exp);
            } else {
              expect(displayVal).toBe(String(rawVal).trim());
            }
          } else {
            expect(displayVal).toBe(String(rawVal).trim());
          }
        }
      }
    });
  });
});
