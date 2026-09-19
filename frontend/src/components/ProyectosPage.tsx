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
        <div className="space-y-6 text-left select-none animate-fade-in text-xs font-semibold">

            {/* Cabecera Maestros */}
            <div className="flex flex-wrap justify-between items-center bg-navy-950/20 border border-navy-850 p-4 rounded-xl gap-3 text-xs">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.06)]">
                        <FolderLock size={18} />
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider">Maestro de Proyectos</h4>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold font-sans">Defina los proyectos oficiales y sus respectivos sinónimos de mapeo</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onAddProyecto}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-md shadow-indigo-950/15"
                    >
                        <Plus size={13} />
                        <span>Nuevo Registro</span>
                    </button>
                    <button
                        onClick={onSaveProyectos}
                        disabled={syncStatus === 'saving'}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.2)] px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all active:scale-95"
                    >
                        <Save size={13} />
                        <span>{syncStatus === 'saving' ? 'Guardando...' : 'Guardar'}</span>
                    </button>
                </div>
            </div>

            {/* Tabla Maestra */}
            <div className="border border-navy-800/80 rounded-2xl bg-navy-950/20 shadow-xl overflow-hidden relative">
                <div className="overflow-x-auto max-h-[70vh] custom-scrollbar">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="bg-navy-950 text-slate-300 font-bold uppercase text-xs border-b border-navy-800">
                                <th className="py-3 px-4 w-24">ID</th>
                                <th className="py-3 px-4 w-72">Nombre Oficial</th>
                                <th className="py-3 px-4">Sinónimos (Separados por Comas)</th>
                                <th className="py-3 px-4 w-32 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-navy-900/40 text-xs text-slate-300 font-normal">
                            {proyectos.map((p, idx) => (
                                <tr key={idx} className="hover:bg-navy-900/10">
                                    <td className="py-3 px-4 font-mono text-slate-400">{p.id || "Auto"}</td>
                                    <td className="py-2 px-4 border border-navy-800/80">
                                        <input
                                            type="text"
                                            value={p.nombre}
                                            onChange={(e) => onUpdateProyecto(idx, 'nombre', e.target.value)}
                                            className="w-full bg-transparent border-0 focus:outline-none text-slate-100"
                                            placeholder="Ej. CHABB"
                                        />
                                    </td>
                                    <td className="py-2 px-4 border border-navy-800/80">
                                        <input
                                            type="text"
                                            value={p.sinonimos || ''}
                                            onChange={(e) => onUpdateProyecto(idx, 'sinonimos', e.target.value)}
                                            className="w-full bg-transparent border-0 focus:outline-none text-slate-100"
                                            placeholder="Ej. CHABB, CH-ABB, PROYECTO ABB"
                                        />
                                    </td>
                                    <td className="py-2 px-4 text-center border border-navy-800/80">
                                        <button
                                            onClick={() => onDeleteProyecto(idx)}
                                            className="p-1 rounded bg-rose-600/10 hover:bg-rose-600/30 text-rose-400 border border-rose-500/20 transition-all active:scale-95"
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