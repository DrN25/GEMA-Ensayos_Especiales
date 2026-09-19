import React from 'react';
import { Database, ShieldCheck, Layers, ArrowRight, FlaskConical, Activity, TrendingUp, Scissors, Compass } from 'lucide-react';

interface DashboardProps {
  records: Record<string, any>[];
  alertsCount: number;
  onNavigateTab: (tabName: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ records, alertsCount, onNavigateTab }) => {
  const total = records.length;

  const countUCS = records.filter(r => r.ucs_diametro || r.ucs_carga_rotura).length;
  const countElasticas = records.filter(r => r.elasticas_modulo_young || r.elasticas_poisson).length;
  const countTraccion = records.filter(r => r.traccion_carga_promedio || r.traccion_resistencia_mpa).length;
  const countCorte = records.filter(r => r.corte_area || r.corte_cohesion_mpa).length;
  const countTriaxial = records.filter(r => r.triaxial_esfuerzo_maximo || r.triaxial_cohesion_mpa).length;
  const countPropiedades = records.filter(r => r.prop_peso_unitario_geometrico).length;

  const recentRecords = [...records].slice(-5).reverse();

  return (
    <div className="space-y-6 text-left select-none animate-fade-in text-xs font-semibold">

      {/* Banner de Bienvenida con Contenedor Oscuro de Contraste Fijo compatible con Modo Claro */}
      <div className="p-6 rounded-2xl border border-indigo-500/15 bg-slate-900 shadow-[0_0_30px_rgba(99,102,241,0.12)] relative overflow-hidden">
        <div className="max-w-2xl relative z-10 text-slate-100">
          <h2 className="text-xl font-extrabold text-white mb-2 uppercase tracking-wider flex items-center gap-3">
            <Layers size={20} className="text-indigo-400 drop-shadow-[0_0_8px_#6366f1] animate-pulse" />
            <span>Módulo de Ensayos Especiales Geomecánicos</span>
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed font-semibold">
            Control de calidad QA/QC y base de datos desnormalizada de ensayos de laboratorio.
            Audite en tiempo real ensayos de compresión uniaxial (UCS), constantes elásticas,
            tracción indirecta, corte directo, compresión triaxial y propiedades físicas.
          </p>
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
      </div>

      {/* FILA SUPERIOR: KPIs Globales amplios con contorno neón y fondo translúcido */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Total Muestras */}
        <div
          onClick={() => onNavigateTab('registro_maestro')}
          className="p-5 rounded-2xl border border-indigo-500/30 bg-indigo-500/[0.03] bg-gradient-to-br from-indigo-500/[0.08] to-transparent shadow-[0_0_20px_rgba(99,102,241,0.12)] hover:border-indigo-500/50 hover:bg-indigo-500/[0.06] hover:shadow-[0_0_25px_rgba(99,102,241,0.22)] cursor-pointer transition-all duration-300 active:scale-[0.98] flex flex-col justify-between h-32 animate-fade-in"
        >
          <div>
            <div className="text-xs uppercase font-extrabold text-indigo-300 tracking-wider flex items-center gap-2">
              <Database size={13} />
              <span>Total Muestras Registradas</span>
            </div>
            <div className="mt-3 text-2xl font-black text-slate-100 font-mono tracking-tight">{total}</div>
          </div>
          <div className="text-xs text-slate-400 font-bold">Base Unificada Desnormalizada</div>
        </div>

        {/* Estado General QA/QC */}
        <div
          onClick={() => onNavigateTab('registro_maestro')}
          className={`p-5 rounded-2xl border bg-navy-950/20 h-32 transition-all duration-300 flex flex-col justify-between cursor-pointer active:scale-[0.98] ${alertsCount > 0
              ? 'border-rose-500/30 bg-rose-500/[0.03] bg-gradient-to-br from-rose-500/[0.08] to-transparent shadow-[0_0_20px_rgba(244,63,94,0.15)] hover:border-rose-500/50 hover:bg-rose-500/[0.06]'
              : 'border-emerald-500/30 bg-emerald-500/[0.03] bg-gradient-to-br from-emerald-500/[0.08] to-transparent shadow-[0_0_20px_rgba(16,185,129,0.12)] hover:border-emerald-500/50 hover:bg-emerald-500/[0.06]'
            }`}
        >
          <div>
            <div className="text-xs uppercase font-extrabold text-slate-400 tracking-wider flex items-center gap-2">
              <ShieldCheck size={13} className={alertsCount > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'} />
              <span>Estado General QA/QC</span>
            </div>
            <div className={`mt-3 text-lg font-black tracking-wider uppercase font-mono ${alertsCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {alertsCount > 0 ? `${alertsCount} Alertas Críticas` : 'Todo Consistente'}
            </div>
          </div>
          <div className="text-xs text-slate-400 font-bold">
            {alertsCount > 0 ? 'Click para Auditar Errores' : 'Auditoría Aprobada'}
          </div>
        </div>

      </div>

      {/* FILA INFERIOR: Los 5 Ensayos por Separado con Colores Característicos Neón y Fondos de su Propia Gama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

        {/* 1. UCS (Naranja Neón) */}
        <div
          onClick={() => onNavigateTab('ucs')}
          className="p-5 rounded-2xl border border-orange-500/30 bg-orange-500/[0.03] bg-gradient-to-br from-orange-500/[0.08] to-transparent shadow-[0_0_20px_rgba(249,115,22,0.12)] hover:border-orange-500/50 hover:bg-orange-500/[0.06] hover:shadow-[0_0_25px_rgba(249,115,22,0.22)] cursor-pointer transition-all duration-300 active:scale-[0.98] flex flex-col justify-between h-32"
        >
          <div>
            <div className="text-xs uppercase font-extrabold text-orange-400 tracking-wider flex items-center gap-2">
              <FlaskConical size={13} />
              <span>Compresión (UCS)</span>
            </div>
            <div className="mt-3 text-2xl font-black text-orange-400 font-mono tracking-tight">{countUCS}</div>
          </div>
          <div className="text-xs text-slate-400 font-bold">Módulo Uniaxial</div>
        </div>

        {/* 2. Elásticas (Rojo Neón) */}
        <div
          onClick={() => onNavigateTab('elasticas')}
          className="p-5 rounded-2xl border border-red-500/30 bg-red-500/[0.03] bg-gradient-to-br from-red-500/[0.08] to-transparent shadow-[0_0_20px_rgba(239,68,68,0.12)] hover:border-red-500/50 hover:bg-red-500/[0.06] hover:shadow-[0_0_25px_rgba(239,68,68,0.22)] cursor-pointer transition-all duration-300 active:scale-[0.98] flex flex-col justify-between h-32"
        >
          <div>
            <div className="text-xs uppercase font-extrabold text-red-400 tracking-wider flex items-center gap-2">
              <Activity size={13} />
              <span>Const. Elásticas</span>
            </div>
            <div className="mt-3 text-2xl font-black text-red-400 font-mono tracking-tight">{countElasticas}</div>
          </div>
          <div className="text-xs text-slate-400 font-bold">Módulo Young/Poisson</div>
        </div>

        {/* 3. Tracción (Amarillo Neón) */}
        <div
          onClick={() => onNavigateTab('traccion')}
          className="p-5 rounded-2xl border border-yellow-500/30 bg-yellow-500/[0.03] bg-gradient-to-br from-yellow-500/[0.08] to-transparent shadow-[0_0_20px_rgba(234,179,8,0.12)] hover:border-yellow-500/50 hover:bg-yellow-500/[0.06] hover:shadow-[0_0_25px_rgba(234,179,8,0.22)] cursor-pointer transition-all duration-300 active:scale-[0.98] flex flex-col justify-between h-32"
        >
          <div>
            <div className="text-xs uppercase font-extrabold text-yellow-400 tracking-wider flex items-center gap-2">
              <TrendingUp size={13} />
              <span>Tracción Indirecta</span>
            </div>
            <div className="mt-3 text-2xl font-black text-yellow-400 font-mono tracking-tight">{countTraccion}</div>
          </div>
          <div className="text-xs text-slate-400 font-bold">Módulo Brasileño</div>
        </div>

        {/* 4. Corte (Verde Neón) */}
        <div
          onClick={() => onNavigateTab('corte')}
          className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.03] bg-gradient-to-br from-emerald-500/[0.08] to-transparent shadow-[0_0_20px_rgba(16,185,129,0.12)] hover:border-emerald-500/50 hover:bg-emerald-500/[0.06] hover:shadow-[0_0_25px_rgba(16,185,129,0.22)] cursor-pointer transition-all duration-300 active:scale-[0.98] flex flex-col justify-between h-32"
        >
          <div>
            <div className="text-xs uppercase font-extrabold text-emerald-400 tracking-wider flex items-center gap-2">
              <Scissors size={13} />
              <span>Corte Directo</span>
            </div>
            <div className="mt-3 text-2xl font-black text-emerald-400 font-mono tracking-tight">{countCorte}</div>
          </div>
          <div className="text-xs text-slate-400 font-bold">Módulo Discontinuidades</div>
        </div>

        {/* 5. Triaxial (Morado Neón) */}
        <div
          onClick={() => onNavigateTab('triaxial')}
          className="p-5 rounded-2xl border border-purple-500/30 bg-purple-500/[0.03] bg-gradient-to-br from-purple-500/[0.08] to-transparent shadow-[0_0_20px_rgba(168,85,247,0.12)] hover:border-purple-500/50 hover:bg-purple-500/[0.06] hover:shadow-[0_0_25px_rgba(168,85,247,0.22)] cursor-pointer transition-all duration-300 active:scale-[0.98] flex flex-col justify-between h-32"
        >
          <div>
            <div className="text-xs uppercase font-extrabold text-purple-400 tracking-wider flex items-center gap-2">
              <Compass size={13} />
              <span>Comp. Triaxial</span>
            </div>
            <div className="mt-3 text-2xl font-black text-purple-400 font-mono tracking-tight">{countTriaxial}</div>
          </div>
          <div className="text-xs text-slate-400 font-bold">Módulo Confinamiento</div>
        </div>

      </div>

      {/* Grid de Registros Recientes e Indicadores de Módulos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Tabla Maestra de Registros Recientes */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl bg-navy-950/15 border border-navy-900 shadow-xl">
          <h3 className="text-xs font-black text-slate-100 uppercase tracking-widest border-b border-navy-900 pb-3 mb-4">Últimas Muestras Registradas</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-navy-850 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 w-16">IDD</th>
                  <th className="pb-3">Sondaje</th>
                  <th className="pb-3">Código Muestra</th>
                  <th className="pb-3">Proyecto</th>
                  <th className="pb-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-900/40 text-slate-300 font-semibold">
                {recentRecords.map((rec) => (
                  <tr key={rec.idd} className="hover:bg-navy-900/10 transition-colors">
                    <td className="py-3 font-mono font-bold text-slate-400">{rec.idd}</td>
                    <td className="py-3">{rec.sondaje || '—'}</td>
                    <td className="py-3 font-bold text-orange-400 font-mono">{rec.codigo_muestra || '—'}</td>
                    <td className="py-3">{rec.proyecto || '—'}</td>
                    <td className="py-3 text-center">
                      <button
                        onClick={() => onNavigateTab('registro_maestro')}
                        className="text-xs font-black text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded border border-indigo-500/20 uppercase flex items-center gap-1 mx-auto transition-all active:scale-95"
                      >
                        <span>Ver Grid</span>
                        <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {recentRecords.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-semibold italic">
                      No se registran muestras en la base de datos local.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel de Control Lateral - MÓDULOS GEOMECÁNICOS Completo con los 6 Ensayos y Redirección al Clic */}
        <div className="glass-panel p-5 rounded-2xl bg-navy-950/15 border border-navy-900 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black text-slate-100 uppercase tracking-widest border-b border-navy-900 pb-3 mb-4">Módulos Geomecánicos</h3>
            <div className="space-y-4">

              {/* 1. UCS Compresión (Naranja) */}
              <div
                onClick={() => onNavigateTab('ucs')}
                className="group cursor-pointer hover:bg-white/[0.02] p-1.5 rounded-xl transition-all"
                title="Ir al Módulo de Compresión Uniaxial"
              >
                <div className="flex justify-between text-xs mb-1.5 font-bold">
                  <span className="text-orange-400 group-hover:text-orange-300 flex items-center gap-1.5 transition-colors">
                    <span>UCS Compresión</span>
                    <ArrowRight size={11} className="opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-[-4px] group-hover:translate-x-0" />
                  </span>
                  <span className="text-slate-200 font-black font-mono">{countUCS}</span>
                </div>
                <div className="h-2 bg-navy-900 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 shadow-[0_0_8px_#f97316] rounded-full" style={{ width: `${total > 0 ? (countUCS / total) * 100 : 0}%` }}></div>
                </div>
              </div>

              {/* 2. Constantes Elásticas (Rojo) */}
              <div
                onClick={() => onNavigateTab('elasticas')}
                className="group cursor-pointer hover:bg-white/[0.02] p-1.5 rounded-xl transition-all"
                title="Ir al Módulo de Constantes Elásticas"
              >
                <div className="flex justify-between text-xs mb-1.5 font-bold">
                  <span className="text-red-400 group-hover:text-red-300 flex items-center gap-1.5 transition-colors">
                    <span>Constantes Elásticas</span>
                    <ArrowRight size={11} className="opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-[-4px] group-hover:translate-x-0" />
                  </span>
                  <span className="text-slate-200 font-black font-mono">{countElasticas}</span>
                </div>
                <div className="h-2 bg-navy-900 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 shadow-[0_0_8px_#ef4444] rounded-full" style={{ width: `${total > 0 ? (countElasticas / total) * 100 : 0}%` }}></div>
                </div>
              </div>

              {/* 3. Tracción Indirecta (Amarillo) */}
              <div
                onClick={() => onNavigateTab('traccion')}
                className="group cursor-pointer hover:bg-white/[0.02] p-1.5 rounded-xl transition-all"
                title="Ir al Módulo de Tracción Indirecta"
              >
                <div className="flex justify-between text-xs mb-1.5 font-bold">
                  <span className="text-yellow-400 group-hover:text-yellow-300 flex items-center gap-1.5 transition-colors">
                    <span>Tracción Indirecta</span>
                    <ArrowRight size={11} className="opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-[-4px] group-hover:translate-x-0" />
                  </span>
                  <span className="text-slate-200 font-black font-mono">{countTraccion}</span>
                </div>
                <div className="h-2 bg-navy-900 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 shadow-[0_0_8px_#eab308] rounded-full" style={{ width: `${total > 0 ? (countTraccion / total) * 100 : 0}%` }}></div>
                </div>
              </div>

              {/* 4. Corte Directo (Verde) */}
              <div
                onClick={() => onNavigateTab('corte')}
                className="group cursor-pointer hover:bg-white/[0.02] p-1.5 rounded-xl transition-all"
                title="Ir al Módulo de Corte Directo"
              >
                <div className="flex justify-between text-xs mb-1.5 font-bold">
                  <span className="text-emerald-400 group-hover:text-emerald-300 flex items-center gap-1.5 transition-colors">
                    <span>Corte Directo</span>
                    <ArrowRight size={11} className="opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-[-4px] group-hover:translate-x-0" />
                  </span>
                  <span className="text-slate-200 font-black font-mono">{countCorte}</span>
                </div>
                <div className="h-2 bg-navy-900 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 shadow-[0_0_8px_#10b981] rounded-full" style={{ width: `${total > 0 ? (countCorte / total) * 100 : 0}%` }}></div>
                </div>
              </div>

              {/* 5. Triaxial (Morado) */}
              <div
                onClick={() => onNavigateTab('triaxial')}
                className="group cursor-pointer hover:bg-white/[0.02] p-1.5 rounded-xl transition-all"
                title="Ir al Módulo de Compresión Triaxial"
              >
                <div className="flex justify-between text-xs mb-1.5 font-bold">
                  <span className="text-purple-400 group-hover:text-purple-300 flex items-center gap-1.5 transition-colors">
                    <span>Compresión Triaxial</span>
                    <ArrowRight size={11} className="opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-[-4px] group-hover:translate-x-0" />
                  </span>
                  <span className="text-slate-200 font-black font-mono">{countTriaxial}</span>
                </div>
                <div className="h-2 bg-navy-900 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 shadow-[0_0_8px_#a855f7] rounded-full" style={{ width: `${total > 0 ? (countTriaxial / total) * 100 : 0}%` }}></div>
                </div>
              </div>

              {/* 6. Propiedades Físicas (Celeste) */}
              <div
                onClick={() => onNavigateTab('propiedades')}
                className="group cursor-pointer hover:bg-white/[0.02] p-1.5 rounded-xl transition-all"
                title="Ir al Módulo de Propiedades Físicas"
              >
                <div className="flex justify-between text-xs mb-1.5 font-bold">
                  <span className="text-sky-400 group-hover:text-sky-300 flex items-center gap-1.5 transition-colors">
                    <span>Propiedades Físicas</span>
                    <ArrowRight size={11} className="opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-[-4px] group-hover:translate-x-0" />
                  </span>
                  <span className="text-slate-200 font-black font-mono">{countPropiedades}</span>
                </div>
                <div className="h-2 bg-navy-900 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500 shadow-[0_0_8px_#38bdf8] rounded-full" style={{ width: `${total > 0 ? (countPropiedades / total) * 100 : 0}%` }}></div>
                </div>
              </div>

            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-navy-900/60 text-xs text-slate-400 font-semibold italic">
            Haga clic en cualquiera de las filas superiores para navegar directamente al módulo correspondiente.
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;