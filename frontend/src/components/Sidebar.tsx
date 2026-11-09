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
  ChevronDown,
  ChevronRight,
  Sun,
  Moon,
  BarChart2,
  FolderLock,
  ShieldCheck,
  X,
  Boxes
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  isConnected: boolean;
  dbInfo: { db_type: string; is_local_fallback: boolean; server?: string } | null;
  isCollapsed: boolean;
  onToggleSidebar?: () => void;
}

export default function Sidebar({
  currentTab,
  setCurrentTab,
  darkMode,
  setDarkMode,
  isConnected,
  dbInfo,
  isCollapsed,
  onToggleSidebar
}: SidebarProps) {
  const [isDistExpanded, setIsDistExpanded] = useState(true);

  const distTabs = [
    { id: 'ucs', label: 'Compresión Uniaxial (UCS)', icon: FlaskConical },
    { id: 'elasticas', label: 'Constantes Elásticas', icon: Activity },
    { id: 'traccion', label: 'Tracción Indirecta', icon: TrendingUp },
    { id: 'corte', label: 'Corte Directo', icon: Scissors },
    { id: 'triaxial', label: 'Compresión Triaxial', icon: Compass },
  ];

  const handleSelectTab = (tab: string) => {
    setCurrentTab(tab);
    if (window.innerWidth < 768 && onToggleSidebar && !isCollapsed) {
      onToggleSidebar();
    }
  };

  const navCategories = [
    {
      category: 'GENERAL',
      items: [
        { id: 'dashboard', label: 'Dashboard Ejecutivo', icon: LayoutDashboard }
      ]
    },
    {
      category: 'BASE GEOTÉCNICA',
      items: [
        { id: 'registro_maestro', label: 'Registro Maestro  ', icon: Database }
      ]
    },
    {
      category: 'ENSAYOS ESPECIALES',
      isGroup: true
    },
    {
      category: 'PROPIEDADES FÍSICAS',
      items: [
        { id: 'propiedades', label: 'Propiedades Físicas', icon: Layers }
      ]
    },
    /*
    {
      category: 'CONTROL DE CALIDAD',
      items: [
        { id: 'auditoria', label: 'Auditoría QA/QC Masiva', icon: ShieldCheck }
      ]
    },
    {
      category: 'INFORMES',
      items: [
        { id: 'reportes', label: 'Reportes y Gráficos', icon: BarChart2 }
      ]
    },
    {
      category: 'CONFIGURACIÓN',
      items: [
        { id: 'proyectos', label: 'Proyectos y Canteras', icon: FolderLock }
      ]
    }
    */
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {!isCollapsed && (
        <div
          onClick={onToggleSidebar}
          className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      <aside
        className={`glass-panel chrome-dark flex flex-col h-screen select-none shadow-2xl relative z-50 md:z-20 transition-all duration-300 ease-in-out text-left ${
          isCollapsed
            ? 'w-0 opacity-0 border-r-0 pointer-events-none overflow-hidden'
            : 'w-64 opacity-100 border-r border-navy-800/80 fixed md:static inset-y-0 left-0'
        }`}
      >
        <div className="w-64 flex flex-col h-full shrink-0">
          {/* Brand Header */}
          <div className="p-4 border-b border-navy-800/80 flex items-center justify-between shrink-0">
            <div
              onClick={() => handleSelectTab('dashboard')}
              className="flex items-center gap-2.5 cursor-pointer group min-w-0"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform shrink-0">
                <Boxes className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-black text-xs tracking-widest text-slate-100 uppercase truncate">
                    GEMA SIGEG
                  </h1>
                  <span className="text-[9px] px-1 py-0.2 rounded font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0">
                    2.0
                  </span>
                </div>
                <p className="text-[10px] text-sky-400 font-extrabold uppercase tracking-wider truncate mt-0.5">
                  Ensayos Especiales
                </p>
              </div>
            </div>

            {/* Header Right: Sun/Moon Toggle & Mobile Close */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg bg-navy-900 hover:bg-navy-850 border border-navy-800 text-slate-400 hover:text-slate-100 transition-all shadow-md active:scale-95"
                title={`Cambiar a modo ${darkMode ? 'claro' : 'oscuro'}`}
              >
                {darkMode ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              <button
                onClick={onToggleSidebar}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-navy-900 md:hidden transition-colors"
                title="Cerrar menú"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
            {navCategories.map((catGroup) => {
              if (catGroup.isGroup) {
                const isDistActive = currentTab === 'distribucion' || distTabs.some(t => t.id === currentTab);
                return (
                  <div key={catGroup.category} className="space-y-1">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 mb-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-navy-800" />
                      <span>{catGroup.category}</span>
                    </h3>

                    <div className="rounded-lg transition-all">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => handleSelectTab('distribucion')}
                          className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-l-lg text-xs font-semibold text-left transition-all relative group ${
                            currentTab === 'distribucion'
                              ? 'bg-sky-500/10 text-sky-400 font-bold border-l-2 border-sky-500 shadow-[inset_0_0_10px_rgba(14,165,233,0.05)]'
                              : 'hover:bg-navy-900/30 hover:text-slate-200 text-slate-400'
                          }`}
                        >
                          <Layers
                            size={16}
                            className={currentTab === 'distribucion' ? 'text-sky-400' : 'text-slate-500 group-hover:text-sky-400'}
                          />
                          <span className="truncate font-semibold tracking-wide">Distribución General</span>
                        </button>

                        <button
                          onClick={() => setIsDistExpanded(!isDistExpanded)}
                          className="p-2 text-slate-500 hover:text-slate-200 hover:bg-navy-900/40 rounded-r-lg transition-all"
                          title={isDistExpanded ? 'Colapsar submódulos' : 'Expandir submódulos'}
                        >
                          {isDistExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </div>

                      {isDistExpanded && (
                        <div className="pl-3 space-y-0.5 border-l border-navy-800 ml-4 mt-1 animate-fade-in">
                          {distTabs.map((sub) => {
                            const isSubActive = currentTab === sub.id;
                            const SubIcon = sub.icon;
                            return (
                              <button
                                key={sub.id}
                                onClick={() => handleSelectTab(sub.id)}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all relative ${
                                  isSubActive
                                    ? 'bg-sky-500/15 text-sky-300 font-bold border-l-2 border-sky-400 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-navy-900/30'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <SubIcon
                                    size={13}
                                    className={isSubActive ? 'text-sky-400' : 'text-slate-500'}
                                  />
                                  <span className="truncate text-[11px]">{sub.label}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div key={catGroup.category} className="space-y-1">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-navy-800" />
                    <span>{catGroup.category}</span>
                  </h3>

                  {catGroup.items?.map((item) => {
                    const isActive = currentTab === item.id;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectTab(item.id)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs text-left transition-all relative group ${
                          isActive
                            ? 'bg-sky-500/10 text-sky-400 font-bold border-l-2 border-sky-500 shadow-[inset_0_0_10px_rgba(14,165,233,0.05)]'
                            : 'hover:bg-navy-900/30 hover:text-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon
                            size={16}
                            className={`${isActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-sky-400'} transition-colors shrink-0`}
                          />
                          <span className="leading-tight truncate font-semibold tracking-wide">{item.label}</span>
                        </div>

                        {isActive && (
                          <span className="absolute right-0 top-1 bottom-1 w-1 bg-sky-500 rounded-l-md shadow-[0_0_8px_rgba(14,165,233,0.8)]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* Database Status Panel */}
          <div className="p-3 mx-3 mb-2 rounded-xl bg-navy-900/90 border border-navy-800 space-y-1.5 shadow-inner shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                Base de Datos
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    !isConnected
                      ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse'
                      : dbInfo?.is_local_fallback
                      ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                      : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                  }`}
                />
                <span
                  className={`font-black uppercase tracking-wider text-[10px] ${
                    !isConnected
                      ? 'text-rose-400'
                      : dbInfo?.is_local_fallback
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {!isConnected ? 'Desconectado' : dbInfo?.is_local_fallback ? 'SQLite Local' : 'SQL Server'}
                </span>
              </div>
            </div>
            {dbInfo?.server && (
              <div className="text-[10px] text-slate-400 truncate font-mono" title={dbInfo.server}>
                Instancia: {dbInfo.server}
              </div>
            )}
          </div>

          {/* Copyright Footer */}
          <div className="p-3 border-t border-navy-800/80 text-[10px] text-slate-500 text-center font-black uppercase tracking-wider shrink-0">
            GEMA Ensayos Especiales &copy; 2026
          </div>
        </div>
      </aside>
    </>
  );
}