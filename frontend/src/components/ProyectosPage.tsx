import React from 'react';
import { Plus, Trash2, Save, FolderLock } from 'lucide-react';

interface Proyecto {
    id?: number;
    nombre: string;
    sinonimos?: string;
}

interface ProyectosPageProps {
    proyectos: Proyecto[];
    onUpdateProyecto: (index: number, field: keyof Proyecto, value: string) => void;
    onDeleteProyecto: (index: number) => void;
    onAddProyecto: () => void;
    onSaveProyectos: () => void;
    syncStatus: 'synced' | 'unsaved' | 'error' | 'saving';
}

export default function ProyectosPage({
    proyectos,
    onUpdateProyecto,
    onDeleteProyecto,
    onAddProyecto,
    onSaveProyectos,
    syncStatus
}: ProyectosPageProps) {

    return (
        <div className="space-y-6 text-left select-none animate-fade-in text-xs font-semibold view-dashboard view-geotech">

            {/* Cabecera Maestros */}
            <div className="glass-panel flex flex-col sm:flex-row justify-between items-start sm:items-center bg-navy-950/20 border border-navy-800 p-4 rounded-xl gap-3 text-xs shadow-md">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-sky-500/10 border border-sky-500/25 text-sky-400 rounded-lg shadow-[0_0_15px_rgba(14,165,233,0.1)]">
                        <FolderLock size={18} />
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider">Maestro de Proyectos</h4>
                        <p className="text-xs text-slate-400 font-medium">Defina los proyectos oficiales y sus respectivos sinónimos de mapeo e importación</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                        onClick={onAddProyecto}
                        className="flex items-center gap-1.5 bg-sky-500/15 border border-sky-500/30 hover:bg-sky-500/25 text-sky-400 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm"
                    >
                        <Plus size={13} />
                        <span>Nuevo Registro</span>
                    </button>
                    <button
                        onClick={onSaveProyectos}
                        disabled={syncStatus === 'saving'}
                        className="flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.12)] px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all active:scale-95 disabled:opacity-50"
                    >
                        <Save size={13} />
                        <span>{syncStatus === 'saving' ? 'Guardando...' : 'Guardar'}</span>
                    </button>
                </div>
            </div>

            {/* Tabla Maestra */}
            <div className="glass-panel border border-navy-800 rounded-2xl bg-navy-950/20 shadow-xl overflow-hidden relative">
                <div className="overflow-x-auto max-h-[70vh] custom-scrollbar">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="bg-navy-900 text-slate-400 font-black uppercase text-[10px] tracking-wider border-b border-navy-800 h-9">
                                <th className="py-2.5 px-4 w-24">ID</th>
                                <th className="py-2.5 px-4 w-72">Nombre Oficial</th>
                                <th className="py-2.5 px-4">Sinónimos (Separados por Comas)</th>
                                <th className="py-2.5 px-4 w-24 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-navy-800/60 text-xs text-slate-200 font-normal">
                            {proyectos.map((p, idx) => (
                                <tr key={idx} className="hover:bg-navy-900/30 transition-colors">
                                    <td className="py-2.5 px-4 font-mono text-slate-400">{p.id || "Auto"}</td>
                                    <td className="py-2 px-4 border-r border-navy-800/60">
                                        <input
                                            type="text"
                                            value={p.nombre}
                                            onChange={(e) => onUpdateProyecto(idx, 'nombre', e.target.value)}
                                            className="w-full bg-navy-900 border border-navy-800 focus:border-sky-500 rounded px-2.5 py-1 outline-none text-slate-100 placeholder:text-slate-500 font-semibold"
                                            placeholder="Ej. CHABB"
                                        />
                                    </td>
                                    <td className="py-2 px-4 border-r border-navy-800/60">
                                        <input
                                            type="text"
                                            value={p.sinonimos || ''}
                                            onChange={(e) => onUpdateProyecto(idx, 'sinonimos', e.target.value)}
                                            className="w-full bg-navy-900 border border-navy-800 focus:border-sky-500 rounded px-2.5 py-1 outline-none text-slate-100 placeholder:text-slate-500"
                                            placeholder="Ej. CHABB, CH-ABB, PROYECTO ABB"
                                        />
                                    </td>
                                    <td className="py-2 px-4 text-center">
                                        <button
                                            onClick={() => onDeleteProyecto(idx)}
                                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all active:scale-95"
                                            title="Eliminar proyecto"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {proyectos.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-slate-500 italic">No se han registrado proyectos en la base de datos de maestros.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}