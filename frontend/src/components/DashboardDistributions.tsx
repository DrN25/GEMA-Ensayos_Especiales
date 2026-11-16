import { useState, type ReactNode } from 'react';
import { CalendarDays, FlaskConical } from 'lucide-react';
import { summaryAssayPalette } from '../config/summaryAssayPalette';

export interface AssayCount {
  etiqueta: string | null;
  ensayos: number;
}

interface AssaySeries {
  etiqueta: string;
  ensayos: number;
}

export interface StackedAssayCount extends AssayCount {
  series: AssaySeries[];
}

const number = new Intl.NumberFormat('es-PE');
const preferredSeries = Object.keys(summaryAssayPalette);
const tooltipPalette = 'border border-[#1e3a8a] bg-[#172554] text-white dark:border-transparent dark:bg-slate-100 dark:text-slate-900';

function seriesSwatch(label: string) {
  if (Object.hasOwn(summaryAssayPalette, label)) {
    return { className: summaryAssayPalette[label as keyof typeof summaryAssayPalette].bar };
  }
  if (label === 'Sin tipo') return { className: 'bg-slate-500' };

  const hash = Array.from(label).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
  return { style: { backgroundColor: `hsl(${hash % 360} 62% 48%)` } };
}

function scaleFor(data: AssayCount[]) {
  const peak = data.reduce((max, entry) => Math.max(max, entry.ensayos), 1);
  const step = Math.max(1, Math.ceil(peak / 4));
  const maximum = Math.ceil(peak / step) * step;
  const ticks = Array.from({ length: maximum / step + 1 }, (_, index) => index * step);
  return { maximum, ticks };
}

function ChartCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="glass-panel flex min-w-0 flex-col rounded-xl border border-navy-800 p-4 shadow-lg sm:p-5">
      <div className="mb-4 flex shrink-0 items-center gap-3 border-b border-navy-800 pb-4">
        {icon}
        <div>
          <h3 className="text-sm font-bold text-slate-100">Distribución</h3>
          <p className="mt-0.5 text-xs text-slate-400">{title}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ChartStatus({ loading, available }: { loading: boolean; available: boolean }) {
  return (
    <p role="status" className="grid min-h-52 place-items-center text-center text-sm text-slate-400">
      {loading ? 'Cargando distribución…' : available ? 'Todavía no hay ensayos registrados.' : 'No se pudo cargar la distribución.'}
    </p>
  );
}

function SeriesLegend({ seriesOrder }: { seriesOrder: string[] }) {
  if (seriesOrder.length === 0) return null;
  return (
    <ul aria-label="Tipos de ensayo" className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-navy-800 pt-3">
      {seriesOrder.map(kind => {
        const { className, style } = seriesSwatch(kind);
        return (
          <li key={kind} className="flex items-center gap-1.5 text-xs text-slate-400">
            <span aria-hidden="true" className={'h-2.5 w-2.5 rounded-sm ' + (className ?? '')} style={style} />
            {kind}
          </li>
        );
      })}
    </ul>
  );
}

function StackedBar({ group, label, maximum, seriesOrder, position, vertical = false }: {
  group: StackedAssayCount;
  label: string;
  maximum: number;
  seriesOrder: string[];
  position: string;
  vertical?: boolean;
}) {
  const [pointed, setPointed] = useState<AssaySeries | null>(null);
  const [focused, setFocused] = useState<AssaySeries | null>(null);
  const active = pointed ?? focused;
  const total = number.format(group.ensayos);
  const size = group.ensayos / maximum * 100 + '%';

  return (
    <>
      <div className={vertical ? 'flex w-3/5 max-w-10 flex-col-reverse' : 'relative flex h-3/4'}
        style={vertical ? { height: size } : { width: size }}>
        {seriesOrder.map(kind => {
          const segment = group.series?.find(entry => entry.etiqueta === kind);
          if (!segment) return null;
          const { className, style } = seriesSwatch(kind);
          const share = segment.ensayos / group.ensayos * 100 + '%';
          return (
            <div
              key={kind}
              tabIndex={0}
              role="img"
              aria-label={`${label}: ${kind}, ${number.format(segment.ensayos)} ensayos, ${total} en total`}
              className={'relative shrink-0 border-white/25 hover:brightness-110 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700 dark:focus-visible:outline-white '
                + (vertical ? 'border-t last:rounded-t-md ' : 'border-r first:rounded-l-md last:rounded-r-md ') + (className ?? '')}
              style={{ ...style, ...(vertical ? { height: share } : { width: share }) }}
              onPointerEnter={() => setPointed(segment)}
              onPointerLeave={() => setPointed(null)}
              onFocus={() => setFocused(segment)}
              onBlur={() => setFocused(null)}
            />
          );
        })}
      </div>
      <div aria-hidden="true"
        className={`pointer-events-none invisible absolute z-20 w-max max-w-36 break-words rounded-md px-2 py-1.5 text-[11px] leading-tight shadow-md group-hover:visible group-focus-within:visible ${tooltipPalette} ${position}`}
        style={vertical ? { bottom: `calc(${size} + 6px)` } : undefined}>
        <p className="font-semibold">{label} · Total: {total}</p>
        {active && <p className="mt-1">{active.etiqueta} · {number.format(active.ensayos)} {active.ensayos === 1 ? 'ensayo' : 'ensayos'}</p>}
      </div>
    </>
  );
}

