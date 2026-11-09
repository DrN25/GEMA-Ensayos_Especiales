// frontend/src/features/grid/FloatingEditor.tsx
import React, { useEffect, useRef, useMemo } from 'react';
import type { GridColumnDef, FloatingEditorPosition } from './types';
import { useGridStore } from './gridStore';
import { COLUMNS_SCHEMA_MAP, validateCell, sanitizeInputForColumn } from './schema';

export type EditorMode = 'quick' | 'full';

interface FloatingEditorProps {
  position: FloatingEditorPosition;
  column: GridColumnDef;
  mode?: EditorMode;
  initialSelection?: 'all' | 'end';
  onCommit: () => void;
  onCancel: () => void;
  onNavigateNext?: (direction: 'down' | 'right' | 'up' | 'left') => void;
}

export const FloatingEditor: React.FC<FloatingEditorProps> = ({
  position,
  column,
  mode = 'full',
  initialSelection = 'end',
  onCommit,
  onCancel,
  onNavigateNext
}) => {
  const editorValue = useGridStore(s => s.editorValue);
  const setEditorValue = useGridStore(s => s.setEditorValue);

  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  const schemaCol = useMemo(() => COLUMNS_SCHEMA_MAP.get(column.id), [column.id]);

  useEffect(() => {
    if (column.editor === 'select' && selectRef.current) {
      selectRef.current.focus();
    } else if (inputRef.current) {
      inputRef.current.focus();
      if (initialSelection === 'all') {
        inputRef.current.select();
      } else {
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }
  }, [column.editor, initialSelection]);

  // Validación reactiva en caliente usando el esquema SSOT
  const validationAlert = useMemo(() => {
    if (!schemaCol) return null;
    const editingCell = useGridStore.getState().editingCell;
    const rowId =
      editingCell?.rowId !== undefined
        ? editingCell.rowId
        : editingCell
        ? useGridStore.getState().rowIds[editingCell.rowIdx]
        : undefined;
    const row = rowId !== undefined ? useGridStore.getState().recordsById.get(rowId) || {} : {};
    return validateCell(editorValue, row, schemaCol);
  }, [editorValue, schemaCol]);

  const isSelect = column.editor === 'select' && column.options && column.options.length > 0;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const check = sanitizeInputForColumn(raw, schemaCol);
    if (check.valid) {
      setEditorValue(check.value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isSelect) {
      if (e.key === 'Enter') {
        e.preventDefault();
        onCommit();
        onNavigateNext?.(e.shiftKey ? 'up' : 'down');
      } else if (e.key === 'Tab') {
        e.preventDefault();
        onCommit();
        onNavigateNext?.(e.shiftKey ? 'left' : 'right');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      onCommit();
      onNavigateNext?.(e.shiftKey ? 'up' : 'down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onCommit();
      onNavigateNext?.(e.shiftKey ? 'left' : 'right');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (mode === 'quick') {
      // En modo rápido (type-to-edit / 1-click / Enter), las 4 flechas guardan y navegan a la celda adyacente
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        onCommit();
        onNavigateNext?.('down');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        onCommit();
        onNavigateNext?.('up');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onCommit();
        onNavigateNext?.('right');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onCommit();
        onNavigateNext?.('left');
      }
    } else if (mode === 'full') {
      // En modo completo (doble clic / F2), las flechas arriba y abajo se bloquean para proteger la sesión de edición
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
      }
      // Las flechas izquierda y derecha quedan libres para mover el cursor del texto
    }
  };

  // Estilos de borde y tooltip según severidad de alerta
  let borderColor = 'border-emerald-400';
  if (validationAlert?.type === 'CRÍTICO') {
    borderColor = 'border-rose-500 shadow-rose-950/50';
  } else if (validationAlert?.type === 'AVISO') {
    borderColor = 'border-amber-400 shadow-amber-950/50';
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
        height: `${position.height}px`,
        zIndex: 50
      }}
      className="animate-scale-up shadow-2xl"
    >
      {isSelect ? (
        <select
          ref={selectRef}
          data-testid="floating-select"
          value={editorValue ?? ''}
          onChange={(e) => setEditorValue(e.target.value)}
          onBlur={onCommit}
          onKeyDown={handleKeyDown}
          className={`w-full h-full bg-white dark:bg-navy-900 border-2 ${borderColor} text-gray-900 dark:text-slate-100 px-1 text-center text-xs font-mono rounded shadow-lg outline-none cursor-pointer`}
        >
          <option value="" className="bg-white dark:bg-navy-950 text-gray-500 dark:text-slate-400">—</option>
          {column.options!.map((opt) => (
            <option key={opt} value={opt} className="bg-white dark:bg-navy-950 text-gray-900 dark:text-slate-100">
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          ref={inputRef}
          data-testid="floating-input"
          type="text"
          value={editorValue ?? ''}
          onChange={handleInputChange}
          onBlur={onCommit}
          onKeyDown={handleKeyDown}
          className={`w-full h-full bg-white dark:bg-navy-900 border-2 ${borderColor} text-gray-900 dark:text-slate-100 px-2 text-center text-xs font-mono rounded shadow-lg outline-none ${column.style?.uppercase ? 'uppercase' : ''}`}
        />
      )}

      {/* Tooltip de feedback inmediato si hay alerta */}
      {validationAlert && (
        <div
          data-testid="floating-editor-tooltip"
          className={`absolute top-full left-0 mt-1 px-2 py-0.5 text-[11px] font-mono rounded shadow-xl whitespace-nowrap z-50 pointer-events-none ${
            validationAlert.type === 'CRÍTICO'
              ? 'bg-rose-50 dark:bg-rose-950/95 border border-rose-400 dark:border-rose-500 text-rose-900 dark:text-rose-200'
              : 'bg-amber-50 dark:bg-amber-950/95 border border-amber-400 dark:border-amber-500 text-amber-900 dark:text-amber-200'
          }`}
        >
          {validationAlert.type === 'CRÍTICO' ? '⚠️' : 'ℹ️'} {validationAlert.message}
        </div>
      )}
    </div>
  );
};
