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
  qaqcAlerts?: any[];
  onDeleteRow?: (idd: number) => void;
  height?: string | number;
}

// Array estático vacío para que TanStack Table NO procese las 10,000 filas
const EMPTY_DATA: any[] = [];
const EMPTY_STYLE: React.CSSProperties = {};

/**
 * Formateador de paridad numérica con v1:
 * - Enteros: idd, dia, anio -> enteros limpios
 * - Flotantes: max 2 decimales redondeados (evita 0.21999999999999886 -> 0.22, 4451.667525 -> 4451.67)
 * - Vacíos/nulos -> '—'
 */
export function formatDisplayValue(val: any, colDef?: GridColumnDef): string {
  if (val === null || val === undefined || val === '') return '—';

  if (colDef?.type === 'number') {
    const num = typeof val === 'number' ? val : parseFloat(String(val));
    if (isNaN(num)) return '—';

    // Campos enteros conocidos
    if (colDef.id === 'idd' || colDef.id === 'dia' || colDef.id === 'anio') {
      return String(Math.round(num));
    }

    // Campos decimales de geotecnia: redondeo a 2 decimales
    const rounded = parseFloat(num.toFixed(2));
    return String(rounded);
  }

  if (typeof val === 'number') {
    if (Number.isInteger(val)) return String(val);
    return String(parseFloat(val.toFixed(2)));
  }

  const s = String(val).trim();
  return s === '' ? '—' : s;
}

interface GridRowProps {
  virtualRow: { index: number; start: number; size: number };
  rowId: number;
  record: Record<string, any>;
  rowVersion: number;
  leafColumns: any[];
  activeColKey: string | null;
  qaqcRowStatus?: { hasCritical: boolean; hasWarning: boolean };
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
  qaqcRowStatus,
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
        const isStickyRight = meta?.isStickyRight;
        const leftOffset = meta?.stickyOffset ?? 0;
        const rightOffset = meta?.stickyRightOffset ?? 0;
        const isActive = activeColKey === colKey;
        const colDef: GridColumnDef | undefined = meta?.gridDef;

        // 1. Columna especial de acciones fijas
        if (colKey === 'acciones_col') {
          return (
            <td
              key={colKey}
              style={{ width: `${col.getSize()}px`, right: `${rightOffset}px` }}
              className="sticky z-10 bg-navy-950 text-center py-1 px-1 border-l-2 border-b border-navy-800"
            >
              <div className="flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInsertRowBelow(virtualRow.index);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-sky-400 hover:bg-sky-500/15"
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
                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/15"
                  title="Eliminar fila"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </td>
          );
        }

        // 2. Columna especial de Validación QA/QC
        if (colKey === 'qaqc_validacion') {
          const sondaje = record.sondaje;
          let badge = (
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
              Validado
            </span>
          );
          if (!sondaje) {
            badge = (
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20 uppercase tracking-wide">
                Sin Validar
              </span>
            );
          } else if (qaqcRowStatus?.hasCritical) {
            badge = (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wide">
                No Válido
              </span>
            );
          } else if (qaqcRowStatus?.hasWarning) {
            badge = (
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wide">
                Con Avisos
              </span>
            );
          }

          return (
            <td
              key={colKey}
              data-testid={`cell-${virtualRow.index}-${colKey}`}
              style={{ width: `${col.getSize()}px` }}
              className="px-2 py-1 text-center border-r border-navy-850/60 select-none"
            >
              {badge}
            </td>
          );
        }

        // 3. Renderizado de celdas estándar con formateo de paridad
        const cellVal = record[colKey];
        const displayVal = formatDisplayValue(cellVal, colDef);

        let stickyClasses = '';
        let stickyStyle: React.CSSProperties = EMPTY_STYLE;

        if (isStickyLeft) {
          stickyClasses = 'sticky z-10 bg-navy-950 font-mono font-bold border-r-2 border-navy-800 text-slate-200';
          stickyStyle = { left: `${leftOffset}px` };
        } else if (isStickyRight) {
          stickyClasses = 'sticky z-10 bg-navy-950 border-l-2 border-navy-800 text-slate-200';
          stickyStyle = { right: `${rightOffset}px` };
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
    prev.qaqcRowStatus === next.qaqcRowStatus &&
    prev.onInsertRowBelow === next.onInsertRowBelow &&
    prev.onDeleteRow === next.onDeleteRow
  );
});

