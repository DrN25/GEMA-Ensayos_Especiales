import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Save,
  ChevronDown,
  RefreshCw,
  Menu,
  ShieldCheck,
  Check,
  Layers,
  Database
} from 'lucide-react';

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
  dashboard: 'Dashboard Ejecutivo',
  registro_maestro: 'Registro Maestro',
  ucs: 'Compresión Uniaxial (UCS)',
  elasticas: 'Constantes Elásticas',
  traccion: 'Tracción Indirecta (Brasileño)',
  corte: 'Corte Directo',
  triaxial: 'Compresión Triaxial',
  propiedades: 'Propiedades Físicas',
  auditoria: 'Auditoría QA/QC Masiva',
  proyectos: 'Proyectos y Canteras',
  reportes: 'Reportes Estadísticos'
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

  const testModules = ['ucs', 'elasticas', 'traccion', 'corte', 'triaxial'];
  const isTestModule = testModules.includes(currentTab);
  const isModified = checkModuleModified(currentTab);

  return (
    <header className="min-h-16 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 md:px-6 py-2 border-b border-navy-800 bg-navy-950/40 backdrop-blur z-10 shrink-0 select-none text-left">
      {/* 1. Left items: Toggle, Back, Module Name */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg bg-navy-900 hover:bg-navy-850 border border-navy-800 text-slate-400 hover:text-slate-100 transition-all shadow-md active:scale-95 shrink-0"
          title={isSidebarCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
        >
          <Menu size={16} />
        </button>

        {currentTab !== 'dashboard' && (
          <button
            onClick={() => setCurrentTab('dashboard')}
            className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 text-slate-300 hover:text-white border border-navy-800 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Volver al Panel</span>
          </button>
        )}

        <div className="flex items-center gap-2 pl-1 min-w-0">
          <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.8)] shrink-0" />
          <h2 className="text-sm md:text-base font-black text-slate-100 tracking-wide truncate">
            {MODULE_LABELS[currentTab] || currentTab}
          </h2>
        </div>
      </div>

      {/* 2. Right items: Connection Status, Action Buttons */}
      <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end min-w-0">
        {/* Server Connectivity Indicator */}
        <div className="hidden md:flex items-center gap-2 pr-3 border-r border-navy-800 shrink-0">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse'
            }`}
          />
          <span
            className="text-xs text-slate-400 font-semibold hidden lg:inline"
            title={isConnected ? 'Conectado a SQL Server' : 'Servidor desconectado'}
          >
            {isConnected ? 'SQL Server Conectado' : 'Servidor Desconectado'}
          </span>
        </div>

        {/* Reconnect button if disconnected */}
        {!isConnected && (
          <button
            onClick={onReconnect}
            className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/40 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0"
            title="Reconectar a SQL Server"
          >
            <RefreshCw size={14} className="animate-spin" />
            <span>Reconectar</span>
          </button>
        )}

        {/* Catálogos de Referencia button */}
        <button
          onClick={onOpenCatalogs}
          className="flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/40 hover:bg-sky-500/20 hover:border-sky-400 text-sky-400 px-3 md:px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-[0_0_12px_rgba(14,165,233,0.12)] active:scale-95 shrink-0"
          title="Ver Catálogos de Referencia Geomecánica e ISRM"
        >
          <BookOpen size={14} className="text-sky-400" />
          <span className="hidden sm:inline">Catálogos</span>
        </button>

        {/* Save Controls */}
        {currentTab !== 'reportes' && currentTab !== 'dashboard' && (
          <div className="relative shrink-0">
            {isTestModule ? (
              <div className="inline-flex rounded-lg shadow-sm border border-navy-800 bg-navy-900">
                <button
                  type="button"
                  onClick={onSaveAll}
                  disabled={saveStatus === 'saving' || hasAlerts}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-l-lg transition-all ${
                    saveStatus === 'saving'
                      ? 'text-slate-400 cursor-not-allowed'
                      : isModified
                      ? 'bg-emerald-500/10 border-r border-navy-800 text-emerald-400 hover:bg-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                      : 'text-slate-400 hover:text-slate-200 border-r border-navy-800'
                  }`}
                  title={isModified ? 'Hay cambios sin guardar' : 'Todos los cambios sincronizados'}
                >
                  <Save size={14} className={saveStatus === 'saving' ? 'animate-spin' : ''} />
                  <span>
                    {saveStatus === 'saving' ? 'Guardando...' : isModified ? 'Guardar Cambios' : 'Sincronizado'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="px-2 py-2 text-slate-400 hover:text-slate-200 hover:bg-navy-850 rounded-r-lg transition-colors border-l border-navy-800"
                  title="Opciones de Guardado"
                >
                  <ChevronDown size={14} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-64 glass-panel border border-navy-800 bg-navy-950/95 rounded-xl shadow-2xl p-1.5 z-50 text-left space-y-1">
                    <button
                      onClick={() => {
                        onSaveSpecific(currentTab);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-navy-900/60 transition-colors flex items-center justify-between"
                    >
                      <span>Guardar sólo este módulo</span>
                      <span className="text-[10px] text-sky-400 uppercase font-bold">{currentTab}</span>
                    </button>
                    <button
                      onClick={() => {
                        onSaveAll();
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-navy-900/60 transition-colors flex items-center justify-between"
                    >
                      <span>Guardar toda la planilla</span>
                      <span className="text-[10px] text-emerald-400 uppercase font-bold">Maestro</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onSaveAll}
                disabled={saveStatus === 'saving' || hasAlerts}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 border ${
                  saveStatus === 'saving'
                    ? 'bg-navy-900 border-navy-800 text-slate-400 cursor-not-allowed'
                    : isModified
                    ? 'bg-emerald-500/10 border-emerald-500/40 hover:bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                    : 'bg-navy-900 border-navy-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Save size={14} className={saveStatus === 'saving' ? 'animate-spin' : ''} />
                <span>
                  {saveStatus === 'saving' ? 'Guardando...' : isModified ? 'Guardar Cambios' : 'Sincronizado'}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}