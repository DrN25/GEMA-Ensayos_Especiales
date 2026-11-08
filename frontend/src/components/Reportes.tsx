import React, { useMemo } from 'react';
import { BarChart, Printer, Clipboard, FileSpreadsheet, Layers, ShieldCheck, Database } from 'lucide-react';

interface ReportesProps {
    records: Record<string, any>[];
    alertsCount: number;
}

export default function Reportes({ records, alertsCount }: ReportesProps) {
    const total = records.length;

    const summary = useMemo(() => {
        return {
            ucs: records.filter(r => r.ucs_diametro || r.ucs_carga_rotura).length,
            elasticas: records.filter(r => r.elasticas_modulo_young || r.elasticas_poisson).length,
            traccion: records.filter(r => r.traccion_carga_promedio || r.traccion_resistencia_mpa).length,
            corte: records.filter(r => r.corte_area || r.corte_cohesion_mpa).length,
            triaxial: records.filter(r => r.triaxial_esfuerzo_maximo || r.triaxial_cohesion_mpa).length,
            propiedades: records.filter(r => r.prop_peso_unitario_geometrico).length,
        };
    }, [records]);

    const uniqueSondajes = useMemo(() => {
        return Array.from(new Set(records.map(r => r.sondaje).filter(Boolean))).sort();
    }, [records]);

    return (
        <div className="space-y-6 text-left select-none animate-fade-in view-dashboard view-geotech">
            {/* Header Toolbar */}
            <div className="glass-panel flex flex-col sm:flex-row justify-between items-start sm:items-center bg-navy-950/20 border border-navy-800 p-5 rounded-2xl gap-3 shadow-md">
                <div>
                    <h2 className="text-xl font-black text-slate-100 uppercase tracking-wider">Centro de Reportes y Estadísticas</h2>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Reportes consolidados e indicadores clave de la campaña geotécnica.</p>
                </div>
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 bg-sky-500/15 border border-sky-500/30 hover:bg-sky-500/25 text-sky-400 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 self-end sm:self-auto"
                >
                    <Printer size={14} />
                    <span>Imprimir Reporte</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-5 rounded-2xl bg-navy-950/20 border border-navy-800 col-span-2 space-y-4 shadow-xl">
                    <h3 className="text-xs font-black text-slate-100 uppercase tracking-widest border-b border-navy-800 pb-3">Distribución Física de Ensayos</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-navy-800 text-slate-400 font-black uppercase text-[10px] tracking-wider">
                                    <th className="pb-3">Sondaje Diamantino</th>
                                    <th className="pb-3 text-center text-sky-400">UCS</th>
                                    <th className="pb-3 text-center text-indigo-400">Elásticas</th>
                                    <th className="pb-3 text-center text-cyan-400">Tracción</th>
                                    <th className="pb-3 text-center text-teal-400">Corte</th>
                                    <th className="pb-3 text-center text-sky-400">Triaxial</th>
                                    <th className="pb-3 text-center text-slate-400">Prop. Físicas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-navy-800/60 text-slate-300 font-semibold font-mono">
                                {uniqueSondajes.map(s => {
                                    const sRows = records.filter(r => r.sondaje === s);
                                    return (
                                        <tr key={s} className="hover:bg-navy-900/30 transition-colors">
                                            <td className="py-2.5 font-sans font-black text-slate-100">{s}</td>
                                            <td className="py-2.5 text-center text-sky-400">{sRows.filter(r => r.ucs_diametro || r.ucs_carga_rotura).length}</td>
                                            <td className="py-2.5 text-center text-indigo-400">{sRows.filter(r => r.elasticas_modulo_young || r.elasticas_poisson).length}</td>
                                            <td className="py-2.5 text-center text-cyan-400">{sRows.filter(r => r.traccion_carga_promedio || r.traccion_resistencia_mpa).length}</td>
                                            <td className="py-2.5 text-center text-teal-400">{sRows.filter(r => r.corte_area || r.corte_cohesion_mpa).length}</td>
                                            <td className="py-2.5 text-center text-sky-400">{sRows.filter(r => r.triaxial_esfuerzo_maximo || r.triaxial_cohesion_mpa).length}</td>
                                            <td className="py-2.5 text-center text-slate-400">{sRows.filter(r => r.prop_peso_unitario_geometrico).length}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="glass-panel p-5 rounded-2xl bg-navy-950/20 border border-navy-800 space-y-4 shadow-xl">
                        <h3 className="text-xs font-black text-slate-100 uppercase tracking-widest border-b border-navy-800 pb-3">KPIS Operacionales</h3>
                        <div className="space-y-3.5">
                            <div className="flex justify-between items-center bg-navy-900/60 p-3 rounded-xl border border-navy-800">
                                <span className="text-xs text-slate-400 font-semibold">Total Registros</span>
                                <span className="text-base font-black text-slate-100 font-mono">{total}</span>
                            </div>
                            <div className="flex justify-between items-center bg-navy-900/60 p-3 rounded-xl border border-navy-800">
                                <span className="text-xs text-slate-400 font-semibold">Alertas Críticas</span>
                                <span className={`text-base font-black font-mono ${alertsCount > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>{alertsCount}</span>
                            </div>
                            <div className="flex justify-between items-center bg-navy-900/60 p-3 rounded-xl border border-navy-800">
                                <span className="text-xs text-slate-400 font-semibold">Tasa de Consistencia</span>
                                <span className="text-base font-black text-emerald-400 font-mono">
                                    {total > 0 ? Math.round(((total - alertsCount) / total) * 100) : 100}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}