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
    id: 'ucs', assay: 'UCS', icon: FlaskConical,
    iconTone: summaryAssayPalette.UCS.icon,
    barTone: summaryAssayPalette.UCS.bar,
  },
  {
    id: 'elasticas', assay: 'CE', short: 'Young / Poisson', icon: Activity,
    iconTone: summaryAssayPalette.CE.icon,
    barTone: summaryAssayPalette.CE.bar,
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
        </div>
      </div>

      <button
        type="button"
        onClick={() => onNavigateTab('registro_maestro')}
        className="group flex w-full flex-wrap items-center justify-between gap-4 rounded-xl border border-navy-800 border-l-4 border-l-sky-600 bg-white dark:bg-navy-950 px-4 py-4 text-left transition-colors hover:border-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600 sm:px-6"
      >
        <span className="flex items-center gap-3 sm:gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200">
            <Database size={23} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-base font-black leading-tight text-slate-100 sm:text-lg">Total de ensayos</span>
            <span className="mt-1 block text-xs font-medium text-slate-400">
              {loading ? 'Cargando resumen…' : totalGlobal === undefined ? 'No se pudo cargar el total.' : 'Códigos de muestra únicos'}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          <strong className="text-lg font-black tabular-nums text-slate-100 sm:text-xl">
            {totalGlobal?.toLocaleString('es-PE') ?? '—'}
          </strong>
          <ChevronRight size={19} className="text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </button>

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

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
          {assayCards.map((m) => {
            const Icon = m.icon;
            const label = m.assay === 'UCS' ? 'Compresión uniaxial' : assayTypes[m.assay];
            const count = totalsByType.get(m.assay) ?? 0;
            const pct = totalGlobal ? Math.round(count / totalGlobal * 100) : 0;
            return (
              <button
                type="button"
                key={m.id}
                onClick={() => onNavigateTab(m.id)}
                className="glass-panel p-4 rounded-xl border border-navy-800 bg-navy-950/25 hover:border-sky-500/40 hover:bg-navy-900/30 text-left cursor-pointer transition-all active:scale-[0.98] flex min-h-36 flex-col justify-between gap-2 group"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className={'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-navy-800 px-2 py-1.5 text-xs font-extrabold ' + m.iconTone}>
                    <Icon size={15} aria-hidden="true" /> {m.assay}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 font-mono">{summary ? pct + '%' : '—'}</span>
                </div>

                <div>
                  <div className="text-lg font-black text-slate-100 font-mono leading-tight">
                    {summary ? count.toLocaleString('es-PE') : '—'}
                  </div>
                  <div className="mt-1 text-[13px] font-bold leading-snug text-slate-200 sm:text-sm">{label}</div>
                  {'short' in m && <div className="mt-0.5 text-[10px] text-slate-400">{m.short}</div>}
                </div>

                <div className="w-full bg-navy-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={'h-full rounded-full transition-all duration-500 ' + m.barTone}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <DashboardDistributions
        campaigns={summary?.por_campana}
        laboratories={summary?.por_laboratorio}
        loading={loading}
      />

      {/* Tabla de Muestras Recientes */}
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