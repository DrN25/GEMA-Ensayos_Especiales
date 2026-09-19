import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { ColumnDef } from '../utils/columnsConfig';
import { getColumnsForModule, COLUMNS_CONFIG, clampValue } from '../utils/columnsConfig';
import { Plus, Trash2 } from 'lucide-react';
import type { QAQCAlert } from '../utils/qaqcValidator';

interface DataGridProps {
  moduleName: string;
  records: Record<string, any>[];
  setRecords: React.Dispatch<React.SetStateAction<Record<string, any>[]>>;
  qaqcAlerts: QAQCAlert[];
  onAddRow: () => void;
  onDeleteRow: (idd: number) => void;
  onInsertRowBelow: (index: number) => void;
  highlightedCell: { idd: number; field: string } | null;
  clearHighlight: () => void;
  proyectosList?: { nombre: string }[];
}

export default function DataGrid({
  moduleName,
  records,
  setRecords,
  qaqcAlerts,
  onAddRow,
  onDeleteRow,
  onInsertRowBelow,
  highlightedCell,
  clearHighlight,
  proyectosList = []
}: DataGridProps) {
  const isMasterView = moduleName === 'registro_maestro';
  const baseCols = getColumnsForModule(moduleName);

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('sigeg_col_widths_v2');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return {
      idd: 80,
      sondaje: 130,
      codigo_muestra: 170,
      laboratorio: 100,
      dia: 70,
      mes: 90,
      anio: 80,
      proyecto: 120,
      desde: 90,
      hasta: 90,
      longitud_muestra: 140,
      este: 100,
      norte: 100,
      elevacion: 100,
      sectores: 110,
      lito1: 90,
      lito2: 90,
      lito3: 90,
      tipo_ensayo: 150,
      ucs_diametro: 120,
      ucs_carga_rotura: 120,
      ucs_resistencia: 140,
      ucs_resistencia_calculada: 140,
      ucs_rotura: 100,
      elasticas_modulo_young: 130,
      elasticas_poisson: 110,
      traccion_carga_promedio: 140,
      traccion_resistencia_kgcm2: 140,
      traccion_vacia_28: 120,
      traccion_resistencia_mpa: 140,
      corte_tipo_fractura: 130,
      corte_area: 120,
      corte_esf_normal_kpa: 120,
      corte_esf_corte_kpa: 120,
      corte_esf_normal_mpa: 130,
      corte_esf_corte_mpa: 130,
      corte_cohesion_mpa: 110,
      corte_angulo_friccion: 110,
      triaxial_carga_confinamiento: 140,
      triaxial_esfuerzo_maximo: 130,
      triaxial_resistencia_mpa: 120,
      triaxial_mi: 100,
      triaxial_cohesion_mpa: 110,
      triaxial_angulo_friccion: 110,
      triaxial_rotura: 100,
      prop_peso_unitario_geometrico: 160,
      observacion: 180,
      campana: 150
    };
  });

  const saveWidths = (widths: Record<string, number>) => {
    setColWidths(widths);
    localStorage.setItem('sigeg_col_widths_v2', JSON.stringify(widths));
  };

  const resizeColName = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  const handleMouseDown = (e: React.MouseEvent, dbName: string) => {
    e.preventDefault();
    resizeColName.current = dbName;
    startX.current = e.pageX;
    startWidth.current = colWidths[dbName] || 100;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizeColName.current) return;
    const diff = e.pageX - startX.current;
    const newWidth = Math.max(50, Math.min(600, startWidth.current + diff));
    saveWidths({ ...colWidths, [resizeColName.current]: newWidth });
  };

  const handleMouseUp = () => {
    resizeColName.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    if (highlightedCell !== null) {
      const cellId = `cell-${highlightedCell.idd}-${highlightedCell.field}`;
      const element = document.getElementById(cellId);
      if (element) {
        element.focus();
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-4', 'ring-indigo-500', 'animate-pulse');
        setTimeout(() => {
          element.classList.remove('ring-4', 'ring-indigo-500', 'animate-pulse');
        }, 2000);
      }
      clearHighlight();
    }
  }, [highlightedCell, clearHighlight]);

  const handlePltNumberLimit = (value: string, type: 'int' | 'float'): string => {
    let cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    if (type === 'int') return parts[0];
    if (parts[1] && parts[1].length > 2) {
      cleaned = parts[0] + '.' + parts[1].slice(0, 2);
    }
    return cleaned;
  };

  const handleBlur = (idd: number, dbName: string, value: string, col: ColumnDef) => {
    if (value === '') return;
    const clamped = clampValue(dbName, value);
    handleCellChange(idd, dbName, clamped);
  };

  const handleCellChange = (idd: number, dbName: string, value: any) => {
    setRecords((prevRecords) =>
      prevRecords.map((rec) => {
        if (rec.idd !== idd) return rec;
        const updated = { ...rec, [dbName]: value };

        // Autogeneración del código de muestra para el flujo interactivo
        if (dbName === 'sondaje') {
          const oldDefault = rec.sondaje ? `${rec.sondaje}-UCS-M${String(rec.idd).padStart(2, '0')}` : '';
          if (!rec.codigo_muestra || rec.codigo_muestra === oldDefault) {
            updated.codigo_muestra = value ? `${value}-UCS-M${String(rec.idd).padStart(2, '0')}` : '';
          }
        }

        const desde = updated.desde !== undefined && updated.desde !== null && updated.desde !== '' ? Number(updated.desde) : null;
        const hasta = updated.hasta !== undefined && updated.hasta !== null && updated.hasta !== '' ? Number(updated.hasta) : null;
        if (desde !== null && hasta !== null) {
          updated.longitud_muestra = parseFloat((hasta - desde).toFixed(2));
        } else {
          updated.longitud_muestra = '';
        }

        return updated;
      })
    );
  };

  const getCellBorderClass = (idd: number, dbName: string) => {
    const alert = qaqcAlerts.find(a => a.idd === idd && a.field === dbName);
    if (!alert) return "border border-slate-700/60 dark:border-navy-800/80";
    return alert.type === 'CRÍTICO'
      ? "outline outline-1 outline-offset-[-2px] outline-dashed outline-rose-500/80 bg-rose-500/5 animate-pulse"
      : "outline outline-1 outline-offset-[-2px] outline-dashed outline-amber-500/80 bg-amber-500/5";
  };

  const getQaqcValidationBadge = (idd: number, rec: any) => {
    const rowAlerts = qaqcAlerts.filter(a => a.idd === idd);
    if (!rec.sondaje) {
      return (
        <span className="px-2.5 py-1 rounded text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20 uppercase tracking-wide">
          Sin Validar
        </span>
      );
    }
    const hasCritical = rowAlerts.some(a => a.type === 'CRÍTICO');
    if (hasCritical) {
      return (
        <span className="px-2.5 py-1 rounded text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wide animate-pulse">
          No Válido
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
        Validado
      </span>
    );
  };

  const colStyles = useMemo(() => {
    const s: Record<string, string> = {};
    Object.keys(colWidths).forEach(k => {
      s[k] = `${colWidths[k]}px`;
    });
    return s;
  }, [colWidths]);

  // Filtrado de columnas visibles para evitar duplicaciones
  const colsToRender = useMemo(() => {
    if (isMasterView) {
      return COLUMNS_CONFIG.filter(col =>
        col.module !== 'common' &&
        col.module !== 'propiedades'
      );
    }
    // Para las 6 vistas específicas de ensayos, solo mostramos las columnas de ese módulo
    return COLUMNS_CONFIG.filter(col => col.module === moduleName);
  }, [moduleName, isMasterView]);

  const hasPropFisicasGroup = isMasterView;

  // Obtener la matriz ordenada de campos visibles de la fila para la navegación con flechas
  const getRowFields = () => {
    if (isMasterView) {
      const fields = [
        'sondaje',
        'codigo_muestra',
        'laboratorio',
        'dia',
        'mes',
        'anio',
        'proyecto',
        'desde',
        'hasta',
        'longitud_muestra',
        'este',
        'norte',
        'elevacion',
        'sectores',
        'lito1',
        'lito2',
        'lito3',
        'tipo_ensayo'
      ];
      colsToRender.forEach(col => {
        fields.push(col.dbName);
      });
      fields.push('observacion');
      fields.push('campana');
      return fields;
    } else {
      // En vistas de ensayos solo navegamos entre los campos visibles
      const fields = [
        'sondaje',
        'codigo_muestra'
      ];
      colsToRender.forEach(col => {
        fields.push(col.dbName);
      });
      fields.push('observacion');
      return fields;
    }
  };

  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLTableElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return;

    const idAttr = target.id;
    if (!idAttr || !idAttr.startsWith('cell-')) return;

    const parts = idAttr.split('-');
    if (parts.length < 3) return;

    const idd = parseInt(parts[1], 10);
    const dbName = parts.slice(2).join('-');

    if (target.tagName === 'SELECT' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }

    const fields = getRowFields();
    const fieldIndex = fields.indexOf(dbName);
    if (fieldIndex === -1) return;

    const rowIds = records.map(r => r.idd);
    const rowIndex = rowIds.indexOf(idd);
    if (rowIndex === -1) return;

    let nextIdd = idd;
    let nextField = dbName;

    switch (e.key) {
      case 'ArrowUp':
        if (rowIndex > 0) {
          nextIdd = rowIds[rowIndex - 1];
          e.preventDefault();
        }
        break;
      case 'ArrowDown':
        if (rowIndex < rowIds.length - 1) {
          nextIdd = rowIds[rowIndex + 1];
          e.preventDefault();
        }
        break;
      case 'ArrowLeft': {
        const input = target as HTMLInputElement;
        if (target.tagName === 'SELECT' || input.selectionStart === 0) {
          if (fieldIndex > 0) {
            nextField = fields[fieldIndex - 1];
            e.preventDefault();
          }
        }
        break;
      }
      case 'ArrowRight': {
        const input = target as HTMLInputElement;
        if (target.tagName === 'SELECT' || input.selectionStart === (input.value?.length ?? 0)) {
          if (fieldIndex < fields.length - 1) {
            nextField = fields[fieldIndex + 1];
            e.preventDefault();
          }
        }
        break;
      }
      default:
        return;
    }

    if (nextIdd !== idd || nextField !== dbName) {
      const nextElId = `cell-${nextIdd}-${nextField}`;
      const nextEl = document.getElementById(nextElId);
      if (nextEl) {
        nextEl.focus();
        if (nextEl.tagName === 'INPUT') {
          (nextEl as HTMLInputElement).select();
        }
      }
    }
  };

  return (
    <div className="space-y-4 select-none animate-fade-in text-xs font-normal">
      <div className="border border-navy-800/80 rounded-2xl bg-navy-950/20 shadow-xl overflow-hidden relative">
        <div className="overflow-x-auto overflow-y-auto max-h-[74vh] custom-scrollbar max-w-full relative">
          <table className="border-collapse text-left table-fixed border-spacing-0" style={{ width: 'max-content' }} onKeyDown={handleGridKeyDown}>

            {/* CABECERA ESTÁTICA SÓLIDA DE 2 NIVELES CON BORDES COMPLETOS */}
            <thead className="sticky top-0 z-30 bg-navy-950 shadow-md">
              {/* Nivel 1 */}
              <tr className="bg-navy-900 border-b border-navy-800 text-center select-none">
                <th style={{ width: colStyles.idd }} className="sticky top-0 left-0 bg-navy-950 z-40 border-r border-b border-slate-700/60 dark:border-navy-800/80 text-center font-bold text-xs" colSpan={1} rowSpan={2}>IDD</th>
                <th style={{ width: colStyles.sondaje }} className="sticky top-0 left-[80px] bg-navy-950 z-40 border-r border-b border-slate-700/60 dark:border-navy-800/80 text-center font-bold text-xs" colSpan={1} rowSpan={2}>Sondaje diamantino</th>
                <th style={{ width: colStyles.codigo_muestra }} className="sticky top-0 left-[210px] bg-navy-950 z-40 border-r border-b border-slate-700/60 dark:border-navy-800/80 text-center font-bold text-xs" colSpan={1} rowSpan={2}>Código de muestra</th>

                {/* Comunes: Solo renderizados en la vista de Registro Maestro */}
                {isMasterView && (
                  <>
                    <th className="py-2.5 px-2 text-center border-r border-b border-navy-800 font-extrabold uppercase tracking-wider text-xs bg-navy-900 text-slate-400" colSpan={1} rowSpan={2}>Laboratorio</th>
                    <th className="py-2.5 px-2 text-center border-r border-b border-navy-800 font-extrabold uppercase tracking-wider text-xs bg-navy-900 text-slate-400" colSpan={3}>Fecha de ensayo</th>
                    <th className="py-2.5 px-2 text-center border-r border-b border-navy-800 font-extrabold uppercase tracking-wider text-xs bg-navy-900 text-slate-400" colSpan={1} rowSpan={2}>Proyecto</th>
                    <th className="py-2.5 px-2 text-center border-r border-b border-navy-800 font-extrabold uppercase tracking-wider text-xs bg-navy-900 text-slate-400" colSpan={3}>Profundidad (m)</th>
                    <th className="py-2.5 px-2 text-center border-r border-b border-navy-800 font-extrabold uppercase tracking-wider text-xs bg-navy-900 text-slate-400" colSpan={3}>Coordenadas</th>
                    <th className="py-2.5 px-2 text-center border-r border-b border-navy-800 font-extrabold uppercase tracking-wider text-xs bg-navy-900 text-slate-400" colSpan={1} rowSpan={2}>SECTORES</th>
                    <th className="py-2.5 px-2 text-center border-r border-b border-navy-800 font-extrabold uppercase tracking-wider text-xs bg-navy-900 text-slate-400" colSpan={3}>Litologia</th>
                    <th className="py-2.5 px-2 text-center border-r border-b border-navy-800 font-extrabold uppercase tracking-wider text-xs bg-navy-900 text-slate-400" colSpan={1} rowSpan={2}>Tipo de ensayo</th>
                  </>
                )}

                {/* Ensayos con colores característicos SÓLIDOS */}
                {(isMasterView || moduleName === 'ucs') && (
                  <th className="py-2.5 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 font-extrabold uppercase tracking-wider text-xs bg-orange-950 text-orange-400 border border-orange-500/30" colSpan={5}>Compresión Uniaxial</th>
                )}
                {(isMasterView || moduleName === 'elasticas') && (
                  <th className="py-2.5 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 font-extrabold uppercase tracking-wider text-xs bg-red-950 text-red-400 border border-red-500/30" colSpan={2}>Constantes Elásticas</th>
                )}
                {(isMasterView || moduleName === 'traccion') && (
                  <th className="py-2.5 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 font-extrabold uppercase tracking-wider text-xs bg-yellow-950 text-yellow-400 border border-yellow-500/30" colSpan={4}>Tracción Indirecta</th>
                )}
                {(isMasterView || moduleName === 'corte') && (
                  <th className="py-2.5 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 font-extrabold uppercase tracking-wider text-xs bg-emerald-950 text-emerald-400 border border-emerald-500/30" colSpan={8}>Corte Directo</th>
                )}
                {(isMasterView || moduleName === 'triaxial') && (
                  <th className="py-2.5 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 font-extrabold uppercase tracking-wider text-xs bg-purple-950 text-purple-400 border border-purple-500/30" colSpan={7}>Compresión Triaxial</th>
                )}

                <th className="py-2.5 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 font-extrabold uppercase tracking-wider text-xs bg-navy-900 text-slate-400" colSpan={1} rowSpan={2}>Validación QA/QC</th>

                <th style={{ width: colStyles.observacion }} className="py-2.5 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 font-extrabold uppercase tracking-wider text-xs bg-navy-900 text-slate-400 relative select-none" colSpan={1} rowSpan={2}>
                  Observación
                  <div onMouseDown={(e) => handleMouseDown(e, 'observacion')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/50" />
                </th>

                {isMasterView && (
                  <th style={{ width: colStyles.campana }} className="py-2.5 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 font-extrabold uppercase tracking-wider text-xs bg-navy-900 text-slate-400 relative select-none" colSpan={1} rowSpan={2}>
                    Campaña de Perforación
                    <div onMouseDown={(e) => handleMouseDown(e, 'campana')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/50" />
                  </th>
                )}

                {hasPropFisicasGroup && (
                  <th className="py-2.5 px-2 text-center sticky top-0 right-32 bg-sky-950 text-sky-400 border-l border-r border-b border-sky-500/30 z-40 font-extrabold uppercase text-xs" colSpan={1}>Prop físicas</th>
                )}

                {isMasterView && (
                  <th className="sticky top-0 right-0 bg-navy-950 z-40 border-l border-b border-slate-700/60 dark:border-navy-800/80 w-32 text-center font-bold text-xs" colSpan={1} rowSpan={2}>Acciones</th>
                )}
              </tr>

              {/* Nivel 2 */}
              <tr className="bg-navy-950 text-slate-300 font-bold uppercase tracking-wider text-xs border-b border-navy-800 text-center select-none">
                {isMasterView && (
                  <>
                    <th style={{ width: colStyles.dia }} className="py-3 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 relative select-none">
                      Día
                      <div onMouseDown={(e) => handleMouseDown(e, 'dia')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/50" />
                    </th>
                    <th style={{ width: colStyles.mes }} className="py-3 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 relative select-none">
                      Mes
                      <div onMouseDown={(e) => handleMouseDown(e, 'mes')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/50" />
                    </th>
                    <th style={{ width: colStyles.anio }} className="py-3 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 relative select-none">
                      Año
                      <div onMouseDown={(e) => handleMouseDown(e, 'anio')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/50" />
                    </th>

                    <th style={{ width: colStyles.desde }} className="py-3 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 relative select-none">Desde (m)</th>
                    <th style={{ width: colStyles.hasta }} className="py-3 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 relative select-none">Hasta (m)</th>
                    <th style={{ width: colStyles.longitud_muestra }} className="py-3 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 relative select-none">Longitud de muestra (m)</th>

                    <th style={{ width: colStyles.este }} className="py-3 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 relative select-none">Este (m)</th>
                    <th style={{ width: colStyles.norte }} className="py-3 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 relative select-none">Norte (m)</th>
                    <th style={{ width: colStyles.elevacion }} className="py-3 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 relative select-none">Elevación (msnm)</th>

                    <th style={{ width: colStyles.lito1 }} className="py-3 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 relative select-none">Lito 1</th>
                    <th style={{ width: colStyles.lito2 }} className="py-3 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 relative select-none">Lito 2</th>
                    <th style={{ width: colStyles.lito3 }} className="py-3 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 relative select-none">Lito 3</th>
                  </>
                )}

                {colsToRender.map((col) => {
                  return (
                    <th
                      key={col.index}
                      style={{ width: colStyles[col.dbName] || '110px' }}
                      className="py-3 px-2 text-center border-r border-b border-slate-700/60 dark:border-navy-800/80 font-bold uppercase tracking-wider text-xs relative select-none"
                    >
                      <span>{col.excelName}</span>
                      <div onMouseDown={(e) => handleMouseDown(e, col.dbName)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/50" />
                    </th>
                  );
                })}

                {hasPropFisicasGroup && (
                  <th style={{ width: colStyles.prop_peso_unitario_geometrico }} className="py-3 px-2.5 text-center sticky top-[38px] right-32 bg-navy-950 border-l border-r border-b border-slate-700/60 dark:border-navy-800/80 z-40 relative select-none">
                    Peso unitario geométrico (gr/cm³)
                    <div onMouseDown={(e) => handleMouseDown(e, 'prop_peso_unitario_geometrico')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/50" />
                  </th>
                )}
              </tr>
            </thead>

            {/* CUERPO DE REGISTROS */}
            <tbody className="divide-y divide-navy-900/40 text-xs text-slate-300 font-normal">
              {records.map((rec, rIdx) => {
                const isEven = rIdx % 2 === 0;
                const rowBg = isEven ? "bg-navy-900/5 hover:bg-navy-900/20" : "bg-navy-950/20 hover:bg-navy-900/20";
                const isInputDisabled = !isMasterView;

                return (
                  <tr key={rec.idd} className={`${rowBg} transition-colors border-b border-navy-900/20`}>

                    {/* IDD Sticky Left */}
                    <td className="sticky left-0 bg-navy-950 text-center text-slate-400 font-mono font-bold text-xs py-2 border-r border-b border-slate-700/60 dark:border-navy-800/80 z-10 select-none">
                      {rec.idd}
                    </td>

                    {/* Sondaje Sticky Left */}
                    <td className={`p-0 sticky left-[80px] bg-navy-950 z-10 ${getCellBorderClass(rec.idd, 'sondaje')}`}>
                      <input
                        id={`cell-${rec.idd}-sondaje`}
                        type="text"
                        value={rec.sondaje || ''}
                        readOnly={isInputDisabled}
                        onChange={(e) => {
                          if (isInputDisabled) return;
                          handleCellChange(rec.idd, 'sondaje', e.target.value);
                        }}
                        className={`w-full bg-transparent border-0 focus:outline-none text-center text-xs py-2 px-1 text-slate-200 font-normal ${isInputDisabled ? 'text-slate-400 bg-navy-900/[0.05] cursor-not-allowed' : ''}`}
                        placeholder="—"
                      />
                    </td>

                    {/* Código de muestra Sticky Left */}
                    <td className={`p-0 sticky left-[210px] bg-navy-950 z-10 ${getCellBorderClass(rec.idd, 'codigo_muestra')}`}>
                      <input
                        id={`cell-${rec.idd}-codigo_muestra`}
                        type="text"
                        value={rec.codigo_muestra || ''}
                        readOnly={isInputDisabled}
                        onChange={(e) => {
                          if (isInputDisabled) return;
                          handleCellChange(rec.idd, 'codigo_muestra', e.target.value);
                        }}
                        className={`w-full bg-transparent border-0 focus:outline-none text-center text-xs py-2 px-1 text-slate-200 font-normal ${isInputDisabled ? 'text-slate-400 bg-navy-900/[0.05] cursor-not-allowed' : ''}`}
                        placeholder="—"
                      />
                    </td>

                    {/* Columnas fijadas de datos comunes: Ocultadas dinámicamente si no es la vista del maestro */}
                    {isMasterView && (
                      <>
                        <td className={`p-0 ${getCellBorderClass(rec.idd, 'laboratorio')}`} style={{ width: colStyles.laboratorio }}>
                          <input
                            id={`cell-${rec.idd}-laboratorio`}
                            type="text"
                            value={rec.laboratorio || ''}
                            onChange={(e) => handleCellChange(rec.idd, 'laboratorio', e.target.value)}
                            className="w-full bg-transparent border-0 focus:outline-none text-center text-xs py-2 px-1 text-slate-200 font-normal"
                            placeholder="—"
                          />
                        </td>

                        <td className={`p-0 ${getCellBorderClass(rec.idd, 'dia')}`} style={{ width: colStyles.dia }}>
                          <input
                            id={`cell-${rec.idd}-dia`}
                            type="text"
                            value={rec.dia !== undefined && rec.dia !== null ? rec.dia : ''}
                            onChange={(e) => {
                              let valClean = handlePltNumberLimit(e.target.value, 'int');
                              const num = parseInt(valClean);
                              if (!isNaN(num)) {
                                if (num > 31) valClean = "31";
                                if (num < 0) valClean = "0";
                              }
                              handleCellChange(rec.idd, 'dia', valClean);
                            }}
                            onBlur={(e) => handleBlur(rec.idd, 'dia', e.target.value, COLUMNS_CONFIG.find(c => c.dbName === 'dia')!)}
                            className="w-full bg-transparent border-0 focus:outline-none text-center text-xs py-2 px-1 text-slate-200 font-normal"
                            placeholder="—"
                          />
                        </td>

                        <td className={`p-0 ${getCellBorderClass(rec.idd, 'mes')}`} style={{ width: colStyles.mes }}>
                          <select
                            id={`cell-${rec.idd}-mes`}
                            value={rec.mes || ''}
                            onChange={(e) => handleCellChange(rec.idd, 'mes', e.target.value)}
                            className="w-full bg-transparent border-0 focus:outline-none text-center text-xs py-2 px-1 text-slate-200 font-normal cursor-pointer"
                          >
                            <option value="" className="bg-navy-950 text-slate-500">—</option>
                            {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map(m => (
                              <option key={m} value={m} className="bg-navy-950 text-slate-200">{m}</option>
                            ))}
                          </select>
                        </td>

                        <td className={`p-0 ${getCellBorderClass(rec.idd, 'anio')}`} style={{ width: colStyles.anio }}>
                          <input
                            id={`cell-${rec.idd}-anio`}
                            type="text"
                            value={rec.anio !== undefined && rec.anio !== null ? rec.anio : ''}
                            onChange={(e) => {
                              let valClean = handlePltNumberLimit(e.target.value, 'int');
                              const num = parseInt(valClean);
                              if (!isNaN(num)) {
                                if (num > 2050) valClean = "2050";
                                if (num < 0) valClean = "0";
                              }
                              handleCellChange(rec.idd, 'anio', valClean);
                            }}
                            onBlur={(e) => handleBlur(rec.idd, 'anio', e.target.value, COLUMNS_CONFIG.find(c => c.dbName === 'anio')!)}
                            className="w-full bg-transparent border-0 focus:outline-none text-center text-xs py-2 px-1 text-slate-200 font-normal"
                            placeholder="—"
                          />
                        </td>

                        <td className={`p-0 ${getCellBorderClass(rec.idd, 'proyecto')}`} style={{ width: colStyles.proyecto }}>
                          <select
                            id={`cell-${rec.idd}-proyecto`}
                            value={rec.proyecto || ''}
                            onChange={(e) => handleCellChange(rec.idd, 'proyecto', e.target.value)}
                            className="w-full bg-transparent border-0 focus:outline-none text-center cursor-pointer text-xs text-slate-200 font-normal py-2 px-1"
                          >
                            <option value="" className="bg-navy-950 text-slate-500">— Seleccionar —</option>
                            {proyectosList.map((p) => (
                              <option key={p.nombre} value={p.nombre} className="bg-navy-950 text-slate-200">{p.nombre}</option>
                            ))}
                          </select>
                        </td>

                        <td className={`p-0 ${getCellBorderClass(rec.idd, 'desde')}`} style={{ width: colStyles.desde }}>
                          <input
                            id={`cell-${rec.idd}-desde`}
                            type="text"
                            value={rec.desde !== undefined && rec.desde !== null ? rec.desde : ''}
                            onChange={(e) => handleCellChange(rec.idd, 'desde', handlePltNumberLimit(e.target.value, 'float'))}
                            onBlur={(e) => handleBlur(rec.idd, 'desde', e.target.value, COLUMNS_CONFIG.find(c => c.dbName === 'desde')!)}
                            className="w-full bg-transparent border-0 focus:outline-none text-center text-xs py-2 px-1 text-slate-200 font-normal"
                            placeholder="—"
                          />
                        </td>

                        <td className={`p-0 ${getCellBorderClass(rec.idd, 'hasta')}`} style={{ width: colStyles.hasta }}>
                          <input
                            id={`cell-${rec.idd}-hasta`}
                            type="text"
                            value={rec.hasta !== undefined && rec.hasta !== null ? rec.hasta : ''}
                            onChange={(e) => handleCellChange(rec.idd, 'hasta', handlePltNumberLimit(e.target.value, 'float'))}
                            onBlur={(e) => handleBlur(rec.idd, 'hasta', e.target.value, COLUMNS_CONFIG.find(c => c.dbName === 'hasta')!)}
                            className="w-full bg-transparent border-0 focus:outline-none text-center text-xs py-2 px-1 text-slate-200 font-normal"
                            placeholder="—"
                          />
                        </td>

                        <td className={`p-0 ${getCellBorderClass(rec.idd, 'longitud_muestra')}`} style={{ width: colStyles.longitud_muestra }}>
                          <input
                            id={`cell-${rec.idd}-longitud_muestra`}
                            type="text"
                            value={rec.longitud_muestra !== undefined && rec.longitud_muestra !== null ? rec.longitud_muestra : ''}
                            readOnly
                            className="w-full bg-transparent border-0 focus:outline-none text-center text-xs py-2 px-1 text-indigo-300 bg-indigo-500/[0.02] cursor-not-allowed font-medium"
                            placeholder="Auto"
                          />
                        </td>

                        <td className={`p-0 ${getCellBorderClass(rec.idd, 'este')}`} style={{ width: colStyles.este }}>
                          <input
                            id={`cell-${rec.idd}-este`}
                            type="text"
                            value={rec.este !== undefined && rec.este !== null ? rec.este : ''}
                            onChange={(e) => handleCellChange(rec.idd, 'este', handlePltNumberLimit(e.target.value, 'float'))}
                            onBlur={(e) => handleBlur(rec.idd, 'este', e.target.value, COLUMNS_CONFIG.find(c => c.dbName === 'este')!)}
                            className="w-full bg-transparent border-0 focus:outline-none text-center text-xs py-2 px-1 text-slate-200 font-normal"
                            placeholder="—"
                          />
                        </td>

                        <td className={`p-0 ${getCellBorderClass(rec.idd, 'norte')}`} style={{ width: colStyles.norte }}>
                          <input
                            id={`cell-${rec.idd}-norte`}
                            type="text"
                            value={rec.norte !== undefined && rec.norte !== null ? rec.norte : ''}
                            onChange={(e) => handleCellChange(rec.idd, 'norte', e.target.value)}
                            className="w-full bg-transparent border-0 focus:outline-none text-center text-xs py-2 px-1 text-slate-200 font-normal"
                            placeholder="—"
                          />
                        </td>

                        <td className={`p-0 ${getCellBorderClass(rec.idd, 'elevacion')}`} style={{ width: colStyles.elevacion }}>
                          <input
                            id={`cell-${rec.idd}-elevacion`}
                            type="text"
                            value={rec.elevacion !== undefined && rec.elevacion !== null ? rec.elevacion : ''}
                            onChange={(e) => handleCellChange(rec.idd, 'elevacion', e.target.value)}
                            className="w-full bg-transparent border-0 focus:outline-none text-center text-xs py-2 px-1 text-slate-200 font-normal"
                            placeholder="—"
                          />
                        </td>

                        <td className={`p-0 ${getCellBorderClass(rec.idd, 'sectores')}`} style={{ width: colStyles.sectores }}>
                          <input
                            id={`cell-${rec.idd}-sectores`}
                            type="text"
                            value={rec.sectores || ''}
                            onChange={(e) => handleCellChange(rec.idd, 'sectores', e.target.value)}
                            className="w-full bg-transparent border-0 focus:outline-none text-center text-xs py-2 px-1 text-slate-200 font-normal"
                            placeholder="—"
                          />
                        </td>

                        <td className={`p-0 ${getCellBorderClass(rec.idd, 'lito1')}`} style={{ width: colStyles.lito1 }}>
                          <input
                            id={`cell-${rec.idd}-lito1`}
                            type="text"
                            value={rec.lito1 || ''}
                            onChange={(e) => handleCellChange(rec.idd, 'lito1', e.target.value)}
                            className="w-full bg-transparent border-0 focus:outline-none text-center text-xs py-2 px-1 text-slate-200 font-normal"
                            placeholder="—"
                          />
                        </td>

                        <td className={`p-0 ${getCellBorderClass(rec.idd, 'lito2')}`} style={{ width: colStyles.lito2 }}>
                          <input
                            id={`cell-${rec.idd}-lito2`}
                            type="text"
                            value={rec.lito2 || ''}
                            onChange={(e) => handleCellChange(rec.idd, 'lito2', e.target.value)}
                            className="w-full bg-transparent border-0 focus:outline-none text-center text-xs py-2 px-1 text-slate-200 font-normal"
                            placeholder="—"
                          />
                        </td>

                        <td className={`p-0 ${getCellBorderClass(rec.idd, 'lito3')}`} style={{ width: colStyles.lito3 }}>
                          <input
                            id={`cell-${rec.idd}-lito3`}
                            type="text"
                            value={rec.lito3 || ''}
                            onChange={(e) => handleCellChange(rec.idd, 'lito3', e.target.value)}
                            className="w-full bg-transparent border-0 focus:outline-none text-center text-xs py-2 px-1 text-slate-200 font-normal"
                            placeholder="—"
                          />
                        </td>

                        <td className={`p-0 border-r border-b border-navy-800 ${getCellBorderClass(rec.idd, 'tipo_ensayo')}`} style={{ width: colStyles.tipo_ensayo }}>
                          <select
                            id={`cell-${rec.idd}-tipo_ensayo`}
                            value={rec.tipo_ensayo || ''}
                            onChange={(e) => handleCellChange(rec.idd, 'tipo_ensayo', e.target.value)}
                            className="w-full bg-transparent border-0 focus:outline-none text-center cursor-pointer text-xs text-slate-200 font-normal py-2 px-1"
                          >
                            <option value="" className="bg-navy-950 text-slate-500">—</option>
                            {COLUMNS_CONFIG.find(c => c.dbName === 'tipo_ensayo')?.validation?.options?.map((opt) => (
                              <option key={opt} value={opt} className="bg-navy-950 text-slate-200">{opt}</option>
                            ))}
                          </select>
                        </td>
                      </>
                    )}

                    {/* Columnas dinámicas centrales restantes */}
                    {colsToRender.map((col) => {
                      const val = rec[col.dbName] !== undefined && rec[col.dbName] !== null ? rec[col.dbName] : '';
                      const cellBorder = getCellBorderClass(rec.idd, col.dbName);

                      return (
                        <td key={col.index} className={`p-0 border-r border-b border-navy-800 ${cellBorder}`} style={{ width: colStyles[col.dbName] }}>
                          {col.validation && col.validation.options ? (
                            isInputDisabled ? (
                              <input
                                id={`cell-${rec.idd}-${col.dbName}`}
                                type="text"
                                value={val || '—'}
                                readOnly
                                className="w-full bg-transparent border-0 focus:outline-none text-center font-normal text-xs py-2 px-1 text-slate-400 bg-navy-900/[0.05] cursor-not-allowed"
                              />
                            ) : (
                              <select
                                id={`cell-${rec.idd}-${col.dbName}`}
                                value={val}
                                onChange={(e) => handleCellChange(rec.idd, col.dbName, e.target.value)}
                                className="w-full bg-transparent border-0 focus:outline-none text-center cursor-pointer text-xs text-slate-200 font-normal py-2 px-1"
                              >
                                <option value="" className="bg-navy-950 text-slate-500">—</option>
                                {col.validation.options.map((opt) => (
                                  <option key={opt} value={opt} className="bg-navy-950 text-slate-200">{opt}</option>
                                ))}
                              </select>
                            )
                          ) : (
                            <input
                              id={`cell-${rec.idd}-${col.dbName}`}
                              type="text"
                              value={val}
                              readOnly={isInputDisabled}
                              onChange={(e) => {
                                if (isInputDisabled) return;
                                let inputVal = e.target.value;
                                if (col.type === 'int' || col.type === 'float') {
                                  inputVal = handlePltNumberLimit(inputVal, col.type);
                                  const numericVal = parseFloat(inputVal);
                                  if (!isNaN(numericVal) && col.validation) {
                                    if (col.validation.max !== undefined && numericVal > col.validation.max) {
                                      inputVal = String(col.validation.max);
                                    }
                                    if (numericVal < 0) {
                                      inputVal = "0";
                                    }
                                  }
                                }
                                handleCellChange(rec.idd, col.dbName, inputVal);
                              }}
                              onBlur={(e) => {
                                if (isInputDisabled) return;
                                if (col.type === 'int' || col.type === 'float') {
                                  handleBlur(rec.idd, col.dbName, e.target.value, col);
                                }
                              }}
                              placeholder="—"
                              className={`w-full bg-transparent border-0 focus:outline-none text-center font-normal text-xs py-2 px-1 ${isInputDisabled
                                ? 'text-slate-400 font-normal bg-navy-900/[0.05] cursor-not-allowed'
                                : 'text-slate-200'
                                }`}
                            />
                          )}
                        </td>
                      );
                    })}

                    {/* Validación QA/QC */}
                    <td className="p-2 border-r border-b border-navy-800 text-center">
                      {getQaqcValidationBadge(rec.idd, rec)}
                    </td>

                    {/* Observación */}
                    <td className={`p-0 ${getCellBorderClass(rec.idd, 'observacion')}`} style={{ width: colStyles.observacion }}>
                      <input
                        id={`cell-${rec.idd}-observacion`}
                        type="text"
                        value={rec.observacion || ''}
                        readOnly={isInputDisabled}
                        onChange={(e) => {
                          if (isInputDisabled) return;
                          handleCellChange(rec.idd, 'observacion', e.target.value);
                        }}
                        className={`w-full bg-transparent border-0 focus:outline-none text-center text-xs py-2 px-1 text-slate-200 font-normal ${isInputDisabled ? 'text-slate-400 bg-navy-900/[0.05] cursor-not-allowed' : ''}`}
                        placeholder="—"
                      />
                    </td>

                    {/* Campaña de Perforación */}
                    {isMasterView && (
                      <td className={`p-0 ${getCellBorderClass(rec.idd, 'campana')}`} style={{ width: colStyles.campana }}>
                        <input
                          id={`cell-${rec.idd}-campana`}
                          type="text"
                          value={rec.campana || ''}
                          onChange={(e) => handleCellChange(rec.idd, 'campana', e.target.value)}
                          className="w-full bg-transparent border-0 focus:outline-none text-center text-xs py-2 px-1 text-slate-200 font-normal"
                          placeholder="—"
                        />
                      </td>
                    )}

                    {/* Propiedades Físicas */}
                    {hasPropFisicasGroup && (
                      <td className={`p-0 sticky right-32 bg-navy-950 z-10 ${getCellBorderClass(rec.idd, 'prop_peso_unitario_geometrico')}`} style={{ width: colStyles.prop_peso_unitario_geometrico }}>
                        <input
                          id={`cell-${rec.idd}-prop_peso_unitario_geometrico`}
                          type="text"
                          value={rec.prop_peso_unitario_geometrico !== undefined && rec.prop_peso_unitario_geometrico !== null ? rec.prop_peso_unitario_geometrico : ''}
                          onChange={(e) => {
                            let valClean = handlePltNumberLimit(e.target.value, 'float');
                            const numericVal = parseFloat(valClean);
                            if (!isNaN(numericVal)) {
                              if (numericVal > 4.0) valClean = "4.0";
                              if (numericVal < 0) valClean = "0";
                            }
                            handleCellChange(rec.idd, 'prop_peso_unitario_geometrico', valClean);
                          }}
                          onBlur={(e) => handleBlur(rec.idd, 'prop_peso_unitario_geometrico', e.target.value, COLUMNS_CONFIG.find(c => c.dbName === 'prop_peso_unitario_geometrico')!)}
                          className="w-full bg-transparent border-0 focus:outline-none text-center text-xs py-2 px-1 text-slate-200 font-normal"
                          placeholder="—"
                        />
                      </td>
                    )}

                    {/* Acciones Sticky Right en la última columna */}
                    {isMasterView && (
                      <td className="sticky right-0 bg-navy-950 text-center py-2 px-1.5 border-l border-b border-slate-700/60 dark:border-navy-800/80 z-10 select-none">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onInsertRowBelow(rIdx)}
                            className="p-1 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/35 border border-indigo-500/20 text-indigo-400 hover:text-white transition-all"
                            title="Insertar Fila Debajo"
                          >
                            <Plus size={13} />
                          </button>
                          <button
                            onClick={() => onDeleteRow(rec.idd)}
                            className="p-1 rounded-lg bg-rose-600/10 hover:bg-rose-600/35 border border-rose-500/20 text-rose-400 hover:text-white transition-all"
                            title="Eliminar Registro"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}