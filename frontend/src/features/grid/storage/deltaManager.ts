// frontend/src/features/grid/storage/deltaManager.ts
import type { GridDelta, RowConflict, ModifiedRowDelta } from './types';
import { saveDelta, loadDelta, clearDelta, CURRENT_DELTA_SCHEMA_VERSION } from './indexedDbDeltaStore';
import type { GridStoreState } from '../gridStore';

function isValuesEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if ((a === null || a === undefined || a === '') && (b === null || b === undefined || b === '')) {
    return true;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < 1e-6;
  }
  if (typeof a === 'number' || typeof b === 'number') {
    const numA = parseFloat(String(a));
    const numB = parseFloat(String(b));
    if (!isNaN(numA) && !isNaN(numB)) {
      return Math.abs(numA - numB) < 1e-6;
    }
  }
  return false;
}

class DeltaManager {
  private debounceTimer: any = null;
  private pendingDelta: GridDelta | null = null;
  private hasPendingWrite = false;

  /**
   * Obtiene la copia en memoria del delta actual.
   */
  public getPendingDelta(): GridDelta | null {
    return this.pendingDelta;
  }

  /**
   * Establece directamente el delta en memoria (útil en restauración y tests).
   */
  public setPendingDelta(delta: GridDelta | null): void {
    this.pendingDelta = delta;
  }

  /**
   * Extrae el delta de cambios a partir del estado actual del useGridStore.
   */
  public extractDeltaFromStore(state: GridStoreState): GridDelta {
    const { dirtyRowIds, deletedRowIds, recordsById, originalRecordsById } = state;
    const modifiedRows: Record<number, ModifiedRowDelta> = { ...(this.pendingDelta?.modifiedRows || {}) };
    const insertedRows: Record<string, any>[] = [];

    // Smart revert: Limpiar del cache en memoria las filas cargadas que ya no estén en dirtyRowIds
    for (const idStr of Object.keys(modifiedRows)) {
      const id = Number(idStr);
      if (recordsById.has(id) && !dirtyRowIds.has(id)) {
        delete modifiedRows[id];
      }
    }
    for (const id of dirtyRowIds) {
      const current = recordsById.get(id);
      const original = originalRecordsById.get(id);

      if (current) {
        if (original) {
          // Fila existente modificada
          modifiedRows[id] = {
            current: JSON.parse(JSON.stringify(current)),
            original: JSON.parse(JSON.stringify(original)),
            updatedAt: Date.now()
          };
        } else {
          // Fila nueva insertada
          insertedRows.push(JSON.parse(JSON.stringify(current)));
        }
      }
    }

    // Preservar filas insertadas que pudieran estar en el delta pero no en la página actual
    const currentInsertedIds = new Set(insertedRows.map(r => r.idd));
    if (this.pendingDelta?.insertedRows) {
      for (const ins of this.pendingDelta.insertedRows) {
        if (!currentInsertedIds.has(ins.idd)) {
          insertedRows.push(ins);
        }
      }
    }

    // Combinar IDs eliminados
    const allDeletedIds = Array.from(new Set([
      ...(this.pendingDelta?.deletedRowIds || []),
      ...Array.from(deletedRowIds)
    ]));

    const delta: GridDelta = {
      version: CURRENT_DELTA_SCHEMA_VERSION,
      timestamp: Date.now(),
      modifiedRows,
      insertedRows,
      deletedRowIds: allDeletedIds
    };

    return delta;
  }

