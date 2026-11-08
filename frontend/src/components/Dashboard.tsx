import React, { useState, useEffect } from 'react';
import {
  Database,
  ShieldCheck,
  Layers,
  FlaskConical,
  Activity,
  TrendingUp,
  Scissors,
  Compass,
  Scale,
  RefreshCw,
  ChevronRight,
  FileSpreadsheet,
  Plus,
  ArrowRight
} from 'lucide-react';

interface DashboardProps {
  records: Record<string, any>[];
  alertsCount: number;
  onNavigateTab: (tabName: string) => void;
  apiBase?: string;
}

interface StatsData {
  total: number;
  counts: {
    ucs: number;
    elasticas: number;
    traccion: number;
    corte: number;
    triaxial: number;
    propiedades: number;
  };
  recent: Record<string, any>[];
}

export default function Dashboard({ records, alertsCount, onNavigateTab, apiBase = '' }: DashboardProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchStats();
  }, [apiBase]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${apiBase}/api/ensayos/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.warn("No se pudo cargar estadísticas globales", e);
    } finally {
      setLoading(false);
    }
  };

  const totalGlobal = stats ? stats.total : (records.length > 0 ? records.length : 0);
  const countUCS = stats ? stats.counts.ucs : records.filter(r => r.ucs_diametro || r.ucs_carga_rotura).length;
  const countElasticas = stats ? stats.counts.elasticas : records.filter(r => r.elasticas_modulo_young || r.elasticas_poisson).length;
  const countTraccion = stats ? stats.counts.traccion : records.filter(r => r.traccion_carga_promedio || r.traccion_resistencia_mpa).length;
  const countCorte = stats ? stats.counts.corte : records.filter(r => r.corte_area || r.corte_cohesion_mpa).length;
  const countTriaxial = stats ? stats.counts.triaxial : records.filter(r => r.triaxial_esfuerzo_maximo || r.triaxial_cohesion_mpa).length;
  const countPropiedades = stats ? stats.counts.propiedades : records.filter(r => r.prop_peso_unitario_geometrico).length;

  const recentRecords = stats && stats.recent && stats.recent.length > 0 ? stats.recent : records.slice(0, 5);

  const modulesList = [
    { id: 'ucs', label: 'Compresión Uniaxial', short: 'UCS', count: countUCS, icon: FlaskConical, color: 'sky' },
    { id: 'elasticas', label: 'Constantes Elásticas', short: 'Young / Poisson', count: countElasticas, icon: Activity, color: 'indigo' },
    { id: 'traccion', label: 'Tracción Indirecta', short: 'Brasileño', count: countTraccion, icon: TrendingUp, color: 'cyan' },
    { id: 'corte', label: 'Corte Directo', short: 'Discontinuidades', count: countCorte, icon: Scissors, color: 'teal' },
    { id: 'triaxial', label: 'Compresión Triaxial', short: 'Hoek-Brown', count: countTriaxial, icon: Compass, color: 'blue' },
    { id: 'propiedades', label: 'Propiedades Físicas', short: 'Densidad y Porosidad', count: countPropiedades, icon: Scale, color: 'slate' },
  ];

  return (
    <div className="space-y-6 select-none w-full animate-fade-in text-left view-dashboard">
      {/* 1. Header Toolbar (matching Mapeo Dashboard style) */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-100 tracking-wide flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.8)]" />
            <span>Consolidado Geotécnico de Ensayos Especiales</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1 font-semibold">
            {loading
              ? 'Conectando con base de datos...'
              : `Total de ${totalGlobal.toLocaleString()} muestras geotécnicas consolidadas en base de datos`}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap justify-start md:justify-end">
          <button
            onClick={() => onNavigateTab('auditoria')}
            className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/40 hover:bg-amber-500/20 hover:border-amber-400 text-amber-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-[0_0_12px_rgba(245,158,11,0.12)] active:scale-95"
          >
            <ShieldCheck size={16} className="text-amber-400" />
            <span>Auditoría QA/QC</span>
          </button>

          <button
            onClick={() => onNavigateTab('registro_maestro')}
            className="flex items-center gap-2 bg-sky-500/10 border border-sky-500/40 hover:bg-sky-500/20 hover:border-sky-400 text-sky-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-[0_0_12px_rgba(14,165,233,0.12)] active:scale-95"
          >
            <Database size={16} />
            <span>Registro Maestro</span>
          </button>

          <button
            onClick={() => onNavigateTab('distribucion')}
            className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-400 font-bold transition-all duration-200 active:scale-95 shadow-[0_0_12px_rgba(99,102,241,0.12)] px-4 py-2 rounded-lg text-xs"
          >
            <Layers size={16} />
            <span>Ver Familias</span>
          </button>
        </div>
      </div>

      {/* 2. KPIs Superiores en Grid (6 Tarjetas estilo Mapeo) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* KPI 1: Total Muestras */}
        <div
          onClick={() => onNavigateTab('registro_maestro')}
          className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg hover:border-sky-500/40 cursor-pointer transition-all active:scale-[0.98]"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
              Total Muestras
            </span>
            <span className="text-xl font-black text-slate-100 block font-mono">
              {loading ? '...' : totalGlobal.toLocaleString()}
            </span>
            <span className="text-[10px] font-bold text-sky-400 block leading-none">
              SQL Server Unificado
            </span>
          </div>
          <Database size={22} className="text-sky-400/40 shrink-0" />
        </div>

        {/* KPI 2: Integridad QA/QC */}
        <div
          onClick={() => onNavigateTab('auditoria')}
          className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg hover:border-amber-500/40 cursor-pointer transition-all active:scale-[0.98]"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
              Integridad QA/QC
            </span>
            <span
              className={`text-xl font-black block font-mono ${
                alertsCount > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {alertsCount > 0 ? `${alertsCount} Alertas` : '100% OK'}
            </span>
            <span
              className={`text-[10px] font-bold block leading-none ${
                alertsCount > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {alertsCount > 0 ? 'Requiere Revisión' : 'Conforme'}
            </span>
          </div>
          <ShieldCheck
            size={22}
            className={`shrink-0 ${alertsCount > 0 ? 'text-rose-400/40 animate-pulse' : 'text-emerald-400/40'}`}
          />
        </div>

        {/* KPI 3: Familias de Ensayo */}
        <div
          onClick={() => onNavigateTab('distribucion')}
          className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg hover:border-indigo-500/40 cursor-pointer transition-all active:scale-[0.98]"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
              Familias Ensayo
            </span>
            <span className="text-xl font-black text-slate-100 block font-mono">6 Módulos</span>
            <span className="text-[10px] font-bold text-indigo-400 block leading-none">
              Laboratorio Geomec.
            </span>
          </div>
          <Layers size={22} className="text-indigo-400/40 shrink-0" />
        </div>

        {/* KPI 4: UCS */}
        <div
          onClick={() => onNavigateTab('ucs')}
          className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg hover:border-sky-500/40 cursor-pointer transition-all active:scale-[0.98]"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
              Compresión UCS
            </span>
            <span className="text-xl font-black text-sky-400 block font-mono">
              {loading ? '...' : countUCS.toLocaleString()}
            </span>
            <span className="text-[10px] font-bold text-slate-400 block leading-none">
              Roca Intacta
            </span>
          </div>
          <FlaskConical size={22} className="text-sky-400/40 shrink-0" />
        </div>

        {/* KPI 5: Elásticas */}
        <div
          onClick={() => onNavigateTab('elasticas')}
          className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg hover:border-indigo-500/40 cursor-pointer transition-all active:scale-[0.98]"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
              Elásticas
            </span>
            <span className="text-xl font-black text-indigo-400 block font-mono">
              {loading ? '...' : countElasticas.toLocaleString()}
            </span>
            <span className="text-[10px] font-bold text-slate-400 block leading-none">
              Young & Poisson
            </span>
          </div>
          <Activity size={22} className="text-indigo-400/40 shrink-0" />
        </div>

        {/* KPI 6: Corte & Triaxial */}
        <div
          onClick={() => onNavigateTab('corte')}
          className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg hover:border-teal-500/40 cursor-pointer transition-all active:scale-[0.98]"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
              Corte Directo
            </span>
            <span className="text-xl font-black text-teal-400 block font-mono">
              {loading ? '...' : countCorte.toLocaleString()}
            </span>
            <span className="text-[10px] font-bold text-slate-400 block leading-none">
              Discontinuidades
            </span>
          </div>
          <Scissors size={22} className="text-teal-400/40 shrink-0" />
        </div>
      </div>

      {/* 3. Módulos y Familias con Navegación Rápida */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <span>Distribución de Ensayos por Módulo</span>
          </h3>
          <button
            onClick={() => onNavigateTab('distribucion')}
            className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1"
          >
            <span>Ver informe detallado</span>
            <ChevronRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {modulesList.map((m) => {
            const Icon = m.icon;
            const pct = totalGlobal > 0 ? Math.round((m.count / totalGlobal) * 100) : 0;
            return (
              <div
                key={m.id}
                onClick={() => onNavigateTab(m.id)}
                className="glass-panel p-4 rounded-xl border border-navy-800 bg-navy-950/25 hover:border-sky-500/40 hover:bg-navy-900/30 cursor-pointer transition-all active:scale-[0.98] flex flex-col justify-between h-32 group"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-navy-900 border border-navy-800 text-sky-400 group-hover:scale-105 transition-transform">
                    <Icon size={16} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 font-mono">{pct}%</span>
                </div>

                <div>
                  <div className="text-lg font-black text-slate-100 font-mono leading-tight">
                    {m.count.toLocaleString()}
                  </div>
                  <div className="text-[11px] font-bold text-slate-300 truncate mt-0.5">{m.label}</div>
                  <div className="text-[10px] text-slate-500 truncate">{m.short}</div>
                </div>

                <div className="w-full bg-navy-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Tabla de Muestras Recientes */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/15 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-navy-800">
          <div>
            <h3 className="text-xs font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Muestras Geotécnicas Recientes</span>
            </h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Registros activos procesados en la base de datos de Ensayos Especiales
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('registro_maestro')}
            className="flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/20 text-sky-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <span>Ver Toda la Matriz</span>
            <ChevronRight size={13} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-navy-900/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-navy-800">
                <th className="py-2.5 px-3 w-16">IDD</th>
                <th className="py-2.5 px-3">Sondaje</th>
                <th className="py-2.5 px-3">Código Muestra</th>
                <th className="py-2.5 px-3">Tipo Ensayo</th>
                <th className="py-2.5 px-3">Proyecto</th>
                <th className="py-2.5 px-3">Campaña</th>
                <th className="py-2.5 px-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-900 font-sans text-slate-300">
              {recentRecords.map((rec) => (
                <tr key={rec.idd} className="hover:bg-navy-900/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-400">#{rec.idd}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-100">{rec.sondaje || '—'}</td>
                  <td className="py-2.5 px-3 font-mono text-sky-400 font-semibold">
                    {rec.codigo_muestra || '—'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-navy-900 text-slate-300 border border-navy-800">
                      {rec.tipo_ensayo || 'Laboratorio'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">{rec.proyecto || '—'}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">{rec.campana || '—'}</td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => onNavigateTab('registro_maestro')}
                      className="text-[11px] font-bold text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 px-2.5 py-1 rounded-lg border border-sky-500/25 transition-all inline-flex items-center gap-1"
                    >
                      <span>Inspeccionar</span>
                      <ChevronRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {recentRecords.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No se encontraron registros en la base de datos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}