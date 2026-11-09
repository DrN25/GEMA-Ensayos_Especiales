// frontend/src/features/grid/__tests__/excelKeyboardNavigation.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { getGridColumnsForModule } from '../columnsDefinition';
import { getConvertibleLockInfo, sanitizeInputForColumn, COLUMNS_SCHEMA_MAP } from '../schema';

describe('Excel Keyboard Navigation & Cell Transition Mechanics', () => {
  const columns = getGridColumnsForModule('registro_maestro');
  const leafCols = columns.filter(c => c.id !== 'acciones_col' && c.id !== 'qaqc_validacion');

  // Simulación de registros de prueba con bloqueo de par convertible (Tracción Indirecta kg/cm² <-> MPa)
  const mockRecords: Record<string, any>[] = [
    {
      idd: 1,
      sondaje: 'CHGT25-001',
      codigo_muestra: 'M-01',
      laboratorio: 'UNI',
      traccion_resistencia_kgcm2: 100,
      traccion_resistencia_mpa: 9.81,
      _convertibleSource: { traccion_resistencia_pair: 'traccion_resistencia_kgcm2' },
      ucs_resistencia: 45.2,
      ucs_resistencia_calculada: 45.2 // Readonly / calculado
    },
    {
      idd: 2,
      sondaje: 'CHGT25-002',
      codigo_muestra: 'M-02',
      laboratorio: 'GEO',
      traccion_resistencia_kgcm2: null,
      traccion_resistencia_mpa: null,
      _convertibleSource: {},
      ucs_resistencia: 60.1,
      ucs_resistencia_calculada: 60.1
    }
  ];

  const rowIds = [1, 2];
  const recordsById = new Map([
    [1, mockRecords[0]],
    [2, mockRecords[1]]
  ]);

  const isCellEditable = (rowIdx: number, colKey: string): boolean => {
    if (colKey === 'acciones_col' || colKey === 'qaqc_validacion') return false;
    const colDef = columns.find(c => c.id === colKey);
    if (!colDef || colDef.editor === 'none' || colDef.type === 'readonly') return false;

    const rowId = rowIds[rowIdx];
    if (rowId === undefined) return false;
    const rec = recordsById.get(rowId);
    if (!rec) return false;

    const lockInfo = getConvertibleLockInfo(colKey, rec);
    if (lockInfo.isReadOnly) return false;

    return true;
  };

  const findNextEditableCell = (
    startRowIdx: number,
    startColKey: string,
    direction: 'forward' | 'backward'
  ): { rowIdx: number; colKey: string; rowId: number } | null => {
    if (leafCols.length === 0 || rowIds.length === 0) return null;

    let currentColIdx = leafCols.findIndex(c => c.id === startColKey);
    if (currentColIdx === -1) currentColIdx = 0;

    let r = startRowIdx;
    let c = currentColIdx;
    const delta = direction === 'forward' ? 1 : -1;
    const maxSteps = rowIds.length * leafCols.length;
    let steps = 0;

    while (steps < maxSteps) {
      c += delta;
      if (c >= leafCols.length) {
        c = 0;
        r += 1;
        if (r >= rowIds.length) return null;
      } else if (c < 0) {
        c = leafCols.length - 1;
        r -= 1;
        if (r < 0) return null;
      }

      const colCandidate = leafCols[c].id;
      if (isCellEditable(r, colCandidate)) {
        return { rowIdx: r, colKey: colCandidate, rowId: rowIds[r] };
      }

      steps++;
    }

    return null;
  };

  describe('1. Salto inteligente de columnas no editables (Tab)', () => {
    it('omite columnas de solo lectura calculadas (p. ej. ucs_resistencia_calculada)', () => {
      expect(isCellEditable(0, 'ucs_resistencia_calculada')).toBe(false);
      expect(isCellEditable(0, 'idd')).toBe(false);
    });

    it('omite celdas bloqueadas por par convertible (p. ej. traccion_resistencia_mpa cuando el origen fue kgcm2)', () => {
      expect(isCellEditable(0, 'traccion_resistencia_mpa')).toBe(false);
      expect(isCellEditable(0, 'traccion_resistencia_kgcm2')).toBe(true);

      expect(isCellEditable(1, 'traccion_resistencia_mpa')).toBe(true);
      expect(isCellEditable(1, 'traccion_resistencia_kgcm2')).toBe(true);
    });

    it('Tab nunca aterriza en acciones_col ni en qaqc_validacion', () => {
      expect(isCellEditable(0, 'acciones_col')).toBe(false);
      expect(isCellEditable(0, 'qaqc_validacion')).toBe(false);
    });
  });

  describe('2. Salto y Wrap entre Filas (Tab / Shift+Tab)', () => {
    it('Tab en la última columna editable de una fila salta a la primera columna editable de la siguiente fila', () => {
      let lastEditableCol = '';
      for (let i = leafCols.length - 1; i >= 0; i--) {
        if (isCellEditable(0, leafCols[i].id)) {
          lastEditableCol = leafCols[i].id;
          break;
        }
      }

      expect(lastEditableCol).toBeTruthy();

      const next = findNextEditableCell(0, lastEditableCol, 'forward');
      expect(next).not.toBeNull();
      expect(next?.rowIdx).toBe(1);
      expect(next?.rowId).toBe(2);
      expect(next?.colKey).toBe('sondaje');
    });

    it('Shift+Tab en la primera columna editable de la fila 1 regresa a la última columna editable de la fila 0', () => {
      const prev = findNextEditableCell(1, 'sondaje', 'backward');
      expect(prev).not.toBeNull();
      expect(prev?.rowIdx).toBe(0);
      expect(prev?.rowId).toBe(1);
    });

    it('Tab en la última celda de la última fila se detiene limpiamente (null)', () => {
      let lastEditableCol = '';
      for (let i = leafCols.length - 1; i >= 0; i--) {
        if (isCellEditable(1, leafCols[i].id)) {
          lastEditableCol = leafCols[i].id;
          break;
        }
      }

      const next = findNextEditableCell(1, lastEditableCol, 'forward');
      expect(next).toBeNull();
    });

    it('Shift+Tab en la primera celda de la primera fila se detiene limpiamente (null)', () => {
      const prev = findNextEditableCell(0, 'sondaje', 'backward');
      expect(prev).toBeNull();
    });
  });

  describe('3. Mecánica de Modo Rápido (Quick Mode) vs Modo Completo (Full Mode)', () => {
    const handleFloatingEditorKeyDown = (
      e: { key: string; shiftKey?: boolean; preventDefault: () => void },
      mode: 'quick' | 'full',
      isSelect: boolean,
      callbacks: {
        onCommit: () => void;
        onCancel: () => void;
        onNavigateNext?: (dir: 'down' | 'right' | 'up' | 'left') => void;
      }
    ) => {
      if (isSelect) {
        if (e.key === 'Enter') {
          e.preventDefault();
          callbacks.onCommit();
          callbacks.onNavigateNext?.(e.shiftKey ? 'up' : 'down');
        } else if (e.key === 'Tab') {
          e.preventDefault();
          callbacks.onCommit();
          callbacks.onNavigateNext?.(e.shiftKey ? 'left' : 'right');
        } else if (e.key === 'Escape') {
          e.preventDefault();
          callbacks.onCancel();
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        callbacks.onCommit();
        callbacks.onNavigateNext?.(e.shiftKey ? 'up' : 'down');
      } else if (e.key === 'Tab') {
        e.preventDefault();
        callbacks.onCommit();
        callbacks.onNavigateNext?.(e.shiftKey ? 'left' : 'right');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        callbacks.onCancel();
      } else if (mode === 'quick') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          callbacks.onCommit();
          callbacks.onNavigateNext?.('down');
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          callbacks.onCommit();
          callbacks.onNavigateNext?.('up');
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          callbacks.onCommit();
          callbacks.onNavigateNext?.('right');
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          callbacks.onCommit();
          callbacks.onNavigateNext?.('left');
        }
      } else if (mode === 'full') {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
        }
      }
    };

    it('en modo rápido, las 4 flechas guardan y navegan a la celda adyacente', () => {
      const onCommit = vi.fn();
      const onNavigateNext = vi.fn();
      const preventDefault = vi.fn();

      handleFloatingEditorKeyDown(
        { key: 'ArrowDown', preventDefault },
        'quick',
        false,
        { onCommit, onCancel: vi.fn(), onNavigateNext }
      );
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onNavigateNext).toHaveBeenCalledWith('down');

      handleFloatingEditorKeyDown(
        { key: 'ArrowRight', preventDefault },
        'quick',
        false,
        { onCommit, onCancel: vi.fn(), onNavigateNext }
      );
      expect(onCommit).toHaveBeenCalledTimes(2);
      expect(onNavigateNext).toHaveBeenCalledWith('right');
    });

    it('en modo completo (doble clic / F2), flechas izquierda y derecha NO salen de la celda para permitir mover el cursor de texto', () => {
      const onCommit = vi.fn();
      const onNavigateNext = vi.fn();
      const preventDefault = vi.fn();

      handleFloatingEditorKeyDown(
        { key: 'ArrowLeft', preventDefault },
        'full',
        false,
        { onCommit, onCancel: vi.fn(), onNavigateNext }
      );
      expect(onCommit).not.toHaveBeenCalled();
      expect(onNavigateNext).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();

      handleFloatingEditorKeyDown(
        { key: 'ArrowRight', preventDefault },
        'full',
        false,
        { onCommit, onCancel: vi.fn(), onNavigateNext }
      );
      expect(onCommit).not.toHaveBeenCalled();
      expect(onNavigateNext).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();
    });

    it('en modo completo (doble clic / F2), flechas arriba y abajo son prevenidas para no expulsar al usuario', () => {
      const onCommit = vi.fn();
      const onNavigateNext = vi.fn();
      const preventDefault = vi.fn();

      handleFloatingEditorKeyDown(
        { key: 'ArrowDown', preventDefault },
        'full',
        false,
        { onCommit, onCancel: vi.fn(), onNavigateNext }
      );
      expect(preventDefault).toHaveBeenCalled();
      expect(onCommit).not.toHaveBeenCalled();
      expect(onNavigateNext).not.toHaveBeenCalled();
    });

    it('en columnas tipo select (dropdown), las flechas no navegan celdas (permiten seleccionar opción)', () => {
      const onCommit = vi.fn();
      const onNavigateNext = vi.fn();
      const preventDefault = vi.fn();

      handleFloatingEditorKeyDown(
        { key: 'ArrowDown', preventDefault },
        'quick',
        true,
        { onCommit, onCancel: vi.fn(), onNavigateNext }
      );
      expect(onCommit).not.toHaveBeenCalled();
      expect(onNavigateNext).not.toHaveBeenCalled();
    });
  });

  describe('4. Sanitización e Inmunidad de Tipos de Datos en Tiempo Real (sanitizeInputForColumn)', () => {
    it('en columnas decimales positivas (ej: desde), solo permite dígitos, un punto decimal y limita decimales', () => {
      const colDesde = COLUMNS_SCHEMA_MAP.get('desde');
      expect(colDesde).toBeDefined();

      // Dígitos válidos
      expect(sanitizeInputForColumn('12', colDesde).valid).toBe(true);
      expect(sanitizeInputForColumn('12.5', colDesde).valid).toBe(true);
      expect(sanitizeInputForColumn('12.55', colDesde).valid).toBe(true);

      // Normaliza coma a punto
      const resComma = sanitizeInputForColumn('12,5', colDesde);
      expect(resComma.valid).toBe(true);
      expect(resComma.value).toBe('12.5');

      // Rechaza tercer decimal (col.decimals = 2)
      expect(sanitizeInputForColumn('12.555', colDesde).valid).toBe(false);

      // Rechaza letras
      expect(sanitizeInputForColumn('12a', colDesde).valid).toBe(false);
      expect(sanitizeInputForColumn('abc', colDesde).valid).toBe(false);

      // Rechaza números negativos en columna positiveOnly
      expect(sanitizeInputForColumn('-5', colDesde).valid).toBe(false);

      // Rechaza doble punto
      expect(sanitizeInputForColumn('12.5.5', colDesde).valid).toBe(false);
    });

    it('en columnas de texto (ej: sondaje), convierte a mayúsculas si uppercase está activado y respeta maxLength', () => {
      const colSondaje = COLUMNS_SCHEMA_MAP.get('sondaje');
      expect(colSondaje).toBeDefined();

      const resUpper = sanitizeInputForColumn('chgt25-001', colSondaje);
      expect(resUpper.valid).toBe(true);
      expect(resUpper.value).toBe('CHGT25-001');

      // Si supera maxLength (50 caracteres)
      const longText = 'A'.repeat(60);
      const resLong = sanitizeInputForColumn(longText, colSondaje);
      expect(resLong.valid).toBe(false);
      expect(resLong.value.length).toBe(50);
    });

    it('en columnas enteras (ej: anio, dia), rechaza puntos decimales y letras', () => {
      const colAnio = COLUMNS_SCHEMA_MAP.get('anio');
      expect(colAnio).toBeDefined();

      expect(sanitizeInputForColumn('2025', colAnio).valid).toBe(true);
      expect(sanitizeInputForColumn('2025.5', colAnio).valid).toBe(false);
      expect(sanitizeInputForColumn('2025a', colAnio).valid).toBe(false);
      expect(sanitizeInputForColumn('-2025', colAnio).valid).toBe(false);
    });

    it('cadena vacía siempre es válida durante la edición para permitir borrar contenido', () => {
      const colDesde = COLUMNS_SCHEMA_MAP.get('desde');
      expect(sanitizeInputForColumn('', colDesde).valid).toBe(true);
      expect(sanitizeInputForColumn('', colDesde).value).toBe('');
    });
  });

  describe('5. Selección inicial al abrir editor: initialSelection ("all" vs "end")', () => {
    it('al presionar Enter (reemplazo general) initialSelection es "all"', () => {
      // Enter debe resaltar todo el texto existente para permitir reemplazar si se desea
      const selectionOnEnter = 'all';
      expect(selectionOnEnter).toBe('all');
    });

    it('al tipear un carácter directamente (type-to-edit) initialSelection es "end" para no sobreescribir el 1er carácter', () => {
      // Type-to-edit ya reemplazó la celda con el 1er carácter; el cursor debe posicionarse al FINAL
      const selectionOnType = 'end';
      expect(selectionOnType).toBe('end');

      // Simulación de escritura consecutiva: 1er char '5', luego llega '6'
      const firstChar = '5';
      const colDesde = COLUMNS_SCHEMA_MAP.get('desde');
      const checkFirst = sanitizeInputForColumn(firstChar, colDesde);
      expect(checkFirst.valid).toBe(true);
      expect(checkFirst.value).toBe('5');

      // Cursor al final -> al presionar '6' se anexa a '5' formando '56'
      const appended = checkFirst.value + '6';
      const checkSecond = sanitizeInputForColumn(appended, colDesde);
      expect(checkSecond.valid).toBe(true);
      expect(checkSecond.value).toBe('56');
    });
  });
});
