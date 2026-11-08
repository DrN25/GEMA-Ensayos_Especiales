// frontend/src/features/grid/__tests__/gridStore.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGridStore } from '../gridStore';

describe('Bloque 2: Store Normalizado O(1) de Grilla Virtualizada', () => {
  beforeEach(() => {
    useGridStore.setState({
      recordsById: new Map(),
      rowIds: [],
      maxIdd: 0,
      rowVersions: new Map(),
      dataVersion: 0,
      activeCell: null,
      editingCell: null,
      editorValue: '',
      dirtyRowIds: new Set()
    });
  });

  it('debe inicializar el catálogo de registros normalizado con Map y rowIds', () => {
    const sample = [
      { idd: 1, sondaje: 'SOND-01', laboratorio: 'LAB-A' },
      { idd: 2, sondaje: 'SOND-02', laboratorio: 'LAB-B' },
      { idd: 3, sondaje: 'SOND-03', laboratorio: 'LAB-C' }
    ];

    useGridStore.getState().setInitialRecords(sample);

    const state = useGridStore.getState();
    expect(state.rowIds).toEqual([1, 2, 3]);
    expect(state.maxIdd).toBe(3);
    expect(state.recordsById.size).toBe(3);
    expect(state.recordsById.get(1)?.sondaje).toBe('SOND-01');
    expect(state.activeCell).toEqual({ rowIdx: 0, colKey: 'sondaje' });
  });

  it('debe insertar una fila debajo del índice indicado de forma normalizada', () => {
    const sample = [
      { idd: 10, sondaje: 'SOND-10', laboratorio: 'LAB-A' },
      { idd: 20, sondaje: 'SOND-20', laboratorio: 'LAB-B' }
    ];

    useGridStore.getState().setInitialRecords(sample);
    const newId = useGridStore.getState().insertRowBelow(0); // Debajo de la fila 0 (ID 10)

    const state = useGridStore.getState();
    expect(newId).toBe(21); // maxIdd (20) + 1
    expect(state.rowIds).toEqual([10, 21, 20]);
    expect(state.recordsById.get(21)?.sondaje).toBe('SOND-10'); // Hereda propiedades padre
    expect(state.dirtyRowIds.has(21)).toBe(true);
    expect(state.activeCell).toEqual({ rowIdx: 1, colKey: 'sondaje', rowId: 21 });
  });

  it('debe eliminar una fila por su rowId actualizando rowIds y recordsById', () => {
    const sample = [
      { idd: 1, sondaje: 'S1' },
      { idd: 2, sondaje: 'S2' },
      { idd: 3, sondaje: 'S3' }
    ];

    useGridStore.getState().setInitialRecords(sample);
    useGridStore.getState().deleteRow(2);

    const state = useGridStore.getState();
    expect(state.rowIds).toEqual([1, 3]);
    expect(state.recordsById.has(2)).toBe(false);
    expect(state.recordsById.size).toBe(2);
  });

  it('debe editar una celda in-place y marcar el rowId como dirty sin duplicar el mapa', () => {
    const sample = [
      { idd: 1, sondaje: 'ORIGINAL', laboratorio: 'LAB' }
    ];

    useGridStore.getState().setInitialRecords(sample);
    useGridStore.getState().startEditing({ rowIdx: 0, colKey: 'sondaje' });
    useGridStore.getState().setEditorValue('MODIFICADO');
    useGridStore.getState().commitEditing();

    const state = useGridStore.getState();
    expect(state.recordsById.get(1)?.sondaje).toBe('MODIFICADO');
    expect(state.dirtyRowIds.has(1)).toBe(true);
    expect(state.editingCell).toBeNull();
  });

  it('debe cancelar la edición sin modificar el valor de la celda', () => {
    const sample = [
      { idd: 1, sondaje: 'ORIGINAL' }
    ];

    useGridStore.getState().setInitialRecords(sample);
    useGridStore.getState().startEditing({ rowIdx: 0, colKey: 'sondaje' });
    useGridStore.getState().setEditorValue('CANCELADO');
    useGridStore.getState().cancelEditing();

    const state = useGridStore.getState();
    expect(state.recordsById.get(1)?.sondaje).toBe('ORIGINAL');
    expect(state.dirtyRowIds.has(1)).toBe(false);
    expect(state.editingCell).toBeNull();
  });

  it('debe confirmar la edición en la fila correcta si se inserta una fila arriba mientras el editor está abierto', () => {
    const sample = [
      { idd: 10, sondaje: 'FILA_0' },
      { idd: 20, sondaje: 'FILA_1_ORIGINAL' }
    ];

    useGridStore.getState().setInitialRecords(sample);
    // Usuario empieza a editar fila 1 (ID 20)
    useGridStore.getState().startEditing({ rowIdx: 1, colKey: 'sondaje' });
    useGridStore.getState().setEditorValue('FILA_1_EDITADA');

    // Se inserta una fila en índice 0 (arriba de la fila en edición)
    const newId = useGridStore.getState().insertRowBelow(0);

    const state = useGridStore.getState();
    // La fila 1 original (ID 20) debe haber recibido el valor editado
    expect(state.recordsById.get(20)?.sondaje).toBe('FILA_1_EDITADA');
    // La nueva fila insertada (ID newId) NO debe tener el texto editado
    expect(state.recordsById.get(newId)?.sondaje).toBe('FILA_0');
    // El editor se cierra ordenadamente
    expect(state.editingCell).toBeNull();
    // El orden de IDs ahora tiene la fila editada al final (índice 2)
    expect(state.rowIds).toEqual([10, newId, 20]);
  });

  it('debe cancelar la edición si la fila que se está editando es eliminada', () => {
    const sample = [
      { idd: 1, sondaje: 'S1' },
      { idd: 2, sondaje: 'S2' }
    ];

    useGridStore.getState().setInitialRecords(sample);
    useGridStore.getState().startEditing({ rowIdx: 1, colKey: 'sondaje' });
    useGridStore.getState().setEditorValue('S2_PENDIENTE');

    // Eliminar la misma fila que se estaba editando (ID 2)
    useGridStore.getState().deleteRow(2);

    const state = useGridStore.getState();
    expect(state.editingCell).toBeNull();
    expect(state.recordsById.has(2)).toBe(false);
    expect(state.rowIds).toEqual([1]);
  });
});

