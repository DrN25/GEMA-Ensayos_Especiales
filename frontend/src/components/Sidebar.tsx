import { useState } from 'react';
import {
  LayoutDashboard,
  Database,
  ClipboardPlus,
  FileText,
  FileSpreadsheet,
  ListFilter,
  FlaskConical,
  Activity,
  TrendingUp,
  Scissors,
  Compass,
  ChevronDown,
  ChevronRight,
  Sun,
  Moon,
  BarChart2,
  FolderLock,
  Users,
  X,
  Cylinder,
  type LucideIcon
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  isConnected: boolean;
  dbInfo: { db_type: string; is_local_fallback: boolean; server?: string } | null;
  canManageUsers: boolean;
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
  canManageUsers,
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

  const navCategories: { category: string; items: { id: string; label: string; icon: LucideIcon }[] }[] = [
    {
      category: 'GENERAL',
      items: [{ id: 'dashboard', label: 'Resumen', icon: LayoutDashboard }]
    },
    {
      category: 'ENSAYOS ESPECIALES',
      items: [
        { id: 'registro_ensayos', label: 'Registro de Ensayos', icon: ClipboardPlus },
        { id: 'propuesta_registro', label: 'Propuesta de Registro', icon: FileText },
        { id: 'distribucion', label: 'Filtro por ensayo', icon: ListFilter },
        { id: 'registro_maestro', label: 'Registro Maestro', icon: Database }
      ]
    },
    {
      category: 'CONTROL DE CALIDAD',
      items: [{ id: 'revision_excel', label: 'Revisión de Excel', icon: FileSpreadsheet }]
    },
    ...(canManageUsers ? [{ category: 'ADMINISTRACIÓN', items: [{ id: 'usuarios', label: 'Gestión de usuarios', icon: Users }] }] : []),
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
        className={`glass-panel chrome-dark gema-sidebar flex flex-col h-screen select-none shadow-2xl relative z-50 md:z-20 transition-all duration-300 ease-in-out text-left ${
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
                <Cylinder className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-black text-xs tracking-widest text-slate-100 uppercase truncate">
                    GEMA SIGEG
                  </h1>
                  <span className="sidebar-version sidebar-accent text-[9px] px-1 py-0.2 rounded font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0">
                    2.0
                  </span>
                </div>
                <p className="sidebar-accent text-[10px] text-sky-400 font-extrabold uppercase tracking-wider truncate mt-0.5">
                  Ensayos Especiales
                </p>
              </div>
            </div>

            {/* Header Right: Sun/Moon Toggle & Mobile Close */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="sidebar-control p-2 rounded-lg bg-navy-900 hover:bg-navy-850 border border-navy-800 text-slate-400 hover:text-slate-100 transition-all shadow-md active:scale-95"
                title={`Cambiar a modo ${darkMode ? 'claro' : 'oscuro'}`}
              >
                {darkMode ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              <button
                onClick={onToggleSidebar}
                className="sidebar-control p-2 rounded-lg text-slate-400 hover:text-white hover:bg-navy-900 md:hidden transition-colors"
                title="Cerrar menú"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <nav aria-label="Módulos GEMA" className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
            {navCategories.map(({ category, items }) => (
              <div key={category} className="space-y-1">
                <h3 className="sidebar-category text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 mb-1 flex items-center gap-1.5">
                  <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-navy-800" />
                  {category}
                </h3>

                {items.map(({ id, label, icon: Icon }) => {
                  const active = currentTab === id;
                  const isProposal = id === 'propuesta_registro';
                  const activeTone = active
                    ? 'sidebar-active bg-sky-500/10 text-sky-400 font-bold border-l-2 border-sky-500'
                    : 'hover:bg-navy-900/30 hover:text-slate-200 text-slate-400';
                  const iconTone = active ? 'text-sky-400' : 'text-slate-500 group-hover:text-sky-400';

                  if (id === 'distribucion') {
                    return (
                      <div key={id}>
                        <div className="flex items-stretch">
                          <button type="button" onClick={() => handleSelectTab(id)} aria-current={active ? 'page' : undefined}
                            className={'sidebar-control flex flex-1 min-w-0 items-center gap-2.5 rounded-l-lg px-3 py-2 text-left text-xs font-semibold transition-colors group ' + activeTone}>
                            <Icon size={16} className={'shrink-0 ' + iconTone} aria-hidden="true" />
                            <span className="truncate tracking-wide">{label}</span>
                          </button>
                          <button type="button" onClick={() => setIsDistExpanded(expanded => !expanded)}
                            aria-expanded={isDistExpanded} aria-controls="sidebar-assay-types"
                            aria-label={isDistExpanded ? 'Colapsar filtro por ensayo' : 'Expandir filtro por ensayo'}
                            className="sidebar-control sidebar-filter-toggle rounded-r-lg px-2 text-slate-500 transition-colors hover:bg-navy-900/40 hover:text-slate-200">
                            {isDistExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </div>

                        <div id="sidebar-assay-types" hidden={!isDistExpanded}
                          className="ml-4 mt-1 space-y-0.5 border-l border-navy-800 pl-3">
                          {distTabs.map(({ id: subId, label: subLabel, icon: SubIcon }) => {
                            const subActive = currentTab === subId;
                            return (
                              <button key={subId} type="button" onClick={() => handleSelectTab(subId)}
                                aria-current={subActive ? 'page' : undefined}
                                className={'sidebar-control flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors group ' + (subActive
                                  ? 'sidebar-active bg-sky-500/15 text-sky-300 font-bold border-l-2 border-sky-400'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-navy-900/30')}>
                                <SubIcon size={13} className={'shrink-0 ' + (subActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-sky-400')} aria-hidden="true" />
                                <span className="truncate text-[11px]">{subLabel}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <button key={id} type="button" onClick={() => handleSelectTab(id)}
                      aria-current={active ? 'page' : undefined}
                      className={'sidebar-control relative flex w-full items-center rounded-lg py-2.5 text-left text-xs transition-colors group '
                        + (isProposal ? 'gap-1.5 px-2.5 ' : 'gap-3 px-3.5 ') + activeTone}>
                      <Icon size={16} className={'shrink-0 transition-colors ' + iconTone} aria-hidden="true" />
                      <span className={isProposal ? 'flex-1 whitespace-nowrap font-extrabold leading-tight' : 'truncate font-semibold leading-tight tracking-wide'}>{label}</span>
                      {isProposal && (
                        <span className="shrink-0 rounded-full bg-[#d9f1ff] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#10305b] dark:bg-sky-400/20 dark:text-sky-200">
                          Nuevo
                        </span>
                      )}
                      {active && <span aria-hidden="true" className="absolute bottom-1 right-0 top-1 w-1 rounded-l-md bg-sky-500" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Database Status Panel */}
          <div className="p-3 mx-3 mb-2 rounded-xl bg-navy-900/90 border border-navy-800 space-y-1.5 shadow-inner shrink-0">
            <div className="flex items-center justify-between">
              <span className="sidebar-status-label text-slate-500 font-bold uppercase tracking-wider text-[10px]">
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
                  data-connection={!isConnected ? 'offline' : dbInfo?.is_local_fallback ? 'local' : 'online'}
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
          <div className="sidebar-footer p-3 border-t border-navy-800/80 text-[10px] text-slate-500 text-center font-black uppercase tracking-wider shrink-0">
            GEMA Ensayos Especiales &copy; 2026
          </div>
        </div>
      </aside>
    </>
  );
}