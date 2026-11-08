// frontend/src/features/grid/__tests__/bloque3HeadersAndResize.spec.ts
import { describe, it, expect } from 'vitest';
import { getGridColumnsForModule } from '../columnsDefinition';
import type { GridColumnDef } from '../types';

describe('Bloque 3: Cabecera de 2 niveles, Sticky y Resize', () => {
  it('1. Debe calcular el colSpan exacto de cada grupo en Registro Maestro', () => {
    const columns = getGridColumnsForModule('registro_maestro');
    const groupsMap = new Map<string, GridColumnDef[]>();
    for (const c of columns) {
      const g = c.group || 'General';
      if (!groupsMap.has(g)) groupsMap.set(g, []);
      groupsMap.get(g)!.push(c);
    }

    // Comprobar que la suma de colSpans coincide con el total de columnas
    let totalColSpan = 0;
    for (const [groupName, groupCols] of groupsMap.entries()) {
      const colSpan = groupCols.length;
      expect(colSpan).toBeGreaterThan(0);
      totalColSpan += colSpan;

      if (groupName === 'Identificación de Muestra') {
        expect(colSpan).toBe(3); // idd, sondaje, codigo_muestra
      } else if (groupName === 'Validación y Cierre') {
        expect(colSpan).toBe(3); // qaqc_validacion, observacion, campana
      }
    }

    expect(totalColSpan).toBe(50);
  });

  it('2. Debe calcular colSpan exacto en módulo filtrado (UCS)', () => {
    const ucsColumns = getGridColumnsForModule('ucs');
    const groupsMap = new Map<string, GridColumnDef[]>();
    for (const c of ucsColumns) {
      const g = c.group || 'General';
      if (!groupsMap.has(g)) groupsMap.set(g, []);
      groupsMap.get(g)!.push(c);
    }

    let totalColSpan = 0;
    for (const [, groupCols] of groupsMap.entries()) {
      totalColSpan += groupCols.length;
    }

    expect(totalColSpan).toBe(26);
    expect(groupsMap.get('Identificación de Muestra')?.length).toBe(3);
    expect(groupsMap.get('Ensayo UCS')?.length).toBe(5);
  });

  it('3. Debe acumular offsets crecientes en columnas sticky left sin solapamiento', () => {
    const columns = getGridColumnsForModule('registro_maestro');
    const leftPinned = columns.filter(c => c.pinned === 'left');

    expect(leftPinned.length).toBe(3); // idd, sondaje, codigo_muestra

    let currentOffset = 0;
    const offsets: number[] = [];
    for (const col of leftPinned) {
      offsets.push(currentOffset);
      currentOffset += col.defaultWidth;
    }

    expect(offsets[0]).toBe(0); // idd
    expect(offsets[1]).toBe(leftPinned[0].defaultWidth); // sondaje
    expect(offsets[2]).toBe(leftPinned[0].defaultWidth + leftPinned[1].defaultWidth); // codigo_muestra
    expect(currentOffset).toBe(leftPinned[0].defaultWidth + leftPinned[1].defaultWidth + leftPinned[2].defaultWidth);
  });

  it('4. Debe calcular offsets en columnas sticky right', () => {
    const columns = getGridColumnsForModule('registro_maestro');
    const rightPinned = columns.filter(c => c.pinned === 'right');

    expect(rightPinned.length).toBe(1); // acciones_col

    // El cálculo va de derecha a izquierda:
    // acciones_col (última): offset = 0
    const rightOffsets: Record<string, number> = {};
    let acc = 0;
    for (let i = rightPinned.length - 1; i >= 0; i--) {
      const c = rightPinned[i];
      rightOffsets[c.id] = acc;
      acc += c.defaultWidth;
    }

    expect(rightOffsets['acciones_col']).toBe(0);
    expect(acc).toBe(rightPinned[0].defaultWidth);
  });

  it('5. Debe respetar límites minWidth y maxWidth en cada columna redimensionable', () => {
    const columns = getGridColumnsForModule('registro_maestro');

    for (const col of columns) {
      const minW = col.minWidth ?? 60;
      const maxW = col.maxWidth ?? 600;
      expect(minW).toBeLessThanOrEqual(col.defaultWidth);
      expect(maxW).toBeGreaterThanOrEqual(col.defaultWidth);
      expect(minW).toBeGreaterThan(0);
    }
  });
});
