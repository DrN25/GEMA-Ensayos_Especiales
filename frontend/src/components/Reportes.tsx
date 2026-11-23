import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Box, ChevronLeft, ChevronRight, ClipboardList, Download, Eye, FilePlus, FileText, History, Save, Search } from 'lucide-react';
import { API_BASE, responseError, useAuth } from '../auth/AuthContext';
import { authFilledInputClass, authPrimaryClass } from '../auth/AuthFields';
import ReportAssayPicker from '../features/reports/ReportAssayPicker';
import type { ReportAssayMatch } from '../features/reports/ReportAssayPicker';
import { downloadReport } from '../features/reports/downloadReport';
import ReportPhotos from '../features/reports/ReportPhotoFields';
import { embedReportPhotos, uploadReportPhoto, photoPairError, previewPhotoDimensions, type ReportPhotos as Photos, type PhotoPosition } from '../features/reports/reportPhotos';

const url = API_BASE + '/api/reportes';
const sections = [
  {
    title: 'Datos', source: 'datos', icon: ClipboardList,
    reference: [
      { key: 'proyecto', label: 'Proyecto' },
      { key: 'sector', label: 'Sector' },
      { key: 'coordenadas', label: 'Coordenadas' },
    ],
    fields: [
      { key: 'numero_informe', label: 'Informe N.º', max: 100, required: true },
      { key: 'fecha_emision', label: 'Fecha de emisión', type: 'date', required: true },
      { key: 'texto_titulo', label: 'Texto del título', max: 150, example: 'Ej. ASTM D2938' },
      { key: 'ejecutor', label: 'Ejecutor', max: 150, example: 'Ej. Ana Pérez' },
      { key: 'supervisor', label: 'Supervisor', max: 150, example: 'Ej. Carlos García' },
      { key: 'ubicacion', label: 'Ubicación', max: 200 },
    ],
  },
  {
    title: 'Datos de muestra', source: 'muestra', icon: Box,
    reference: [
      { key: 'codigo', label: 'Código de muestra' },
      { key: 'sondaje', label: 'Sondaje' },
      { key: 'litologia', label: 'Litología' },
      { key: 'observaciones', label: 'Observaciones' },
    ],
    fields: [
      { key: 'material', label: 'Material', max: 150 },
      { key: 'presentacion', label: 'Presentación', max: 150 },
      { key: 'muestreado', label: 'Muestreado', max: 150 },
      { key: 'profundidad', label: 'Profundidad', max: 100 },
    ],
  },
] as const;
const historyColumns = ['Informe', 'Código de muestra', 'Tipo de ensayo', 'Sondaje', 'Fecha de emisión', 'Emitido por', 'PDF'];

type Field = typeof sections[number]['fields'][number]['key'];
type EmissionFields = Record<Field, string>;
type Sample = { muestra: Record<string, string>; datos: Record<string, string>; tipo_ensayo: string; corridas: number; fotografias_habilitadas?: boolean };
type DocumentResponse = { id_reporte: number; codigo_muestra: string; numero_informe: string; html: string; sigla_ensayo: string };
type HistoryItem = Pick<DocumentResponse, 'id_reporte' | 'codigo_muestra' | 'numero_informe'> & {
  fecha_emision: string; usuario_emisor: string; tipo_ensayo: string | null; sondaje: string | null;
};
type ReportHistory = { items: HistoryItem[]; hay_mas: boolean };

const secondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-navy-800 bg-navy-950 px-4 py-2.5 text-sm font-semibold hover:bg-navy-900 disabled:opacity-50';

