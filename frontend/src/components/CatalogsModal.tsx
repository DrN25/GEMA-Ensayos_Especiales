import React, { useState } from 'react';
import { X, BookOpen, Layers, Compass, BarChart } from 'lucide-react';

interface CatalogsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ISRM_TABLE = [
    { indice: "R0", minUcs: 0.25, maxUcs: 1, denominacion: "Roca extremadamente débil" },
    { indice: "R1", minUcs: 1, maxUcs: 5, denominacion: "Roca muy débil" },
    { indice: "R2", minUcs: 5, maxUcs: 25, denominacion: "Roca débil" },
    { indice: "R3", minUcs: 25, maxUcs: 50, denominacion: "Roca moderadamente resistente" },
    { indice: "R4", minUcs: 50, maxUcs: 100, denominacion: "Roca resistente" },
    { indice: "R5", minUcs: 100, maxUcs: 250, denominacion: "Roca muy resistente" },
    { indice: "R6", minUcs: 250, maxUcs: Infinity, denominacion: "Roca extremadamente resistente" },
];

export default function CatalogsModal({ isOpen, onClose }: CatalogsModalProps) {
    const [activeSubTab, setActiveTab] = useState<string>('registro_maestro');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left">
            {/* Modal con brillos y bordes neón ámbar premium */}
            <div className="glass-panel w-full max-w-4xl p-6 rounded-2xl border border-amber-500/25 bg-navy-900/95 shadow-[0_0_30px_rgba(245,158,11,0.12)] flex flex-col overflow-hidden text-xs text-slate-100 space-y-4">

                <div className="flex justify-between items-center border-b border-navy-850 pb-3 shrink-0">
                    <div className="flex items-center gap-2">
                        <BookOpen size={16} className="text-amber-400" />
                        <h3 className="text-xs font-black text-slate-100 uppercase tracking-widest">Catálogos de Referencia</h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-navy-800 text-slate-400 hover:text-white transition-colors">
                        <X size={14} />
                    </button>
                </div>

                {/* 7 pestañas obligatorias con estilo de brillo neón activo */}
                <div className="flex flex-wrap gap-1 border-b border-navy-900 pb-2 shrink-0">
                    {[
                        { id: 'registro_maestro', label: 'Registros Maestros' },
                        { id: 'ucs', label: 'Compresión Uniaxial' },
                        { id: 'elasticas', label: 'Constantes Elásticas' },
                        { id: 'traccion', label: 'Tracción Indirecta' },
                        { id: 'corte', label: 'Corte Directo' },
                        { id: 'triaxial', label: 'Triaxial' },
                        { id: 'propiedades', label: 'Propiedades Físicas' }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${activeSubTab === t.id
                                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.18)]'
                                    : 'bg-navy-950 border-navy-800/80 text-slate-400 hover:bg-navy-900/60'
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto max-h-96 pr-1 space-y-3">
                    {activeSubTab === 'registro_maestro' && (
                        <div className="space-y-3 animate-fade-in text-xs">
                            <h4 className="font-extrabold text-slate-200 text-xs">Guía de Parámetros de Registro de Campo</h4>
                            <p className="text-slate-400 text-xs">Metadatos de posicionamiento y códigos de control sugeridos para SIGEG 2.0.</p>
                            <table className="w-full text-left border-collapse border border-navy-900 rounded-lg overflow-hidden text-xs">
                                <thead>
                                    <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider border-b border-navy-850">
                                        <th className="py-2 px-3">Parámetro</th>
                                        <th className="py-2 px-3">Código de Control</th>
                                        <th className="py-2 px-3">Clasificación Geotécnica</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-navy-900/30 text-slate-300 font-semibold">
                                    <tr className="hover:bg-navy-900/10">
                                        <td className="py-2.5 px-3">Sondaje Diamantino</td>
                                        <td className="py-2.5 px-3 text-emerald-400">CHS-19 / CHS-20</td>
                                        <td className="py-2.5 px-3 font-medium">Sondaje de perforación con testigo continuo</td>
                                    </tr>
                                    <tr className="hover:bg-navy-900/10">
                                        <td className="py-2.5 px-3">Zonificación de Litologías</td>
                                        <td className="py-2.5 px-3 text-emerald-400">LIT_01 / LIT_02</td>
                                        <td className="py-2.5 px-3 font-medium">Estructura litoestratigráfica maestra</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeSubTab === 'ucs' && (
                        <div className="space-y-3 animate-fade-in text-xs">
                            <h4 className="font-black text-slate-200">Resistencias y Grados ISRM (Ensayos UCS)</h4>
                            <table className="w-full text-left border-collapse border border-navy-900 rounded-lg overflow-hidden">
                                <thead>
                                    <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-navy-850">
                                        <th className="py-2 px-3">Grado</th>
                                        <th className="py-2 px-3">Denominación</th>
                                        <th className="py-2 px-3 text-center">UCS Mínimo (MPa)</th>
                                        <th className="py-2 px-3 text-center">UCS Máximo (MPa)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-navy-900/30 text-slate-300 font-semibold">
                                    {[
                                        { g: "R0", d: "Roca extremadamente débil", min: 0.25, max: 1.0 },
                                        { g: "R1", d: "Roca muy débil", min: 1.0, max: 5.0 },
                                        { g: "R2", d: "Roca débil", min: 5.0, max: 25.0 },
                                        { g: "R3", d: "Roca moderadamente resistente", min: 25.0, max: 50.0 },
                                        { g: "R4", d: "Roca resistente", min: 50.0, max: 100.0 },
                                        { g: "R5", d: "Roca muy resistente", min: 100.0, max: 250.0 },
                                        { g: "R6", d: "Roca extremadamente resistente", min: 250.0, max: Infinity }
                                    ].map(r => (
                                        <tr key={r.g} className="hover:bg-navy-900/10">
                                            <td className="py-2.5 px-3 font-bold text-emerald-400">{r.g}</td>
                                            <td className="py-2.5 px-3 font-medium">{r.d}</td>
                                            <td className="py-2.5 px-3 text-center font-mono">{r.min}</td>
                                            <td className="py-2.5 px-3 text-center font-mono">{r.max === Infinity ? '∞' : r.max}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeSubTab === 'elasticas' && (
                        <div className="space-y-3 animate-fade-in text-xs">
                            <h4 className="font-black text-slate-200">Constantes Elásticas Típicas</h4>
                            <p className="text-slate-400 text-xs">Límites de elasticidad y Poisson sugeridos para auditoría geomecánica.</p>
                            <table className="w-full text-left border-collapse border border-navy-900 rounded-lg overflow-hidden">
                                <thead>
                                    <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-navy-850">
                                        <th className="py-2 px-3">Tipo de Roca</th>
                                        <th className="py-2 px-3">Módulo de Young (GPa)</th>
                                        <th className="py-2 px-3">Relación de Poisson</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-navy-900/30 text-slate-300 font-semibold">
                                    <tr className="hover:bg-navy-900/10">
                                        <td className="py-2.5 px-3 font-medium">Granito</td>
                                        <td className="py-2.5 px-3 font-mono">10.0 - 70.0</td>
                                        <td className="py-2.5 px-3 font-mono">0.10 - 0.30</td>
                                    </tr>
                                    <tr className="hover:bg-navy-900/10">
                                        <td className="py-2.5 px-3 font-medium">Arenisca</td>
                                        <td className="py-2.5 px-3 font-mono">5.0 - 40.0</td>
                                        <td className="py-2.5 px-3 font-mono">0.05 - 0.40</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeSubTab === 'traccion' && (
                        <div className="space-y-3 animate-fade-in text-xs">
                            <h4 className="font-black text-slate-200">Ensayos Brasileños (Tracción Indirecta)</h4>
                            <table className="w-full text-left border-collapse border border-navy-900 rounded-lg overflow-hidden">
                                <thead>
                                    <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-navy-850">
                                        <th className="py-2 px-3">Litología</th>
                                        <th className="py-2 px-3">Carga Promedio (kN)</th>
                                        <th className="py-2 px-3">Resistencia Sugerida (MPa)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-navy-900/30 text-slate-300 font-semibold font-mono">
                                    <tr className="hover:bg-navy-900/10">
                                        <td className="py-2.5 px-3 font-sans font-medium">Basalto</td>
                                        <td className="py-2.5 px-3">15.0 - 35.0</td>
                                        <td className="py-2.5 px-3">5.0 - 15.0</td>
                                    </tr>
                                    <tr className="hover:bg-navy-900/10">
                                        <td className="py-2.5 px-3 font-sans font-medium">Esquisto</td>
                                        <td className="py-2.5 px-3">3.0 - 12.0</td>
                                        <td className="py-2.5 px-3">2.0 - 8.0</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeSubTab === 'corte' && (
                        <div className="space-y-3 animate-fade-in text-xs">
                            <h4 className="font-black text-slate-200">Parámetros de Ensayos de Corte Directo</h4>
                            <table className="w-full text-left border-collapse border border-navy-900 rounded-lg overflow-hidden">
                                <thead>
                                    <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-navy-850">
                                        <th className="py-2 px-3">Estado de la Discontinuidad</th>
                                        <th className="py-2 px-3">Cohesión C (MPa)</th>
                                        <th className="py-2 px-3">Ángulo de Fricción (°)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-navy-900/30 text-slate-300 font-semibold font-mono">
                                    <tr className="hover:bg-navy-900/10">
                                        <td className="py-2.5 px-3 font-sans font-medium">Limpia y Rugosa (Sana)</td>
                                        <td className="py-2.5 px-3">0.10 - 2.00</td>
                                        <td className="py-2.5 px-3">35.0 - 45.0</td>
                                    </tr>
                                    <tr className="hover:bg-navy-900/10">
                                        <td className="py-2.5 px-3 font-sans font-medium">Con Relleno de Arcilla</td>
                                        <td className="py-2.5 px-3">0.01 - 0.15</td>
                                        <td className="py-2.5 px-3">10.0 - 20.0</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeSubTab === 'triaxial' && (
                        <div className="space-y-3 animate-fade-in text-xs">
                            <h4 className="font-black text-slate-200">Parámetros Intactos de Hoek-Brown (mi)</h4>
                            <table className="w-full text-left border-collapse border border-navy-900 rounded-lg overflow-hidden">
                                <thead>
                                    <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-navy-850">
                                        <th className="py-2 px-3">Grupo Litológico</th>
                                        <th className="py-2 px-3 text-center">Parámetro mi</th>
                                        <th className="py-2 px-3 text-center">Fricción Interna Promedio</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-navy-900/30 text-slate-300 font-semibold">
                                    <tr className="hover:bg-navy-900/10">
                                        <td className="py-2.5 px-3 font-medium">Granito / Riolita</td>
                                        <td className="py-2.5 px-3 text-center font-mono">30 ± 3</td>
                                        <td className="py-2.5 px-3 text-center font-mono">45° - 55°</td>
                                    </tr>
                                    <tr className="hover:bg-navy-900/10">
                                        <td className="py-2.5 px-3 font-medium">Caliza / Dolomita</td>
                                        <td className="py-2.5 px-3 text-center font-mono">8 ± 2</td>
                                        <td className="py-2.5 px-3 text-center font-mono">30° - 40°</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeSubTab === 'propiedades' && (
                        <div className="space-y-3 animate-fade-in text-xs">
                            <h4 className="font-black text-slate-200">Peso Unitario Típico de las Rocas</h4>
                            <table className="w-full text-left border-collapse border border-navy-900 rounded-lg overflow-hidden">
                                <thead>
                                    <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-navy-850">
                                        <th className="py-2 px-3">Litología</th>
                                        <th className="py-2 px-3 text-center">Peso Unitario Mínimo (gr/cm3)</th>
                                        <th className="py-2 px-3 text-center">Peso Unitario Máximo (gr/cm3)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-navy-900/30 text-slate-300 font-semibold font-mono">
                                    <tr className="hover:bg-navy-900/10">
                                        <td className="py-2.5 px-3 font-sans font-medium">Andesita / Basalto</td>
                                        <td className="py-2.5 px-3 text-center">2.40</td>
                                        <td className="py-2.5 px-3 text-center">2.90</td>
                                    </tr>
                                    <tr className="hover:bg-navy-900/10">
                                        <td className="py-2.5 px-3 font-sans font-medium">Toba / Ignimbrita</td>
                                        <td className="py-2.5 px-3 text-center">1.20</td>
                                        <td className="py-2.5 px-3 text-center">2.20</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-3 border-t border-navy-800/80 shrink-0">
                    <button onClick={onClose} className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-300 px-5 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm">
                        Cerrar Catálogo
                    </button>
                </div>
            </div>
        </div>
    );
}