  /**
   * Programa la persistencia en IndexedDB con debounce de 500ms fuera del camino crítico de edición.
   */
  public scheduleDebouncedSave(state: GridStoreState): void {
    const delta = this.extractDeltaFromStore(state);
    this.pendingDelta = delta;
    this.hasPendingWrite = true;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      if (this.hasPendingWrite && this.pendingDelta) {
        const hasActualChanges =
          Object.keys(this.pendingDelta.modifiedRows).length > 0 ||
          this.pendingDelta.insertedRows.length > 0 ||
          this.pendingDelta.deletedRowIds.length > 0;

        if (hasActualChanges) {
          await saveDelta(this.pendingDelta);
        } else {
          await clearDelta();
        }
        this.hasPendingWrite = false;
      }
    }, 500);
  }

  /**
   * Guarda de inmediato en IndexedDB (ej. antes de descargar o cambiar de contexto).
   */
  public async flushImmediate(state?: GridStoreState): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (state) {
      this.pendingDelta = this.extractDeltaFromStore(state);
    }

    if (this.pendingDelta) {
      const hasActualChanges =
        Object.keys(this.pendingDelta.modifiedRows).length > 0 ||
        this.pendingDelta.insertedRows.length > 0 ||
        this.pendingDelta.deletedRowIds.length > 0;

      if (hasActualChanges) {
        await saveDelta(this.pendingDelta);
      } else {
        await clearDelta();
      }
    }
    this.hasPendingWrite = false;
  }

  /**
   * Carga el delta pendiente desde IndexedDB y lo almacena en memoria.
   */
  public async initFromStorage(): Promise<GridDelta | null> {
    const delta = await loadDelta();
    this.pendingDelta = delta;
    return delta;
  }

  /**
   * Combina registros recién traídos del servidor con el delta pendiente local.
   * Detecta conflictos si un registro cambió en el servidor respecto a su original guardado.
   */
  public mergeServerRecordsWithDelta(serverRecords: Record<string, any>[]): {
    merged: Record<string, any>[];
    conflicts: RowConflict[];
    appliedCount: number;
    deletedIdsOnPage: Set<number>;
    dirtyIdsOnPage: Set<number>;
    insertedToPrepend: Record<string, any>[];
  } {
    const conflicts: RowConflict[] = [];
    const deletedIdsOnPage = new Set<number>();
    const dirtyIdsOnPage = new Set<number>();
    let appliedCount = 0;

    if (!this.pendingDelta) {
      return {
        merged: serverRecords,
        conflicts,
        appliedCount,
        deletedIdsOnPage,
        dirtyIdsOnPage,
        insertedToPrepend: []
      };
    }

    const { modifiedRows, insertedRows, deletedRowIds } = this.pendingDelta;
    const deletedSet = new Set(deletedRowIds);

    const merged = serverRecords.map(serverRow => {
      const id = Number(serverRow.idd);

      // Si está en lista de eliminados pendientes
      if (deletedSet.has(id)) {
        deletedIdsOnPage.add(id);
        return serverRow;
      }

      // Si tiene modificaciones locales pendientes
      const mod = modifiedRows[id];
      if (mod) {
        // Detección de conflictos: Solo si el usuario editó el campo Y el servidor lo cambió respecto al snapshot original
        let hasConflict = false;
        let conflictField = '';
        let serverVal = null;
        let localVal = null;
        let origVal = null;

        for (const [key, currentVal] of Object.entries(mod.current)) {
          if (key.startsWith('_')) continue;
          const originalVal = mod.original[key];
          if (!isValuesEqual(currentVal, originalVal)) {
            const serverFieldVal = serverRow[key];
            if (!isValuesEqual(serverFieldVal, originalVal) && !isValuesEqual(serverFieldVal, currentVal)) {
              hasConflict = true;
              conflictField = key;
              serverVal = serverFieldVal;
              localVal = currentVal;
              origVal = originalVal;
              break;
            }
          }
        }

        if (hasConflict) {
          conflicts.push({
            idd: id,
            sondaje: serverRow.sondaje || mod.current.sondaje,
            field: conflictField,
            serverValue: serverVal,
            localValue: localVal,
            originalValue: origVal,
            serverRecord: { ...serverRow },
            localRecord: { ...mod.current },
            originalRecord: { ...mod.original }
          });
          // Por defecto mantenemos el cambio local activo para no perder trabajo
          dirtyIdsOnPage.add(id);
          appliedCount++;
          return { ...serverRow, ...mod.current };
        } else {
          // Sin conflicto: reaplicar limpiamente el delta local
          dirtyIdsOnPage.add(id);
          appliedCount++;
          return { ...serverRow, ...mod.current };
        }
      }

      return serverRow;
    });

    return {
      merged,
      conflicts,
      appliedCount,
      deletedIdsOnPage,
      dirtyIdsOnPage,
      insertedToPrepend: insertedRows || []
    };
  }

  /**
   * Resuelve un conflicto específico: 'keep_local' o 'use_server'.
   */
  public resolveConflict(idd: number, decision: 'keep_local' | 'use_server', serverRecord?: Record<string, any>): void {
    if (!this.pendingDelta) return;

    if (decision === 'use_server') {
      // Descartar el cambio local para este IDD
      delete this.pendingDelta.modifiedRows[idd];
      this.hasPendingWrite = true;
      saveDelta(this.pendingDelta).catch(() => {});
    } else {
      // Mantener lo local: actualizar el snapshot original al nuevo valor del servidor para resolver el conflicto
      if (serverRecord && this.pendingDelta.modifiedRows[idd]) {
        this.pendingDelta.modifiedRows[idd].original = JSON.parse(JSON.stringify(serverRecord));
        this.hasPendingWrite = true;
        saveDelta(this.pendingDelta).catch(() => {});
      }
    }
  }

  /**
   * Limpia completamente el delta local (tras guardar o descartar cambios).
   */
  public async clear(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingDelta = null;
    this.hasPendingWrite = false;
    await clearDelta();
  }
}

export const deltaManager = new DeltaManager();
