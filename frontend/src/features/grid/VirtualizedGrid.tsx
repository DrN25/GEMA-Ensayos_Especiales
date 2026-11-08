// frontend/src/features/grid/VirtualizedGrid.tsx
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender
} from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Plus, Trash2 } from 'lucide-react';
import type { GridColumnDef, FloatingEditorPosition } from './types';
import { getGridColumnsForModule } from './columnsDefinition';
import { useGridStore } from './gridStore';
import { FloatingEditor } from './FloatingEditor';

export interface VirtualizedGridProps {
  moduleName?: string;
  initialRecords?: Record<string, any>[];
  proyectosList?: { nombre: string }[];
  onDeleteRow?: (idd: number) => void;
  height?: string | number;
}

// Array estático vacío para que TanStack Table NO procese las 10,000 filas
const EMPTY_DATA: any[] = [];
const EMPTY_STYLE: React.CSSProperties = {};

interface GridRowProps {
  virtualRow: { index: number; start: number; size: number };
  rowId: number;
  record: Record<string, any>;
  rowVersion: number;
  leafColumns: any[];
  activeColKey: string | null;
  onCellClick: (rowIdx: number, colKey: string, e: React.MouseEvent<HTMLTableCellElement>) => void;
  onCellDoubleClick: (rowIdx: number, colKey: string, e: React.MouseEvent<HTMLTableCellElement>) => void;
  onInsertRowBelow: (rowIdx: number) => void;
  onDeleteRow: (rowId: number) => void;
}

const GridRow = React.memo<GridRowProps>(({
  virtualRow,
  rowId,
  record,
  leafColumns,
  activeColKey,
  onCellClick,
  onCellDoubleClick,
  onInsertRowBelow,
  onDeleteRow
}) => {
  const isEven = virtualRow.index % 2 === 0;
  const rowBg = isEven ? 'bg-navy-950/40' : 'bg-navy-900/20';

  return (
    <tr
      key={rowId}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `${virtualRow.size}px`,
        transform: `translateY(${virtualRow.start}px)`,
        display: 'table',
        tableLayout: 'fixed'
      }}
      className={`border-b border-navy-900/30 hover:bg-navy-900/50 ${rowBg}`}
    >
      {leafColumns.map(col => {
        const colKey = col.id;
        const meta: any = col.columnDef.meta;
        const isStickyLeft = meta?.isStickyLeft;
        const leftOffset = meta?.stickyOffset ?? 0;
        const isActive = activeColKey === colKey;

        // Columna especial de acciones fijas
        if (colKey === 'acciones_col') {
          return (
            <td
              key={colKey}
              style={{ width: `${col.getSize()}px`, right: 0 }}
              className="sticky z-10 bg-navy-950 text-center py-1 px-1 border-l-2 border-b border-navy-800"
            >
              <div className="flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInsertRowBelow(virtualRow.index);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-sky-400 hover:bg-sky-500/15 transition-all"
                  title="Insertar fila abajo"
                >
                  <Plus size={13} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteRow(rowId);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-all"
                  title="Eliminar fila"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </td>
          );
        }

        // Renderizado de celdas estándar
        const cellVal = record[colKey];
        const displayVal = cellVal !== undefined && cellVal !== null ? String(cellVal) : '—';

        let stickyClasses = '';
        let stickyStyle: React.CSSProperties = EMPTY_STYLE;

        if (isStickyLeft) {
          stickyClasses = 'sticky z-10 bg-navy-950 font-mono font-bold border-r-2 border-navy-800 text-slate-200';
          stickyStyle = { left: `${leftOffset}px` };
        }

        const activeRing = isActive ? 'ring-2 ring-sky-400 bg-sky-500/15 z-20' : '';

        return (
          <td
            key={colKey}
            data-testid={`cell-${virtualRow.index}-${colKey}`}
            onClick={(e) => onCellClick(virtualRow.index, colKey, e)}
            onDoubleClick={(e) => onCellDoubleClick(virtualRow.index, colKey, e)}
            style={{
              width: `${col.getSize()}px`,
              ...stickyStyle
            }}
            className={`px-2 py-1.5 text-center truncate cursor-cell border-r border-navy-850/60 select-none ${stickyClasses} ${activeRing}`}
          >
            {displayVal}
          </td>
        );
      })}
    </tr>
  );
}, (prev, next) => {
  return (
    prev.rowId === next.rowId &&
    prev.virtualRow.index === next.virtualRow.index &&
    prev.virtualRow.start === next.virtualRow.start &&
    prev.rowVersion === next.rowVersion &&
    prev.activeColKey === next.activeColKey &&
    prev.leafColumns === next.leafColumns &&
    prev.onInsertRowBelow === next.onInsertRowBelow &&
    prev.onDeleteRow === next.onDeleteRow
  );
});

