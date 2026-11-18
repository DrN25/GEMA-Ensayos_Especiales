import { useEffect, useId, useState } from 'react';
import { ArrowRight, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { API_BASE, responseError, useAuth } from '../../auth/AuthContext';
import { authFilledInputClass } from '../../auth/AuthFields';

export interface ReportAssayMatch {
  codigo_muestra: string;
  sondaje: string | null;
  tipos_ensayo: string[];
  estado_plantilla: 'disponible' | 'pendiente' | 'revisar';
}

const filterFields = [
  { key: 'tipo_ensayo', label: 'Tipo de ensayo', all: 'Todos los tipos' },
  { key: 'proyecto', label: 'Proyecto', all: 'Todos los proyectos' },
  { key: 'laboratorio', label: 'Laboratorio', all: 'Todos los laboratorios' },
  { key: 'campana', label: 'Campaña', all: 'Todas las campañas' },
] as const;

type FilterKey = typeof filterFields[number]['key'];
type FilterOptions = Record<FilterKey, { valor: string; etiqueta: string }[]>;
const emptyFilters: Record<FilterKey, string> = { tipo_ensayo: '', proyecto: '', laboratorio: '', campana: '' };

const availability = {
  disponible: 'Plantilla disponible',
  pendiente: 'Plantilla pendiente',
  revisar: 'Requiere revisión',
};

export default function ReportAssayPicker({ disabled, selectedCode, onSelect }: {
  disabled: boolean;
  selectedCode: string | null;
  onSelect: (match: ReportAssayMatch) => void;
}) {
  const { authFetch } = useAuth();
  const id = useId();
  const listId = id + '-results';
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [options, setOptions] = useState<FilterOptions>();
  const [optionsError, setOptionsError] = useState('');
  const [result, setResult] = useState<{ search: string; matches: ReportAssayMatch[]; error?: string }>();
  const term = query.trim();
  const applied = filterFields.filter(({ key }) => filters[key]);
  const canSearch = term.length >= 2 || applied.length > 0;
  const params = new URLSearchParams(applied.map(({ key }) => [key, filters[key]]));
  if (term) params.set('q', term);
  const search = params.toString();
  const current = result?.search === search ? result : undefined;
  const matches = current?.matches ?? [];

  useEffect(() => {
    const controller = new AbortController();
    void authFetch(API_BASE + '/api/reportes/filtros', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw await responseError(response, 'No se pudieron cargar los filtros.');
      const options: FilterOptions = await response.json();
      if (!controller.signal.aborted) setOptions(options);
    }).catch(error => {
      if (!controller.signal.aborted) setOptionsError(error instanceof Error ? error.message : 'No se pudieron cargar los filtros.');
    });
    return () => controller.abort();
  }, [authFetch]);

  useEffect(() => {
    if (!canSearch) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await authFetch(API_BASE + '/api/reportes/ensayos?' + search, { signal: controller.signal });
        if (!response.ok) throw await responseError(response, 'No se pudieron buscar ensayos.');
        const matches: ReportAssayMatch[] = await response.json();
        if (!controller.signal.aborted) setResult({ search, matches });
      } catch (error) {
        if (!controller.signal.aborted) setResult({
          search, matches: [], error: error instanceof Error ? error.message : 'No se pudieron buscar ensayos.',
        });
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [authFetch, canSearch, search]);

  return (
    <div className="space-y-3">
      <div className="max-w-xl space-y-1.5">
        <label htmlFor={id} className="block text-sm font-bold">Buscar ensayo</label>
        <div className="relative">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input id={id} type="search" aria-controls={canSearch ? listId : undefined}
            value={query} placeholder="Código de muestra o sondaje" maxLength={150} autoComplete="off"
            disabled={disabled} className={authFilledInputClass + ' pl-9'}
            onChange={event => setQuery(event.target.value)} />
        </div>
      </div>
      <fieldset disabled={disabled || !options} className="min-w-0 space-y-2 rounded-lg border border-navy-800 p-3">
        <legend className="px-2">
          <span className="flex items-center gap-2 text-sm font-bold">
            <SlidersHorizontal size={16} aria-hidden="true" className="text-sky-600 dark:text-sky-400" /> Filtros
          </span>
        </legend>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {filterFields.map(({ key, label, all }) => (
            <div key={key} className="grid min-w-0 gap-1 text-xs font-semibold text-slate-300">
              <label htmlFor={id + '-' + key}>{label}</label>
              <select id={id + '-' + key} className={authFilledInputClass + ' min-w-0'} value={filters[key]}
                onChange={event => setFilters(previous => ({ ...previous, [key]: event.target.value }))}>
                <option value="">{all}</option>
                {options?.[key].map(option => <option key={option.valor} value={option.valor}>{option.etiqueta}</option>)}
              </select>
            </div>
          ))}
        </div>
        {applied.length > 0 && (
          <button type="button" onClick={() => setFilters(emptyFilters)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-sky-700 hover:bg-navy-900 dark:text-sky-300">
            <RotateCcw size={14} aria-hidden="true" /> Limpiar filtros
          </button>
        )}
      </fieldset>
      {optionsError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-200">{optionsError}</p>}
      {!canSearch && <p className="text-xs text-slate-400">Escribe al menos dos caracteres o selecciona un filtro para buscar.</p>}
      {matches.length === 30 && <p className="text-xs text-slate-400">Se muestran hasta 30 coincidencias. Acota la búsqueda para ver otros resultados.</p>}
      {canSearch && (
        <div id={listId} aria-busy={!current} className="max-h-80 overflow-auto rounded-lg border border-navy-800">
          <table aria-label="Ensayos encontrados" className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-navy-900 text-xs text-slate-300">
              <tr>{['Código de muestra', 'Sondaje', 'Tipo de ensayo', 'Plantilla', 'Acción'].map(label => (
                <th scope="col" className="whitespace-nowrap px-3 py-2.5" key={label}>{label}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-navy-800">
              {matches.map(match => (
                <tr key={match.codigo_muestra} className={selectedCode === match.codigo_muestra ? 'bg-navy-900' : 'hover:bg-navy-900/60'}>
                  <th scope="row" className="whitespace-nowrap px-3 py-2.5 font-semibold">{match.codigo_muestra}</th>
                  <td className="px-3 py-2.5">{match.sondaje || '—'}</td>
                  <td className="px-3 py-2.5">{match.tipos_ensayo.join(' · ') || 'Sin registrar'}</td>
                  <td className="px-3 py-2.5">
                    <span className={'inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold '
                      + (match.estado_plantilla === 'disponible'
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200'
                        : 'bg-navy-900 text-slate-300')}>
                      {availability[match.estado_plantilla]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <button type="button" disabled={disabled} aria-pressed={selectedCode === match.codigo_muestra}
                      aria-label={'Seleccionar ' + match.codigo_muestra} onClick={() => onSelect(match)}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-navy-800 px-2.5 py-1.5 text-xs font-semibold hover:border-sky-500 aria-pressed:border-sky-500 disabled:opacity-50">
                      <ArrowRight size={14} aria-hidden="true" /> Seleccionar
                    </button>
                  </td>
                </tr>
              ))}
              {!matches.length && (
                <tr><td colSpan={5} className="px-3 py-3 text-slate-400">
                  <span role={current?.error ? 'alert' : 'status'}>
                    {!current ? 'Buscando ensayos…' : current.error ?? 'No se encontraron ensayos.'}
                  </span>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