export const VirtualizedGrid: React.FC<VirtualizedGridProps> = ({
  moduleName = 'registro_maestro',
  initialRecords,
  proyectosList = [],
  qaqcAlerts = [],
  onDeleteRow,
  height = '600px'
}) => {
  // 1. Store global zustand normalizado
  const rowIds = useGridStore(s => s.rowIds);
  const rowVersions = useGridStore(s => s.rowVersions);
  const activeCell = useGridStore(s => s.activeCell);
  const editingCell = useGridStore(s => s.editingCell);
  const isEditing = editingCell !== null;
  const setInitialRecords = useGridStore(s => s.setInitialRecords);
  const getRowById = useGridStore(s => s.getRowById);
  const setActiveCell = useGridStore(s => s.setActiveCell);
  const startEditing = useGridStore(s => s.startEditing);
  const cancelEditing = useGridStore(s => s.cancelEditing);
  const commitEditing = useGridStore(s => s.commitEditing);
  const insertRowBelow = useGridStore(s => s.insertRowBelow);
  const deleteRow = useGridStore(s => s.deleteRow);

  const containerRef = useRef<HTMLDivElement>(null);

  // Estados locales de ancho de columnas
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [editorPos, setEditorPos] = useState<FloatingEditorPosition | null>(null);

  // Mapa de alertas QA/QC por rowId para renderizado O(1)
  const qaqcStatusMap = useMemo(() => {
    const map = new Map<number, { hasCritical: boolean; hasWarning: boolean }>();
    if (!qaqcAlerts || qaqcAlerts.length === 0) return map;
    for (const alert of qaqcAlerts) {
      const cur = map.get(alert.idd) || { hasCritical: false, hasWarning: false };
      if (alert.severity === 'critical') cur.hasCritical = true;
      if (alert.severity === 'warning') cur.hasWarning = true;
      map.set(alert.idd, cur);
    }
    return map;
  }, [qaqcAlerts]);

  // Carga inicial al montar o cuando cambian los registros
  useEffect(() => {
    if (initialRecords && initialRecords.length > 0) {
      setInitialRecords(initialRecords);
    }
  }, [initialRecords, setInitialRecords]);

  // Obtener definiciones de columnas declarativas para este módulo
  const gridColumns = useMemo(() => {
    return getGridColumnsForModule(moduleName, {
      proyectos: proyectosList.map(p => p.nombre)
    });
  }, [moduleName, proyectosList]);

  // Construir columnas de TanStack Table agrupadas por 2 niveles
  const tanstackColumns = useMemo<ColumnDef<any, any>[]>(() => {
    const groupsMap = new Map<string, GridColumnDef[]>();
    for (const col of gridColumns) {
      const groupKey = col.group || 'General';
      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, []);
      }
      groupsMap.get(groupKey)!.push(col);
    }

    // Calcular offsets acumulados de pinned right
    const rightPinnedCols = gridColumns.filter(c => c.pinned === 'right');
    const rightOffsets: Record<string, number> = {};
    let rightAcc = 0;
    for (let i = rightPinnedCols.length - 1; i >= 0; i--) {
      const col = rightPinnedCols[i];
      rightOffsets[col.id] = rightAcc;
      rightAcc += (colWidths[col.id] || col.defaultWidth);
    }

    let leftAccumulator = 0;
    const result: ColumnDef<any, any>[] = [];

    for (const [groupTitle, cols] of groupsMap.entries()) {
      const childCols: ColumnDef<any, any>[] = cols.map(c => {
        const width = colWidths[c.id] || c.defaultWidth;
        const isStickyLeft = c.pinned === 'left';
        const isStickyRight = c.pinned === 'right';

        let offset = 0;
        let rightOffset = 0;
        if (isStickyLeft) {
          offset = leftAccumulator;
          leftAccumulator += width;
        } else if (isStickyRight) {
          rightOffset = rightOffsets[c.id] ?? 0;
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
            stickyRightOffset: rightOffset,
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

  // TanStack Table SOLO para cabeceras y orden
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
  const leafColumns = table.getAllLeafColumns();

  // Posicionar editor flotante sobre celda activa
  const openEditorForCell = useCallback((rowIdx: number, colKey: string) => {
    const rowId = rowIds[rowIdx];
    if (rowId === undefined) return;
    const colDef = gridColumns.find(c => c.id === colKey);
    if (!colDef || colDef.type === 'readonly' || colDef.editor === 'none') return;

    if (containerRef.current) {
      const cellEl = containerRef.current.querySelector(
        `[data-testid="cell-${rowIdx}-${colKey}"]`
      ) as HTMLElement;

      if (cellEl) {
        const cRect = containerRef.current.getBoundingClientRect();
        const cellRect = cellEl.getBoundingClientRect();

        setEditorPos({
          top: cellRect.top - cRect.top + containerRef.current.scrollTop,
          left: cellRect.left - cRect.left + containerRef.current.scrollLeft,
          width: cellRect.width,
          height: cellRect.height
        });
      }
    }

    startEditing({ rowIdx, colKey, rowId });
  }, [rowIds, gridColumns, startEditing]);

  const handleCellClick = useCallback((rowIdx: number, colKey: string) => {
    const rowId = rowIds[rowIdx];
    if (rowId === undefined) return;
    if (isEditing) {
      commitEditing();
      setEditorPos(null);
    }
    setActiveCell({ rowIdx, colKey, rowId });
  }, [rowIds, isEditing, commitEditing, setActiveCell]);

  const handleCellDoubleClick = useCallback((rowIdx: number, colKey: string) => {
    openEditorForCell(rowIdx, colKey);
  }, [openEditorForCell]);

  // Teclado: Navegación Excel
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!activeCell) return;
    const { rowIdx, colKey } = activeCell;
    const colIdx = leafColumns.findIndex(c => c.id === colKey);

    if (isEditing) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIdx < rowIds.length - 1) {
        const nextId = rowIds[rowIdx + 1];
        setActiveCell({ rowIdx: rowIdx + 1, colKey, rowId: nextId });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIdx > 0) {
        const nextId = rowIds[rowIdx - 1];
        setActiveCell({ rowIdx: rowIdx - 1, colKey, rowId: nextId });
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (colIdx < leafColumns.length - 1) {
        setActiveCell({ rowIdx, colKey: leafColumns[colIdx + 1].id, rowId: activeCell.rowId });
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (colIdx > 0) {
        setActiveCell({ rowIdx, colKey: leafColumns[colIdx - 1].id, rowId: activeCell.rowId });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openEditorForCell(rowIdx, colKey);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const dir = e.shiftKey ? -1 : 1;
      const nextIdx = colIdx + dir;
      if (nextIdx >= 0 && nextIdx < leafColumns.length) {
        setActiveCell({ rowIdx, colKey: leafColumns[nextIdx].id, rowId: activeCell.rowId });
      }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      openEditorForCell(rowIdx, colKey);
    }
  };

  const handleInsertRow = useCallback((rIdx: number) => {
    if (isEditing) {
      commitEditing();
      setEditorPos(null);
    }
    insertRowBelow(rIdx);
  }, [isEditing, commitEditing, insertRowBelow]);

  const handleDeleteRow = useCallback((rId: number) => {
    if (isEditing) {
      cancelEditing();
      setEditorPos(null);
    }
    deleteRow(rId);
    if (onDeleteRow) {
      onDeleteRow(rId);
    }
  }, [isEditing, cancelEditing, deleteRow, onDeleteRow]);

  const activeColumnDef = gridColumns.find(c => c.id === editingCell?.colKey);

  return (
    <div className="flex flex-col w-full h-full border border-navy-800 rounded-xl overflow-hidden bg-navy-950 select-none">
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
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
                  const rightOffset = meta?.stickyRightOffset ?? 0;

                  const colDef: GridColumnDef | undefined = meta?.gridDef;

                  let stickyClasses = 'bg-navy-900 z-20 sticky';
                  let styleObj: React.CSSProperties = {
                    top: gIdx === 0 ? 0 : 28,
                    height: gIdx === 0 ? 28 : 34,
                    width: `${header.getSize()}px`
                  };

                  if (isStickyLeft) {
                    stickyClasses += ' z-30 border-r-2 border-navy-800';
                    styleObj.left = `${leftOffset}px`;
                  } else if (isStickyRight) {
                    stickyClasses += ' z-30 border-l-2 border-navy-800';
                    styleObj.right = `${rightOffset}px`;
                  }

                  return (
                    <th
                      key={header.id}
                      data-col-id={header.id}
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
              const qaqcStatus = qaqcStatusMap.get(rowId);

              return (
                <GridRow
                  key={rowId}
                  virtualRow={virtualRow}
                  rowId={rowId}
                  record={rec}
                  rowVersion={rowVersion}
                  leafColumns={leafColumns}
                  activeColKey={activeColKey}
                  qaqcRowStatus={qaqcStatus}
                  onCellClick={handleCellClick}
                  onCellDoubleClick={handleCellDoubleClick}
                  onInsertRowBelow={handleInsertRow}
                  onDeleteRow={handleDeleteRow}
                />
              );
            })}
          </tbody>
        </table>

        {/* Editor flotante desacoplado */}
        {isEditing && editorPos && activeColumnDef && (
          <FloatingEditor
            position={editorPos}
            column={activeColumnDef}
            onCommit={() => {
              commitEditing();
              setEditorPos(null);
            }}
            onCancel={() => {
              cancelEditing();
              setEditorPos(null);
            }}
            onNavigateNext={(dir) => {
              if (!activeCell) return;
              const { rowIdx, colKey } = activeCell;
              const cIdx = leafColumns.findIndex(c => c.id === colKey);
              if (dir === 'down' && rowIdx < rowIds.length - 1) {
                const nxtId = rowIds[rowIdx + 1];
                setActiveCell({ rowIdx: rowIdx + 1, colKey, rowId: nxtId });
              } else if (dir === 'right' && cIdx < leafColumns.length - 1) {
                setActiveCell({ rowIdx, colKey: leafColumns[cIdx + 1].id, rowId: activeCell.rowId });
              } else if (dir === 'left' && cIdx > 0) {
                setActiveCell({ rowIdx, colKey: leafColumns[cIdx - 1].id, rowId: activeCell.rowId });
              }
            }}
          />
        )}
      </div>
    </div>
  );
};