function CampaignChart({ data, seriesOrder }: { data: StackedAssayCount[]; seriesOrder: string[] }) {
  const { maximum, ticks } = scaleFor(data);

  return (
    <>
      <div className="overflow-x-auto pb-1">
        <div style={{ minWidth: Math.max(250, data.length * 62 + 48) }}>
          <div className="mb-9 text-xs font-semibold text-slate-400">Ensayos</div>
          <div className="relative ml-12 h-44 border-b border-l border-navy-800">
            {ticks.slice(1).map(tick => (
              <div key={tick} aria-hidden="true" className="pointer-events-none absolute inset-x-0 border-t border-navy-800/70" style={{ bottom: tick / maximum * 100 + '%' }}>
                <span className="absolute right-full mr-2 -translate-y-1/2 whitespace-nowrap font-mono text-[10px] text-slate-400">{number.format(tick)}</span>
              </div>
            ))}
            <span aria-hidden="true" className="absolute right-full bottom-0 mr-2 translate-y-1/2 font-mono text-[10px] text-slate-400">0</span>
            <ul className="relative z-0 flex h-full">
              {data.map((campaign, index) => {
                const label = campaign.etiqueta ?? 'Sin campaña';
                return (
                  <li key={campaign.etiqueta} tabIndex={0}
                    aria-label={label + ': ' + number.format(campaign.ensayos) + ' ensayos en total'}
                    className="group relative flex h-full min-w-0 flex-1 items-end justify-center focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-500">
                    <StackedBar group={campaign} label={label} maximum={maximum} seriesOrder={seriesOrder} vertical
                      position={index === 0 ? 'left-0' : index === data.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2'} />
                  </li>
                );
              })}
            </ul>
          </div>
          <div aria-hidden="true" className="ml-12 mt-2 flex items-start text-center text-[11px] font-medium leading-tight text-slate-400">
            {data.map(({ etiqueta }) => <span key={etiqueta} className="min-w-0 flex-1 break-words px-0.5">{etiqueta ?? 'Sin campaña'}</span>)}
          </div>
          <p className="ml-12 mt-3 text-center text-xs font-semibold text-slate-400">Campaña</p>
        </div>
      </div>
      <SeriesLegend seriesOrder={seriesOrder} />
    </>
  );
}

function LaboratoryChart({ data, seriesOrder }: { data: StackedAssayCount[]; seriesOrder: string[] }) {
  const { maximum, ticks } = scaleFor(data);
  const grid = 'grid grid-cols-[minmax(5.5rem,2fr)_minmax(0,5fr)] items-center gap-3';

  return (
    <div className="flex flex-1 flex-col justify-center">
      <div className="my-auto py-3">
        <ul className="space-y-3">
          {data.map(laboratory => {
            const label = laboratory.etiqueta ?? 'Sin laboratorio';
            return (
              <li key={laboratory.etiqueta} tabIndex={0}
                aria-label={label + ': ' + number.format(laboratory.ensayos) + ' ensayos en total'}
                className={grid + ' group rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500'}>
                <span className="break-words text-xs font-medium text-slate-100">{label}</span>
                <div className="relative flex h-8 items-center rounded-md bg-navy-900/70">
                  {ticks.slice(1, -1).map(tick => (
                    <span key={tick} aria-hidden="true" className="absolute inset-y-0 border-l border-navy-800" style={{ left: tick / maximum * 100 + '%' }} />
                  ))}
                  <StackedBar group={laboratory} label={label} maximum={maximum} seriesOrder={seriesOrder}
                    position="bottom-full right-0 mb-1" />
                </div>
              </li>
            );
          })}
        </ul>
        <div className={grid + ' mt-2'} aria-hidden="true">
          <span />
          <div className="relative h-5 border-t border-navy-800">
            {ticks.map((tick, index) => (
              <span key={tick} style={{ left: tick / maximum * 100 + '%' }}
                className={'absolute pt-1 font-mono text-[10px] text-slate-400 ' + (index === 0 ? '' : tick === maximum ? '-translate-x-full' : '-translate-x-1/2')}>
                {number.format(tick)}
              </span>
            ))}
          </div>
          <span />
          <span className="text-center text-xs font-semibold text-slate-400">Ensayos</span>
        </div>
      </div>
      <SeriesLegend seriesOrder={seriesOrder} />
    </div>
  );
}

export default function DashboardDistributions({ campaigns, laboratories, loading }: {
  campaigns?: StackedAssayCount[];
  laboratories?: StackedAssayCount[];
  loading: boolean;
}) {
  const kinds = new Set(
    [...(campaigns ?? []), ...(laboratories ?? [])].flatMap(group => group.series?.map(segment => segment.etiqueta) ?? [])
  );
  const seriesOrder = [
    ...preferredSeries.filter(kind => kinds.has(kind)),
    ...Array.from(kinds).filter(kind => !preferredSeries.includes(kind)).sort((a, b) => a.localeCompare(b, 'es')),
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard title="Ensayos por campaña" icon={<CalendarDays size={18} className="text-sky-700 dark:text-sky-300" />}>
        {campaigns?.length ? <CampaignChart data={campaigns} seriesOrder={seriesOrder} /> : <ChartStatus loading={loading} available={Boolean(campaigns)} />}
      </ChartCard>
      <ChartCard title="Ensayos por laboratorio" icon={<FlaskConical size={18} className="text-emerald-700 dark:text-emerald-300" />}>
        {laboratories?.length
          ? <LaboratoryChart data={[...laboratories].sort((a, b) => b.ensayos - a.ensayos)} seriesOrder={seriesOrder} />
          : <ChartStatus loading={loading} available={Boolean(laboratories)} />}
      </ChartCard>
    </div>
  );
}
