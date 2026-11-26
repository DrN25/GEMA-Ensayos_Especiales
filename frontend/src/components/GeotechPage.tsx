import React, { useState, useMemo } from 'react';
import { FileSpreadsheet, Download, ShieldCheck, Plus, Trash2, Search } from 'lucide-react';
import DataGrid from './DataGrid';
import { type QAQCAlert } from '../utils/qaqcValidator';
import { COLUMNS_CONFIG } from '../utils/columnsConfig';
import { getGridVersion } from '../features/grid/flags';
import { VirtualizedGrid } from '../features/grid/VirtualizedGrid';


interface GeotechPageProps {
    moduleName: string;
    records: Record<string, any>[];
    setRecords: React.Dispatch<React.SetStateAction<Record<string, any>[]>>;
    qaqcAlerts: QAQCAlert[];
    onOpenImport: () => void;
    onOpenExport: () => void;
    onValidate: () => void;
    highlightedCell: { idd: number; field: string } | null;
    clearHighlight: () => void;
    onFocusField: (idd: number, field: string, tab: string) => void;
    proyectosList?: { nombre: string }[]; // Lista de proyectos activos
    page?: number;
    pageSize?: number;
    totalPages?: number;
    totalRecords?: number;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    onSearchServer?: (query: string) => void;
    isLoading?: boolean;
    onDeleteRow?: (id: number) => void;
    onClearDatabase?: () => void;
}

const TITLE_MAP: Record<string, string> = {
    registro_maestro: "Registro Maestro Geotécnico",
    ucs: "Módulo de Compresión Uniaxial (UCS)",
    elasticas: "Constantes Elásticas de Roca",
    traccion: "Tracción Indirecta (Ensayo Brasileño)",
    corte: "Corte Directo en Discontinuidades",
    triaxial: "Compresión Triaxial",
    propiedades: "Propiedades Físicas Geométricas"
};

