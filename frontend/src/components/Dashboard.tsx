import { useAuth } from '../auth/AuthContext';
import { useState, useEffect } from 'react';
import DashboardDistributions, { type AssayCount, type StackedAssayCount } from './DashboardDistributions';
import { assayTypes } from '../config/registrationFormats';
import { summaryAssayPalette } from '../config/summaryAssayPalette';
import {
  Database,
  FlaskConical,
  Activity,
  TrendingUp,
  Scissors,
  Compass,
  ChevronRight,
} from 'lucide-react';

interface DashboardProps {
  records: Record<string, any>[];
  onNavigateTab: (tabName: string) => void;
  apiBase?: string;
}

interface SummaryData {
  total_ensayos: number;
  por_tipo: AssayCount[];
  por_campana: StackedAssayCount[];
  por_laboratorio: StackedAssayCount[];
  recent: Record<string, any>[];
}

const assayCards = [
  {
    id: 'registro_maestro', assay: null, short: 'Códigos de muestra únicos', icon: Database,
    iconTone: 'bg-navy-900 text-slate-300',
    barTone: 'bg-slate-500',
  },
  {
    id: 'ucs', assay: 'UCS', short: 'Compresión Uniaxial', icon: FlaskConical,
    iconTone: summaryAssayPalette.UCS.icon,
    barTone: summaryAssayPalette.UCS.bar,
  },
  {
    id: 'elasticas', assay: 'CE', short: 'Young / Poisson', icon: Activity,
    iconTone: summaryAssayPalette.UCS.icon,
    barTone: summaryAssayPalette.UCS.bar,
  },
  {
    id: 'traccion', assay: 'TI', short: 'Brasileño', icon: TrendingUp,
    iconTone: summaryAssayPalette.TI.icon,
    barTone: summaryAssayPalette.TI.bar,
  },
  {
    id: 'corte', assay: 'CD', short: 'Discontinuidades', icon: Scissors,
    iconTone: summaryAssayPalette.CD.icon,
    barTone: summaryAssayPalette.CD.bar,
  },
  {
    id: 'triaxial', assay: 'TX', short: 'Hoek-Brown', icon: Compass,
    iconTone: summaryAssayPalette.TX.icon,
    barTone: summaryAssayPalette.TX.bar,
  },
] as const;

export default function Dashboard({ records, onNavigateTab, apiBase = '' }: DashboardProps) {
  const { authFetch } = useAuth();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const request = new AbortController();
    authFetch(`${apiBase}/api/ensayos/resumen`, { signal: request.signal })
      .then(response => {
        if (!response.ok) throw new Error('No se pudo cargar el resumen de ensayos.');
        return response.json() as Promise<SummaryData>;
      })
      .then(data => setSummary(data))
      .catch(error => {
        if (!request.signal.aborted) console.warn('No se pudo cargar el resumen de ensayos.', error);
      })
      .finally(() => {
        if (!request.signal.aborted) setLoading(false);
      });
    return () => request.abort();
  }, [apiBase, authFetch]);

  const totalGlobal = summary?.total_ensayos;
  const totalsByType = new Map(summary?.por_tipo.map(entry => [entry.etiqueta, entry.ensayos]));
  const recentRecords = summary && summary.recent.length > 0 ? summary.recent : records.slice(0, 5);

  return (
    <div className="space-y-6 select-none w-full animate-fade-in text-left view-dashboard">
      <div className="flex items-center gap-3">
        <span className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5 text-sky-700 dark:text-sky-300">
          <FlaskConical size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-black tracking-wide text-slate-100">Ensayos Especiales</h2>
          <p className="mt-1 text-xs font-semibold text-slate-400">
            {loading ? 'Cargando resumen…' : totalGlobal === undefined
              ? 'No se pudo cargar el total de ensayos.'
              : `Total de ${totalGlobal.toLocaleString('es-PE')} ${totalGlobal === 1 ? 'ensayo' : 'ensayos'} en el Registro Maestro`}
          </p>
        </div>
      </div>

      <DashboardDistributions
        campaigns={summary?.por_campana}
        laboratories={summary?.por_laboratorio}
        loading={loading}
      />

      {/* 3. Módulos y Familias con Navegación Rápida */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <span>Distribución de ensayos por tipo</span>
          </h3>
          <button
            onClick={() => onNavigateTab('distribucion')}
            className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1"
          >
            <span>Ver informe detallado</span>
            <ChevronRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {assayCards.map((m) => {
            const Icon = m.icon;
            const label = m.assay === null ? 'Total de ensayos' : assayTypes[m.assay];
            const count = m.assay === null ? totalGlobal ?? 0 : totalsByType.get(label.toLocaleLowerCase('es-PE')) ?? 0;
            const pct = totalGlobal ? Math.round(count / totalGlobal * 100) : 0;
            return (
              <div
                key={m.id}
                onClick={() => onNavigateTab(m.id)}
                className="glass-panel p-4 rounded-xl border border-navy-800 bg-navy-950/25 hover:border-sky-500/40 hover:bg-navy-900/30 cursor-pointer transition-all active:scale-[0.98] flex min-h-36 flex-col justify-between gap-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className={'p-2 rounded-lg border border-navy-800 group-hover:scale-105 transition-transform ' + m.iconTone}>
                    <Icon size={16} />
                  </div>
                  {m.assay !== null && (
                    <span className="text-[10px] font-bold text-slate-500 font-mono">{summary ? pct + '%' : '—'}</span>
                  )}
                </div>

                <div>
                  <div className="text-lg font-black text-slate-100 font-mono leading-tight">
                    {summary ? count.toLocaleString('es-PE') : '—'}
                  </div>
                  <div className="text-[11px] font-bold text-slate-300 leading-tight mt-0.5">{label}</div>
                  <div className="text-[10px] text-slate-500 truncate">{m.short}</div>
                </div>

                <div className="w-full bg-navy-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={'h-full rounded-full transition-all duration-500 ' + m.barTone}
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