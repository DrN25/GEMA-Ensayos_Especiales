// frontend/src/features/grid/gridStore.ts
import { create } from 'zustand';
import type { CellCoordinate } from './types';
import type { QAQCAlert } from './schema';
import { deltaManager } from './storage/deltaManager';
import {
  COLUMNS_SCHEMA,
  COLUMNS_SCHEMA_MAP,
  validateRow,
  validateDesdeVsHasta,
  computeConvertiblePairUpdate
} from './schema';

/**
 * Validador unificado a nivel de fila que combina reglas de celda del esquema
 * y reglas relacionales de profundidades (Desde vs Hasta).
 */
function validateRowCombined(row: Record<string, any>): QAQCAlert[] {
  const cellAlerts = validateRow(row, COLUMNS_SCHEMA);
  const depthAlerts = validateDesdeVsHasta(row);
  return [...cellAlerts, ...depthAlerts];
}

/**
 * Recalcula campos dependientes y autogenerados de forma pura según el esquema SSOT.
 */
function recalculateDerivedFields(row: Record<string, any>, colKey?: string) {
  // Capacidad de pares convertibles bidireccionales (Etapa C)
  if (colKey && (colKey === 'traccion_resistencia_kgcm2' || colKey === 'traccion_resistencia_mpa')) {
    const pairUpdates = computeConvertiblePairUpdate(colKey, row[colKey], row);
    Object.assign(row, pairUpdates);
  }

  if (!colKey || colKey === 'sondaje') {
    const codeCol = COLUMNS_SCHEMA_MAP.get('codigo_muestra');
    if (codeCol?.autoGenerate && (!row.codigo_muestra || String(row.codigo_muestra).trim() === '')) {
      row.codigo_muestra = codeCol.autoGenerate(row);
    }
  }

  if (!colKey || colKey === 'desde' || colKey === 'hasta') {
    const longCol = COLUMNS_SCHEMA_MAP.get('longitud_muestra');
    if (longCol?.calculate) {
      const calc = longCol.calculate(row);
      if (calc !== null && calc !== undefined) {
        row.longitud_muestra = calc;
      }
    }
  }

  if (!colKey || colKey === 'ucs_carga_rotura' || colKey === 'ucs_diametro') {
    const ucsCalcCol = COLUMNS_SCHEMA_MAP.get('ucs_resistencia_calculada');
    if (ucsCalcCol?.calculate) {
      const calc = ucsCalcCol.calculate(row);
      if (calc !== null && calc !== undefined) {
        row.ucs_resistencia_calculada = calc;
      }
    }
  }

  if (!colKey || colKey === 'corte_esf_normal_kpa') {
    const normCol = COLUMNS_SCHEMA_MAP.get('corte_esf_normal_mpa');
    if (normCol?.calculate) {
      const calc = normCol.calculate(row);
      if (calc !== null && calc !== undefined) {
        row.corte_esf_normal_mpa = calc;
      }
    }
  }

  if (!colKey || colKey === 'corte_esf_corte_kpa') {
    const corteCol = COLUMNS_SCHEMA_MAP.get('corte_esf_corte_mpa');
    if (corteCol?.calculate) {
      const calc = corteCol.calculate(row);
      if (calc !== null && calc !== undefined) {
        row.corte_esf_corte_mpa = calc;
      }
    }
  }
}

export interface GridStoreState {
  // Datos normalizados
  recordsById: Map<number, Record<string, any>>;
  originalRecordsById: Map<number, Record<string, any>>;
  rowIds: number[];
  maxIdd: number;
  rowVersions: Map<number, number>;
  dataVersion: number;

  // QA/QC Incremental en O(1)
  qaqcAlertsByRowId: Map<number, QAQCAlert[]>;

  // Celda activa y editor flotante
  activeCell: CellCoordinate | null;
  editingCell: CellCoordinate | null;
  editorValue: any;

  // Dirty tracking O(1)
  dirtyRowIds: Set<number>;
  deletedRowIds: Set<number>;

  // Acciones
  setInitialRecords: (records: Record<string, any>[], options?: { markAllDirty?: boolean; originalRecords?: Record<string, any>[] }) => void;
  setActiveCell: (cell: CellCoordinate | null) => void;
  startEditing: (cell: CellCoordinate, initialValue?: any) => void;
  setEditorValue: (val: any) => void;
  commitEditing: () => void;
  cancelEditing: () => void;
  insertRowBelow: (idx: number, defaults?: Record<string, any>) => number;
  deleteRow: (rowId: number) => void;
  updateCellValue: (rowIdx: number, colKey: string, value: any) => void;