function emptyEmission(): EmissionFields {
  return {
    numero_informe: '', fecha_emision: new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima' }).format(new Date()),
    texto_titulo: '', ejecutor: '', supervisor: '', ubicacion: '', material: '', presentacion: '', muestreado: '', profundidad: '',
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo completar la operación.';
}

export default function Reportes() {
  const { authFetch } = useAuth();
  const pendingKey = useRef<string | null>(null);
  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [sample, setSample] = useState<Sample | null>(null);
  const [emission, setEmission] = useState(emptyEmission);
  const [html, setHtml] = useState('');
  const [saved, setSaved] = useState<DocumentResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<Photos>({});
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [historyInput, setHistoryInput] = useState('');
  const [historyFilter, setHistoryFilter] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [history, setHistory] = useState<ReportHistory | null>(null);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    if (tab !== 'history') return;
    const controller = new AbortController();
    const params = new URLSearchParams({ q: historyFilter, page: String(historyPage) });
    setHistory(null);
    setHistoryError('');
    void authFetch(url + '?' + params, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw await responseError(response, 'No se pudo cargar el historial.');
      const result: ReportHistory = await response.json();
      if (!controller.signal.aborted) setHistory(result);
    }).catch(error => {
      if (!controller.signal.aborted) setHistoryError(errorMessage(error));
    });
    return () => controller.abort();
  }, [authFetch, tab, historyFilter, historyPage]);

  async function request(path: string, options?: RequestInit) {
    const response = await authFetch(url + path, options);
    if (!response.ok) throw await responseError(response, 'No se pudo completar la operación. Revisa los campos del reporte.');
    return response.json();
  }

  async function loadPhoto(path: string) {
    const response = await authFetch(API_BASE + path);
    if (!response.ok) throw await responseError(response, 'No se pudo recuperar la fotografía del reporte.');
    return response;
  }

  async function run(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await operation();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  function selectSample(code: string, status: ReportAssayMatch['estado_plantilla'] = 'disponible') {
    void run(async () => {
      setSelectedCode(code);
      setSample(null);
      setSaved(null);
      setHtml('');
      setPhotos({});
      pendingKey.current = null;
      if (status !== 'disponible') {
        setNotice(status === 'pendiente'
          ? 'Este tipo de ensayo todavía no tiene plantilla para emitir reportes.'
          : 'Revisa el tipo de ensayo de este código en el Registro Maestro antes de emitir.');
        return;
      }
      setSample(await request('/muestra?' + new URLSearchParams({ codigo_muestra: code })));
      setEmission(emptyEmission());
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isPreview = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'preview';
    if (!sample || photoProcessing || saved && !isPreview) return;
    const pairError = photoPairError(photos);
    if (pairError) { setError(pairError); return; }
    if (!emission.numero_informe.trim()) {
      setError('Ingresa el número de informe.');
      return;
    }
    void run(async () => {
      const ids: Partial<Record<PhotoPosition, string>> = {};
      if (!isPreview) {
        pendingKey.current ??= crypto.randomUUID();
        for (const position of ['antes', 'despues'] as const) {
          const photo = photos[position];
          if (photo) {
            const id = await uploadReportPhoto(photo, position, sample.muestra.codigo, pendingKey.current, request);
            ids[position] = id;
            setPhotos(current => ({ ...current, [position]: { ...photo, id, uploadRequest: pendingKey.current! } }));
          }
        }
      }
      const common = { ...emission, codigo_muestra: sample.muestra.codigo };
      const payload = isPreview
        ? { ...common, fotografias_locales: previewPhotoDimensions(photos) }
        : { ...common, imagenes: ids, solicitud_id: pendingKey.current };
      const result: DocumentResponse = await request(isPreview ? '/vista-previa' : '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!isPreview) {
        setSaved(result);
        setNotice('Reporte guardado. Si la descarga falla, puedes reintentar desde el historial.');
      }
      const prepared = await embedReportPhotos(result.html, loadPhoto, photos);
      setHtml(prepared);
      if (!isPreview) await downloadReport(prepared, result.id_reporte, result.codigo_muestra, result.sigla_ensayo);
    });
  }

  function download(id: number) {
    void run(async () => {
      const result: DocumentResponse = await request('/' + id);
      await downloadReport(await embedReportPhotos(result.html, loadPhoto), result.id_reporte, result.codigo_muestra, result.sigla_ensayo);
    });
  }

  return (
    <section className="space-y-4 text-slate-100">
      <h1 className="flex items-center gap-2 text-xl font-black"><FileText size={22} className="text-sky-600" aria-hidden="true" /> Reportes de ensayos</h1>
      <div aria-label="Vistas de reportes" className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={tab === 'new'} disabled={busy || photoProcessing} onClick={() => setTab('new')} className={tab === 'new' ? authPrimaryClass : secondary}><FilePlus size={16} aria-hidden="true" /> Nuevo reporte</button>
        <button type="button" aria-pressed={tab === 'history'} disabled={busy || photoProcessing} onClick={() => setTab('history')} className={tab === 'history' ? authPrimaryClass : secondary}>
          <History size={16} aria-hidden="true" /> Historial
        </button>
      </div>
      {notice && <p role="status" className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:bg-navy-900 dark:text-rose-200">{error}</p>}

      {tab === 'new' ? (
        <>
          <div className="rounded-xl border border-navy-800 bg-navy-950 p-4">
            <ReportAssayPicker disabled={busy || photoProcessing} selectedCode={selectedCode} onSelect={match => selectSample(match.codigo_muestra, match.estado_plantilla)} />
          </div>

          {sample && (
            <form onSubmit={submit} aria-busy={busy} className="space-y-4 rounded-xl border border-navy-800 bg-navy-950 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold">{sample.muestra.codigo}</h2>
                <p className="text-sm text-slate-400">
                  {sample.tipo_ensayo} · {sample.corridas} {sample.corridas === 1 ? 'corrida' : 'corridas'}
                </p>
              </div>
              {sections.map(({ title, source, icon: Icon, reference, fields }) => (
                <fieldset key={source} disabled={busy || Boolean(saved)}
                  className="min-w-0 space-y-3 rounded-xl border border-navy-800 px-4 pb-4 pt-2">
                  <legend className="px-2">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <Icon size={17} aria-hidden="true" className="text-sky-600 dark:text-sky-400" /> {title}
                    </span>
                  </legend>
                  <dl className="grid gap-3 rounded-lg bg-navy-900 p-3 sm:grid-cols-2 xl:grid-cols-3">
                    {reference.map(({ key, label }) => (
                      <div key={key} className="min-w-0">
                        <dt className="text-xs font-semibold text-slate-400">{label}</dt>
                        <dd className="whitespace-pre-line break-words text-sm">{sample[source][key] || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {fields.map(field => (
                      <label key={field.key} className="grid min-w-0 gap-1 text-sm font-semibold">
                        {field.label}{'required' in field ? ' *' : ''}
                        <input type={'type' in field ? field.type : 'text'} required={'required' in field} maxLength={'max' in field ? field.max : undefined}
                          placeholder={'example' in field ? field.example : undefined} className={authFilledInputClass} value={emission[field.key]}
                          onChange={event => {
                            pendingKey.current = null;
                            setHtml('');
                            setEmission(current => ({ ...current, [field.key]: event.target.value }));
                          }} />
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              {sample.fotografias_habilitadas && <ReportPhotos photos={photos} disabled={busy || Boolean(saved)} onProcessing={setPhotoProcessing}
                onChange={next => { setPhotos(next); setHtml(''); pendingKey.current = null; }} />}
              <div className="flex flex-wrap gap-2">
                {saved ? (
                  <>
                    <button type="button" disabled={busy} onClick={() => download(saved.id_reporte)} className={authPrimaryClass}><Download size={16} aria-hidden="true" /> Descargar PDF</button>
                    <button type="button" disabled={busy} onClick={() => selectSample(sample.muestra.codigo)} className={secondary}><FilePlus size={16} aria-hidden="true" /> Nueva emisión</button>
                  </>
                ) : (
                  <>
                    <button type="submit" value="preview" disabled={busy || photoProcessing} className={secondary}><Eye size={16} aria-hidden="true" /> Vista previa</button>
                    <button type="submit" value="save" disabled={busy || photoProcessing} className={authPrimaryClass}><Save size={16} aria-hidden="true" /> {busy || photoProcessing ? 'Procesando…' : 'Guardar reporte'}</button>
                  </>
                )}
              </div>
            </form>
          )}
          {html && <iframe title="Vista previa del reporte" sandbox="" srcDoc={html} className="h-[75vh] w-full rounded-xl border border-navy-800 bg-white" />}
        </>
      ) : (
        <div className="space-y-3 rounded-xl border border-navy-800 bg-navy-950 p-4">
          <form onSubmit={event => { event.preventDefault(); setHistoryPage(1); setHistoryFilter(historyInput.trim()); }} className="flex flex-wrap gap-2">
            <input aria-label="Filtrar historial" placeholder="Informe o código de muestra" maxLength={150} value={historyInput}
              onChange={event => setHistoryInput(event.target.value)} className={authFilledInputClass + ' sm:max-w-md'} />
            <button type="submit" disabled={busy} className={secondary}><Search size={16} aria-hidden="true" /> Buscar</button>
          </form>
          {historyError && <p role="alert" className="text-sm text-rose-800 dark:text-rose-200">{historyError}</p>}
          {!history && !historyError && <p role="status" className="text-sm text-slate-400">Cargando historial…</p>}
          {history && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-navy-900"><tr>{historyColumns.map(label => <th key={label} scope="col" className="px-3 py-2">{label}</th>)}</tr></thead>
                  <tbody className="divide-y divide-navy-800">
                    {history.items.map(item => (
                      <tr key={item.id_reporte}>
                        <td className="px-3 py-2 font-semibold">{item.numero_informe}</td><td className="px-3 py-2">{item.codigo_muestra}</td>
                        <td className="px-3 py-2">{item.tipo_ensayo || '—'}</td>
                        <td className="px-3 py-2">{item.sondaje || '—'}</td>
                        <td className="px-3 py-2">{item.fecha_emision.split('-').reverse().join('/')}</td><td className="px-3 py-2">{item.usuario_emisor}</td>
                        <td className="px-3 py-2"><button type="button" disabled={busy} onClick={() => download(item.id_reporte)} className={secondary}><Download size={15} aria-hidden="true" /> Descargar</button></td>
                      </tr>
                    ))}
                    {!history.items.length && <tr><td colSpan={historyColumns.length} className="px-3 py-3 text-slate-400">No hay reportes para mostrar.</td></tr>}
                  </tbody>
                </table>
              </div>
              {(historyPage > 1 || history.hay_mas) && (
                <div className="flex gap-2">
                  <button type="button" disabled={historyPage === 1 || busy} onClick={() => setHistoryPage(page => page - 1)} className={secondary}><ChevronLeft size={16} aria-hidden="true" /> Anterior</button>
                  <button type="button" disabled={!history.hay_mas || busy} onClick={() => setHistoryPage(page => page + 1)} className={secondary}>Siguiente <ChevronRight size={16} aria-hidden="true" /></button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
