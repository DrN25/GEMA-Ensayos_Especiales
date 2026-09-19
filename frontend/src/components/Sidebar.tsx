import React, { useState } from 'react';
import {
  LayoutDashboard,
  Database,
  FlaskConical,
  Activity,
  TrendingUp,
  Scissors,
  Compass,
  Layers,
  DatabaseZap,
  ChevronDown,
  ChevronRight,
  Sun,
  Moon,
  BarChart2,
  FolderLock,
  ShieldCheck
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  isConnected: boolean;
  dbInfo: { db_type: string; is_local_fallback: boolean; server?: string } | null;
  isCollapsed: boolean;
}

export default function Sidebar({
  currentTab,
  setCurrentTab,
  darkMode,
  setDarkMode,
  isConnected,
  dbInfo,
  isCollapsed
}: SidebarProps) {
  const [isDistExpanded, setIsDistExpanded] = useState(true);

  const distTabs = [
    { id: 'ucs', label: 'Compresión Uniaxial', icon: FlaskConical },
    { id: 'elasticas', label: 'Constantes Elásticas', icon: Activity },
    { id: 'traccion', label: 'Tracción Indirecta', icon: TrendingUp },
    { id: 'corte', label: 'Corte Directo', icon: Scissors },
    { id: 'triaxial', label: 'Triaxial', icon: Compass },
  ];

  return (
    <aside
      className={`bg-slate-950/90 border-r border-slate-900/80 flex flex-col h-screen select-none shrink-0 transition-all duration-300 ease-in-out text-left ${isCollapsed ? 'w-0 opacity-0 overflow-hidden border-r-0 pointer-events-none' : 'w-64 opacity-100'
        }`}
    >
      <div className={`flex flex-col h-full w-64 transition-opacity duration-200 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
        {/* Brand Header */}
        <div
          onClick={() => setCurrentTab('dashboard')}
          className="p-5 border-b border-navy-800/80 flex items-center gap-3 cursor-pointer hover:bg-slate-900/20 transition-all shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <DatabaseZap className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="font-extrabold text-xs tracking-widest text-slate-100">SIGEG 2.0</h1>
            <span className="text-xs text-slate-500 font-extrabold tracking-wider uppercase block mt-0.5">
              Ensayos Especiales
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto custom-scrollbar">
          {/* GENERAL */}
          <div className="space-y-1">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest block px-3 mb-1.5">General</span>
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${currentTab === 'dashboard'
                ? 'bg-indigo-500/10 border-indigo-500/10 text-indigo-400 font-black border-l-2 border-l-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.05)]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
                }`}
            >
              <LayoutDashboard size={14} />
              <span>Dashboard</span>
            </button>
          </div>

          {/* REGISTRO DE CAMPO */}
          <div className="space-y-1">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest block px-3 mb-1.5">Registro de Campo</span>
            <button
              onClick={() => setCurrentTab('registro_maestro')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${currentTab === 'registro_maestro'
                ? 'bg-indigo-500/10 border-indigo-500/10 text-indigo-400 font-black border-l-2 border-l-indigo-500'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
                }`}
            >
              <Database size={14} />
              <span>Registro Maestro</span>
            </button>
          </div>

          {/* DISTRIBUCIÓN */}
          <div className="space-y-1">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest block px-3 mb-1.5">Ensayos Especiales</span>
            <div className="flex items-center justify-between w-full rounded-xl text-xs font-bold transition-all relative">
              <button
                onClick={() => setCurrentTab('distribucion')}
                className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-l-xl border-l-2 transition-all ${currentTab === 'distribucion'
                  ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/10'
                  }`}
              >
                <Layers size={14} />
                <span>Distribución</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDistExpanded(!isDistExpanded);
                }}
                className="p-2.5 text-slate-500 hover:text-slate-300 hover:bg-slate-900/10 rounded-r-xl transition-all"
              >
                {isDistExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>

            {isDistExpanded && (
              <div className="pl-3.5 space-y-1.5 border-l border-slate-800 ml-5 animate-fade-in">
                {distTabs.map(sub => {
                  const subActive = currentTab === sub.id;
                  const SubIcon = sub.icon;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setCurrentTab(sub.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${subActive
                        ? 'bg-indigo-500/10 text-indigo-400 font-extrabold border-l-2 border-l-indigo-500'
                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/10'
                        }`}
                    >
                      <SubIcon size={13} className={subActive ? 'text-indigo-400' : 'text-slate-400'} />
                      <span>{sub.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* PROPIEDADES */}
          <div className="space-y-1">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest block px-3 mb-1.5">Propiedades</span>
            <button
              onClick={() => setCurrentTab('propiedades')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${currentTab === 'propiedades'
                ? 'bg-indigo-500/10 border-indigo-500/10 text-indigo-400 font-black border-l-2 border-l-indigo-500'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
                }`}
            >
              <Layers size={14} />
              <span>Propiedades Físicas</span>
            </button>
          </div>

          {/* AUDITORÍA */}
          <div className="space-y-1">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest block px-3 mb-1.5">Control de Calidad</span>
            <button
              onClick={() => setCurrentTab('auditoria')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${currentTab === 'auditoria'
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 font-black border-l-2 border-l-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
                }`}
            >
              <ShieldCheck size={14} className={currentTab === 'auditoria' ? 'text-amber-400' : 'text-slate-400'} />
              <span>Auditoría QA/QC</span>
            </button>
          </div>

          {/* REPORTES */}
          <div className="space-y-1">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest block px-3 mb-1.5">Informes</span>
            <button
              onClick={() => setCurrentTab('reportes')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${currentTab === 'reportes'
                ? 'bg-indigo-500/10 border-indigo-500/10 text-indigo-400 font-black border-l-2 border-l-indigo-500'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
                }`}
            >
              <BarChart2 size={14} />
              <span>Reportes</span>
            </button>
          </div>

          {/* MAESTROS (Reubicado estrictamente al final y sin botones chevron de submenú) */}
          <div className="space-y-1">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest block px-3 mb-1.5">Maestros</span>
            <button
              onClick={() => setCurrentTab('proyectos')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${currentTab === 'proyectos'
                ? 'bg-indigo-500/10 border-indigo-500/10 text-indigo-400 font-black border-l-2 border-l-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.05)]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
                }`}
            >
              <FolderLock size={14} />
              <span>Proyectos</span>
            </button>
          </div>

        </nav>

        {/* Database Status Panel */}
        <div className="px-5 py-3.5 border-t border-slate-900 bg-slate-950/40 text-xs shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">
              {dbInfo ? (dbInfo.is_local_fallback ? "SQLite Local" : "SQL Server") : "Database"}
            </span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${!isConnected
                  ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] animate-pulse'
                  : dbInfo?.is_local_fallback
                    ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse'
                    : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse'
                }`} />
              <span className={`font-black uppercase tracking-wider text-xs ${!isConnected
                  ? 'text-rose-400'
                  : dbInfo?.is_local_fallback
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}>
                {!isConnected
                  ? 'Offline'
                  : dbInfo?.is_local_fallback
                    ? 'Local'
                    : 'Conectado'}
              </span>
            </div>
          </div>
          {dbInfo && !dbInfo.is_local_fallback && dbInfo.server && (
            <div className="text-xs text-slate-500 mt-1 truncate font-mono" title={dbInfo.server}>
              Host: {dbInfo.server}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <span className="text-xs text-slate-500 font-medium">Tema: {darkMode ? 'Oscuro' : 'Claro'}</span>
          </div>
          <div className="text-xs text-slate-600 font-mono">v2.0.0</div>
        </div>
      </div>
    </aside>
  );
}