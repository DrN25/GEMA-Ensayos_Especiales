// frontend/src/features/grid/VirtualizedGrid.tsx
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender
} from '@tanstack/react-table';
import type { ColumnDef, Table, HeaderGroup, Header } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { GridColumnDef, FloatingEditorPosition, ColumnPinned } from './types';
import { getGridColumnsForModule } from './columnsDefinition';
import { useGridStore } from './gridStore';
import { FloatingEditor, type EditorMode } from './FloatingEditor';
import { getConvertibleLockInfo, COLUMNS_SCHEMA_MAP, sanitizeInputForColumn } from './schema';

export interface VirtualizedGridProps {
  moduleName?: string;
  initialRecords?: Record<string, any>[];
  proyectosList?: { nombre: string }[];
  qaqcAlerts?: any[];
  onDeleteRow?: (idd: number) => void;
  height?: string | number;
  pinnedConfig?: Record<string, ColumnPinned>;
  onColumnResize?: (colId: string, newWidth: number) => void;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  totalRecords?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  isLoading?: boolean;
}

// Array estático vacío para que TanStack Table NO procese las 10,000 filas
const EMPTY_DATA: any[] = [];
const EMPTY_STYLE: React.CSSProperties = {};
/**
 * Auto-scroll horizontal suave respetando el espacio de columnas fijas (sticky)
 */
function scrollCellIntoViewIfNeeded(container: HTMLElement, cell: HTMLElement, stickyLeft = 0, stickyRight = 0) {
  const containerRect = container.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();

  const minVisibleLeft = containerRect.left + stickyLeft;
  const maxVisibleRight = containerRect.right - stickyRight;

  if (cellRect.left < minVisibleLeft) {
    container.scrollLeft -= (minVisibleLeft - cellRect.left);
  } else if (cellRect.right > maxVisibleRight) {
    container.scrollLeft += (cellRect.right - maxVisibleRight);
  }
}


/**
 * Formateador de paridad numérica con v1:
 * - Enteros: idd, dia, anio -> enteros limpios
 * - Flotantes: max 2 decimales redondeados (evita 0.21999999999999886 -> 0.22, 4451.667525 -> 4451.67)
 * - Vacíos/nulos -> '—'
 */
