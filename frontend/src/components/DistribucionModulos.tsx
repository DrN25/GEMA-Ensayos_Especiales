import { useState, useEffect } from 'react';
import {
  FlaskConical,
  Activity,
  TrendingUp,
  Scissors,
  Compass,
  Layers,
  ShieldCheck,
  Check,
  ChevronRight,
  Database
} from 'lucide-react';
import { type QAQCAlert } from '../utils/qaqcValidator';

interface DistribucionModulosProps {
  records: Record<string, any>[];
  qaqcAlerts: QAQCAlert[];
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
}

export default function DistribucionModulos({
  records,
  qaqcAlerts,
  onNavigateTab,
  apiBase = ''
}: DistribucionModulosProps) {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/api/ensayos/stats`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setStats(data);
      })
      .catch((e) => console.warn('No se pudo cargar estadísticas', e));
  }, [apiBase]);

  const totalGlobal = stats ? stats.total : records.length;

  const cards = [
    {
      id: 'ucs',
      label: 'Compresión Uniaxial',
      subtitle: 'Ensayos de carga axial y rotura',
      icon: FlaskConical,
      totalCount: stats ? stats.counts.ucs : records.filter((r) => r.ucs_diametro || r.ucs_carga_rotura).length,
      badgeStyle: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
      iconStyle: 'text-sky-400 bg-sky-500/15 border-sky-500/30',
      progressBg: 'bg-sky-500',
      description: 'Diámetro (cm) · Carga de rotura (kN) · Resistencia (MPa) · Tipo rotura'
    },
    {
      id: 'elasticas',
      label: 'Constantes Elásticas',
      subtitle: 'Módulos de deformabilidad elástica',
      icon: Activity,
      totalCount: stats ? stats.counts.elasticas : records.filter((r) => r.elasticas_modulo_young || r.elasticas_poisson).length,
      badgeStyle: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
      iconStyle: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30',
      progressBg: 'bg-indigo-500',
      description: 'Módulo de Young (GPa) · Relación de Poisson (adimensional)'
    },
    {
      id: 'traccion',
      label: 'Tracción Indirecta',
      subtitle: 'Ensayo brasileño de disco diametral',
      icon: TrendingUp,
      totalCount: stats ? stats.counts.traccion : records.filter((r) => r.traccion_carga_promedio || r.traccion_resistencia_mpa).length,
      badgeStyle: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      iconStyle: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
      progressBg: 'bg-cyan-500',
      description: 'Carga de rotura (kN) · Resistencia promedio (kg/cm² y MPa)'
    },
    {
      id: 'corte',
      label: 'Corte Directo',
      subtitle: 'Comportamiento en discontinuidades',
      icon: Scissors,
      totalCount: stats ? stats.counts.corte : records.filter((r) => r.corte_area || r.corte_cohesion_mpa).length,
      badgeStyle: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
      iconStyle: 'text-teal-400 bg-teal-500/15 border-teal-500/30',
      progressBg: 'bg-teal-500',
      description: 'Esfuerzo normal (kPa/MPa) · Esfuerzo corte · Cohesión · Fricción (°)'
    },
    {
      id: 'triaxial',
      label: 'Compresión Triaxial',
      subtitle: 'Confinamiento y envolvente Hoek-Brown',
      icon: Compass,
      totalCount: stats ? stats.counts.triaxial : records.filter((r) => r.triaxial_esfuerzo_maximo || r.triaxial_cohesion_mpa).length,
      badgeStyle: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      iconStyle: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
      progressBg: 'bg-blue-500',
      description: 'Confinamiento (MPa) · Esfuerzo máximo · Parámetro mi · Cohesión triaxial'
    },
    {
      id: 'propiedades',
      label: 'Propiedades Físicas',
      subtitle: 'Densidad y cubicación geométrica',
      icon: Layers,
      totalCount: stats ? stats.counts.propiedades : records.filter((r) => r.prop_peso_unitario_geometrico).length,
      badgeStyle: 'text-slate-400 bg-navy-900 border-navy-800',
      iconStyle: 'text-slate-400 bg-navy-900 border-navy-800',
      progressBg: 'bg-sky-500',
      description: 'Peso unitario geométrico (gr/cm³) · Campaña · Observación'
    }
  ];

  return (
    <div className="space-y-6 text-left select-none animate-fade-in text-xs view-dashboard">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest block mb-0.5">
            Mapeo Geotécnico Estructural
          </span>
        </div>
        <h2 className="text-xl font-black text-slate-100 uppercase tracking-wider">
          Distribución de Ensayos por Familia
        </h2>
        <p className="text-xs text-slate-400 mt-1 font-semibold leading-relaxed">
          Segmentación automática de la base de datos desnormalizada ({totalGlobal.toLocaleString()} registros totales
          analizados). Seleccione un módulo para abrir la vista de edición o auditoría.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((c) => {
          const Icon = c.icon;
          const activeAlerts = qaqcAlerts.filter((a) => a.tab === c.id);
          const pct = totalGlobal > 0 ? Math.round((c.totalCount / totalGlobal) * 100) : 0;

          return (
            <div
              key={c.id}
              onClick={() => onNavigateTab(c.id)}
              className="glass-panel p-5 rounded-2xl border border-navy-800 bg-navy-950/20 hover:border-sky-500/40 hover:bg-navy-900/30 cursor-pointer transition-all duration-200 active:scale-[0.98] flex flex-col justify-between h-72 shadow-lg group"
            >
              <div>
                {/* Cabecera */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${c.iconStyle}`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-100 uppercase tracking-wider group-hover:text-sky-400 transition-colors">
                        {c.label}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-semibold">{c.subtitle}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full font-mono border ${c.badgeStyle}`}>
                    {pct}%
                  </span>
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-3 gap-2 mt-4 bg-navy-900/60 p-3 rounded-xl border border-navy-800 text-center font-mono">
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Total</div>
                    <div className="text-xl font-black text-slate-100 mt-0.5">{c.totalCount.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Válidos</div>
                    <div className="text-xl font-black text-emerald-400 mt-0.5 flex items-center justify-center gap-1">
                      <Check size={14} className="stroke-[3]" />
                      <span>{Math.max(0, c.totalCount - activeAlerts.length).toLocaleString()}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Alertas</div>
                    <div
                      className={`text-xl font-black mt-0.5 flex items-center justify-center gap-1 ${
                        activeAlerts.length > 0 ? 'text-rose-400' : 'text-slate-500'
                      }`}
                    >
                      <ShieldCheck size={14} />
                      <span>{activeAlerts.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Barra de Progreso */}
              <div className="space-y-1 mt-3">
                <div className="flex justify-between text-[11px] font-bold text-slate-400">
                  <span>Representatividad de Muestras</span>
                  <span className="font-mono">{pct}%</span>
                </div>
                <div className="w-full bg-navy-900 rounded-full h-1.5 border border-navy-800 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${c.progressBg}`} style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* Pie con Parámetros */}
              <div className="mt-3 pt-3 border-t border-navy-800 flex items-center justify-between">
                <p className="text-[11px] text-slate-400 truncate max-w-[220px]" title={c.description}>
                  {c.description}
                </p>
                <ChevronRight size={14} className="text-slate-600 group-hover:text-sky-400 transition-colors shrink-0" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}