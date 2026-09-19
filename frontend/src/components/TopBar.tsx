import React, { useState } from 'react';
import { ArrowLeft, BookOpen, Save, ChevronDown, RefreshCw, Menu, AlignLeft } from 'lucide-react';

interface TopBarProps {
    currentTab: string;
    setCurrentTab: (tab: string) => void;
    onBack: () => void;
    canGoBack: boolean;
    onOpenCatalogs: () => void;
    onSaveAll: () => void;
    onSaveSpecific: (tab: string) => void;
    onReconnect: () => void;
    isConnected: boolean;
    saveStatus: 'synced' | 'unsaved' | 'error' | 'saving';
    isSidebarCollapsed: boolean;
    onToggleSidebar: () => void;
    hasAlerts: boolean;
    checkModuleModified: (tab: string) => boolean;
}

const MODULE_LABELS: Record<string, string> = {
    dashboard: "Dashboard",
    registro_maestro: "Registro Maestro",
    proyectos: "Proyectos",
    ucs: "Compresión Uniaxial",
    elasticas: "Constantes Elásticas",
    traccion: "Tracción Indirecta",
    corte: "Corte Directo",
    triaxial: "Compresión Triaxial",
    propiedades: "Propiedades Físicas",
    reportes: "Reportes"
};

export default function TopBar({
    currentTab,
    setCurrentTab,
    onBack,
    canGoBack,
    onOpenCatalogs,
    onSaveAll,
    onSaveSpecific,
    onReconnect,
    isConnected,
    saveStatus,
    isSidebarCollapsed,
    onToggleSidebar,
    hasAlerts,
    checkModuleModified
}: TopBarProps) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const getBreadcrumbs = () => {
        if (currentTab === 'dashboard') {
            return (
                <button onClick={() => setCurrentTab('dashboard')} className="text-indigo-400 font-black tracking-wider uppercase bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-lg text-xs">
                    Dashboard
                </button>
            );
        }

        const underDistribution = ['ucs', 'elasticas', 'traccion', 'corte', 'triaxial'].includes(currentTab);

        if (underDistribution) {
            return (
                <div className="flex items-center gap-2 text-xs">
                    <button onClick={() => setCurrentTab('distribucion')} className="text-slate-400 hover:text-slate-100 transition-colors font-bold">
                        Distribución
                    </button>
                    <span className="text-slate-600 font-semibold">&gt;</span>
                    <button onClick={() => setCurrentTab(currentTab)} className="text-indigo-400 font-black tracking-wider uppercase bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-lg">
                        {MODULE_LABELS[currentTab] || currentTab}
                    </button>
                </div>
            );
        }

        if (currentTab === 'proyectos') {
            return (
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 font-bold">Maestros</span>
                    <span className="text-slate-600 font-semibold">&gt;</span>
                    <button onClick={() => setCurrentTab('proyectos')} className="text-indigo-400 font-black tracking-wider uppercase bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-lg">
                        Proyectos
                    </button>
                </div>
            );
        }

        return (
            <button onClick={() => setCurrentTab(currentTab)} className="text-indigo-400 font-black tracking-wider uppercase bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-lg text-xs">
                {MODULE_LABELS[currentTab] || currentTab}
            </button>
        );
    };

    return (
        /* Se asigna z-50 de forma estricta para garantizar que el TopBar siempre esté por encima de la tabla scrollable */
        <header className="h-16 border-b border-navy-800 flex items-center justify-between px-6 bg-navy-950/40 backdrop-blur z-50 shrink-0 select-none text-left">
            <div className="flex items-center gap-3">
                <button
                    onClick={onToggleSidebar}
                    className="p-1.5 rounded-lg bg-navy-900 border border-navy-800 hover:bg-navy-850 transition-all active:scale-95 shadow-sm h-10 w-10 flex items-center justify-center shrink-0"
                    title={isSidebarCollapsed ? "Expandir Sidebar" : "Contraer Sidebar"}
                >
                    {isSidebarCollapsed ? (
                        <Menu size={16} className="text-purple-400 drop-shadow-[0_0_8px_#a855f7] animate-pulse" />
                    ) : (
                        <AlignLeft size={16} className="text-purple-400 drop-shadow-[0_0_8px_#a855f7]" />
                    )}
                </button>

                {canGoBack && currentTab !== 'dashboard' && (
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1 bg-navy-900 hover:bg-navy-850 border border-navy-800 text-slate-300 hover:text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm h-10 shrink-0"
                    >
                        <ArrowLeft size={13} />
                        <span>Atrás</span>
                    </button>
                )}

                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest hidden lg:inline pr-3 border-r border-navy-800/80">
                    SIGEG 2.0
                </span>

                <div className="flex items-center gap-1.5">
                    {getBreadcrumbs()}
                </div>
            </div>

            <div className="flex items-center gap-3">
                {!isConnected && (
                    <button
                        onClick={onReconnect}
                        className="flex items-center gap-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-400 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 animate-pulse h-10"
                    >
                        <RefreshCw size={13} />
                        <span>Reintentar Conexión</span>
                    </button>
                )}

                <button
                    onClick={onOpenCatalogs}
                    className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/35 hover:bg-amber-500/20 text-amber-400 px-4 rounded-lg text-xs font-bold transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)] hover:shadow-[0_0_20px_rgba(245,158,11,0.25)] active:scale-95 h-10"
                >
                    <BookOpen size={13} className="text-amber-400 animate-pulse" />
                    <span>Catálogos</span>
                </button>

                {/* MÓDULO DE GUARDADO SQL SERVER - PRIORIDAD Z-50 */}
                <div className="relative flex items-center h-10 z-50">
                    {/* Desplegable de Guardado Segmentado */}
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className={`px-3 border border-r-0 rounded-l-lg text-xs transition-all active:scale-95 h-10 flex items-center justify-center ${hasAlerts
                                ? 'bg-slate-850 border-slate-800 text-slate-600 cursor-not-allowed'
                                : saveStatus === 'unsaved'
                                    ? 'bg-amber-600 hover:bg-amber-700 text-slate-900 border-amber-500/40 text-amber-100'
                                    : saveStatus === 'saving'
                                        ? 'bg-indigo-700 border-indigo-600 text-white'
                                        : saveStatus === 'error'
                                            ? 'bg-rose-700 border-rose-600 text-white'
                                            : 'bg-emerald-700 hover:bg-emerald-800 border-emerald-600/40 text-emerald-100'
                            }`}
                    >
                        <ChevronDown size={14} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Botón Principal Guardar Todo */}
                    <button
                        onClick={onSaveAll}
                        disabled={saveStatus === 'saving' || hasAlerts}
                        className={`flex items-center gap-1.5 px-4 rounded-r-lg text-xs font-black border transition-all shadow-md active:scale-95 h-10 ${hasAlerts
                                ? 'bg-slate-850 border-slate-800 text-slate-500 cursor-not-allowed'
                                : saveStatus === 'unsaved'
                                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-900 border-amber-400/40 shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse'
                                    : saveStatus === 'saving'
                                        ? 'bg-indigo-600 text-white border-indigo-500/30 cursor-wait'
                                        : saveStatus === 'error'
                                            ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.15)]'
                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                            }`}
                    >
                        <Save size={14} />
                        <span>{saveStatus === 'saving' ? 'Guardando...' : 'Guardar Todo'}</span>
                    </button>

                    {/* Dropdown de Guardado Específico - PRIORIDAD ABSOLUTA Z-[999] */}
                    {isDropdownOpen && (
                        <div className="absolute right-0 top-11 mt-2.5 w-64 bg-slate-950 border border-navy-800 rounded-xl shadow-2xl p-2 space-y-1.5 z-[999] animate-scale-up">
                            <div className="text-xs font-black text-slate-500 uppercase tracking-widest px-2.5 py-1 border-b border-navy-900">
                                Guardado por Módulo
                            </div>
                            {Object.entries(MODULE_LABELS).map(([key, label]) => {
                                if (key === 'dashboard' || key === 'reportes') return null;
                                const isModified = checkModuleModified(key);
                                return (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            onSaveSpecific(key);
                                            setIsDropdownOpen(false);
                                        }}
                                        disabled={hasAlerts}
                                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition-all truncate ${hasAlerts
                                                ? 'text-slate-600 cursor-not-allowed bg-slate-900/10'
                                                : isModified
                                                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 shadow-[0_0_10px_rgba(245,158,11,0.05)]'
                                                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.05)]'
                                            }`}
                                    >
                                        <span>Guardar — {label}</span>
                                        <span className={`w-2 h-2 rounded-full ${isModified ? 'bg-amber-400 shadow-[0_0_4px_#fbbf24]' : 'bg-emerald-500'}`} />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}