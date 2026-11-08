// frontend/src/features/grid/gridStore.ts
import { create } from 'zustand';
import type { CellCoordinate } from './types';

export interface GridStoreState {
  // Datos normalizados
  recordsById: Map<number, Record<string, any>>;
  rowIds: number[];
  maxIdd: number;
  rowVersions: Map<number, number>;
  dataVersion: number;

  // Celda activa y editor flotante
  activeCell: CellCoordinate | null;
  editingCell: CellCoordinate | null;
  editorValue: any;

  // Dirty tracking O(1)
  dirtyRowIds: Set<number>;

  // Acciones
  setInitialRecords: (records: Record<string, any>[]) => void;
  setActiveCell: (cell: CellCoordinate | null) => void;
  startEditing: (cell: CellCoordinate, initialValue?: any) => void;
  setEditorValue: (val: any) => void;
  commitEditing: () => void;
  cancelEditing: () => void;
  insertRowBelow: (idx: number, defaults?: Record<string, any>) => number;
  deleteRow: (rowId: number) => void;
  updateCellValue: (rowIdx: number, colKey: string, value: any) => void;

  // Selectores de lectura rápida
  getRow: (idx: number) => Record<string, any> | undefined;
  getRowById: (rowId: number) => Record<string, any> | undefined;
  getAllRecords: () => Record<string, any>[];
}

export const useGridStore = create<GridStoreState>((set, get) => ({
  recordsById: new Map(),
  rowIds: [],
  maxIdd: 0,
  rowVersions: new Map(),
  dataVersion: 0,

  activeCell: null,
  editingCell: null,
  editorValue: '',
  dirtyRowIds: new Set(),

  setInitialRecords: (records) => {
    const map = new Map<number, Record<string, any>>();
    const ids: number[] = [];
    const versions = new Map<number, number>();
    let max = 0;

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const rawId = r.idd !== undefined ? Number(r.idd) : i + 1;
      const id = isNaN(rawId) ? i + 1 : rawId;
      if (id > max) max = id;
      map.set(id, r);
      ids.push(id);
      versions.set(id, 1);
    }

    set({
      recordsById: map,
      rowIds: ids,
      maxIdd: max,
      rowVersions: versions,
      dataVersion: get().dataVersion + 1,
      dirtyRowIds: new Set(),
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
    const { editingCell, editorValue, rowIds, recordsById, rowVersions, dirtyRowIds } = get();
    if (!editingCell) return;

    // Resuelve por rowId inmutable para no escribir en fila incorrecta tras inserciones o eliminaciones
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
      dirtyRowIds.add(rowId);
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
    const { rowIds, recordsById, rowVersions, dirtyRowIds } = get();
    const rowId = rowIds[rowIdx];
    if (rowId === undefined) return;

    const row = recordsById.get(rowId);
    if (!row) return;

    if (row[colKey] !== value) {
      row[colKey] = value;
      dirtyRowIds.add(rowId);
      rowVersions.set(rowId, (rowVersions.get(rowId) || 1) + 1);
      set({ dataVersion: get().dataVersion + 1 });
    }
  },

  insertRowBelow: (idx, defaults = {}) => {
    // Si hay una edición activa, confirmarla en su fila original antes de desplazar índices
    const state = get();
    if (state.editingCell) {
      state.commitEditing();
    }

    const { rowIds, recordsById, maxIdd, rowVersions, dirtyRowIds } = get();
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

    set({
      maxIdd: newId,
      dataVersion: get().dataVersion + 1,
      activeCell: { rowIdx: idx + 1, colKey: 'sondaje', rowId: newId }
    });

    return newId;
  },

  deleteRow: (rowId) => {
    // Si la celda en edición está en la fila eliminada, cancelar; si está en otra, confirmar
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

    const { rowIds, recordsById, dirtyRowIds } = get();
    const idx = rowIds.indexOf(rowId);
    if (idx === -1) return;

    recordsById.delete(rowId);
    rowIds.splice(idx, 1);
    dirtyRowIds.delete(rowId);

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
  }
}));