export function formatDisplayValue(val: any, colDef?: GridColumnDef): string {
  if (val === null || val === undefined || val === '') return '—';

  // Delegar al formateador del esquema SSOT si existe
  if (colDef?.format) {
    const formatted = colDef.format(val);
    return formatted === '' ? '—' : formatted;
  }

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

// =========================================================================
// COMPONENTE HEADER AISLADO (MEMOIZADO: No re-renderiza con activeCell)
// =========================================================================
interface GridHeaderProps {
  headerGroups: HeaderGroup<any>[];
  colWidths: Record<string, number>;
  onResizeCommit: (colId: string, newWidth: number) => void;
}

const GridHeader = React.memo<GridHeaderProps>(({
  headerGroups,
  colWidths,
  onResizeCommit
}) => {
  // Manejador de Resize sin re-render de celdas mediante manipulación directa de DOM (<col> y <th>)
  const handleStartResize = useCallback((header: Header<any, unknown>, e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const colDef: GridColumnDef | undefined = (header.column.columnDef.meta as any)?.gridDef;
    const colId = header.id;
    const minW = colDef?.minWidth ?? 60;
    const maxW = colDef?.maxWidth ?? 600;
    const startX = e.clientX;
    const startWidth = colWidths[colId] || header.getSize();

    const handleEl = e.currentTarget;
    try {
      handleEl.setPointerCapture(e.pointerId);
    } catch (_) {}

    const colEl = document.getElementById(`grid-col-${colId}`);
    const thEl = document.querySelector(`th[data-col-id="${colId}"]`) as HTMLElement | null;

    let currentCalculatedWidth = startWidth;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const delta = moveEvt.clientX - startX;
      currentCalculatedWidth = Math.max(minW, Math.min(maxW, Math.round(startWidth + delta)));
      if (colEl) colEl.style.width = `${currentCalculatedWidth}px`;
      if (thEl) thEl.style.width = `${currentCalculatedWidth}px`;
    };

    const onPointerUp = (upEvt: PointerEvent) => {
      handleEl.removeEventListener('pointermove', onPointerMove);
      handleEl.removeEventListener('pointerup', onPointerUp);
      try {
        handleEl.releasePointerCapture(upEvt.pointerId);
      } catch (_) {}

      onResizeCommit(colId, currentCalculatedWidth);
    };

    handleEl.addEventListener('pointermove', onPointerMove);
    handleEl.addEventListener('pointerup', onPointerUp);
  }, [colWidths, onResizeCommit]);

  return (
    <thead className="bg-navy-900 border-b border-navy-800 text-slate-300">
      {headerGroups.map((headerGroup, gIdx) => (
        <tr key={headerGroup.id} className="h-7">
          {headerGroup.headers.map(header => {
            const meta: any = header.column.columnDef.meta;
            const isStickyLeft = meta?.isStickyLeft;
            const isStickyRight = meta?.isStickyRight;
            const leftOffset = meta?.stickyOffset ?? 0;
            const rightOffset = meta?.stickyRightOffset ?? 0;
            const colDef: GridColumnDef | undefined = meta?.gridDef;

            // Nivel 0 (Grupos) vs Nivel 1 (Columnas Hoja)
            const isGroupLevel = gIdx === 0;
            const headerHeight = isGroupLevel ? 28 : 34;
            const topOffset = isGroupLevel ? 0 : 28;

            let stickyClasses = 'bg-navy-900 sticky select-none';
            let styleObj: React.CSSProperties = {
              top: topOffset,
              height: headerHeight,
              width: `${header.getSize()}px`,
              minWidth: `${header.getSize()}px`,
              maxWidth: `${header.getSize()}px`
            };

            if (isStickyLeft) {
              stickyClasses += isGroupLevel ? ' z-40 border-r-2 border-navy-800' : ' z-30 border-r-2 border-navy-800';
              styleObj.left = `${leftOffset}px`;
            } else if (isStickyRight) {
              stickyClasses += isGroupLevel ? ' z-40 border-l-2 border-navy-800' : ' z-30 border-l-2 border-navy-800';
              styleObj.right = `${rightOffset}px`;
            } else {
              stickyClasses += ' z-20';
            }

            return (
              <th
                key={header.id}
                data-col-id={header.id}
                colSpan={header.colSpan}
                style={styleObj}
                className={`px-2 py-1 border-r border-b border-navy-800 font-bold text-center truncate relative ${stickyClasses}`}
              >
                <div className="flex items-center justify-center relative w-full h-full overflow-hidden">
                  <span className="truncate">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </span>
                  {colDef?.unit && (
                    <span className="text-[10px] text-sky-400 font-normal ml-1">({colDef.unit})</span>
                  )}
                </div>

                {/* Handle de redimensionamiento sólo en cabeceras de columnas hoja (Nivel 1) */}
                {!isGroupLevel && colDef && (
                  <div
                    data-testid={`resize-handle-${header.id}`}
                    onPointerDown={(e) => handleStartResize(header, e)}
                    className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize select-none hover:bg-sky-400/80 active:bg-sky-500 z-50 flex items-center justify-end group"
                    title={`Redimensionar columna ${colDef.header} (${colDef.minWidth ?? 60}px - ${colDef.maxWidth ?? 600}px)`}
                  >
                    <div className="w-[1.5px] h-full bg-navy-700/60 group-hover:bg-sky-300" />
                  </div>
                )}
              </th>
            );
          })}
        </tr>
      ))}
    </thead>
  );
});