  // Operaciones de guardado y sincronización
  getDirtyRecords: () => Record<string, any>[];
  clearDirty: () => void;
  clearAll: () => void;
  importRecords: (records: Record<string, any>[]) => void;
  discardAllChanges: () => void;
  getPendingChangesCount: () => { modified: number; inserted: number; deleted: number; total: number };

  // Selectores de lectura rápida
  getRow: (idx: number) => Record<string, any> | undefined;
  getRowById: (rowId: number) => Record<string, any> | undefined;
  getAllRecords: () => Record<string, any>[];
  getQaqcAlerts: () => QAQCAlert[];
  getQaqcAlertsForRow: (rowId: number) => QAQCAlert[];
}

/**
 * Compara si un registro modificado difiere de su snapshot original.
 */
function isRecordDifferent(current: Record<string, any>, original?: Record<string, any>): boolean {
  if (!original) return true; // Si no existía en el snapshot original, es una fila nueva (dirty)

  // Comparar claves en current
  for (const k of Object.keys(current)) {
    if (k.startsWith('_')) continue;
    if (current[k] !== original[k]) return true;
  }
  // Comparar si en original había claves que ya no están
  for (const k of Object.keys(original)) {
    if (k.startsWith('_')) continue;
    if (current[k] !== original[k]) return true;
  }
  return false;
}

