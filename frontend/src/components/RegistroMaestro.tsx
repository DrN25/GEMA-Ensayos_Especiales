import React, { useState, useMemo } from 'react';
import { FileSpreadsheet, Download, ShieldCheck, Plus, Search, ShieldAlert, Check } from 'lucide-react';
import DataGrid from './DataGrid';
import { type QAQCAlert } from '../utils/qaqcValidator';

interface RegistroMaestroProps {
    records: Record<string, any>[];
    setRecords: React.Dispatch<React.SetStateAction<Record<string, any>[]>>;
    qaqcAlerts: QAQCAlert[];
    onOpenImport: () => void;
    onOpenExport: () => void;
    onValidate: () => void;
    highlightedCell: { idd: number; field: string } | null;
    clearHighlight: () => void;
    onFocusField: (idd: number, field: string, tab: string) => void;
}

export default function RegistroMaestro({
    records,
    setRecords,
    qaqcAlerts,
    onOpenImport,
    onOpenExport,
    onValidate,
    highlightedCell,
    clearHighlight,
    onFocusField
}: RegistroMaestroProps) {

    const [activeTab, setActiveTab] = useState<'table' | 'graphs' | 'qaqc'>('table');

    // Estados de Filtros
    const [fSondaje, setFSondaje] = useState('');
    const [fMuestra, setFMuestra] = useState('');
    const [fLaboratorio, setFLaboratorio] = useState('');
    const [fQaqcStatus, setFQaqcStatus] = useState('Todos');

    // Valores únicos de Laboratorio para el selector
    const uniqueLaboratorios = useMemo(() => {
        return Array.from(new Set(records.map(r => r.laboratorio).filter(Boolean))).sort();
    }, [records]);

    // Aplicar lógica de filtros reactiva
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            if (fSondaje && !String(r.sondaje || "").toLowerCase().includes(fSondaje.toLowerCase())) return false;
            if (fMuestra && !String(r.codigo_muestra || "").toLowerCase().includes(fMuestra.toLowerCase())) return false;
            if (fLaboratorio && r.laboratorio !== fLaboratorio) return false;

            if (fQaqcStatus !== 'Todos') {
                const rowAlerts = qaqcAlerts.filter(a => a.idd === r.idd);
                const hasCritical = rowAlerts.some(a => a.type === 'CRÍTICO');
                const hasWarning = rowAlerts.some(a => a.type === 'AVISO');

                if (fQaqcStatus === 'Validado') {
                    if (!r.sondaje || hasCritical) return false;
                }
                if (fQaqcStatus === 'Sin Validar') { // Con Advertencia
                    if (!r.sondaje || !hasWarning || hasCritical) return false;
                }
                if (fQaqcStatus === 'No Valido') { // Crítico / Fallido
                    if (!r.sondaje || !hasCritical) return false;
                }
            }
            return true;
        });
    }, [records, fSondaje, fMuestra, fLaboratorio, fQaqcStatus, qaqcAlerts]);

    const totalSondajes = useMemo(() => {
        return new Set(filteredRecords.map(r => r.sondaje).filter(Boolean)).size;
    }, [filteredRecords]);

    // Contadores de KPIs de Alertas
    const masterAlerts = qaqcAlerts.filter(a => a.tab === 'registro_maestro');
    const masterCríticos = masterAlerts.filter(a => a.type === 'CRÍTICO').length;
    const masterAvisos = masterAlerts.filter(a => a.type === 'AVISO').length;

    return (
        <div className="space-y-4 text-left select-none animate-fade-in">
            {/* Pestañas de Vista */}
            <div className="flex gap-1 border-b border-navy-850 pb-2">
                <button
                    onClick={() => setActiveTab('table')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${activeTab === 'table' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'border-transparent text-slate-400 hover:bg-slate-900/10'
                        }`}
                >
                    Registro Maestro
                </button>
                <button
                    onClick={() => setActiveTab('graphs')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${activeTab === 'graphs' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'border-transparent text-slate-400 hover:bg-slate-900/10'
                        }`}
                >
                    Gráficos (Pendiente)
                </button>
                <button
                    onClick={() => setActiveTab('qaqc')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${activeTab === 'qaqc' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'border-transparent text-slate-400 hover:bg-slate-900/10'
                        }`}
                >
                    Auditoría QA/QC
                </button>
            </div>

            {activeTab === 'table' && (
                <div className="space-y-4">
                    {/* Cabecera Interna de Tabla — Botón "Nuevo Registro" reubicado al Top */}
                    <div className="flex flex-wrap justify-between items-center bg-navy-950/20 border border-navy-850 p-4 rounded-xl gap-3">
                        <div>
                            <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider">Base de Datos — Registro Maestro</h4>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Consolidación de las 47 columnas de Ensayos Especiales</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => {
                                    const nextIdd = records.length > 0 ? Math.max(...records.map((r) => Number(r.idd) || 0)) + 1 : 1;
                                    const newRec = {
                                        idd: nextIdd,
                                        sondaje: '',
                                        codigo_muestra: '',
                                        laboratorio: '',
                                        mes: '',
                                        anio: new Date().getFullYear(),
                                        proyecto: '',
                                        desde: '',
                                        hasta: '',
                                        longitud_muestra: '',
                                        este: '',
                                        norte: '',
                                        elevacion: '',
                                        sectores: '',
                                        lito1: '',
                                        lito2: '',
                                        lito3: '',
                                        tipo_ensayo: ''
                                    };
                                    // Insertar al inicio para visualización instantánea sin hacer scroll
                                    setRecords([newRec, ...records]);
                                    onFocusField(nextIdd, 'sondaje', 'registro_maestro');
                                }}
                                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-md shadow-indigo-950/15"
                            >
                                <Plus size={13} />
                                <span>Nuevo Registro</span>
                            </button>

                            <button
                                onClick={onOpenImport}
                                className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 text-slate-300 hover:text-white border border-navy-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                            >
                                <FileSpreadsheet size={13} className="text-emerald-500" />
                                <span>Importar</span>
                            </button>
                            <button
                                onClick={onOpenExport}
                                className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 text-slate-300 hover:text-white border border-navy-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                            >
                                <Download size={13} className="text-sky-500" />
                                <span>Exportar</span>
                            </button>
                            <button
                                onClick={onValidate}
                                className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 text-slate-300 hover:text-white border border-navy-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                            >
                                <ShieldCheck size={13} className="text-indigo-400" />
                                <span>Validar QA/QC</span>
                            </button>
                        </div>
                    </div>

                    {/* Bloque de Filtros y Contadores en el Top */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 bg-navy-950/40 border border-navy-900 p-4 rounded-xl text-xs">
                        <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-500 uppercase">Sondaje</span>
                            <input
                                type="text"
                                placeholder="CHS19-..."
                                value={fSondaje}
                                onChange={e => setFSondaje(e.target.value)}
                                className="w-full bg-navy-900 border border-navy-800 rounded-lg px-2.5 py-1.5 text-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-500 uppercase">Muestra</span>
                            <input
                                type="text"
                                placeholder="UCS-M..."
                                value={fMuestra}
                                onChange={e => setFMuestra(e.target.value)}
                                className="w-full bg-navy-900 border border-navy-800 rounded-lg px-2.5 py-1.5 text-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-500 uppercase">Laboratorio</span>
                            <select
                                value={fLaboratorio}
                                onChange={e => setFLaboratorio(e.target.value)}
                                className="w-full bg-navy-900 border border-navy-800 rounded-lg px-2 py-1.5 text-white cursor-pointer"
                            >
                                <option value="">Todos</option>
                                {uniqueLaboratorios.map(l => (
                                    <option key={l} value={l}>{l}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-500 uppercase">Estado QA/QC</span>
                            <select
                                value={fQaqcStatus}
                                onChange={e => setFQaqcStatus(e.target.value)}
                                className="w-full bg-navy-900 border border-navy-800 rounded-lg px-2 py-1.5 text-white cursor-pointer"
                            >
                                <option value="Todos">Todos</option>
                                <option value="Validado">Validado</option>
                                <option value="Sin Validar">Con Advertencia</option>
                                <option value="No Valido">Crítico / Fallido</option>
                            </select>
                        </div>
                        <div className="flex items-end gap-1.5 col-span-2 col-start-1 md:col-start-auto">
                            <button
                                onClick={() => {
                                    setFSondaje('');
                                    setFMuestra('');
                                    setFLaboratorio('');
                                    setFQaqcStatus('Todos');
                                }}
                                className="bg-navy-900 border border-navy-800 hover:bg-navy-850 px-3.5 py-1.5 rounded-lg text-slate-400 font-bold hover:text-white"
                            >
                                Limpiar Filtros
                            </button>
                            <div className="h-full flex items-center gap-4 pl-4 border-l border-navy-800 text-[10px] text-slate-500 uppercase font-black tracking-wider">
                                <div>Sondajes: <span className="text-slate-300 font-bold">{totalSondajes}</span></div>
                                <div>Filas: <span className="text-slate-300 font-bold">{filteredRecords.length}</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Grilla Principal */}
                    <DataGrid
                        moduleName="registro_maestro"
                        records={filteredRecords}
                        setRecords={setRecords}
                        qaqcAlerts={qaqcAlerts}
                        onAddRow={() => { }} // Lógica delegada al Top
                        onDeleteRow={(id) => setRecords(prev => prev.filter(r => r.idd !== id))}
                        onInsertRowBelow={(idx) => {
                            const parent = filteredRecords[idx];
                            const nextIdd = Math.max(...records.map((r) => Number(r.idd) || 0)) + 1;
                            const newRow = {
                                idd: nextIdd,
                                sondaje: parent?.sondaje || '',
                                codigo_muestra: '',
                                mes: parent?.mes || '',
                                anio: parent?.anio || new Date().getFullYear(),
                                proyecto: parent?.proyecto || ''
                            };
                            const updated = [...records];
                            updated.splice(idx + 1, 0, newRow);
                            setRecords(updated);
                        }}
                        highlightedCell={highlightedCell}
                        clearHighlight={clearHighlight}
                    />
                </div>
            )}

            {activeTab === 'graphs' && (
                <div className="glass-panel p-16 rounded-xl border border-navy-800 text-center text-slate-500">
                    <p className="text-xs">El visualizador de curvas esfuerzo-deformación uniaxial y envolventes triaxiales se encuentra PENDIENTE de implementación.</p>
                </div>
            )}

            {activeTab === 'qaqc' && (
                <div className="space-y-4 animate-fade-in">
                    {/* KPIs del estado QA/QC */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-navy-950/40 border border-navy-800 rounded-xl p-4 text-center">
                            <div className="text-[10px] text-slate-500 font-black uppercase">Errores Críticos</div>
                            <div className="text-2xl font-black text-rose-400 font-mono mt-1">{masterCríticos}</div>
                        </div>
                        <div className="bg-navy-950/40 border border-navy-800 rounded-xl p-4 text-center">
                            <div className="text-[10px] text-slate-500 font-black uppercase">Avisos</div>
                            <div className="text-2xl font-black text-amber-400 font-mono mt-1">{masterAvisos}</div>
                        </div>
                        <div className="bg-navy-950/40 border border-navy-800 rounded-xl p-4 text-center">
                            <div className="text-[10px] text-slate-500 font-black uppercase">Validados</div>
                            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                                {filteredRecords.length - masterAlerts.length}
                            </div>
                        </div>
                        <div className="bg-navy-950/40 border border-navy-800 rounded-xl p-4 text-center">
                            <div className="text-[10px] text-slate-500 font-black uppercase">Sin Validar</div>
                            <div className="text-2xl font-black text-slate-400 font-mono mt-1">
                                {filteredRecords.filter(r => !r.sondaje).length}
                            </div>
                        </div>
                    </div>

                    {/* Tarjetas de Validaciones */}
                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-navy-900 pb-2">Lista de Auditoría de Ensayos Especiales</h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {masterAlerts.map((alert, i) => {
                                const isCritico = alert.type === 'CRÍTICO';
                                return (
                                    <div
                                        key={i}
                                        onClick={() => onFocusField(alert.idd, alert.field, alert.tab)}
                                        className={`p-3.5 rounded-xl border text-left text-xs cursor-pointer hover:bg-navy-900/10 transition-all ${isCritico ? 'border-rose-500/20 bg-rose-950/5' : 'border-amber-500/20 bg-amber-950/5'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`font-black uppercase tracking-wider text-[9px] ${isCritico ? 'text-rose-400' : 'text-amber-400'}`}>
                                                [{alert.type}] IDD: {alert.idd}
                                            </span>
                                            <span className="text-[9px] text-slate-500 font-mono">Campo: {alert.field}</span>
                                        </div>
                                        <p className="text-slate-300 leading-normal">{alert.message}</p>
                                        <span className="text-[9px] text-blue-400 hover:underline mt-2 block">Haga clic para auditar la celda &raquo;</span>
                                    </div>
                                );
                            })}
                            {masterAlerts.length === 0 && (
                                <div className="col-span-2 p-12 text-center text-slate-500 italic font-semibold">
                                    ✓ Validación aprobada 100%. No se registran avisos en este módulo.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}