// =========================================================================
// FILA DE DATOS MEMOIZADA
// =========================================================================
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
      style={{ height: `${virtualRow.size}px` }}
      className={`border-b border-navy-900/30 hover:bg-navy-900/50 group ${rowBg}`}
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
              style={{ right: `${rightOffset}px` }}
              className="sticky z-10 bg-navy-950 group-hover:bg-navy-900 text-center py-1 px-1 border-l-2 border-b border-navy-800"
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
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30 uppercase tracking-wide">
                No Válido
              </span>
            );
          } else if (qaqcRowStatus?.hasWarning) {
            badge = (
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase tracking-wide">
                Con Avisos
              </span>
            );
          }

          return (
            <td
              key={colKey}
              data-testid={`cell-${virtualRow.index}-${colKey}`}
              className="px-2 py-1 text-center border-r border-navy-850/60 select-none"
            >
              {badge}
            </td>
          );
        }

        // 3. Renderizado de celdas estándar con formateo de paridad
        const cellVal = record[colKey];
        const displayVal = formatDisplayValue(cellVal, colDef);
        const lockInfo = getConvertibleLockInfo(colKey, record);
        const isLocked = lockInfo.isReadOnly;

        let stickyClasses = '';
        let stickyStyle: React.CSSProperties = EMPTY_STYLE;

        if (isStickyLeft) {
          const isIdd = colKey === 'idd';
          stickyClasses = `sticky z-10 font-bold border-r-2 border-navy-800 bg-navy-950 group-hover:bg-navy-900 ${isIdd ? 'font-mono text-slate-400' : 'text-slate-200'}`;
          stickyStyle = { left: `${leftOffset}px` };
        } else if (isStickyRight) {
          stickyClasses = 'sticky z-10 border-l-2 border-navy-800 text-slate-200 bg-navy-950 group-hover:bg-navy-900';
          stickyStyle = { right: `${rightOffset}px` };
        }

        const activeRing = isActive
          ? isLocked
            ? 'ring-2 ring-inset ring-amber-400/80 z-20 font-semibold bg-amber-500/10'
            : 'ring-2 ring-inset ring-sky-400 z-20 font-semibold bg-sky-500/15'
          : '';

        const lockedClasses = isLocked
          ? 'bg-slate-900/60 dark:bg-slate-950/70 text-slate-500 cursor-not-allowed select-none opacity-80'
          : 'cursor-cell';

        return (
          <td
            key={colKey}
            data-testid={`cell-${virtualRow.index}-${colKey}`}
            data-col-key={colKey}
            data-row-idx={virtualRow.index}
            data-locked={isLocked ? 'true' : undefined}
            onClick={(e) => onCellClick(virtualRow.index, colKey, e)}
            onDoubleClick={(e) => onCellDoubleClick(virtualRow.index, colKey, e)}
            style={stickyStyle}
            title={isLocked ? lockInfo.message : undefined}
            className={`px-2 py-1.5 text-center truncate border-r border-navy-850/60 select-none relative ${stickyClasses} ${lockedClasses} ${activeRing}`}
          >
            {displayVal}
            {isActive && isLocked && (
              <div
                data-testid="convertible-locked-banner"
                className="absolute -top-7 left-1/2 -translate-x-1/2 z-40 px-2.5 py-0.5 rounded bg-navy-950 border border-amber-500/60 text-amber-300 text-[10px] font-bold whitespace-nowrap shadow-xl flex items-center gap-1.5 pointer-events-none animate-fade-in"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>{lockInfo.message}</span>
              </div>
            )}
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

// =========================================================================
// COMPONENTE PRINCIPAL VIRTUALIZED GRID
// =========================================================================
export const VirtualizedGrid: React.FC<VirtualizedGridProps> = ({
  moduleName = 'registro_maestro',
  initialRecords,
  proyectosList = [],
  qaqcAlerts = [],
  onDeleteRow,
  height = '600px',
  pinnedConfig,
  onColumnResize,
  page,
  pageSize,
  totalPages,
  totalRecords,
  onPageChange,
  onPageSizeChange,
  isLoading
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
  const updateCellValue = useGridStore(s => s.updateCellValue);

  const containerRef = useRef<HTMLDivElement>(null);

  // Estados locales de ancho de columnas
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [editorPos, setEditorPos] = useState<FloatingEditorPosition | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('full');
  const [editorSelection, setEditorSelection] = useState<'all' | 'end'>('end');

  // Mapa de alertas QA/QC por rowId para renderizado O(1)
  const qaqcStatusMap = useMemo(() => {
    const map = new Map<number, { hasCritical: boolean; hasWarning: boolean }>();
    if (!qaqcAlerts || qaqcAlerts.length === 0) return map;
    for (const alert of qaqcAlerts) {
      const cur = map.get(alert.idd) || { hasCritical: false, hasWarning: false };
      if (alert.type === 'CRÍTICO' || alert.severity === 'critical') cur.hasCritical = true;
      if (alert.type === 'AVISO' || alert.severity === 'warning') cur.hasWarning = true;
      map.set(alert.idd, cur);
    }
    return map;
  }, [qaqcAlerts]);

  // Carga y sincronización determinística (evita ciclos de renderizado infinito)
  const prevRecordsKeyRef = useRef<string>('');
  useEffect(() => {
    if (!initialRecords) return;
    const firstId = initialRecords[0]?.idd ?? '';
    const lastId = initialRecords[initialRecords.length - 1]?.idd ?? '';
    const key = `${moduleName}:${initialRecords.length}:${firstId}:${lastId}`;
    if (prevRecordsKeyRef.current !== key) {
      prevRecordsKeyRef.current = key;
      setInitialRecords(initialRecords);
    }
  }, [initialRecords, moduleName, setInitialRecords]);

  // Obtener definiciones de columnas declarativas para este módulo
  const gridColumns = useMemo(() => {
    return getGridColumnsForModule(moduleName, {
      proyectos: proyectosList.map(p => p.nombre)
    });
  }, [moduleName, proyectosList]);

  // Construir columnas de TanStack Table agrupadas por 2 niveles con sticky offsets
  const tanstackColumns = useMemo<ColumnDef<any, any>[]>(() => {
    const groupsMap = new Map<string, GridColumnDef[]>();
    for (const col of gridColumns) {
      const groupKey = col.group || 'General';
      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, []);
      }
      groupsMap.get(groupKey)!.push(col);
    }

    // Calcular offsets acumulados de pinned right respetando overrides
    const rightPinnedCols = gridColumns.filter(c => (pinnedConfig?.[c.id] ?? c.pinned) === 'right');
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
      let groupLeftStart = leftAccumulator;
      let groupHasStickyLeft = false;
      let groupHasStickyRight = false;
      let groupRightOffsetMin = Infinity;

      const childCols: ColumnDef<any, any>[] = cols.map(c => {
        const width = colWidths[c.id] || c.defaultWidth;
        const pinSetting = pinnedConfig?.[c.id] ?? c.pinned;
        const isStickyLeft = pinSetting === 'left';
        const isStickyRight = pinSetting === 'right';

        let offset = 0;
        let rightOffset = 0;
        if (isStickyLeft) {
          offset = leftAccumulator;
          leftAccumulator += width;
          groupHasStickyLeft = true;
        } else if (isStickyRight) {
          rightOffset = rightOffsets[c.id] ?? 0;
          groupHasStickyRight = true;
          if (rightOffset < groupRightOffsetMin) groupRightOffsetMin = rightOffset;
        }

        return {
          id: c.id,
          accessorKey: c.accessorKey,
          header: c.header,
          size: width,
          meta: {
            gridDef: c,
            pinned: pinSetting,
            stickyOffset: offset,
            stickyRightOffset: rightOffset,
            isStickyLeft,
            isStickyRight
          }
        };
      });

      // El grupo es sticky left si todos sus hijos son sticky left
      const allStickyLeft = childCols.length > 0 && childCols.every(c => (c.meta as any)?.isStickyLeft);
      // El grupo es sticky right si todos sus hijos son sticky right
      const allStickyRight = childCols.length > 0 && childCols.every(c => (c.meta as any)?.isStickyRight);

      result.push({
        id: `group_${groupTitle}`,
        header: groupTitle,
        columns: childCols,
        meta: {
          isGroup: true,
          isStickyLeft: allStickyLeft,
          isStickyRight: allStickyRight,
          stickyOffset: allStickyLeft ? groupLeftStart : undefined,
          stickyRightOffset: allStickyRight ? (groupRightOffsetMin === Infinity ? 0 : groupRightOffsetMin) : undefined,
          groupTitle
        }
      });
    }

    return result;
  }, [gridColumns, colWidths, pinnedConfig]);

  // TanStack Table SOLO para cabeceras y estructura de columnas
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
  const totalVirtualSize = rowVirtualizer.getTotalSize();
  const virtualPaddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const virtualPaddingBottom = virtualRows.length > 0
    ? totalVirtualSize - virtualRows[virtualRows.length - 1].end
    : 0;

  const leafColumns = useMemo(() => table.getAllLeafColumns(), [table]);
  // Anchos acumulados de columnas fijas (sticky) para auto-scroll inteligente
  const stickyLeftWidth = useMemo(() => {
    return gridColumns
      .filter(c => (pinnedConfig?.[c.id] ?? c.pinned) === 'left')
      .reduce((acc, c) => acc + (colWidths[c.id] || c.defaultWidth), 0);
  }, [gridColumns, pinnedConfig, colWidths]);

  const stickyRightWidth = useMemo(() => {
    return gridColumns
      .filter(c => (pinnedConfig?.[c.id] ?? c.pinned) === 'right')
      .reduce((acc, c) => acc + (colWidths[c.id] || c.defaultWidth), 0);
  }, [gridColumns, pinnedConfig, colWidths]);


  // Commit de Resize persistente en estado
  const handleResizeCommit = useCallback((colId: string, newWidth: number) => {
    setColWidths(prev => ({
      ...prev,
      [colId]: newWidth
    }));
    onColumnResize?.(colId, newWidth);
  }, [onColumnResize]);

  // Manejo de Clic y Doble Clic para Edición Flotante
  const openEditorForCell = useCallback((
    rowIdx: number,
    colKey: string,
    mode: EditorMode = 'full',
    initialValue?: any,
    selection: 'all' | 'end' = 'end'
  ) => {
    const colDef = gridColumns.find(c => c.id === colKey);
    if (!colDef || colDef.editor === 'none' || colDef.type === 'readonly') return;

    const rowId = rowIds[rowIdx];
    if (rowId === undefined) return;
    const rec = getRowById(rowId);
    if (!rec) return;

    // Bloqueo configurable de pares convertibles
    const lockInfo = getConvertibleLockInfo(colKey, rec);
    if (lockInfo.isReadOnly) return;

    if (containerRef.current) {
      const cellEl = containerRef.current.querySelector(
        `[data-testid="cell-${rowIdx}-${colKey}"]`
      );

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

    setEditorMode(mode);
    setEditorSelection(selection);
    startEditing({ rowIdx, colKey, rowId }, initialValue);
  }, [rowIds, gridColumns, getRowById, startEditing]);

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
    openEditorForCell(rowIdx, colKey, 'full', undefined, 'end');
  }, [openEditorForCell]);

  const isCellEditable = useCallback((rowIdx: number, colKey: string): boolean => {
    if (colKey === 'acciones_col' || colKey === 'qaqc_validacion') return false;
    const colDef = gridColumns.find(c => c.id === colKey);
    if (!colDef || colDef.editor === 'none' || colDef.type === 'readonly') return false;

    const rowId = rowIds[rowIdx];
    if (rowId === undefined) return false;
    const rec = getRowById(rowId);
    if (!rec) return false;

    const lockInfo = getConvertibleLockInfo(colKey, rec);
    if (lockInfo.isReadOnly) return false;

    return true;
  }, [gridColumns, rowIds, getRowById]);

  // Búsqueda determinística O(1) de la siguiente celda editable con wrap de filas
  const findNextEditableCell = useCallback((
    startRowIdx: number,
    startColKey: string,
    direction: 'forward' | 'backward'
  ): { rowIdx: number; colKey: string; rowId: number } | null => {
    const leafCols = leafColumns.filter(c => c.id !== 'acciones_col' && c.id !== 'qaqc_validacion');
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
        if (r >= rowIds.length) return null; // Fin de la tabla
      } else if (c < 0) {
        c = leafCols.length - 1;
        r -= 1;
        if (r < 0) return null; // Inicio de la tabla
      }

      const colCandidate = leafCols[c].id;
      if (isCellEditable(r, colCandidate)) {
        return { rowIdx: r, colKey: colCandidate, rowId: rowIds[r] };
      }

      steps++;
    }

    return null;
  }, [leafColumns, rowIds, isCellEditable]);

  // Navegación fluida entre celdas al presionar Tab / Enter / Flechas desde el editor
  const handleNavigateNext = useCallback((direction: 'down' | 'right' | 'up' | 'left') => {
    setEditorPos(null);
    containerRef.current?.focus();

    if (!activeCell) return;
    const { rowIdx, colKey } = activeCell;
    const colIdx = leafColumns.findIndex(c => c.id === colKey);

    if (direction === 'down') {
      if (rowIdx < rowIds.length - 1) {
        const nextId = rowIds[rowIdx + 1];
        setActiveCell({ rowIdx: rowIdx + 1, colKey, rowId: nextId });
      }
    } else if (direction === 'up') {
      if (rowIdx > 0) {
        const nextId = rowIds[rowIdx - 1];
        setActiveCell({ rowIdx: rowIdx - 1, colKey, rowId: nextId });
      }
    } else if (direction === 'right') {
      const next = findNextEditableCell(rowIdx, colKey, 'forward');
      if (next) {
        setActiveCell(next);
      } else if (colIdx < leafColumns.length - 1) {
        const nextCol = leafColumns[colIdx + 1].id;
        if (nextCol !== 'acciones_col') {
          setActiveCell({ rowIdx, colKey: nextCol, rowId: activeCell.rowId });
        }
      }
    } else if (direction === 'left') {
      const prev = findNextEditableCell(rowIdx, colKey, 'backward');
      if (prev) {
        setActiveCell(prev);
      } else if (colIdx > 0) {
        setActiveCell({ rowIdx, colKey: leafColumns[colIdx - 1].id, rowId: activeCell.rowId });
      }
    }
  }, [activeCell, rowIds, leafColumns, findNextEditableCell, setActiveCell]);

  // Auto-scroll al cambiar activeCell (vertical con virtualizer y horizontal con offset de sticky columns)
  useEffect(() => {
    if (activeCell && activeCell.rowIdx !== undefined) {
      rowVirtualizer.scrollToIndex(activeCell.rowIdx, { align: 'auto' });
      requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const cellEl = containerRef.current.querySelector(
          `[data-testid="cell-${activeCell.rowIdx}-${activeCell.colKey}"]`
        ) as HTMLElement | null;
        if (cellEl) {
          scrollCellIntoViewIfNeeded(containerRef.current, cellEl, stickyLeftWidth, stickyRightWidth);
        }
      });
    }
  }, [activeCell?.rowIdx, activeCell?.colKey, rowVirtualizer, stickyLeftWidth, stickyRightWidth]);

  // Teclado: Navegación estilo Excel
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
        const nextCol = leafColumns[colIdx + 1].id;
        if (nextCol !== 'acciones_col') {
          setActiveCell({ rowIdx, colKey: nextCol, rowId: activeCell.rowId });
        }
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (colIdx > 0) {
        setActiveCell({ rowIdx, colKey: leafColumns[colIdx - 1].id, rowId: activeCell.rowId });
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const next = findNextEditableCell(rowIdx, colKey, e.shiftKey ? 'backward' : 'forward');
      if (next) {
        setActiveCell(next);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openEditorForCell(rowIdx, colKey, 'quick', undefined, 'all');
    } else if (e.key === 'F2') {
      e.preventDefault();
      openEditorForCell(rowIdx, colKey, 'full', undefined, 'end');
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      const rowId = rowIds[rowIdx];
      if (rowId !== undefined) {
        const rec = getRowById(rowId);
        if (rec) {
          const lockInfo = getConvertibleLockInfo(colKey, rec);
          if (!lockInfo.isReadOnly) {
            const colDef = gridColumns.find(c => c.id === colKey);
            if (colDef && colDef.editor !== 'none' && colDef.type !== 'readonly') {
              e.preventDefault();
              updateCellValue(rowIdx, colKey, null);
            }
          }
        }
      }
    } else if (
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.metaKey &&
      e.key !== ' '
    ) {
      // Type-to-edit directo estilo Excel: si la celda es editable y el caracter inicial es válido para el tipo de columna
      const colDef = gridColumns.find(c => c.id === colKey);
      if (colDef && colDef.editor !== 'none' && colDef.type !== 'readonly') {
        const rowId = rowIds[rowIdx];
        const rec = rowId !== undefined ? getRowById(rowId) : undefined;
        const isLocked = rec ? getConvertibleLockInfo(colKey, rec).isReadOnly : false;
        if (!isLocked) {
          const schemaCol = COLUMNS_SCHEMA_MAP.get(colKey);
          const check = sanitizeInputForColumn(e.key, schemaCol);
          if (check.valid) {
            e.preventDefault();
            openEditorForCell(rowIdx, colKey, 'quick', check.value, 'end');
          }
        }
      }
    }
  };

  const handleInsertRow = useCallback((rowIdx: number) => {
    insertRowBelow(rowIdx);
  }, [insertRowBelow]);

  const handleDeleteRow = useCallback((rowId: number) => {
    if (onDeleteRow) onDeleteRow(rowId);
    else deleteRow(rowId);
  }, [onDeleteRow, deleteRow]);

  // Tooltip único por delegación de eventos (elimina 1.750 atributos title del DOM)
  const [delegatedTooltip, setDelegatedTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const handleContainerPointerOver = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('td[data-col-key]');
    if (!target) return;
    const colKey = target.getAttribute('data-col-key');
    const rowIdxStr = target.getAttribute('data-row-idx');
    if (!colKey || rowIdxStr === null) return;

    const rowIdx = parseInt(rowIdxStr, 10);
    const rowId = rowIds[rowIdx];
    const rec = rowId !== undefined ? getRowById(rowId) : undefined;
    if (!rec) return;

    const colDef = gridColumns.find(c => c.id === colKey);
    const cellVal = rec[colKey];
    const lockInfo = getConvertibleLockInfo(colKey, rec);

    let tooltipText: string;
    if (lockInfo.isReadOnly) {
      tooltipText = [
        `Valor almacenado: ${cellVal !== null && cellVal !== undefined && cellVal !== '' ? cellVal : '—'}${colDef?.unit ? ` ${colDef.unit}` : ''}`,
        `🔒 ${lockInfo.message}`
      ].join('\n');
    } else {
      const unitHint = colDef?.hint || (colDef?.unit ? `Registrar en ${colDef.unit}` : '');
      tooltipText = [
        `Valor almacenado: ${cellVal !== null && cellVal !== undefined && cellVal !== '' ? cellVal : '—'}${colDef?.unit ? ` ${colDef.unit}` : ''}`,
        unitHint ? `• ${unitHint}` : null,
        colDef?.displayHint ? `• ${colDef.displayHint}` : null
      ].filter(Boolean).join('\n');
    }

    setDelegatedTooltip({ x: e.clientX, y: e.clientY, text: tooltipText });
  }, [rowIds, getRowById, gridColumns]);

  const handleContainerPointerOut = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (!related || !related.closest('td[data-col-key]')) {
      setDelegatedTooltip(null);
    }
  }, []);

  const activeColumnDef = editingCell ? gridColumns.find(c => c.id === editingCell.colKey) : undefined;
  const headerGroups = useMemo(() => table.getHeaderGroups(), [table]);

  return (
    <div className="relative w-full border border-navy-800 rounded-lg overflow-hidden bg-navy-950 font-sans shadow-lg">
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerOver={handleContainerPointerOver}
        onPointerOut={handleContainerPointerOut}
        style={{ height, overflow: 'auto', position: 'relative' }}
        className="w-full focus:outline-none scrollbar-thin scrollbar-thumb-navy-700 scrollbar-track-navy-950"
      >
        <table className="border-collapse text-xs select-none" style={{ tableLayout: 'fixed', width: 'max-content' }}>
          {/* Colgroup para ancho fijo O(1) gobernado por el navegador */}
          <colgroup>
            {leafColumns.map(col => (
              <col
                key={col.id}
                id={`grid-col-${col.id}`}
                style={{ width: `${colWidths[col.id] || col.getSize()}px` }}
              />
            ))}
          </colgroup>

          {/* Cabecera aislada de 2 niveles (Sticky Top, Sticky Groups y Resize) */}
          <GridHeader
            headerGroups={headerGroups}
            colWidths={colWidths}
            onResizeCommit={handleResizeCommit}
          />

          {/* Cuerpo virtualizado nativo con filas espaciadoras */}
          <tbody>
            {virtualPaddingTop > 0 && (
              <tr style={{ height: `${virtualPaddingTop}px` }}>
                <td
                  colSpan={leafColumns.length}
                  style={{ height: `${virtualPaddingTop}px`, padding: 0, border: 0 }}
                />
              </tr>
            )}

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

            {virtualPaddingBottom > 0 && (
              <tr style={{ height: `${virtualPaddingBottom}px` }}>
                <td
                  colSpan={leafColumns.length}
                  style={{ height: `${virtualPaddingBottom}px`, padding: 0, border: 0 }}
                />
              </tr>
            )}
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
          />
        )}

        {/* Tooltip flotante único por delegación de eventos */}
        {delegatedTooltip && (
          <div
            data-testid="grid-delegated-tooltip"
            style={{ left: `${delegatedTooltip.x + 12}px`, top: `${delegatedTooltip.y + 16}px` }}
            className="fixed pointer-events-none z-50 px-2.5 py-1.5 rounded-lg bg-navy-950/95 border border-sky-500/40 text-slate-200 text-xs shadow-2xl whitespace-pre-line backdrop-blur-sm"
          >
            {delegatedTooltip.text}
          </div>
        )}
      </div>

      {/* Barra de Paginación Rápida Restaurada */}
      <div
        data-testid="grid-pagination-bar"
        className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-navy-950/90 border-t border-navy-800 text-xs text-slate-400 gap-3 select-none"
      >
        <div className="flex items-center gap-3">
          <span>
            Página <span className="font-bold text-slate-200">{page ?? 1}</span> de{' '}
            <span className="font-bold text-slate-200">{totalPages ?? 1}</span>
            <span className="text-slate-500 ml-1.5 font-mono">
              ({(totalRecords !== undefined ? totalRecords : rowIds.length).toLocaleString()} registros totales)
            </span>
          </span>

          {onPageSizeChange && (
            <div className="flex items-center gap-1.5 pl-3 border-l border-navy-800">
              <span className="text-slate-500 text-[11px]">Mostrar:</span>
              <select
                value={pageSize ?? 50}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="bg-navy-900 border border-navy-800 rounded px-2 py-0.5 text-xs text-slate-300 outline-none cursor-pointer"
              >
                <option value={25}>25 filas</option>
                <option value={50}>50 filas</option>
                <option value={100}>100 filas</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange && onPageChange(Math.max(1, (page ?? 1) - 1))}
            disabled={(page ?? 1) <= 1 || !onPageChange || isLoading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-navy-800 bg-navy-900 text-slate-300 hover:bg-navy-800 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none font-bold"
          >
            <ChevronLeft size={14} />
            <span>Anterior</span>
          </button>
          <button
            onClick={() => onPageChange && onPageChange(Math.min((totalPages ?? 1), (page ?? 1) + 1))}
            disabled={(page ?? 1) >= (totalPages ?? 1) || !onPageChange || isLoading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-navy-800 bg-navy-900 text-slate-300 hover:bg-navy-800 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none font-bold"
          >
            <span>Siguiente</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