export const useGridStore = create<GridStoreState>((set, get) => ({
  recordsById: new Map(),
  originalRecordsById: new Map(),
  rowIds: [],
  maxIdd: 0,
  rowVersions: new Map(),
  dataVersion: 0,

  qaqcAlertsByRowId: new Map(),

  activeCell: null,
  editingCell: null,
  editorValue: '',
  dirtyRowIds: new Set(),
  deletedRowIds: new Set(),

  setInitialRecords: (records, options = {}) => {
    const map = new Map<number, Record<string, any>>();
    const originals = new Map<number, Record<string, any>>();
    const ids: number[] = [];
    const versions = new Map<number, number>();
    const dirty = new Set<number>();
    const alertsMap = new Map<number, QAQCAlert[]>();
    let max = 0;

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const rawId = r.idd !== undefined ? Number(r.idd) : i + 1;
      const id = isNaN(rawId) ? i + 1 : rawId;
      if (id > max) max = id;

      // Clon superficial de cada registro para tracking de dirty/revert
      const rowClone = { ...r, idd: id };
      recalculateDerivedFields(rowClone);
      map.set(id, rowClone);
      originals.set(id, { ...rowClone });
      ids.push(id);
      versions.set(id, 1);

      // Validación QA/QC incremental inicial (solo almacena si hay alertas)
      const rowAlerts = validateRowCombined(rowClone);
      if (rowAlerts.length > 0) {
        alertsMap.set(id, rowAlerts);
      }

      if (options.markAllDirty) {
        dirty.add(id);
      }
    }

    // Si se proporcionó snapshot original del servidor explícito, sobreescribir originals
    if (options.originalRecords) {
      for (const origR of options.originalRecords) {
        const rawId = origR.idd !== undefined ? Number(origR.idd) : undefined;
        if (rawId !== undefined) {
          const clone = { ...origR, idd: rawId };
          recalculateDerivedFields(clone);
          originals.set(rawId, clone);
        }
      }
    }

    set({
      recordsById: map,
      originalRecordsById: originals,
      rowIds: ids,
      maxIdd: max,
      rowVersions: versions,
      dataVersion: get().dataVersion + 1,
      qaqcAlertsByRowId: alertsMap,
      dirtyRowIds: dirty,
      deletedRowIds: new Set(),
      activeCell: ids.length > 0 ? { rowIdx: 0, colKey: 'sondaje' } : null,
      editingCell: null
    });
  },

  setActiveCell: (cell) => {
    set({ activeCell: cell });
  },

  startEditing: (cell, initialValue) => {
    const { rowIds, recordsById } = get();
    const rowId = cell.rowId !== undefined ? cell.rowId : rowIds[cell.rowIdx];
    const row = rowId !== undefined ? recordsById.get(rowId) : undefined;
    const currentVal = row ? row[cell.colKey] : '';
    set({
      activeCell: { ...cell, rowId },
      editingCell: { ...cell, rowId },
      editorValue: initialValue !== undefined ? initialValue : (currentVal ?? '')
    });
  },

  setEditorValue: (val) => {
    set({ editorValue: val });
  },

  commitEditing: () => {
    const { editingCell, editorValue, rowIds, recordsById, originalRecordsById, rowVersions, dirtyRowIds, qaqcAlertsByRowId } = get();
    if (!editingCell) return;

    const rowId = editingCell.rowId !== undefined ? editingCell.rowId : rowIds[editingCell.rowIdx];
    if (rowId === undefined) {
      set({ editingCell: null });
      return;
    }

    const row = recordsById.get(rowId);
    if (!row) {
      set({ editingCell: null });
      return;
    }

    const colKey = editingCell.colKey;
    if (row[colKey] !== editorValue) {
      // Mutación in-place del registro normalizado
      row[colKey] = editorValue;

      // Verificar si la fila ahora difiere de su snapshot original
      const orig = originalRecordsById.get(rowId);
      if (isRecordDifferent(row, orig)) {
        dirtyRowIds.add(rowId);
      } else {
        dirtyRowIds.delete(rowId); // Revertido al valor original (smart revert)
      }

      // Recalcular campos derivados tras la edición
      recalculateDerivedFields(row, editingCell.colKey);

      // Revalidación QA/QC incremental SOLO para la fila modificada O(1)
      const rowAlerts = validateRowCombined(row);
      if (rowAlerts.length > 0) {
        qaqcAlertsByRowId.set(rowId, rowAlerts);
      } else {
        qaqcAlertsByRowId.delete(rowId);
      }

      rowVersions.set(rowId, (rowVersions.get(rowId) || 1) + 1);
      set({ editingCell: null, dataVersion: get().dataVersion + 1 });
      deltaManager.scheduleDebouncedSave(get());
    } else {
      set({ editingCell: null });
    }
  },

  cancelEditing: () => {
    set({ editingCell: null });
  },

  updateCellValue: (rowIdx, colKey, value) => {
    const { rowIds, recordsById, originalRecordsById, rowVersions, dirtyRowIds, qaqcAlertsByRowId } = get();
    const rowId = rowIds[rowIdx];
    if (rowId === undefined) return;

    const row = recordsById.get(rowId);
    if (!row) return;

    if (row[colKey] !== value) {
      row[colKey] = value;

      const orig = originalRecordsById.get(rowId);
      if (isRecordDifferent(row, orig)) {
        dirtyRowIds.add(rowId);
      } else {
        dirtyRowIds.delete(rowId);
      }

      // Revalidación QA/QC incremental O(1)
      recalculateDerivedFields(row, colKey);
      const rowAlerts = validateRowCombined(row);
      if (rowAlerts.length > 0) {
        qaqcAlertsByRowId.set(rowId, rowAlerts);
      } else {
        qaqcAlertsByRowId.delete(rowId);
      }

      rowVersions.set(rowId, (rowVersions.get(rowId) || 1) + 1);
      set({ dataVersion: get().dataVersion + 1 });
      deltaManager.scheduleDebouncedSave(get());
    }
  },

  insertRowBelow: (idx, defaults = {}) => {
    const state = get();
    if (state.editingCell) {
      state.commitEditing();
    }

    const { rowIds, recordsById, maxIdd, rowVersions, dirtyRowIds, qaqcAlertsByRowId } = get();
    const parentId = rowIds[idx];
    const parent = parentId !== undefined ? recordsById.get(parentId) : undefined;

    const newId = maxIdd + 1;
    const newRow: Record<string, any> = {
      idd: newId,
      sondaje: parent?.sondaje || '',
      codigo_muestra: '',
      laboratorio: parent?.laboratorio || '',
      dia: new Date().getDate(),
      mes: 'Enero',
      anio: new Date().getFullYear(),
      proyecto: parent?.proyecto || '',
      ...defaults
    };

    recordsById.set(newId, newRow);
    rowIds.splice(idx + 1, 0, newId);
    rowVersions.set(newId, 1);
    dirtyRowIds.add(newId);

    // QA/QC incremental para la nueva fila
    recalculateDerivedFields(newRow);
    const newAlerts = validateRowCombined(newRow);
    if (newAlerts.length > 0) {
      qaqcAlertsByRowId.set(newId, newAlerts);
    }

    set({
      maxIdd: newId,
      dataVersion: get().dataVersion + 1,
      activeCell: { rowIdx: idx + 1, colKey: 'sondaje', rowId: newId }
    });

    deltaManager.scheduleDebouncedSave(get());
    return newId;
  },

  deleteRow: (rowId) => {
    const state = get();
    if (state.editingCell) {
      const editingRowId = state.editingCell.rowId !== undefined
        ? state.editingCell.rowId
        : state.rowIds[state.editingCell.rowIdx];
      if (editingRowId === rowId) {
        state.cancelEditing();
      } else {
        state.commitEditing();
      }
    }

    const { rowIds, recordsById, originalRecordsById, dirtyRowIds, deletedRowIds, qaqcAlertsByRowId } = get();
    const idx = rowIds.indexOf(rowId);
    if (idx >= 0) {
      rowIds.splice(idx, 1);
    }
    recordsById.delete(rowId);
    qaqcAlertsByRowId.delete(rowId);

    if (dirtyRowIds.has(rowId)) {
      dirtyRowIds.delete(rowId);
    }
    if (originalRecordsById.has(rowId)) {
      deletedRowIds.add(rowId);
    }

    const currentActive = get().activeCell;
    let nextActive = currentActive;
    if (currentActive && currentActive.rowIdx >= rowIds.length) {
      nextActive = rowIds.length > 0
        ? { rowIdx: rowIds.length - 1, colKey: currentActive.colKey, rowId: rowIds[rowIds.length - 1] }
        : null;
    }

    set({
      dataVersion: get().dataVersion + 1,
      activeCell: nextActive,
      editingCell: null
    });

    deltaManager.scheduleDebouncedSave(get());
  },

  getDirtyRecords: () => {
    const { dirtyRowIds, recordsById } = get();
    const result: Record<string, any>[] = [];
    for (const id of dirtyRowIds) {
      const rec = recordsById.get(id);
      if (rec) {
        result.push(rec);
      }
    }
    return result;
  },

  clearDirty: () => {
    const { recordsById } = get();
    const newOriginals = new Map<number, Record<string, any>>();
    for (const [id, rec] of recordsById.entries()) {
      newOriginals.set(id, { ...rec });
    }
    set({
      dirtyRowIds: new Set(),
      deletedRowIds: new Set(),
      originalRecordsById: newOriginals,
      dataVersion: get().dataVersion + 1
    });
  },

  clearAll: () => {
    set({
      recordsById: new Map(),
      originalRecordsById: new Map(),
      rowIds: [],
      maxIdd: 0,
      rowVersions: new Map(),
      dataVersion: get().dataVersion + 1,
      dirtyRowIds: new Set(),
      deletedRowIds: new Set(),
      qaqcAlertsByRowId: new Map(),
      activeCell: null,
      editingCell: null
    });
  },

  importRecords: (records) => {
    const { recordsById, rowIds, rowVersions, dirtyRowIds, qaqcAlertsByRowId } = get();
    let max = get().maxIdd;

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const rawId = r.idd !== undefined ? Number(r.idd) : max + 1;
      const id = isNaN(rawId) ? max + 1 : rawId;
      if (id > max) max = id;

      const rowClone = { ...r, idd: id };
      recordsById.set(id, rowClone);
      if (!rowIds.includes(id)) {
        rowIds.push(id);
      }
      rowVersions.set(id, (rowVersions.get(id) || 0) + 1);
      dirtyRowIds.add(id);

      recalculateDerivedFields(rowClone);
      const rowAlerts = validateRowCombined(rowClone);
      if (rowAlerts.length > 0) {
        qaqcAlertsByRowId.set(id, rowAlerts);
      } else {
        qaqcAlertsByRowId.delete(id);
      }
    }

    set({
      maxIdd: max,
      dataVersion: get().dataVersion + 1,
      activeCell: rowIds.length > 0 ? { rowIdx: 0, colKey: 'sondaje' } : null
    });

    deltaManager.scheduleDebouncedSave(get());
  },

  discardAllChanges: () => {
    const { originalRecordsById, recordsById, rowIds, dirtyRowIds, deletedRowIds, qaqcAlertsByRowId, rowVersions } = get();
    if (get().editingCell) {
      set({ editingCell: null });
    }

    // 1. Revertir filas modificadas a su snapshot original
    for (const [id, orig] of originalRecordsById.entries()) {
      if (recordsById.has(id)) {
        const reverted = { ...orig };
        recalculateDerivedFields(reverted);
        recordsById.set(id, reverted);

        // Revalidación QA/QC incremental
        const alerts = validateRowCombined(reverted);
        if (alerts.length > 0) {
          qaqcAlertsByRowId.set(id, alerts);
        } else {
          qaqcAlertsByRowId.delete(id);
        }
        rowVersions.set(id, (rowVersions.get(id) || 1) + 1);
      }
    }

    // 2. Eliminar filas insertadas (aquellas en recordsById que no estaban en originalRecordsById)
    const insertedIds: number[] = [];
    for (const id of rowIds) {
      if (!originalRecordsById.has(id)) {
        insertedIds.push(id);
      }
    }
    for (const id of insertedIds) {
      recordsById.delete(id);
      qaqcAlertsByRowId.delete(id);
      const idx = rowIds.indexOf(id);
      if (idx >= 0) rowIds.splice(idx, 1);
    }

    // 3. Restaurar filas eliminadas
    for (const id of deletedRowIds) {
      const orig = originalRecordsById.get(id);
      if (orig) {
        const restored = { ...orig };
        recalculateDerivedFields(restored);
        recordsById.set(id, restored);
        if (!rowIds.includes(id)) {
          rowIds.push(id);
        }
        const alerts = validateRowCombined(restored);
        if (alerts.length > 0) {
          qaqcAlertsByRowId.set(id, alerts);
        }
        rowVersions.set(id, (rowVersions.get(id) || 1) + 1);
      }
    }

    // 4. Limpiar sets
    dirtyRowIds.clear();
    deletedRowIds.clear();

    // 5. Limpiar delta manager
    deltaManager.clear();

    set({
      dataVersion: get().dataVersion + 1,
      editingCell: null
    });
  },

  getPendingChangesCount: () => {
    const { dirtyRowIds, deletedRowIds, originalRecordsById, recordsById } = get();
    const pendingDelta = deltaManager.getPendingDelta();

    let modified = 0;
    let inserted = 0;

    for (const id of dirtyRowIds) {
      if (originalRecordsById.has(id)) {
        modified++;
      } else {
        inserted++;
      }
    }

    let deleted = deletedRowIds.size;

    // Sumar deltas de otras páginas no cargadas en memoria
    if (pendingDelta) {
      for (const [idStr] of Object.entries(pendingDelta.modifiedRows)) {
        const id = Number(idStr);
        if (!recordsById.has(id)) {
          modified++;
        }
      }
      for (const ins of pendingDelta.insertedRows) {
        if (!recordsById.has(ins.idd)) {
          inserted++;
        }
      }
      for (const delId of pendingDelta.deletedRowIds) {
        if (!deletedRowIds.has(delId) && !recordsById.has(delId)) {
          deleted++;
        }
      }
    }

    return {
      modified,
      inserted,
      deleted,
      total: modified + inserted + deleted
    };
  },

  getRow: (idx) => {
    const { rowIds, recordsById } = get();
    const id = rowIds[idx];
    return id !== undefined ? recordsById.get(id) : undefined;
  },

  getRowById: (rowId) => {
    return get().recordsById.get(rowId);
  },

  getAllRecords: () => {
    const { rowIds, recordsById } = get();
    const result: Record<string, any>[] = new Array(rowIds.length);
    for (let i = 0; i < rowIds.length; i++) {
      result[i] = recordsById.get(rowIds[i])!;
    }
    return result;
  },

  getQaqcAlerts: () => {
    const { qaqcAlertsByRowId } = get();
    const result: QAQCAlert[] = [];
    for (const alerts of qaqcAlertsByRowId.values()) {
      for (let i = 0; i < alerts.length; i++) {
        result.push(alerts[i]);
      }
    }
    return result;
  },

  getQaqcAlertsForRow: (rowId: number) => {
    return get().qaqcAlertsByRowId.get(rowId) || [];
  }
}));
