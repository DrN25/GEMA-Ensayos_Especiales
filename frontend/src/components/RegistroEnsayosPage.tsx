import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Box, CircleAlert, CircleCheck, Clock3, Cylinder, Layers3, LoaderCircle, Plus, Save, Trash2, TriangleAlert } from 'lucide-react';
import { assayFormatLabels, assayTypes, getFormatReference, getLabGroups, laboratories, type AssayType, type Laboratory } from '../config/registrationFormats';
import { COLUMNS_CONFIG, type ColumnDef } from '../utils/columnsConfig';
import { MESES_OPTIONS } from '../features/grid/schema/columns';
import { summaryAssayPalette } from '../config/summaryAssayPalette';
import ProposalLaboratory from '../features/proposalLab/ProposalLaboratory';

import BoreholePicker, { type Borehole } from './BoreholePicker';

interface SampleValidation {
  valida: boolean;
  motivo: 'fracturas' | 'tipo_desconocido' | 'sin_registros' | null;
  fracturas: number;
  tipos_sin_dato: number;
  registros_estructurales: number;
  litologia: string | null;
  fuente_litologia: 'estructural' | 'geotecnico_general' | null;
}

function parseDepth(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d+)?$/.test(normalized)) return null;
  const depth = Number(normalized);
  return depth <= 999 ? depth : null;
}

const projectOptions = [
  { id: 'ferro', name: 'Ferro', code: 'FRBB' },
  { id: 'chalco', name: 'Chalco', code: 'CHABB' },
  { id: 'charcas', name: 'Charcas', code: null },
] as const;

const charcasCodeNotice = 'Charcas todavía no tiene un código confirmado para el Registro Maestro.';

const coordinateFields = [
  { key: 'east', label: 'Este (m)', digits: 6, example: '794191,25' },
  { key: 'north', label: 'Norte (m)', digits: 7, example: '8440808,91' },
  { key: 'elevation', label: 'Elevación (msnm)', digits: 4, example: '3737,00' },
] as const;

function formatCoordinate(value: string, digits: number) {
  const match = /^(-?)(\d+)(?:[.,](\d+))?$/.exec(value.trim());
  if (!match || match[2].length !== digits) return null;

  const [, sign, whole, fraction = ''] = match;
  const decimals = fraction.padEnd(3, '0');
  const cents = Number(whole) * 100 + Number(decimals.slice(0, 2)) + (Number(decimals[2]) >= 5 ? 1 : 0);
  const roundedWhole = String(Math.floor(cents / 100)).padStart(digits, '0');
  if (roundedWhole.length !== digits) return null;
  return sign + roundedWhole + ',' + String(cents % 100).padStart(2, '0');
}

function validationMessage(result: SampleValidation) {
  if (result.valida) return 'Muestra válida.';
  if (result.motivo === 'sin_registros') return 'Muestra no válida. No hay registros estructurales en el tramo para comprobar el tipo SE.';
  if (result.motivo === 'tipo_desconocido') return 'Muestra no válida. Hay registros sin un tipo de estructura identificable.';
  return 'Muestra no válida. Para este ensayo todos los registros del tramo deben ser de tipo SE (Superficie Espejo).';
}

type Measurement = { id: number; values: Record<string, string> };

interface SampleRegistrationData {
  sondaje_id: number;
  numero_muestra: string;
  proyecto: string;
  desde: number;
  hasta: number;
  este: string;
  norte: string;
  elevacion: string;
}

interface AssayRegistrationData extends SampleRegistrationData {
  ensayo: AssayType;
  laboratorio: Laboratory;
  dia: number | null;
  mes: string;
  anio: number;
  sectores: string | null;
  observacion: string | null;
  campana: string | null;
  mediciones: Record<string, string>[];
}

type RegistrationSaved = { codigo_muestra: string; cantidad: number };

function validMeasurement(value: string) {
  return value === '' || /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) && Number.isFinite(Number(value));
}

