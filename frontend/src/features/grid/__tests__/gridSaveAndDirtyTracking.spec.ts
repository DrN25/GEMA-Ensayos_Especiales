// frontend/src/features/grid/__tests__/gridSaveAndDirtyTracking.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGridStore } from '../gridStore';

describe('Bloque 4: Dirty Tracking O(1), Reversión y Payload de Guardado', () => {
  beforeEach(() => {
    useGridStore.getState().clearAll();
  });

  it('1. Debe marcar una fila como dirty al editar un valor diferente al original', () => {
    const sample = [
      { idd: 101, sondaje: 'S1', desde: 10.5, hasta: 11.0 },
      { idd: 102, sondaje: 'S2', desde: 20.0, hasta: 21.0 }
    ];

    useGridStore.getState().setInitialRecords(sample);
    expect(useGridStore.getState().dirtyRowIds.size).toBe(0);

    // Editar campo 'sondaje' en la primera fila
    useGridStore.getState().updateCellValue(0, 'sondaje', 'S1-EDITADO');

    const state = useGridStore.getState();
    expect(state.dirtyRowIds.size).toBe(1);
    expect(state.dirtyRowIds.has(101)).toBe(true);
    expect(state.dirtyRowIds.has(102)).toBe(false);
  });

  it('2. Debe DESMARCAR la fila de dirty si el valor se revierte al original', () => {
    const sample = [
      { idd: 101, sondaje: 'S1-ORIGINAL', desde: 10.5 }
    ];

    useGridStore.getState().setInitialRecords(sample);
    expect(useGridStore.getState().dirtyRowIds.size).toBe(0);

    // Editar a un valor nuevo
    useGridStore.getState().updateCellValue(0, 'sondaje', 'S1-CAMBIADO');
    expect(useGridStore.getState().dirtyRowIds.has(101)).toBe(true);

    // Revertir exactamente al valor original
    useGridStore.getState().updateCellValue(0, 'sondaje', 'S1-ORIGINAL');
    expect(useGridStore.getState().dirtyRowIds.has(101)).toBe(false);
    expect(useGridStore.getState().dirtyRowIds.size).toBe(0);
  });

  it('3. Debe marcar automáticamente las filas insertadas como dirty', () => {
    const sample = [
      { idd: 10, sondaje: 'DH-01', laboratorio: 'LAB-A' }
    ];

    useGridStore.getState().setInitialRecords(sample);
    const newId = useGridStore.getState().insertRowBelow(0);

    const state = useGridStore.getState();
    expect(state.dirtyRowIds.has(newId)).toBe(true);
    expect(state.dirtyRowIds.has(10)).toBe(false);
    expect(state.dirtyRowIds.size).toBe(1);
  });

  it('4. Debe rastrear eliminaciones en deletedRowIds y limpiar de dirtyRowIds', () => {
    const sample = [
      { idd: 50, sondaje: 'DH-50' },
      { idd: 51, sondaje: 'DH-51' }
    ];

    useGridStore.getState().setInitialRecords(sample);

    // Editar la fila 50 y luego eliminarla
    useGridStore.getState().updateCellValue(0, 'sondaje', 'MODIFICADO');
    expect(useGridStore.getState().dirtyRowIds.has(50)).toBe(true);

    useGridStore.getState().deleteRow(50);

    const state = useGridStore.getState();
    expect(state.recordsById.has(50)).toBe(false);
    expect(state.dirtyRowIds.has(50)).toBe(false); // Eliminada no está dirty
    expect(state.deletedRowIds.has(50)).toBe(true); // Está en deletedRowIds
  });

  it('5. Debe construir el payload de guardado con ÚNICAMENTE las filas dirty', () => {
    const sample = [
      { idd: 1, sondaje: 'S1', desde: 1.0 },
      { idd: 2, sondaje: 'S2', desde: 2.0 },
      { idd: 3, sondaje: 'S3', desde: 3.0 },
      { idd: 4, sondaje: 'S4', desde: 4.0 }
    ];

    useGridStore.getState().setInitialRecords(sample);

    // Modificar solo las filas 2 y 4
    useGridStore.getState().updateCellValue(1, 'sondaje', 'S2-NUEVO');
    useGridStore.getState().updateCellValue(3, 'desde', 4.55);

    const dirtyRecords = useGridStore.getState().getDirtyRecords();

    expect(dirtyRecords.length).toBe(2);
    expect(dirtyRecords.map(r => r.idd)).toEqual([2, 4]);
    expect(dirtyRecords.find(r => r.idd === 2)?.sondaje).toBe('S2-NUEVO');
    expect(dirtyRecords.find(r => r.idd === 4)?.desde).toBe(4.55);
  });

  it('6. Debe limpiar dirtyRowIds y deletedRowIds tras clearDirty() actualizando los originales', () => {
    const sample = [
      { idd: 1, sondaje: 'S1' }
    ];

    useGridStore.getState().setInitialRecords(sample);
    useGridStore.getState().updateCellValue(0, 'sondaje', 'S1-ACTUALIZADO');
    expect(useGridStore.getState().dirtyRowIds.size).toBe(1);

    // Simular guardado exitoso
    useGridStore.getState().clearDirty();

    const state = useGridStore.getState();
    expect(state.dirtyRowIds.size).toBe(0);
    expect(state.deletedRowIds.size).toBe(0);

    // Ahora el nuevo original es 'S1-ACTUALIZADO'. Si volvemos a escribir 'S1-ACTUALIZADO', no es dirty.
    expect(state.originalRecordsById.get(1)?.sondaje).toBe('S1-ACTUALIZADO');
  });

  it('7. Debe marcar todos los registros importados de Excel como dirty', () => {
    const imported = [
      { idd: 901, sondaje: 'IMP-01', laboratorio: 'LAB-IMP' },
      { idd: 902, sondaje: 'IMP-02', laboratorio: 'LAB-IMP' }
    ];

    useGridStore.getState().importRecords(imported);

    const state = useGridStore.getState();
    expect(state.rowIds).toEqual([901, 902]);
    expect(state.dirtyRowIds.has(901)).toBe(true);
    expect(state.dirtyRowIds.has(902)).toBe(true);
    expect(state.dirtyRowIds.size).toBe(2);
    expect(state.getDirtyRecords().length).toBe(2);
  });
});
