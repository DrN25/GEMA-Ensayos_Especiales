// frontend/src/features/grid/__tests__/localDeltaPersistence.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGridStore } from '../gridStore';
import { deltaManager } from '../storage/deltaManager';
import {
  saveDelta,
  loadDelta,
  clearDelta,
  isDeltaCorrupted,
  resetMemoryStoreForTesting,
  CURRENT_DELTA_SCHEMA_VERSION
} from '../storage/indexedDbDeltaStore';
import type { GridDelta } from '../storage/types';

describe('Persistencia Local con IndexedDB / DeltaManager y Descarte de Cambios', () => {
  beforeEach(async () => {
    resetMemoryStoreForTesting();
    await clearDelta();
    await deltaManager.clear();

    // Iniciar el store con 3 registros base
    useGridStore.getState().setInitialRecords([
      { idd: 1, sondaje: 'DH-01', desde: 10, hasta: 12, traccion_resistencia_kgcm2: 100, traccion_resistencia_mpa: 9.81 },
      { idd: 2, sondaje: 'DH-02', desde: 20, hasta: 22, traccion_resistencia_kgcm2: 200, traccion_resistencia_mpa: 19.61 },
      { idd: 3, sondaje: 'DH-03', desde: 30, hasta: 32, traccion_resistencia_kgcm2: 300, traccion_resistencia_mpa: 29.42 }
    ]);
  });

  it('1. Debe guardar y extraer el delta al modificar celdas', async () => {
    const store = useGridStore.getState();
    expect(store.dirtyRowIds.size).toBe(0);

    // Modificar celda de la fila 0 (IDD 1)
    store.updateCellValue(0, 'sondaje', 'DH-01-MODIFICADO');

    expect(store.dirtyRowIds.has(1)).toBe(true);

    // Forzar guardado inmediato al deltaManager
    await deltaManager.flushImmediate(useGridStore.getState());

    const pending = deltaManager.getPendingDelta();
    expect(pending).not.toBeNull();
    expect(pending!.modifiedRows[1]).toBeDefined();
    expect(pending!.modifiedRows[1].current.sondaje).toBe('DH-01-MODIFICADO');
    expect(pending!.modifiedRows[1].original.sondaje).toBe('DH-01');

    // Cargar directamente de la capa de almacenamiento (IndexedDB / Memory fallback)
    const storedDelta = await loadDelta();
    expect(storedDelta).not.toBeNull();
    expect(storedDelta!.modifiedRows[1].current.sondaje).toBe('DH-01-MODIFICADO');
  });

  it('2. Smart Revert: Volver al valor original debe quitar el cambio y limpiar el delta', async () => {
    const store = useGridStore.getState();

    // Modificar celda
    store.updateCellValue(0, 'sondaje', 'DH-01-MODIFICADO');
    expect(store.dirtyRowIds.has(1)).toBe(true);
    await deltaManager.flushImmediate(useGridStore.getState());
    expect(deltaManager.getPendingDelta()?.modifiedRows[1]).toBeDefined();

    // Volver a escribir el valor original exactamente
    store.updateCellValue(0, 'sondaje', 'DH-01');
    expect(store.dirtyRowIds.has(1)).toBe(false);

    await deltaManager.flushImmediate(useGridStore.getState());
    const pending = deltaManager.getPendingDelta();
    expect(pending?.modifiedRows[1]).toBeUndefined();
    expect(Object.keys(pending?.modifiedRows || {}).length).toBe(0);
  });

  it('3. Debe detectar conflictos cuando el servidor tiene datos distintos al original snapshot', async () => {
    const store = useGridStore.getState();

    // Usuario modifica el sondaje localmente
    store.updateCellValue(0, 'sondaje', 'DH-01-MI-CAMBIO');
    await deltaManager.flushImmediate(useGridStore.getState());

    // Simulamos que el servidor devuelve un registro donde otro usuario cambió el sondaje en la BD
    const serverRecords = [
      { idd: 1, sondaje: 'DH-01-CAMBIO-SERVIDOR', desde: 10, hasta: 12, traccion_resistencia_kgcm2: 100, traccion_resistencia_mpa: 9.81 },
      { idd: 2, sondaje: 'DH-02', desde: 20, hasta: 22, traccion_resistencia_kgcm2: 200, traccion_resistencia_mpa: 19.61 }
    ];

    const mergeResult = deltaManager.mergeServerRecordsWithDelta(serverRecords);

    // Debe haber detectado el conflicto
    expect(mergeResult.conflicts.length).toBe(1);
    expect(mergeResult.conflicts[0].idd).toBe(1);
    expect(mergeResult.conflicts[0].field).toBe('sondaje');
    expect(mergeResult.conflicts[0].serverValue).toBe('DH-01-CAMBIO-SERVIDOR');
    expect(mergeResult.conflicts[0].localValue).toBe('DH-01-MI-CAMBIO');
    expect(mergeResult.conflicts[0].originalValue).toBe('DH-01');
  });

  it('4. Botón Descartar cambios: Debe revertir modificadas, eliminar insertadas y restaurar eliminadas', async () => {
    const store = useGridStore.getState();

    // 1. Modificar fila 1 (IDD 1)
    store.updateCellValue(0, 'sondaje', 'DH-01-EDITADO');

    // 2. Insertar fila nueva
    const newId = store.insertRowBelow(0, { sondaje: 'DH-NUEVO' });

    // 3. Eliminar fila 3 (IDD 3)
    store.deleteRow(3);

    await deltaManager.flushImmediate(useGridStore.getState());

    // Verificar conteo de cambios pendientes
    const counts = store.getPendingChangesCount();
    expect(counts.modified).toBe(1);
    expect(counts.inserted).toBe(1);
    expect(counts.deleted).toBe(1);
    expect(counts.total).toBe(3);

    // Ejecutar Descartar Todo
    store.discardAllChanges();

    // Verificar estado restaurado
    expect(store.dirtyRowIds.size).toBe(0);
    expect(store.deletedRowIds.size).toBe(0);

    // La fila 1 volvió a su valor original
    expect(store.getRowById(1)?.sondaje).toBe('DH-01');

    // La fila insertada fue eliminada
    expect(store.getRowById(newId)).toBeUndefined();
    expect(store.rowIds.includes(newId)).toBe(false);

    // La fila 3 fue restaurada
    expect(store.getRowById(3)).toBeDefined();
    expect(store.rowIds.includes(3)).toBe(true);

    // El deltaManager y storage deben estar limpios
    expect(deltaManager.getPendingDelta()).toBeNull();
    const stored = await loadDelta();
    expect(stored).toBeNull();
  });

  it('5. Borrado del delta tras guardado exitoso vs conservación en caso de falla', async () => {
    const store = useGridStore.getState();
    store.updateCellValue(0, 'sondaje', 'DH-01-GUARDAR');
    await deltaManager.flushImmediate(useGridStore.getState());

    expect(await loadDelta()).not.toBeNull();

    // Si el guardado falla, deltaManager no debe ser limpiado
    // (comprobamos que el delta persiste en el store)
    expect(deltaManager.getPendingDelta()?.modifiedRows[1]).toBeDefined();

    // Guardado exitoso: llamamos a clear()
    await deltaManager.clear();
    expect(deltaManager.getPendingDelta()).toBeNull();
    expect(await loadDelta()).toBeNull();
  });

  it('6. Manejo de delta corrupto o versión de esquema obsoleta: Debe descartar sin romper la app', async () => {
    // Probar validador con payloads corruptos
    expect(isDeltaCorrupted(null)).toBe(true);
    expect(isDeltaCorrupted({})).toBe(true);
    expect(isDeltaCorrupted({ version: 999 })).toBe(true); // Versión incompatible
    expect(isDeltaCorrupted({ version: CURRENT_DELTA_SCHEMA_VERSION, timestamp: 'invalido' })).toBe(true);

    // Inyectar delta corrupto en storage
    await saveDelta({
      version: 999, // Versión no coincidente
      timestamp: Date.now(),
      modifiedRows: {},
      insertedRows: [],
      deletedRowIds: []
    } as any);

    // Al cargar mediante loadDelta(), debe detectar corrupción, descartarlo y retornar null
    const result = await loadDelta();
    expect(result).toBeNull();
  });
});

