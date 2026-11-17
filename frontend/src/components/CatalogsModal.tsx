import { useEffect, useRef, useState } from 'react';
import { BookOpen, Layers, X } from 'lucide-react';
import lithologyReference from '../assets/tabla_litologias.png';
import { lithologyByProject } from '../config/lithologyCatalog';

interface CatalogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const projects = [
  { id: 'ferrobamba', label: 'Ferrobamba' },
  { id: 'chalco', label: 'Chalcobamba' },
] as const;

type Project = (typeof projects)[number]['id'];
type Lithology = (typeof lithologyByProject)[Project][number];

const groupBadges = [
  { code: 'INTRUSIVO', label: 'INTRUSIVOS', color: 'bg-violet-500/10 text-violet-800 dark:text-violet-300' },
  { code: 'SEDIMENTARI', label: 'SEDIMENTARIAS', color: 'bg-sky-500/10 text-sky-800 dark:text-sky-300' },
  { code: 'METAMORFIC', label: 'METAMÓRFICAS', color: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' },
  { code: 'BRECHA', label: 'BRECHAS', color: 'bg-rose-500/10 text-rose-800 dark:text-rose-300' },
  { code: 'ENDOSKARN', label: 'ENDOSKARN', color: 'bg-amber-500/10 text-amber-800 dark:text-amber-300' },
];

function GroupBadge({ group }: { group: string }) {
  const badge = groupBadges.find(({ code }) => group.toUpperCase().includes(code));
  if (!badge) return <span className="font-semibold">{group}</span>;

  return (
    <span className={'inline-flex rounded px-2 py-0.5 text-[10px] font-extrabold ' + badge.color}>
      {badge.label}
    </span>
  );
}

const summaryColumns = ['Clase / Grupo', 'Litología 1 (Lito 1)', 'Litología 2 (Lito 2)', 'Litología 3 (Lito 3)', 'Factor K'];
const detailedColumns = ['Unidad Geotécnica', 'Lito 2', 'Lito 3', 'Validación Lito', 'Factor K (K)'];
const titleClass = 'flex items-center gap-2 text-sm font-bold';
const panelBorder = 'border-navy-800';

function LithologyTable({ rows, detailed = false, labelId }: {
  rows: Lithology[];
  detailed?: boolean;
  labelId: string;
}) {
  const columns = detailed ? detailedColumns : summaryColumns;
  const seenPairs = new Set<string>();
  const visibleRows = detailed ? rows.filter(({ lito2, lito3 }) => {
    // Mapeo conserva la primera fila de cada par exacto Lito 2 / Lito 3.
    const pair = JSON.stringify([lito2, lito3]);
    if (seenPairs.has(pair)) return false;
    seenPairs.add(pair);
    return true;
  }) : rows;

  return (
    <div
      role="region"
      aria-labelledby={labelId}
      tabIndex={0}
      className={'max-h-[36dvh] overflow-auto rounded-lg border custom-scrollbar ' + panelBorder}
    >
      <table aria-labelledby={labelId} className="w-full border-separate border-spacing-0 text-left text-xs">
        <thead className="sticky top-0 z-10 bg-navy-950">
          <tr>
            {columns.map((column, index) => (
              <th key={column} scope="col" className={'whitespace-nowrap border-b px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide ' + panelBorder
                + (index === columns.length - 1 ? ' text-center text-cyan-800 dark:text-cyan-300' : ' text-slate-300')}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-800">
          {visibleRows.map(({ grupo, lito1, lito2, lito3, k }, index) => (
            <tr key={index} className="hover:bg-navy-900 dark:hover:bg-navy-800/50">
              <td className="px-3 py-2"><GroupBadge group={grupo} /></td>
              {!detailed && <td className="px-3 py-2 font-semibold">{lito1}</td>}
              <td className={'px-3 py-2' + (detailed ? ' font-semibold' : '')}>{lito2}</td>
              <td className="px-3 py-2">{lito3}</td>
              {detailed && <td className="px-3 py-2 font-mono">{lito2}/{lito3}</td>}
              <td className="px-3 py-2 text-center font-bold tabular-nums text-cyan-800 dark:text-cyan-300">{k.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CatalogsModal({ isOpen, onClose }: CatalogsModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [project, setProject] = useState<Project>('ferrobamba');
  const rows = lithologyByProject[project];

  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (isOpen && !modal.open) modal.showModal();
    if (!isOpen && modal.open) modal.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="catalogs-title"
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-[1440px] overflow-hidden rounded-2xl border border-navy-800 bg-navy-950 p-0 text-slate-100 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm dark:backdrop:bg-slate-950/70"
    >
      {isOpen && (
        <div className="flex max-h-[90dvh] flex-col">
          <div className={'flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 ' + panelBorder}>
            <h2 id="catalogs-title" className="flex items-center gap-2 text-sm font-bold">
              <BookOpen size={17} aria-hidden="true" className="text-sky-700 dark:text-sky-400" />
              Catálogos de Referencia Geotécnica
            </h2>
            <button
              type="button"
              autoFocus
              onClick={onClose}
              aria-label="Cerrar catálogos"
              className="rounded-lg p-2 text-slate-300 hover:bg-navy-900 dark:hover:bg-navy-800"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="min-h-0 overflow-y-auto p-4 custom-scrollbar sm:p-6 xl:flex xl:items-start xl:gap-5">
            <div className={'mb-4 shrink-0 rounded-xl border bg-white p-3 dark:bg-navy-900 xl:mb-0 xl:w-48 ' + panelBorder}>
              <h3 className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
                Roca Intacta &amp; Litología
              </h3>
              <p className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-900 dark:bg-indigo-600 dark:text-white">
                <Layers size={14} aria-hidden="true" />
                Litología y K
              </p>
            </div>

            <div className="min-w-0 flex-1 gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
              <div className="min-w-0 space-y-6">
                <section className="space-y-3">
                  <div className={'flex flex-wrap items-center justify-between gap-3 border-b pb-2 ' + panelBorder}>
                    <h3 id="lithology-summary-title" className={titleClass}>
                      <Layers size={15} aria-hidden="true" className="shrink-0 text-cyan-700 dark:text-cyan-400" />
                      Factor de correlación para ensayos de carga puntual (Proyecto: {project.toUpperCase()})
                    </h3>
                    <div role="group" aria-label="Proyecto" className={'flex gap-1 rounded-lg border bg-white p-1 dark:bg-navy-900 ' + panelBorder}>
                      {projects.map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={project === id}
                          onClick={() => setProject(id)}
                          className={'rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors ' + (project === id
                            ? 'bg-cyan-50 text-cyan-900 ring-1 ring-inset ring-cyan-200 dark:bg-cyan-400 dark:text-slate-950 dark:ring-0'
                            : 'text-slate-300 hover:bg-navy-900 dark:hover:bg-navy-800')}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <LithologyTable key={project} labelId="lithology-summary-title" rows={rows} />
                </section>

                <section className="space-y-3">
                  <h3 id="lithology-detail-title" className={titleClass + ' border-b pb-2 ' + panelBorder}>
                    <Layers size={15} aria-hidden="true" className="shrink-0 text-violet-700 dark:text-violet-400" />
                    Factor de correlación para ensayos de carga puntual (Detallado)
                  </h3>
                  <LithologyTable key={project} labelId="lithology-detail-title" rows={rows} detailed />
                </section>
              </div>

              <figure className="mt-6 space-y-3 lg:sticky lg:top-0 lg:mt-0">
                <figcaption className={titleClass + ' border-b pb-2 ' + panelBorder}>
                  <Layers size={15} aria-hidden="true" className="text-emerald-700 dark:text-emerald-400" />
                  Tabla de Litologías
                </figcaption>
                <img
                  src={lithologyReference}
                  alt="Tabla de referencia de códigos de litología"
                  className={'mx-auto h-auto w-full max-w-[380px] rounded-lg border ' + panelBorder}
                />
              </figure>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
