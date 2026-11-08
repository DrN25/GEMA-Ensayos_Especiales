// frontend/src/features/grid/FloatingEditor.tsx
import React, { useEffect, useRef } from 'react';
import type { GridColumnDef, FloatingEditorPosition } from './types';
import { useGridStore } from './gridStore';

interface FloatingEditorProps {
  position: FloatingEditorPosition;
  column: GridColumnDef;
  onCommit: () => void;
  onCancel: () => void;
  onNavigateNext?: (direction: 'down' | 'right' | 'up' | 'left') => void;
}

export const FloatingEditor: React.FC<FloatingEditorProps> = ({
  position,
  column,
  onCommit,
  onCancel,
  onNavigateNext
}) => {
  const editorValue = useGridStore(s => s.editorValue);
  const setEditorValue = useGridStore(s => s.setEditorValue);

  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (column.editor === 'select' && selectRef.current) {
      selectRef.current.focus();
    } else if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [column.editor]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommit();
      onNavigateNext?.('down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onCommit();
      onNavigateNext?.(e.shiftKey ? 'left' : 'right');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const isSelect = column.editor === 'select' && column.options && column.options.length > 0;

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
          className="w-full h-full bg-navy-900 border-2 border-emerald-400 text-slate-100 px-1 text-center text-xs font-mono rounded shadow-lg outline-none cursor-pointer"
        >
          <option value="" className="bg-navy-950 text-slate-500">—</option>
          {column.options!.map((opt) => (
            <option key={opt} value={opt} className="bg-navy-950 text-slate-200">
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          ref={inputRef}
          data-testid="floating-input"
          type={column.type === 'number' ? 'text' : 'text'}
          value={editorValue ?? ''}
          onChange={(e) => setEditorValue(e.target.value)}
          onBlur={onCommit}
          onKeyDown={handleKeyDown}
          className="w-full h-full bg-navy-900 border-2 border-emerald-400 text-slate-100 px-2 text-center text-xs font-mono rounded shadow-lg outline-none"
        />
      )}
    </div>
  );
};

