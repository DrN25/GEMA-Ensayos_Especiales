import React from 'react';
import { FlaskConical, Activity, TrendingUp, Scissors, Compass, Layers, ShieldAlert, Check } from 'lucide-react';
import { type QAQCAlert } from '../utils/qaqcValidator';

interface DistribucionModulosProps {
    records: Record<string, any>[];
    qaqcAlerts: QAQCAlert[];
    onNavigateTab: (tabName: string) => void;
}

export default function DistribucionModulos({
    records,
    qaqcAlerts,
    onNavigateTab
}: DistribucionModulosProps) {

    const totalRecords = records.length;

    // Catálogo estructural con los mismos acabados, sombras neón y gradientes exactos que el Dashboard
    const cards = [
        {
            id: "ucs",
            label: "Compresión Uniaxial",
            subtitle: "Ensayos UCS básicos de testigo",
            icon: FlaskConical,
            cardStyle: "border-orange-500/30 bg-orange-500/[0.03] bg-gradient-to-br from-orange-500/[0.08] to-transparent shadow-[0_0_20px_rgba(249,115,22,0.12)] hover:border-orange-500/50 hover:bg-orange-500/[0.06] hover:shadow-[0_0_25px_rgba(249,115,22,0.22)]",
            badgeStyle: "text-orange-400 bg-orange-500/10 border border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.1)]",
            iconStyle: "text-orange-400 bg-orange-500/15 border border-orange-500/30",
            progressBar: "bg-orange-500 shadow-[0_0_8px_#f97316]",
            textLabel: "text-orange-400",
            description: "UCS (MPa) · Diámetro testigo (cm) · Carga de rotura (kN) · Rotura",
            filterFn: (r: any) => !!r.ucs_diametro || !!r.ucs_carga_rotura
        },
        {
            id: "elasticas",
            label: "Constantes Elásticas",
            subtitle: "Propiedades elásticas de Young y Poisson",
            icon: Activity,
            cardStyle: "border-red-500/30 bg-red-500/[0.03] bg-gradient-to-br from-red-500/[0.08] to-transparent shadow-[0_0_20px_rgba(239,68,68,0.12)] hover:border-red-500/50 hover:bg-red-500/[0.06] hover:shadow-[0_0_25px_rgba(239,68,68,0.22)]",
            badgeStyle: "text-red-400 bg-red-500/10 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.1)]",
            iconStyle: "text-red-400 bg-red-500/15 border border-red-500/30",
            progressBar: "bg-red-500 shadow-[0_0_8px_#ef4444]",
            textLabel: "text-red-400",
            description: "Módulo de Young (GPa) · Relación de Poisson",
            filterFn: (r: any) => !!r.elasticas_modulo_young || !!r.elasticas_poisson
        },
        {
            id: "traccion",
            label: "Tracción Indirecta",
            subtitle: "Ensayo brasileño de rotura",
            icon: TrendingUp,
            cardStyle: "border-yellow-500/30 bg-yellow-500/[0.03] bg-gradient-to-br from-yellow-500/[0.08] to-transparent shadow-[0_0_20px_rgba(234,179,8,0.12)] hover:border-yellow-500/50 hover:bg-yellow-500/[0.06] hover:shadow-[0_0_25px_rgba(234,179,8,0.22)]",
            badgeStyle: "text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.1)]",
            iconStyle: "text-yellow-400 bg-yellow-500/15 border border-yellow-500/30",
            progressBar: "bg-yellow-500 shadow-[0_0_8px_#eab308]",
            textLabel: "text-yellow-400",
            description: "Carga de rotura promedio (kN) · Resistencia promedio (MPa)",
            filterFn: (r: any) => !!r.traccion_carga_promedio || !!r.traccion_resistencia_mpa
        },
        {
            id: "corte",
            label: "Corte Directo",
            subtitle: "Corte e inclinación en discontinuidades",
            icon: Scissors,
            cardStyle: "border-emerald-500/30 bg-emerald-500/[0.03] bg-gradient-to-br from-emerald-500/[0.08] to-transparent shadow-[0_0_20px_rgba(16,185,129,0.12)] hover:border-emerald-500/50 hover:bg-emerald-500/[0.06] hover:shadow-[0_0_25px_rgba(16,185,129,0.22)]",
            badgeStyle: "text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]",
            iconStyle: "text-emerald-400 bg-emerald-500/15 border border-emerald-500/30",
            progressBar: "bg-emerald-500 shadow-[0_0_8px_#10b981]",
            textLabel: "text-emerald-400",
            description: "Área (cm²) · Cohesión (MPa) · Ángulo de Fricción (°)",
            filterFn: (r: any) => !!r.corte_area || !!r.corte_cohesion_mpa
        },
        {
            id: "triaxial",
            label: "Compresión Triaxial",
            subtitle: "Criterios Hoek-Brown y confinamiento",
            icon: Compass,
            cardStyle: "border-purple-500/30 bg-purple-500/[0.03] bg-gradient-to-br from-purple-500/[0.08] to-transparent shadow-[0_0_20px_rgba(168,85,247,0.12)] hover:border-purple-500/50 hover:bg-purple-500/[0.06] hover:shadow-[0_0_25px_rgba(168,85,247,0.22)]",
            badgeStyle: "text-purple-400 bg-purple-500/10 border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.1)]",
            iconStyle: "text-purple-400 bg-purple-500/15 border border-purple-500/30",
            progressBar: "bg-purple-500 shadow-[0_0_8px_#a855f7]",
            textLabel: "text-purple-400",
            description: "Carga de confinamiento (MPa) · Esfuerzo máximo (MPa) · Cohesión",
            filterFn: (r: any) => !!r.triaxial_esfuerzo_maximo || !!r.triaxial_cohesion_mpa
        },
        {
            id: "propiedades",
            label: "Propiedades Físicas",
            subtitle: "Índice de densidad y peso unitario",
            icon: Layers,
            cardStyle: "border-sky-500/30 bg-sky-500/[0.03] bg-gradient-to-br from-sky-500/[0.08] to-transparent shadow-[0_0_20px_rgba(56,189,248,0.12)] hover:border-sky-500/50 hover:bg-sky-500/[0.06] hover:shadow-[0_0_25px_rgba(56,189,248,0.22)]",
            progressBar: "bg-sky-500 shadow-[0_0_8px_#38bdf8]",
            borderHover: "",
            description: "Peso unitario geométrico (gr/cm³) · Observación",
            badgeStyle: "text-sky-400 bg-sky-500/10 border border-sky-500/30 shadow-[0_0_10px_rgba(56,189,248,0.1)]",
            iconStyle: "text-sky-400 bg-sky-500/15 border border-sky-500/30",
            textLabel: "text-sky-400",
            filterFn: (r: any) => !!r.prop_peso_unitario_geometrico
        }
    ];

    return (
        <div className="space-y-6 text-left select-none animate-fade-in text-xs">
            <div>
                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest block mb-1">Distribución por Tipo — Seleccionar Módulo</span>
                <h2 className="text-xl font-extrabold text-slate-100 uppercase tracking-wider">Distribución por Módulos</h2>
                <p className="text-xs text-slate-400 mt-1 font-semibold leading-relaxed">
                    Los registros se distribuyen automáticamente según el tipo de ensayo mapeado en la base de datos. <strong className="text-indigo-400 font-bold">{totalRecords}</strong> ensayos registrados.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {cards.map(c => {
                    const Icon = c.icon;
                    const matching = records.filter(c.filterFn);
                    const activeAlerts = qaqcAlerts.filter(a => a.tab === c.id);
                    const pct = totalRecords > 0 ? Math.round((matching.length / totalRecords) * 100) : 0;

                    return (
                        <div
                            key={c.id}
                            onClick={() => onNavigateTab(c.id)}
                            className={`glass-panel p-5 rounded-2xl border cursor-pointer transition-all duration-300 active:scale-[0.98] flex flex-col justify-between h-72 ${c.cardStyle}`}
                        >
                            <div>
                                {/* Cabecera Tarjeta */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${c.iconStyle}`}>
                                            <Icon size={16} />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-slate-100 uppercase tracking-wider">{c.label}</h4>
                                            <p className="text-xs text-slate-500 font-bold">{c.subtitle}</p>
                                        </div>
                                    </div>
                                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-full font-mono ${c.badgeStyle}`}>
                                        {pct}%
                                    </span>
                                </div>

                                {/* Grid de métricas con fuentes grandes (text-2xl) para impacto de datos */}
                                <div className="grid grid-cols-3 gap-3 mt-4 bg-navy-950/45 p-3.5 rounded-xl border border-navy-900 text-center font-mono text-xs">
                                    <div>
                                        <div className="text-xs font-bold text-slate-500 uppercase">Total</div>
                                        <div className="text-2xl font-black text-slate-100 mt-1">{matching.length}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-500 uppercase">Val.</div>
                                        <div className="text-2xl font-black text-emerald-400 mt-1 flex items-center justify-center gap-1">
                                            <Check size={18} className="stroke-[3]" />
                                            <span>{matching.length - activeAlerts.length}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-500 uppercase">Alertas</div>
                                        <div className={`text-2xl font-black mt-1 flex items-center justify-center gap-1 ${activeAlerts.length > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`}>
                                            <ShieldAlert size={18} className="stroke-[3]" />
                                            <span>{activeAlerts.length}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Progress Bar Neón (Llena el espacio en blanco y aporta dinamismo) */}
                            <div className="space-y-1.5 mt-3">
                                <div className="flex justify-between text-xs font-bold text-slate-400">
                                    <span className={c.textLabel}>Porcentaje de Muestras</span>
                                    <span>{pct}%</span>
                                </div>
                                <div className="w-full bg-navy-900 rounded-full h-2 border border-navy-850 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${c.progressBar}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>

                            {/* Parámetros descriptivos al pie */}
                            <div className="mt-3 pt-3 border-t border-navy-900/60">
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1">Parámetros clave:</span>
                                <p className="text-xs text-slate-400 font-bold leading-relaxed truncate animate-fade-in" title={c.description}>
                                    {c.description}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}