export const VirtualizedGrid: React.FC<VirtualizedGridProps> = ({
  moduleName = 'registro_maestro',
  initialRecords,
  proyectosList,
  onDeleteRow,
  height = 'calc(100vh - 280px)'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Store normalizado
  const rowIds = useGridStore(s => s.rowIds);
  const rowVersions = useGridStore(s => s.rowVersions);
  const activeCell = useGridStore(s => s.activeCell);
  const editingCell = useGridStore(s => s.editingCell);
  const setInitialRecords = useGridStore(s => s.setInitialRecords);
  const setActiveCell = useGridStore(s => s.setActiveCell);
  const startEditing = useGridStore(s => s.startEditing);
  const commitEditing = useGridStore(s => s.commitEditing);
  const cancelEditing = useGridStore(s => s.cancelEditing);
  const insertRowBelow = useGridStore(s => s.insertRowBelow);
  const deleteRowInStore = useGridStore(s => s.deleteRow);
  const getRowById = useGridStore(s => s.getRowById);

  // Inicialización de registros al montar (evita reset si ya se cargaron para este módulo)
  const currentModuleRef = useRef(moduleName);
  useEffect(() => {
    if (initialRecords && initialRecords.length > 0) {
      if (currentModuleRef.current !== moduleName || rowIds.length === 0) {
        currentModuleRef.current = moduleName;
        setInitialRecords(initialRecords);
      }
    }
  }, [initialRecords, moduleName, rowIds.length, setInitialRecords]);

  // Proyectos formateados
  const proyectosOptions = useMemo(() => {
    return proyectosList?.map(p => p.nombre) || [];
  }, [proyectosList]);

  // Columnas enriquecidas para el módulo
  const gridColumns = useMemo(() => {
    return getGridColumnsForModule(moduleName, {
      proyectos: proyectosOptions
    });
  }, [moduleName, proyectosOptions]);

  // Estado visual de anchos de columna
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const c of gridColumns) {
      map[c.id] = c.defaultWidth;
    }
    return map;
  });

  // Mapear GridColumnDef a la jerarquía de 2 niveles de TanStack Table
  const tanstackColumns = useMemo<ColumnDef<any, any>[]>(() => {
    const groupsMap = new Map<string, GridColumnDef[]>();
    for (const col of gridColumns) {
      const g = col.group || 'General';
      if (!groupsMap.has(g)) groupsMap.set(g, []);
      groupsMap.get(g)!.push(col);
    }

    let leftAccumulator = 0;
    const result: ColumnDef<any, any>[] = [];

    for (const [groupTitle, cols] of groupsMap.entries()) {
      const childCols: ColumnDef<any, any>[] = cols.map(c => {
        const width = colWidths[c.id] || c.defaultWidth;
        const isStickyLeft = c.pinned === 'left';
        const isStickyRight = c.pinned === 'right';

        let offset = 0;
        if (isStickyLeft) {
          offset = leftAccumulator;
          leftAccumulator += width;
        }

        return {
          id: c.id,
          accessorKey: c.accessorKey,
          header: c.header,
          size: width,
          meta: {
            gridDef: c,
            pinned: c.pinned,
            stickyOffset: offset,
            isStickyLeft,
            isStickyRight
          }
        };
      });

      result.push({
        id: `group_${groupTitle}`,
        header: groupTitle,
        columns: childCols
      });
    }

    return result;
  }, [gridColumns, colWidths]);

  // TanStack Table SOLO para cabeceras y orden (datos vacíos para rendimiento)
  const table = useReactTable({
    data: EMPTY_DATA,
    columns: tanstackColumns,
    getCoreRowModel: getCoreRowModel()
  });

  // Virtualizador de filas sobre rowIds.length
  const rowVirtualizer = useVirtualizer({
    count: rowIds.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 36,
    overscan: 10
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0
    ? totalSize - virtualRows[virtualRows.length - 1].end
    : 0;

  // Posición del editor flotante
  const [editorPos, setEditorPos] = useState<FloatingEditorPosition | null>(null);

  const calculateEditorPosition = useCallback((tdElement: HTMLElement): FloatingEditorPosition => {
    const container = containerRef.current;
    if (!container) return { top: 0, left: 0, width: 100, height: 36 };

    const cRect = container.getBoundingClientRect();
    const tRect = tdElement.getBoundingClientRect();

    return {
      top: tRect.top - cRect.top + container.scrollTop,
      left: tRect.left - cRect.left + container.scrollLeft,
      width: tRect.width,
      height: tRect.height
    };
  }, []);

  // Manejo de clic en celda O(1) con useCallback estable
  const handleCellClick = useCallback((rowIdx: number, colKey: string, e: React.MouseEvent<HTMLTableCellElement>) => {
    if (useGridStore.getState().editingCell) {
      commitEditing();
    }
    setActiveCell({ rowIdx, colKey });
  }, [commitEditing, setActiveCell]);

  // Manejo de doble clic para abrir editor
  const handleCellDoubleClick = useCallback((rowIdx: number, colKey: string, e: React.MouseEvent<HTMLTableCellElement>) => {
    const colDef = gridColumns.find(c => c.id === colKey);
    if (!colDef || colDef.editor === 'none' || colDef.type === 'readonly') return;

    const pos = calculateEditorPosition(e.currentTarget);
    setEditorPos(pos);
    startEditing({ rowIdx, colKey });
  }, [gridColumns, calculateEditorPosition, startEditing]);

  const handleDeleteRowCallback = useCallback((rowId: number) => {
    if (onDeleteRow) {
      onDeleteRow(rowId);
    } else {
      deleteRowInStore(rowId);
    }
  }, [onDeleteRow, deleteRowInStore]);

  // Manejo de teclado cuando la tabla tiene foco
  const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!activeCell || editingCell) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      const colDef = gridColumns.find(c => c.id === activeCell.colKey);
      if (colDef && colDef.editor !== 'none' && colDef.type !== 'readonly') {
        const td = containerRef.current?.querySelector(`[data-testid="cell-${activeCell.rowIdx}-${activeCell.colKey}"]`) as HTMLElement;
        if (td) {
          setEditorPos(calculateEditorPosition(td));
          startEditing(activeCell);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (activeCell.rowIdx < rowIds.length - 1) {
        setActiveCell({ rowIdx: activeCell.rowIdx + 1, colKey: activeCell.colKey });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (activeCell.rowIdx > 0) {
        setActiveCell({ rowIdx: activeCell.rowIdx - 1, colKey: activeCell.colKey });
      }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const colDef = gridColumns.find(c => c.id === activeCell.colKey);
      if (colDef && colDef.editor !== 'none' && colDef.type !== 'readonly') {
        const td = containerRef.current?.querySelector(`[data-testid="cell-${activeCell.rowIdx}-${activeCell.colKey}"]`) as HTMLElement;
        if (td) {
          setEditorPos(calculateEditorPosition(td));
          startEditing(activeCell, e.key);
        }
      }
    }
  };

  const activeColDef = useMemo(() => {
    if (!editingCell) return undefined;
    return gridColumns.find(c => c.id === editingCell.colKey);
  }, [editingCell, gridColumns]);

  const leafColumns = useMemo(() => {
    return table.getAllLeafColumns();
  }, [table]);

  return (
    <div className="relative w-full border border-navy-800 rounded-xl bg-navy-950 shadow-2xl flex flex-col overflow-hidden">
      {/* Contenedor de scroll nativo UNIFICADO (cabecera y cuerpo sincrónicos al 100%) */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleContainerKeyDown}
        style={{ height, overflow: 'auto', position: 'relative' }}
        className="w-full focus:outline-none scrollbar-thin scrollbar-thumb-navy-700 scrollbar-track-navy-950"
      >
        <table className="w-full border-collapse text-xs select-none" style={{ tableLayout: 'fixed' }}>
          {/* Colgroup para ancho fijo O(1) */}
          <colgroup>
            {leafColumns.map(col => (
              <col key={col.id} style={{ width: `${colWidths[col.id] || col.getSize()}px` }} />
            ))}
          </colgroup>

          {/* Cabecera de 2 niveles con Sticky Top */}
          <thead className="bg-navy-900 border-b border-navy-800 text-slate-300">
            {table.getHeaderGroups().map((headerGroup, gIdx) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const meta: any = header.column.columnDef.meta;
                  const isStickyLeft = meta?.isStickyLeft;
                  const isStickyRight = meta?.isStickyRight;
                  const leftOffset = meta?.stickyOffset ?? 0;

                  const colDef: GridColumnDef | undefined = meta?.gridDef;

                  let stickyClasses = 'bg-navy-900 z-20 sticky';
                  let styleObj: React.CSSProperties = {
                    top: gIdx === 0 ? 0 : 28,
                    height: gIdx === 0 ? 28 : 34
                  };

                  if (isStickyLeft) {
                    stickyClasses += ' z-30 shadow-[2px_0_5px_rgba(0,0,0,0.4)]';
                    styleObj.left = `${leftOffset}px`;
                  } else if (isStickyRight) {
                    stickyClasses += ' z-30 shadow-[-2px_0_5px_rgba(0,0,0,0.4)]';
                    styleObj.right = 0;
                  }

                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      style={styleObj}
                      className={`px-2 py-1 border-r border-b border-navy-800 font-bold text-center truncate ${stickyClasses}`}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {colDef?.unit && (
                        <span className="text-[10px] text-sky-400 font-normal ml-1">({colDef.unit})</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* Cuerpo virtualizado */}
          <tbody
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: 'relative',
              display: 'block'
            }}
          >
            {virtualRows.map(virtualRow => {
              const rowId = rowIds[virtualRow.index];
              const rec = rowId !== undefined ? getRowById(rowId) : undefined;
              if (!rec) return null;

              const activeColKey = activeCell?.rowIdx === virtualRow.index ? activeCell.colKey : null;
              const rowVersion = rowVersions.get(rowId) || 1;

              return (
                <GridRow
                  key={rowId}
                  virtualRow={virtualRow}
                  rowId={rowId}
                  record={rec}
                  rowVersion={rowVersion}
                  leafColumns={leafColumns}
                  activeColKey={activeColKey}
                  onCellClick={handleCellClick}
                  onCellDoubleClick={handleCellDoubleClick}
                  onInsertRowBelow={insertRowBelow}
                  onDeleteRow={handleDeleteRowCallback}
                />
              );
            })}
          </tbody>
        </table>

        {/* Editor Flotante Único */}
        {editingCell && editorPos && activeColDef && (
          <FloatingEditor
            position={editorPos}
            column={activeColDef}
            onCommit={commitEditing}
            onCancel={cancelEditing}
            onNavigateNext={(direction) => {
              if (!activeCell) return;
              if (direction === 'down' && activeCell.rowIdx < rowIds.length - 1) {
                setActiveCell({ rowIdx: activeCell.rowIdx + 1, colKey: activeCell.colKey });
              } else if (direction === 'up' && activeCell.rowIdx > 0) {
                setActiveCell({ rowIdx: activeCell.rowIdx - 1, colKey: activeCell.colKey });
              }
            }}
          />
        )}
      </div>
    </div>
  );
};