export default function GeotechPage({
    moduleName,
    records,
    setRecords,
    qaqcAlerts,
    onOpenImport,
    onOpenExport,
    onValidate,
    highlightedCell,
    clearHighlight,
    onFocusField,
    proyectosList = [],
    page = 1,
    pageSize = 50,
    totalPages = 1,
    totalRecords,
    onPageChange,
    onPageSizeChange,
    onSearchServer,
    isLoading = false,
    onDeleteRow,
    onClearDatabase
}: GeotechPageProps) {
    const [inputSondaje, setInputSondaje] = useState('');
    const [inputMuestra, setInputMuestra] = useState('');
    const [inputLaboratorio, setInputLaboratorio] = useState('');
    const [inputQaqcStatus, setInputQaqcStatus] = useState('Todos');

    const [appliedSondaje, setAppliedSondaje] = useState('');
    const [appliedMuestra, setAppliedMuestra] = useState('');
    const [appliedLaboratorio, setAppliedLaboratorio] = useState('');
    const [appliedQaqcStatus, setAppliedQaqcStatus] = useState('Todos');

    const uniqueLaboratorios = useMemo(() => {
        const isMaster = moduleName === 'registro_maestro';
        const essayCols = isMaster ? [] : COLUMNS_CONFIG.filter(col => col.module === moduleName);

        const filteredForModule = records.filter(r => {
            if (!isMaster && essayCols.length > 0) {
                return essayCols.some(col => {
                    const val = r[col.dbName];
                    return val !== null && val !== undefined && val !== '';
                });
            }
            return true;
        });

        return Array.from(new Set(filteredForModule.map(r => r.laboratorio).filter(Boolean))).sort();
    }, [records, moduleName]);

    const filteredRecords = useMemo(() => {
        const isMaster = moduleName === 'registro_maestro';
        const essayCols = isMaster ? [] : COLUMNS_CONFIG.filter(col => col.module === moduleName);

        return records.filter(r => {
            // FILTRO GEOMECÁNICO: Omitir registros que no contienen datos en ninguna columna de este ensayo
            if (!isMaster && essayCols.length > 0) {
                const hasAnyValue = essayCols.some(col => {
                    const val = r[col.dbName];
                    return val !== null && val !== undefined && val !== '';
                });
                if (!hasAnyValue) return false;
            }

            if (appliedSondaje && !String(r.sondaje || "").toLowerCase().includes(appliedSondaje.toLowerCase())) return false;
            if (appliedMuestra && !String(r.codigo_muestra || "").toLowerCase().includes(appliedMuestra.toLowerCase())) return false;
            if (appliedLaboratorio && r.laboratorio !== appliedLaboratorio) return false;

            if (appliedQaqcStatus !== 'Todos') {
                const rowAlerts = qaqcAlerts.filter(a => a.idd === r.idd);
                const hasCritical = rowAlerts.some(a => a.type === 'CRÍTICO');
                const hasWarning = rowAlerts.some(a => a.type === 'AVISO');

                if (appliedQaqcStatus === 'Validado') {
                    if (!r.sondaje || hasCritical) return false;
                }
                if (appliedQaqcStatus === 'Sin Validar') { // Con Advertencia
                    if (!r.sondaje || !hasWarning || hasCritical) return false;
                }
                if (appliedQaqcStatus === 'No Valido') { // Crítico / Fallido
                    if (!r.sondaje || !hasCritical) return false;
                }
            }
            return true;
        });
    }, [records, moduleName, appliedSondaje, appliedMuestra, appliedLaboratorio, appliedQaqcStatus, qaqcAlerts]);

    const totalSondajes = useMemo(() => {
        return new Set(filteredRecords.map(r => r.sondaje).filter(Boolean)).size;
    }, [filteredRecords]);

    const handleSearch = () => {
        setAppliedSondaje(inputSondaje);
        setAppliedMuestra(inputMuestra);
        setAppliedLaboratorio(inputLaboratorio);
        setAppliedQaqcStatus(inputQaqcStatus);
        if (onSearchServer) {
            onSearchServer(inputSondaje || inputMuestra);
        }
    };

    const handleClearFilters = () => {
        setInputSondaje('');
        setInputMuestra('');
        setInputLaboratorio('');
        setInputQaqcStatus('Todos');

        setAppliedSondaje('');
        setAppliedMuestra('');
        setAppliedLaboratorio('');
        setAppliedQaqcStatus('Todos');
        if (onSearchServer) {
            onSearchServer('');
        }
    };

    const isMaster = moduleName === 'registro_maestro';

    return (
        <div className="space-y-4 text-left select-none animate-fade-in text-xs font-semibold view-dashboard view-geotech">
            {/* Cabecera de Página */}
            <div className="glass-panel flex flex-wrap justify-between items-center bg-navy-950/20 border border-navy-800 p-4 rounded-2xl gap-3 text-xs shadow-md">
                <div>
                    <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider">{TITLE_MAP[moduleName]}</h4>
                    <p className="text-[11px] text-slate-400 font-normal">Consolidación, edición y validación en tiempo real</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {isMaster && (
                        <>
                            <button
                                onClick={() => {
                                    const nextId = records.length > 0 ? Math.max(...records.map(r => Number(r.idd) || 0)) + 1 : 1;
                                    const newRec = { idd: nextId, sondaje: '', codigo_muestra: '', laboratorio: '', dia: new Date().getDate(), mes: 'Enero', anio: new Date().getFullYear(), proyecto: proyectosList[0]?.nombre || '' };
                                    setRecords([...records, newRec]);
                                    setTimeout(() => onFocusField(nextId, 'sondaje', 'registro_maestro'), 100);
                                }}
                                className="flex items-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95 shadow-md shadow-sky-500/20"
                            >
                                <Plus size={13} />
                                <span>Nuevo Registro</span>
                            </button>
                            <button
                                onClick={onOpenImport}
                                className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                            >
                                <FileSpreadsheet size={13} />
                                <span>Importar Excel</span>
                            </button>
                            {onClearDatabase && (
                                <button
                                    type="button"
                                    onClick={onClearDatabase}
                                    className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                                    title="Elimina todos los registros de la base de datos para pruebas limpias de importación"
                                >
                                    <Trash2 size={13} />
                                    <span>Vaciar BD (Pruebas)</span>
                                </button>
                            )}
                        </>
                    )}
                    <button
                        onClick={onOpenExport}
                        className="flex items-center gap-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                    >
                        <Download size={13} />
                        <span>Exportar Excel</span>
                    </button>
                    <button
                        onClick={onValidate}
                        className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                    >
                        <ShieldCheck size={13} />
                        <span>Validar QA/QC</span>
                    </button>
                </div>
            </div>

            {/* Bloque de Filtros Responsivo */}
            <div className="glass-panel grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 bg-navy-950/20 border border-navy-800 p-4 rounded-2xl text-xs shadow-md">
                <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sondaje</span>
                    <input
                        type="text"
                        placeholder="Ej. CHS-19..."
                        value={inputSondaje}
                        onChange={e => setInputSondaje(e.target.value)}
                        className="w-full bg-navy-900 border border-navy-800 rounded-xl px-2.5 py-1.5 text-slate-100 outline-none focus:border-sky-500 transition-colors font-mono"
                    />
                </div>
                <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Muestra</span>
                    <input
                        type="text"
                        placeholder="Código..."
                        value={inputMuestra}
                        onChange={e => setInputMuestra(e.target.value)}
                        className="w-full bg-navy-900 border border-navy-800 rounded-xl px-2.5 py-1.5 text-slate-100 outline-none focus:border-sky-500 transition-colors font-mono"
                    />
                </div>
                <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Laboratorio</span>
                    <select
                        value={inputLaboratorio}
                        onChange={e => setInputLaboratorio(e.target.value)}
                        className="w-full bg-navy-900 border border-navy-800 rounded-xl px-2 py-1.5 text-slate-200 cursor-pointer outline-none focus:border-sky-500 transition-colors"
                    >
                        <option value="">Todos los Labs</option>
                        {uniqueLaboratorios.map(l => (
                            <option key={l} value={l}>{l}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado QA/QC</span>
                    <select
                        value={inputQaqcStatus}
                        onChange={e => setInputQaqcStatus(e.target.value)}
                        className="w-full bg-navy-900 border border-navy-800 rounded-xl px-2 py-1.5 text-slate-200 cursor-pointer outline-none focus:border-sky-500 transition-colors"
                    >
                        <option value="Todos">Todos los Estados</option>
                        <option value="Validado">Validado</option>
                        <option value="Sin Validar">Con Advertencia</option>
                        <option value="No Valido">Crítico / Fallido</option>
                    </select>
                </div>

                <div className="flex flex-wrap items-center justify-between col-span-1 sm:col-span-2 md:col-span-4 lg:col-span-2 w-full gap-3 pt-2 lg:pt-0 lg:pl-4 lg:border-l lg:border-navy-800">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSearch}
                            className="bg-sky-500 hover:bg-sky-400 px-4 py-2 rounded-xl text-slate-950 font-black transition-all active:scale-95 flex items-center gap-1.5 text-xs shadow-md shadow-sky-500/20"
                        >
                            <Search size={13} />
                            <span>Buscar</span>
                        </button>
                        <button
                            onClick={handleClearFilters}
                            className="bg-navy-900 border border-navy-800 hover:bg-navy-850 hover:border-slate-500/40 text-slate-300 hover:text-slate-100 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                        >
                            Limpiar
                        </button>
                    </div>

                    <div className="flex items-center gap-4 text-right font-bold ml-auto">
                        <div className="text-xs text-slate-400">
                            Sondajes: <span className="text-slate-100 font-mono font-black">{totalSondajes}</span>
                        </div>
                        <div className="text-xs text-slate-400">
                            Filas: <span className="text-sky-400 font-mono font-black">{filteredRecords.length}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grilla Principal - v1 clásica o v2 virtualizada de alto rendimiento */}
            {getGridVersion() === 'v2' ? (
                <VirtualizedGrid
                    key={moduleName}
                    moduleName={moduleName}
                    initialRecords={filteredRecords}
                    proyectosList={proyectosList}
                    qaqcAlerts={qaqcAlerts}
                    onDeleteRow={onDeleteRow ? onDeleteRow : (id) => setRecords(prev => prev.filter(r => r.idd !== id))}
                    height="calc(100vh - 385px)"
                    page={page}
                    pageSize={pageSize}
                    totalPages={totalPages}
                    totalRecords={totalRecords}
                    onPageChange={onPageChange}
                    onPageSizeChange={onPageSizeChange}
                    isLoading={isLoading}
                />
            ) : (
                <DataGrid
                    moduleName={moduleName}
                    records={filteredRecords}
                    setRecords={setRecords}
                    qaqcAlerts={qaqcAlerts}
                    onAddRow={() => { }}
                    onDeleteRow={onDeleteRow ? onDeleteRow : (id) => setRecords(prev => prev.filter(r => r.idd !== id))}
                    onInsertRowBelow={(idx) => {
                        const parent = filteredRecords[idx];
                        const nextId = Math.max(...records.map(r => Number(r.idd) || 0)) + 1;
                        const newRow = { idd: nextId, sondaje: parent?.sondaje || '', codigo_muestra: '', laboratorio: parent?.laboratorio || '', dia: parent?.dia || 1, mes: parent?.mes || 'Enero', anio: parent?.anio || new Date().getFullYear(), proyecto: parent?.proyecto || '' };
                        const updated = [...records];
                        updated.splice(idx + 1, 0, newRow);
                        setRecords(updated);
                    }}
                    highlightedCell={highlightedCell}
                    clearHighlight={clearHighlight}
                    proyectosList={proyectosList}
                    page={page}
                    pageSize={pageSize}
                    totalPages={totalPages}
                    totalRecords={totalRecords}
                    onPageChange={onPageChange}
                    onPageSizeChange={onPageSizeChange}
                    isLoading={isLoading}
                />
            )}
        </div>
    );
}
