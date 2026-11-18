import { useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, LoaderCircle, Upload } from 'lucide-react';
import { API_BASE, responseError, useAuth } from '../../auth/AuthContext';
import { authPrimaryClass } from '../../auth/AuthFields';

const outputName = 'Ensayos_Especiales_Auditado.xlsx';
const maxBytes = 25 * 1024 ** 2;
const number = new Intl.NumberFormat('es-PE');

type Summary = {
  registros: number;
  codigos_unicos: number;
  codigos_repetidos: number;
  por_tipo: { tipo: string; registros: number }[];
};

export default function ExcelReview() {
  const { authFetch } = useAuth();
  const fileId = useId();
  const active = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ excel: Blob; summary: Summary } | null>(null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => () => active.current?.abort(), []);

  async function processFile() {
    if (!file || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setProcessing(true);
    setResult(null);
    setError('');

    try {
      const data = new FormData();
      data.append('file', file);
      const response = await authFetch(API_BASE + '/api/revision-excel', {
        method: 'POST', body: data, signal: controller.signal,
      });
      if (!response.ok) throw await responseError(response, 'No se pudo preparar el Excel auditado.');
      const encoded = response.headers.get('X-Resumen-Revision');
      if (!encoded) throw new Error('No se recibió el resumen de la revisión.');
      const summary: Summary = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded), char => char.charCodeAt(0))));
      const excel = await response.blob();
      if (!controller.signal.aborted) setResult({ excel, summary });
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'No se pudo preparar el Excel auditado.');
      }
    } finally {
      active.current = null;
      if (!controller.signal.aborted) setProcessing(false);
    }
  }

  function download() {
    if (!result) return;
    const url = URL.createObjectURL(result.excel);
    const link = document.createElement('a');
    link.href = url;
    link.download = outputName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  return (
    <section className="mx-auto max-w-5xl space-y-5 text-slate-100">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
          <FileSpreadsheet size={22} aria-hidden="true" />
        </span>
        <h1 className="text-xl font-black">Revisión de Excel</h1>
      </div>

      <form onSubmit={event => { event.preventDefault(); void processFile(); }}
        className="space-y-4 rounded-xl border border-navy-800 bg-navy-950 p-4 sm:p-5" aria-busy={processing}>
        <div className="space-y-1.5">
          <label htmlFor={fileId} className="block text-sm font-bold">Archivo de Ensayos Especiales</label>
          <input id={fileId} type="file" accept=".xlsx" disabled={processing} aria-describedby={fileId + '-help'}
            className="block w-full rounded-lg border border-navy-800 bg-navy-900 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-navy-950 file:px-3 file:py-1.5 file:font-semibold file:text-slate-100 disabled:opacity-60"
            onChange={event => {
              const chosen = event.target.files?.[0] ?? null;
              setResult(null);
              if (chosen && (!/\.xlsx$/i.test(chosen.name) || chosen.size > maxBytes)) {
                setError('Selecciona un archivo .xlsx de hasta 25 MiB.');
                setFile(null);
                event.target.value = '';
                return;
              }
              setError('');
              setFile(chosen);
            }} />
          <p id={fileId + '-help'} className="text-xs text-slate-400">Formato .xlsx, hasta 25 MiB y 25 000 registros.</p>
        </div>
        {error && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:bg-navy-900 dark:text-rose-200">{error}</p>}
        <button type="submit" className={authPrimaryClass} disabled={!file || processing}>
          {processing ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Upload size={17} aria-hidden="true" />}
          {processing ? 'Procesando Excel…' : 'Procesar Excel'}
        </button>
      </form>

      {result && (
        <div className="space-y-4 rounded-xl border border-navy-800 bg-navy-950 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 role="status" className="flex items-center gap-2 font-bold">
                <CheckCircle2 size={18} className="text-emerald-700 dark:text-emerald-200" aria-hidden="true" /> Excel listo para descargar
              </h2>
              <p className="mt-1 text-sm text-slate-400">Al abrir el archivo en Excel se calculan los estados de auditoría y se aplican los colores.</p>
            </div>
            <button type="button" className={authPrimaryClass} onClick={download}>
              <Download size={17} aria-hidden="true" /> Descargar Excel auditado
            </button>
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              ['Registros leídos', result.summary.registros],
              ['Códigos de muestra únicos', result.summary.codigos_unicos],
              ['Códigos con varias corridas', result.summary.codigos_repetidos],
            ].map(([label, value]) => (
              <div className="rounded-lg border border-navy-800 bg-navy-900 p-3" key={label}>
                <dt className="text-xs font-semibold text-slate-400">{label}</dt>
                <dd className="mt-1 text-lg font-black tabular-nums">{number.format(Number(value))}</dd>
              </div>
            ))}
          </dl>
          <div className="overflow-x-auto rounded-lg border border-navy-800">
            <table aria-label="Registros por tipo de ensayo" className="w-full text-left text-sm">
              <thead className="bg-navy-900 text-slate-300">
                <tr><th scope="col" className="px-3 py-2">Tipo de ensayo</th><th scope="col" className="px-3 py-2 text-right">Registros</th></tr>
              </thead>
              <tbody className="divide-y divide-navy-800">
                {result.summary.por_tipo.map(({ tipo, registros }) => (
                  <tr key={tipo}><th scope="row" className="px-3 py-2 font-medium">{tipo}</th><td className="px-3 py-2 text-right tabular-nums">{number.format(registros)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