const inputClass = 'w-full min-w-0 rounded-lg border border-navy-800 bg-navy-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none disabled:opacity-60';
const actionClass = 'inline-flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-400 hover:bg-sky-500/20';

const sectionTones = {
  hole: { border: 'border-[#01467F]/40', header: 'bg-[#01467F] text-white' },
  sample: { border: 'border-[#0069FD]/40', header: 'bg-[#0069FD] text-white' },
  lab: { border: 'border-navy-800', header: 'bg-[#C5D0E1] text-[#10233F]' },
};

type SectionTone = (typeof sectionTones)[keyof typeof sectionTones];

const registrationSteps = [
  { label: '1. Sondaje', icon: Layers3, tone: sectionTones.hole },
  { label: '2. Muestra', icon: Box, tone: sectionTones.sample },
  { label: '3. Laboratorio', icon: Cylinder, tone: sectionTones.lab },
];

const leftStep = 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)';
const nextStep = 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)';

function RegistrationSteps() {
  return (
    <nav aria-label="Secciones del registro">
      <ol className="grid grid-cols-3 gap-1 rounded-l-lg">
        {registrationSteps.map(({ label, icon: Icon, tone }, index) => (
          <li key={label} className="min-w-0">
            <a href={'#registration-step-' + (index + 1)}
              className={'flex min-h-11 items-center justify-center gap-2 px-3 py-2.5 text-center text-xs font-bold leading-tight hover:brightness-110 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-current sm:px-5 sm:text-sm '
                + (index === 0 ? 'rounded-l-lg ' : '') + tone.header}
              style={{ clipPath: index === 0 ? leftStep : nextStep }}>
              <Icon size={16} aria-hidden="true" className="hidden shrink-0 sm:block" />
              <span>{label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Section({ number, title, icon, tone, children }: {
  number: number;
  title: string;
  icon: ReactNode;
  tone: SectionTone;
  children: ReactNode;
}) {
  return (
    <section id={'registration-step-' + number} aria-labelledby={'registration-section-' + number} className={'glass-panel relative scroll-mt-4 rounded-xl border ' + tone.border + (number === 1 ? ' z-10' : '')}>
      <div className={'flex items-center gap-3 rounded-t-xl border-b px-4 py-3 sm:px-5 ' + tone.border + ' ' + tone.header}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/10">{icon}</span>
        <h3 id={'registration-section-' + number} className="text-sm font-bold">{number}. {title}</h3>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0 space-y-1.5"><span className="block text-xs font-semibold text-slate-400">{label}</span>{children}</label>;
}

function SampleNumberInput({ id, label, value, error, required, placeholder, onChange, onBlur }: {
  id: string;
  label: string;
  value: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <Field label={label}>
      <input
        id={id}
        className={inputClass + ' aria-[invalid=true]:border-red-500/70'}
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? id + '-message' : undefined}
        onChange={event => onChange(event.target.value)}
        onBlur={onBlur}
      />
      {error && <span id={id + '-message'} className="block text-xs text-red-400">{error}</span>}
    </Field>
  );
}

function LabInput({ field, value, onChange }: { field: ColumnDef; value: string; onChange: (value: string) => void }) {
  const numeric = field.type !== 'string';
  const invalid = numeric && !validMeasurement(value);
  return (
    <input
      name={field.dbName}
      aria-label={field.excelName}
      aria-invalid={invalid}
      title={invalid ? 'Ingresa un valor numérico.' : undefined}
      className={inputClass + (numeric ? ' text-right tabular-nums aria-[invalid=true]:border-red-500/70' : '')}
      inputMode={numeric ? 'decimal' : 'text'}
      maxLength={numeric ? undefined : 100}
      value={value}
      onChange={event => onChange(numeric ? event.target.value.replace(',', '.') : event.target.value)}
    />
  );
}

const yearLimits = COLUMNS_CONFIG.find(column => column.dbName === 'anio')?.validation;
const firstYear = yearLimits?.min ?? 1980;
const lastYear = yearLimits?.max ?? 2050;
const yearOptions = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => lastYear - index);
const dayOptions = Array.from({ length: 31 }, (_, index) => index + 1);

function splitLithology(value: string | null) {
  const [first, second, ...rest] = value?.split('_') ?? [];
  return {
    lito1: first?.trim() || null,
    lito2: second?.trim() || null,
    lito3: rest.join('_').trim() || null,
  };
}

function LaboratoryDetails({ lithology, month, year, onMonthChange, onYearChange }: {
  lithology: string | null;
  month: string;
  year: string;
  onMonthChange: (month: string) => void;
  onYearChange: (year: string) => void;
}) {
  const lithologyFields = splitLithology(lithology);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
      <Field label="Día (opcional)">
        <select name="dia" className={inputClass} defaultValue="">
          <option value="">Sin día</option>
          {dayOptions.map(day => <option key={day} value={day}>{day}</option>)}
        </select>
      </Field>
      <Field label="Mes (obligatorio)">
        <select name="mes" className={inputClass} value={month} onChange={event => onMonthChange(event.target.value)} required>
          <option value="">Selecciona</option>
          {MESES_OPTIONS.map(month => <option key={month} value={month}>{month}</option>)}
        </select>
      </Field>
      <Field label="Año (obligatorio)">
        <select name="anio" className={inputClass} value={year} onChange={event => onYearChange(event.target.value)} required>
          <option value="">Selecciona</option>
          {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
        </select>
      </Field>
      <Field label="Litología">
        <input className={inputClass + ' read-only:bg-navy-900 read-only:cursor-default'} value={lithology ?? ''} placeholder="Sin dato de Logueo" readOnly />
      </Field>
      {Object.entries(lithologyFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value ?? ''} />
      ))}
      <Field label="Sectores">
        <input name="sectores" maxLength={100} className={inputClass} />
      </Field>
    </div>
  );
}

function LaboratoryForm({ assay, lab, onLabChange, code, from, to, lithology, apiBase, sampleData, saveUnavailableReason, onSaved }: {
  assay: AssayType;
  lab: Laboratory;
  onLabChange: (lab: Laboratory) => void;
  code: string;
  from: string;
  to: string;
  lithology: string | null;
  apiBase: string;
  sampleData: SampleRegistrationData | null;
  saveUnavailableReason?: string;
  onSaved: (saved: RegistrationSaved) => void;
}) {
  const groups = getLabGroups(lab, assay);
  const columns = groups.flatMap(group => group.columns);
  const [measurements, setMeasurements] = useState<Measurement[]>([{ id: 1, values: {} }]);
  const [nextRowId, setNextRowId] = useState(2);
  const reference = getFormatReference(lab, assay);
  const referenceTone = summaryAssayPalette[assay === 'CE' ? 'UCS' : assay];
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [pending, setPending] = useState<AssayRegistrationData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const invalidMeasurements = measurements.some(row => columns.some(column =>
    column.type !== 'string' && !validMeasurement(row.values[column.dbName] ?? '')
  ));
  const canSave = Boolean(sampleData && month && year && code && !invalidMeasurements && !saving);

  function reviewRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sampleData || !canSave || inFlight.current) return;

    const data = new FormData(event.currentTarget);
    const read = (name: string) => String(data.get(name) ?? '').trim() || null;
    const day = read('dia');
    if (day && Number(day) > new Date(Number(year), MESES_OPTIONS.indexOf(month) + 1, 0).getDate()) {
      setSaveError('El día no existe en el mes y año seleccionados.');
      return;
    }

    setSaveError('');
    setPending({
      ...sampleData,
      ensayo: assay,
      laboratorio: lab,
      dia: day ? Number(day) : null,
      mes: month,
      anio: Number(year),
      sectores: read('sectores'),
      observacion: read('observacion'),
      campana: read('campana'),
      mediciones: measurements.map(row => Object.fromEntries(
        columns.map(column => [column.dbName, row.values[column.dbName] ?? ''])
      )),
    });
    dialog.current?.showModal();
  }

  async function saveRegistration() {
    if (!pending || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError('');

    try {
      const response = await fetch(apiBase + '/api/ensayos/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending),
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = data.detail;
        setSaveError(typeof detail === 'string' ? detail : 'Revisa los datos obligatorios y las mediciones.');
        return;
      }

      form.current?.reset();
      setMonth('');
      setYear('');
      setMeasurements([{ id: 1, values: {} }]);
      setNextRowId(2);
      onSaved(data);
    } catch {
      setSaveError('No se pudo confirmar el guardado. Revisa el Registro Maestro antes de volver a intentar.');
    } finally {
      inFlight.current = false;
      setSaving(false);
      dialog.current?.close();
      setPending(null);
    }
  }

  return (
    <form ref={form} onSubmit={reviewRegistration} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Laboratorio">
          <select name="laboratorio" className={inputClass} value={lab} onChange={event => {
            onLabChange(event.target.value as Laboratory);
            setMeasurements([{ id: 1, values: {} }]);
            setNextRowId(2);
          }}>
            {laboratories.map(option => <option key={option}>{option}</option>)}
          </select>
        </Field>
        <Field label="Código de muestra preliminar"><input name="codigo_muestra" className={inputClass + ' read-only:bg-navy-900 read-only:cursor-default'} value={code} readOnly placeholder="—" /></Field>
        <Field label="Desde (m)"><input name="desde" className={inputClass + ' read-only:bg-navy-900 read-only:cursor-default'} value={from} readOnly placeholder="—" /></Field>
        <Field label="Hasta (m)"><input name="hasta" className={inputClass + ' read-only:bg-navy-900 read-only:cursor-default'} value={to} readOnly placeholder="—" /></Field>
      </div>

      <aside aria-label="Formato de laboratorio" aria-live="polite" className={'space-y-1.5 rounded-lg border border-l-4 p-3.5 border-navy-800 ' + referenceTone.icon}>
        <h4 className="text-sm font-bold">Formato {lab} · {assayFormatLabels[assay]} · {reference.title}</h4>
        <p className="text-xs font-semibold">{reference.standard}</p>
        <p className="text-xs leading-relaxed text-slate-300">{reference.note}</p>
      </aside>

      <LaboratoryDetails lithology={lithology} month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-slate-100">Mediciones del ensayo</h4>
          <button type="button" className={actionClass} onClick={() => {
            setMeasurements(previous => [...previous, { id: nextRowId, values: {} }]);
            setNextRowId(nextRowId + 1);
          }}><Plus size={15} /> Agregar fila</button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-navy-800">
          <table aria-label="Mediciones de laboratorio" className="w-full text-left text-xs">
            <thead className="bg-navy-900 text-slate-400">
              <tr>
                <th rowSpan={2} scope="col" className="px-3 py-2">Fila</th>
                {groups.map(group => (
                  <th key={group.id} scope="colgroup" colSpan={group.columns.length}
                    className="border-x border-b border-navy-800 px-3 py-2 text-slate-100">
                    {group.title}
                  </th>
                ))}
                <th rowSpan={2} scope="col" className="px-3 py-2">Acción</th>
              </tr>
              <tr>
                {columns.map(field => (
                  <th key={field.dbName} scope="col" className="min-w-32 px-2 py-2 align-bottom">{field.excelName}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {measurements.map((row, index) => (
                <tr key={row.id} className="border-t border-navy-800">
                  <th scope="row" className="px-3 py-2 text-slate-400">{index + 1}</th>
                  {columns.map(field => (
                    <td key={field.dbName} className="px-2 py-2">
                      <LabInput field={field} value={row.values[field.dbName] ?? ''} onChange={value => {
                        setMeasurements(previous => previous.map(item => item.id === row.id
                          ? { ...item, values: { ...item.values, [field.dbName]: value } }
                          : item));
                      }} />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <button type="button" aria-label={'Eliminar fila ' + (index + 1)} disabled={measurements.length === 1}
                      className="rounded-md p-2 text-rose-400 hover:bg-rose-500/10 disabled:opacity-40"
                      onClick={() => setMeasurements(previous => previous.filter(item => item.id !== row.id))}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Field label="Observaciones del ensayo">
        <textarea name="observacion" maxLength={500} rows={3} className={inputClass} />
      </Field>
      <Field label="Campaña de Perforación">
        <input name="campana" maxLength={100} className={inputClass} />
      </Field>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-navy-800 pt-4">
        {saveError && <p role="alert" className="mr-auto text-xs text-red-400">{saveError}</p>}
        {!canSave && !saveError && (
          <p className="text-xs text-slate-400">
            {invalidMeasurements ? 'Corrige los valores numéricos marcados.' : saveUnavailableReason ?? 'Completa los campos obligatorios para guardar.'}
          </p>
        )}
        <button type="submit" disabled={!canSave} className={actionClass + ' disabled:cursor-not-allowed disabled:opacity-50'}>
          <Save size={15} /> Guardar
        </button>
      </div>

      <dialog ref={dialog} aria-labelledby="registration-confirm-title"
        className="w-[calc(100%-2rem)] max-w-md rounded-xl border border-navy-800 bg-navy-950 p-5 text-slate-100 shadow-2xl backdrop:bg-slate-950/70 backdrop:backdrop-blur-sm"
        onCancel={event => { if (inFlight.current) event.preventDefault(); }}>
        <h4 id="registration-confirm-title" className="text-sm font-bold">Confirmar registro de ensayos</h4>
        <p className="mt-2 text-sm text-slate-300">
          Se guardarán {pending?.mediciones.length} {pending?.mediciones.length === 1 ? 'fila' : 'filas'} para la muestra <strong>{code}</strong>.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" autoFocus disabled={saving} className={actionClass} onClick={() => dialog.current?.close()}>Cancelar</button>
          <button type="button" disabled={saving} className={actionClass + ' disabled:opacity-50'} onClick={saveRegistration}>
            {saving ? 'Guardando…' : 'Confirmar guardado'}
          </button>
        </div>
      </dialog>
    </form>
  );
}

type RegistrationPageProps = { apiBase: string } & (
  | { mode: 'registro'; onSaved: (saved: RegistrationSaved) => void }
  | { mode: 'propuesta'; onSaved?: never }
);

export default function RegistroEnsayosPage({ apiBase, mode, onSaved }: RegistrationPageProps) {
  const [holes, setHoles] = useState<Borehole[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [request, setRequest] = useState(0);
  const [holeId, setHoleId] = useState('');
  const [projectId, setProjectId] = useState('');
  const project = projectOptions.find(option => option.id === projectId);
  const projectMissing = !project;
  const projectCode = project?.code;
  const saveUnavailableReason = mode === 'registro' && project?.code === null ? charcasCodeNotice : undefined;
  const projectNotice = projectMissing ? 'Selecciona el proyecto para continuar.' : saveUnavailableReason;
  const [assay, setAssay] = useState<AssayType | ''>('');
  const [lab, setLab] = useState<Laboratory>('UNI (LGM)');
  const [sample, setSample] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [coordinates, setCoordinates] = useState({ east: '', north: '', elevation: '' });
  const hole = holes.find(item => String(item.id) === holeId);
  const [validationRequest, setValidationRequest] = useState(0);
  const [validation, setValidation] = useState<{ key: string; result: SampleValidation | null } | null>(null);
  const startDepth = parseDepth(from);
  const endDepth = parseDepth(to);
  const depthFormatError = 'Ingresa una profundidad entre 0 y 999 m, con hasta 3 dígitos antes del separador decimal.';
  const fromError = from && startDepth === null ? depthFormatError : undefined;
  const toError = to && endDepth === null
    ? depthFormatError
    : startDepth !== null && endDepth !== null && endDepth <= startDepth
      ? 'Hasta debe ser mayor que Desde.'
      : undefined;
  const east = formatCoordinate(coordinates.east, 6);
  const north = formatCoordinate(coordinates.north, 7);
  const elevation = formatCoordinate(coordinates.elevation, 4);
  const coordinatesValid = east !== null && north !== null && elevation !== null;
  const hasFormatErrors = Boolean(fromError || toError
    || coordinates.east.trim() && east === null
    || coordinates.north.trim() && north === null
    || coordinates.elevation.trim() && elevation === null);
  const intervalValid = startDepth !== null && endDepth !== null && startDepth < endDepth;
  const validationQuery = hole && assay && intervalValid
    ? new URLSearchParams({ sondaje_id: holeId, desde: String(startDepth), hasta: String(endDepth), ensayo: assay }).toString()
    : '';
  const validationKey = validationQuery + ':' + validationRequest;
  const currentValidation = validationQuery && validation?.key === validationKey ? validation : null;
  const result = currentValidation?.result;
  const sampleReady = Boolean(result?.valida && !hasFormatErrors && coordinatesValid);
  const laboratoryEnabled = sampleReady && !projectMissing;
  const StatusIcon = hasFormatErrors || !coordinatesValid || currentValidation && !result || result?.valida === false
    ? CircleAlert
    : result?.valida ? CircleCheck : validationQuery ? LoaderCircle : Clock3;

  useEffect(() => {
    if (!validationQuery) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(apiBase + '/api/ensayos/validar-muestra?' + validationQuery, { signal: controller.signal });
        if (!response.ok) throw new Error('Error al consultar el logueo');
        const data: SampleValidation = await response.json();
        if (!controller.signal.aborted) setValidation({ key: validationKey, result: data });
      } catch {
        if (!controller.signal.aborted) setValidation({ key: validationKey, result: null });
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [apiBase, validationQuery, validationKey]);

  const abbreviation = assay === 'CE' ? 'UCS' : assay;
  const selectedPalette = abbreviation ? summaryAssayPalette[abbreviation] : null;
  const laboratoryTone = selectedPalette
    ? { border: 'border-navy-800', header: selectedPalette.bar + ' ' + selectedPalette.headerText }
    : sectionTones.lab;
  const code = hole && abbreviation && sample.trim() ? [hole.code, abbreviation, sample.trim().toUpperCase()].join('-') : '';
  const sampleData: SampleRegistrationData | null = mode === 'registro' && laboratoryEnabled && projectCode && hole && sample.trim() && code.length <= 150
    && startDepth !== null && endDepth !== null && coordinatesValid
    ? {
      sondaje_id: hole.id,
      numero_muestra: sample.trim(),
      proyecto: projectCode,
      desde: startDepth,
      hasta: endDepth,
      este: east.replace(',', '.'),
      norte: north.replace(',', '.'),
      elevacion: elevation.replace(',', '.'),
    }
    : null;

  useEffect(() => {
    const controller = new AbortController();
    fetch(apiBase + '/api/ensayos/sondajes-registro', { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Error al consultar los sondajes');
        return response.json();
      })
      .then((items: Borehole[]) => {
        if (controller.signal.aborted) return;
        setHoles(items);
        setStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    return () => controller.abort();
  }, [apiBase, request]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <RegistrationSteps />

      <Section number={1} tone={sectionTones.hole} title="Sondaje" icon={<Layers3 size={18} />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <BoreholePicker holes={holes} selected={hole} disabled={status !== 'ready' || holes.length === 0}
            placeholder={status === 'loading' ? 'Cargando sondajes…' : 'Busca por código de sondaje'}
            onSelect={selected => {
              const id = String(selected.id);
              if (id === holeId) return;
              setHoleId(id);
              setSample('');
              setFrom('');
              setTo('');
              setCoordinates({ east: '', north: '', elevation: '' });
            }}
          />
          <Field label="Proyecto (obligatorio)">
            <select
              name="proyecto"
              className={inputClass + ' aria-[invalid=true]:border-amber-500/70'}
              value={projectId}
              onChange={event => setProjectId(event.target.value)}
              required
              aria-invalid={projectMissing}
              aria-describedby={projectNotice ? 'registration-project-warning' : undefined}
            >
              <option value="">Selecciona un proyecto</option>
              {projectOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            {projectNotice && (
              <span id="registration-project-warning" className="flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300">
                <TriangleAlert size={13} aria-hidden="true" />
                {projectNotice}
              </span>
            )}
          </Field>
        </div>
        {status === 'ready' && holes.length === 0 && <p role="status" className="mt-3 text-xs text-slate-400">No hay sondajes disponibles.</p>}
        {status === 'error' && (
          <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>No se pudieron consultar los sondajes.</span>
            <button type="button" className={actionClass} onClick={() => {
              setStatus('loading');
              setRequest(previous => previous + 1);
            }}>Reintentar</button>
          </div>
        )}
        <div className="mt-4 rounded-lg border border-navy-800 bg-navy-900/60 p-4">
          <h4 className="text-xs font-bold tracking-wide text-sky-400">Datos de Logueo – GEMA · Referencia</h4>
          {result ? (
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div><dt className="text-slate-400">Desde (m)</dt><dd className="mt-1 font-mono text-sm text-slate-100">{startDepth}</dd></div>
              <div><dt className="text-slate-400">Hasta (m)</dt><dd className="mt-1 font-mono text-sm text-slate-100">{endDepth}</dd></div>
              <div><dt className="text-slate-400">Litología</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-100">{result.litologia ?? 'Sin dato'}</dd></div>
              <div><dt className="text-slate-400">Registros estructurales</dt><dd className="mt-1 font-mono text-sm text-slate-100">{result.registros_estructurales}</dd></div>
            </dl>
          ) : (
            <p className="mt-2 text-xs text-slate-400">
              {validationQuery
                ? currentValidation ? 'No se pudo cargar la referencia.' : 'Consultando el tramo…'
                : 'Selecciona un sondaje y completa el intervalo y el tipo de ensayo.'}
            </p>
          )}
        </div>
      </Section>

      <Section number={2} tone={sectionTones.sample} title="Muestra" icon={<Box size={18} />}>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.55fr)]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="N.º de muestra (obligatorio)"><input className={inputClass} maxLength={95} placeholder="M01" value={sample} onChange={event => setSample(event.target.value)} /></Field>
              <SampleNumberInput id="sample-from" label="Desde (m)" value={from} error={fromError} onChange={setFrom} />
              <SampleNumberInput id="sample-to" label="Hasta (m)" value={to} error={toError} onChange={setTo} />
            </div>

            <div className="rounded-lg border border-navy-800 bg-navy-900/60 p-3.5">
              <h4 className="mb-3 text-xs font-bold text-slate-100">Coordenadas (obligatorias)</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                {coordinateFields.map(({ key, label, digits, example }) => {
                  const value = coordinates[key];
                  const formatted = formatCoordinate(value, digits);
                  return (
                    <SampleNumberInput
                      key={key}
                      id={'sample-' + key}
                      label={label}
                      value={value}
                      placeholder={example}
                      required
                      error={!value.trim() ? 'Campo obligatorio.' : formatted === null ? 'Ingresa ' + digits + ' dígitos antes del separador decimal, sin separadores de miles.' : undefined}
                      onChange={next => setCoordinates(previous => ({ ...previous, [key]: next }))}
                      onBlur={() => {
                        if (formatted !== null) setCoordinates(previous => ({ ...previous, [key]: formatted }));
                      }}
                    />
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-400">Este: 6 dígitos · Norte: 7 · Elevación: 4. Se redondean a 2 decimales.</p>
            </div>
          </div>

          <fieldset className="min-w-0 rounded-lg border border-navy-800 bg-navy-900/60 px-3.5 pb-3.5">
            <legend className="px-1 text-xs font-bold text-slate-100">Tipo de ensayo</legend>
            <div className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
              {Object.entries(assayTypes).map(([key, label]) => (
                <label key={key} className={'flex min-w-0 cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 text-xs font-semibold ' +
                  (assay === key ? 'border-sky-500/40 bg-sky-500/10 text-sky-400' : 'border-transparent text-slate-300 hover:bg-navy-800/60')}>
                  <input type="radio" name="registration-assay" value={key} checked={assay === key}
                    onChange={() => setAssay(key as AssayType)} className="h-4 w-4 shrink-0 accent-sky-500" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div role="status" className="mt-4 flex items-start gap-3 rounded-lg border border-navy-800 bg-navy-900 px-3 py-3 text-xs text-slate-400">
          <span className={'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ' +
            (StatusIcon === CircleAlert ? 'bg-red-500/10 text-red-400' : sampleReady ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-500/10 text-sky-400')}>
            <StatusIcon size={18} aria-hidden="true" className={StatusIcon === LoaderCircle ? 'animate-spin' : undefined} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="font-semibold text-slate-100">Validación de la muestra</p>
            {hasFormatErrors ? (
              <p className="mt-1 text-red-400">Corrige los campos marcados para continuar a Laboratorio.</p>
            ) : !coordinatesValid ? (
              <p className="mt-1 text-red-400">Completa Este, Norte y Elevación para habilitar Laboratorio.</p>
            ) : result ? (
              <>
                <p className={result.valida ? 'mt-1 font-semibold text-emerald-400' : 'mt-1 font-semibold text-red-400'}>{validationMessage(result)}</p>
                <p className="mt-1">Fracturas detectadas: {result.fracturas}{result.tipos_sin_dato > 0 ? ' · Registros sin tipo: ' + result.tipos_sin_dato : ''}</p>
                {assay === 'CD' && <p className="mt-1">Corte Directo admite estructuras en el tramo.</p>}
              </>
            ) : currentValidation ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span>No se pudo validar el tramo.</span>
                <button type="button" className={actionClass} onClick={() => setValidationRequest(value => value + 1)}>Reintentar</button>
              </div>
            ) : (
              <p className="mt-1">{validationQuery ? 'Verificando las estructuras…' : 'Pendiente de los datos de la muestra.'}</p>
            )}
          </div>
        </div>
      </Section>

      <Section number={3} tone={mode === 'propuesta' ? sectionTones.lab : laboratoryTone} title={mode === 'registro' && assay ? 'Laboratorio · ' + assayFormatLabels[assay] : 'Laboratorio'} icon={<Cylinder size={18} />}>
        {mode === 'propuesta' ? (
          <ProposalLaboratory sampleAssay={assay} borehole={hole?.code} sampleNumber={sample}
            from={from} to={to} lithology={result?.litologia} />
        ) : assay
          ? (
            <>
              {!laboratoryEnabled && <p className="mb-3 text-xs text-slate-400">{sampleReady ? 'Completa el proyecto para habilitar el ingreso de mediciones.' : 'Valida la muestra para habilitar el ingreso de mediciones.'}</p>}
              <fieldset disabled={!laboratoryEnabled} className="min-w-0 disabled:opacity-60">
                <LaboratoryForm key={holeId + ':' + assay} assay={assay} lab={lab} onLabChange={setLab} code={code} from={from} to={to} lithology={result?.litologia ?? null}
                  apiBase={apiBase} sampleData={sampleData} saveUnavailableReason={saveUnavailableReason} onSaved={saved => {
                    setSample('');
                    onSaved(saved);
                  }} />
              </fieldset>
            </>
          )
          : <p className="text-sm text-slate-400">Selecciona el tipo de ensayo para ver el formato de laboratorio.</p>}
      </Section>
    </div>
  );
}
