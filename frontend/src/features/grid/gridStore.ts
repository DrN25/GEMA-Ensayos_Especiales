// frontend/src/features/grid/gridStore.ts
import { create } from 'zustand';
import type { CellCoordinate } from './types';
import { validateSingleRecord, type QAQCAlert } from '../../utils/qaqcValidator';

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
  setInitialRecords: (records: Record<string, any>[], options?: { markAllDirty?: boolean }) => void;
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
    if (current[k] !== original[k]) return true;
  }
  // Comparar si en original había claves que ya no están
  for (const k of Object.keys(original)) {
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
      map.set(id, rowClone);
      originals.set(id, { ...rowClone });
      ids.push(id);
      versions.set(id, 1);

      // Validación QA/QC incremental inicial (solo almacena si hay alertas)
      const rowAlerts = validateSingleRecord(rowClone);
      if (rowAlerts.length > 0) {
        alertsMap.set(id, rowAlerts);
      }

      if (options.markAllDirty) {
        dirty.add(id);
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
        dirtyRowIds.delete(rowId); // Revertido al valor original
      }

      // Revalidación QA/QC incremental SOLO para la fila modificada O(1)
      const rowAlerts = validateSingleRecord(row);
      if (rowAlerts.length > 0) {
        qaqcAlertsByRowId.set(rowId, rowAlerts);
      } else {
        qaqcAlertsByRowId.delete(rowId);
      }

      rowVersions.set(rowId, (rowVersions.get(rowId) || 1) + 1);
      set({ editingCell: null, dataVersion: get().dataVersion + 1 });
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
      const rowAlerts = validateSingleRecord(row);
      if (rowAlerts.length > 0) {
        qaqcAlertsByRowId.set(rowId, rowAlerts);
      } else {
        qaqcAlertsByRowId.delete(rowId);
      }

      rowVersions.set(rowId, (rowVersions.get(rowId) || 1) + 1);
      set({ dataVersion: get().dataVersion + 1 });
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
    const newAlerts = validateSingleRecord(newRow);
    if (newAlerts.length > 0) {
      qaqcAlertsByRowId.set(newId, newAlerts);
    }

    set({
      maxIdd: newId,
      dataVersion: get().dataVersion + 1,
      activeCell: { rowIdx: idx + 1, colKey: 'sondaje', rowId: newId }
    });

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

      const rowAlerts = validateSingleRecord(rowClone);
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
