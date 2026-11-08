import React, { useState, useMemo } from 'react';
import { FileSpreadsheet, Download, ShieldCheck, Plus, Trash2, Search, HelpCircle, ChevronDown, ChevronRight, BarChart, Compass, Database, CheckCircle2 } from 'lucide-react';
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

const MODULE_KEYS = ['registro_maestro', 'ucs', 'elasticas', 'traccion', 'corte', 'triaxial', 'propiedades'];

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
    const [activeTab, setActiveTab] = useState<'table' | 'graphs' | 'qaqc'>('table');
    const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
        registro_maestro: true,
        ucs: true,
        elasticas: true
    });

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

    const currentModuleAlerts = qaqcAlerts.filter(a => a.tab === moduleName);
    const currentModuleCriticals = currentModuleAlerts.filter(a => a.type === 'CRÍTICO').length;
    const currentModuleWarnings = currentModuleAlerts.filter(a => a.type === 'AVISO').length;

    const toggleAccordion = (key: string) => {
        setOpenAccordions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const isMaster = moduleName === 'registro_maestro';

    return (
        <div className="space-y-4 text-left select-none animate-fade-in text-xs font-semibold view-dashboard view-geotech">
            {/* Pestañas de Vista */}
            <div className="flex gap-2 border-b border-navy-800 pb-2 text-xs">
                <button
                    onClick={() => setActiveTab('table')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        activeTab === 'table'
                            ? 'bg-sky-500/10 border-sky-500/30 text-sky-400 font-extrabold shadow-[0_0_15px_rgba(14,165,233,0.1)]'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-navy-900/40'
                    }`}
                >
                    {isMaster ? 'Registro Maestro Geotécnico' : 'Grilla de Ensayos'}
                </button>
                <button
                    onClick={() => setActiveTab('graphs')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        activeTab === 'graphs'
                            ? 'bg-sky-500/10 border-sky-500/30 text-sky-400 font-extrabold shadow-[0_0_15px_rgba(14,165,233,0.1)]'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-navy-900/40'
                    }`}
                >
                    Curvas y Envolventes
                </button>
                <button
                    onClick={() => setActiveTab('qaqc')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        activeTab === 'qaqc'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-extrabold shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-navy-900/40'
                    }`}
                >
                    Auditoría QA/QC
                </button>
            </div>

            {activeTab === 'table' && (
                <div className="space-y-4">
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
                            moduleName={moduleName}
                            initialRecords={filteredRecords}
                            proyectosList={proyectosList}
                            qaqcAlerts={qaqcAlerts}
                            onDeleteRow={onDeleteRow ? onDeleteRow : (id) => setRecords(prev => prev.filter(r => r.idd !== id))}
                            height="calc(100vh - 280px)"
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
            )}

            {activeTab === 'graphs' && (
                <div className="glass-panel p-16 rounded-xl border border-navy-800 text-center text-slate-500 flex flex-col items-center gap-3">
                    <BarChart size={32} className="text-indigo-400 animate-pulse" />
                    <p className="text-xs max-w-sm font-semibold font-sans">El visualizador de curvas esfuerzo-deformación uniaxial y envolventes triaxiales se encuentra PENDIENTE de implementación técnica.</p>
                </div>
            )}

            {activeTab === 'qaqc' && (
                <div className="space-y-4 animate-fade-in text-xs">
                    <div className="flex justify-between items-center bg-navy-950/20 border border-navy-850 p-4 rounded-xl">
                        <div>
                            <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider">Auditoría del Módulo — {TITLE_MAP[moduleName]}</h4>
                            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Validación automatizada del módulo</p>
                        </div>
                        <button
                            onClick={onValidate}
                            className="flex items-center gap-1.5 bg-navy-900 border border-navy-800 hover:border-slate-500/40 text-slate-300 hover:text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                        >
                            <ShieldCheck size={13} className="text-indigo-400" />
                            <span>Boton Validacion</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-navy-950/40 border border-navy-800 rounded-xl p-4 text-center">
                            <div className="text-xs text-slate-500 font-bold uppercase">Errores Críticos</div>
                            <div className="text-2xl font-black text-rose-400 font-mono mt-1">{currentModuleCriticals}</div>
                        </div>
                        <div className="bg-navy-950/40 border border-navy-800 rounded-xl p-4 text-center">
                            <div className="text-xs text-slate-500 font-bold uppercase">Avisos</div>
                            <div className="text-2xl font-black text-amber-400 font-mono mt-1">{currentModuleWarnings}</div>
                        </div>
                        <div className="bg-navy-950/40 border border-navy-800 rounded-xl p-4 text-center">
                            <div className="text-xs text-slate-500 font-bold uppercase font-mono">Validados</div>
                            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                                {filteredRecords.length - currentModuleAlerts.length}
                            </div>
                        </div>
                        <div className="bg-navy-950/40 border border-navy-800 rounded-xl p-4 text-center">
                            <div className="text-xs text-slate-500 font-bold uppercase font-mono">Sin Validar</div>
                            <div className="text-2xl font-black text-slate-400 font-mono mt-1">
                                {filteredRecords.filter(r => !r.sondaje).length}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-navy-900 pb-2">Secciones de Auditoría</h4>

                        {MODULE_KEYS.map(key => {
                            if (!isMaster && key !== moduleName) return null;

                            const sectionAlerts = qaqcAlerts.filter(a => a.tab === key);
                            const isOpen = !!openAccordions[key];

                            return (
                                <div key={key} className="border border-navy-850 rounded-xl overflow-hidden bg-navy-950/20">
                                    <button
                                        onClick={() => toggleAccordion(key)}
                                        className="w-full flex items-center justify-between p-3.5 bg-navy-950/40 hover:bg-navy-900/40 transition-colors text-xs font-bold uppercase text-slate-200"
                                    >
                                        <span className="flex items-center gap-2">
                                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            <span>Validaciones de {TITLE_MAP[key]}</span>
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${sectionAlerts.length > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                            {sectionAlerts.length} Alertas
                                        </span>
                                    </button>

                                    {isOpen && (
                                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-navy-850 bg-navy-950/10 animate-fade-in">
                                            {sectionAlerts.map((alert, i) => {
                                                const isCrit = alert.type === 'CRÍTICO';
                                                return (
                                                    <div
                                                        key={i}
                                                        onClick={() => onFocusField(alert.idd, alert.field, alert.tab)}
                                                        className={`p-3.5 rounded-xl border text-left text-xs cursor-pointer hover:bg-navy-900/10 transition-all ${isCrit ? 'border-rose-500/20 bg-rose-950/5' : 'border-amber-500/20 bg-amber-950/5'}`}
                                                    >
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className={`font-black uppercase tracking-wider text-xs ${isCrit ? 'text-rose-400' : 'text-amber-400'}`}>
                                                                [{alert.type}] IDD: {alert.idd}
                                                            </span>
                                                            <span className="text-xs text-slate-500 font-mono">Campo: {alert.field}</span>
                                                        </div>
                                                        <p className="text-slate-300 leading-normal">{alert.message}</p>
                                                        <span className="text-xs text-sky-400 hover:underline mt-2 flex items-center gap-1 font-sans font-bold">
                                                            <span>Haga clic para auditar la celda</span>
                                                            <ChevronRight size={12} />
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                            {sectionAlerts.length === 0 && (
                                                <div className="col-span-2 py-4 text-center text-slate-500 italic font-semibold flex items-center justify-center gap-1.5">
                                                    <CheckCircle2 size={13} className="text-emerald-400" />
                                                    <span>Sección aprobada. No se registran avisos en este módulo.</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}