import { useState } from 'react';
import { Calculator, CircleAlert, FileText, Save } from 'lucide-react';
import { summaryAssayPalette } from '../../config/summaryAssayPalette';
import { getExample } from './examples';
import { initialProposalRows, proposalAssays, proposalDefaults, proposalFormat, proposalLabs,
  type ProposalAssay, type ProposalColumn, type ProposalFormat, type ProposalLab, type ProposalRow } from './formats';
import { buttonClass, ColumnInput, fieldClass, ProposalAssayTable, ProposalField, proposalNumber, ProposalTableTools } from './ProposalTable';

interface ProposalLaboratoryProps {
  sampleAssay: Exclude<ProposalAssay, 'PF'> | '';
  borehole?: string;
  sampleNumber: string;
  from: string;
  to: string;
  lithology?: string | null;
}

interface Details {
  operator: string;
  date: string;
  lithology: string;
  observations: string;
}

const positiveDimensions = new Set(['d', 'h', 't', 'ancho', 'largo', 'area', 'area_m', 'area_p', 'vol']);
const readonlyClass = fieldClass + ' read-only:bg-navy-900 read-only:cursor-default';

function rowErrors(columns: ProposalColumn[], row: ProposalRow, location: string) {
  return columns.flatMap(column => {
    const value = row[column.key];
    if (column.calc || column.tipo !== 'num' || typeof value !== 'string' || !value.trim()) return [];

    const numeric = proposalNumber(value);
    if (numeric === null) return [`${location}: "${column.label}" no es un número válido.`];
    if (positiveDimensions.has(column.key) && numeric <= 0) return [`${location}: "${column.label}" debe ser positivo.`];
    return [];
  });
}

function resultLabels(lab: ProposalLab, assay: ProposalAssay, format: ProposalFormat, rows: ProposalRow[]) {
  switch (assay) {
    case 'UCS':
    case 'CE':
      return [
        'UCS (MPa)', 'E (GPa)',
        ...(rows.some(row => proposalNumber(row.e2)) ? ['E strain gauges (GPa)'] : []),
        'ν',
      ];
    case 'TI':
      return [
        'σt promedio (MPa)',
        ...(lab === 'UNI (LGM)' ? ['σt promedio (kg/cm²)'] : []),
        'Carga promedio (kN)',
      ];
    case 'TX':
      return [
        'σci Hoek-Brown (MPa)', 'mi', 'Cohesión c (MPa)', 'Ángulo de fricción φ (°)',
        ...(format.metodo_mc === 'equivalente' ? [] : ['R² Mohr-Coulomb']),
      ];
    case 'CD':
      return [
        ...(lab === 'Geomec' ? ['Área del plano (mm²)'] : []),
        ...(lab === 'LaboRock (GeoBlast)' ? [' máximo', ' residual'] : ['']).flatMap(suffix => [
          `Cohesión c${suffix} (MPa)`, `Ángulo de fricción φ${suffix} (°)`, `R²${suffix}`,
        ]),
      ];
    case 'PF':
      return ['Densidad natural (g/cm³)', 'Densidad seca (g/cm³)', 'Absorción (%)', 'Porosidad aparente (%)', 'Peso específico (kN/m³)'];
  }
}

const chartAxes = {
  TI: ['Disco', 'σt (MPa)'],
  CD: ['σn (MPa)', 'τ (MPa)'],
  TX: ['σ3 (MPa)', 'σ1 (MPa)'],
} as const;

function LaboratoryDraft({ lab, assay, code, interval, details, onDetailsChange }: {
  lab: ProposalLab;
  assay: ProposalAssay;
  code: string;
  interval: [string, string];
  details: Details;
  onDetailsChange: (patch: Partial<Details>) => void;
}) {
  const format = proposalFormat(lab, assay);
  const [header, setHeader] = useState<ProposalRow>(() => proposalDefaults(format.cabecera));
  const [rows, setRows] = useState<ProposalRow[]>(() => initialProposalRows(lab, assay, format));
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const draftKey = JSON.stringify([code, interval, details, header, rows]);
  const fresh = previewKey === draftKey;
  const stale = previewKey !== null && !fresh;
  const blankRow = () => proposalDefaults(format.columnas);
  const example = getExample(lab, assay, format.columnas);
  const errors = [
    ...(!details.date ? ['Ingresa la fecha de ejecución.'] : []),
    ...rowErrors(format.cabecera, header, 'Cabecera'),
    ...rows.flatMap((row, index) => rowErrors(format.columnas, row, `Fila ${index + 1}`)),
    ...(assay === 'CE' && !rows.some(row => proposalNumber(row.e) !== null && proposalNumber(row.nu) !== null)
      ? ['Constantes elásticas: son obligatorios E y ν en al menos una probeta.'] : []),
  ];
  const axes = assay === 'TI' || assay === 'CD' || assay === 'TX' ? chartAxes[assay] : null;
  const tone = assay === 'PF' ? 'bg-navy-900 text-slate-100' : summaryAssayPalette[assay === 'CE' ? 'UCS' : assay].icon;

  return (
    <div className="space-y-4">
      <aside aria-label="Formato de laboratorio" className={'space-y-1 rounded-lg border border-l-4 border-navy-800 p-3.5 ' + tone}>
        <h4 className="text-sm font-bold">Formato {lab} · {proposalAssays[assay]} · {format.titulo}</h4>
        <p className="text-xs font-semibold">{format.norma}</p>
        <p className="text-xs leading-relaxed text-slate-300">{format.notas}</p>
      </aside>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <ProposalField label="Operador">
          <input className={fieldClass} maxLength={120} placeholder="Responsable del ensayo" value={details.operator}
            onChange={event => onDetailsChange({ operator: event.target.value })} />
        </ProposalField>
        <ProposalField label="Fecha de ejecución">
          <input type="date" className={fieldClass} value={details.date} onChange={event => onDetailsChange({ date: event.target.value })} />
        </ProposalField>
        <ProposalField label="Litología">
          <input className={fieldClass} maxLength={200} value={details.lithology} onChange={event => onDetailsChange({ lithology: event.target.value })} />
        </ProposalField>
        {format.cabecera.map(column => (
          <ProposalField key={column.key} label={column.label + (column.unidad ? ' (' + column.unidad + ')' : '')} hint={column.ayuda}>
            <ColumnInput column={column} value={header[column.key]} onChange={value => setHeader(previous => ({ ...previous, [column.key]: value }))} />
          </ProposalField>
        ))}
      </div>

      <ProposalTableTools assay={assay} columns={format.columnas} rows={rows} onChange={setRows} blankRow={blankRow} example={example} />
      <p className="text-xs text-slate-400">
        Ingresa los datos como aparecen en la tabla del informe del laboratorio. Marca <strong>Excluir (rojo)</strong> en los valores que el laboratorio pinta en rojo.
      </p>
      <ProposalAssayTable mode="edit" columns={format.columnas} rows={rows} onChange={setRows} blankRow={blankRow} />

      {errors.length > 0 && (
        <ul className="space-y-1 text-xs text-red-400" aria-label="Validación de datos de laboratorio">
          {errors.map(error => <li key={error} className="flex items-center gap-2"><CircleAlert size={14} aria-hidden="true" />{error}</li>)}
        </ul>
      )}

      {fresh && (
        <>
          <section className="space-y-2" aria-label="Vista previa de la tabla completa">
            <h4 className="text-sm font-bold text-sky-400">Tabla del formato con columnas calculadas</h4>
            <p className="text-xs text-slate-400">Vista previa demostrativa. Las celdas calculadas se muestran sin valor.</p>
            <ProposalAssayTable mode="preview" columns={format.columnas} rows={rows} />
          </section>
          <section className="space-y-3 border-t border-navy-800 pt-4" aria-label="Resultados demostrativos">
            <h4 className="text-sm font-bold text-sky-400">Resultados</h4>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              Código generado <span className="rounded-md bg-navy-900 px-2 py-1 font-mono text-slate-100">{code || '—'}</span>
            </div>
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {resultLabels(lab, assay, format, rows).map(label => (
                <div key={label} className="rounded-lg border border-navy-800 bg-navy-900/60 p-2.5">
                  <dt className="text-xs text-slate-400">{label}</dt>
                  <dd className="mt-1 font-mono text-sm text-slate-100">—</dd>
                </div>
              ))}
            </dl>
            {axes ? (
              <div role="img" aria-label={'Gráfico demostrativo · eje X: ' + axes[0] + ' · eje Y: ' + axes[1]}
                className="rounded-lg border border-dashed border-navy-800 px-3 py-4 text-xs text-slate-400">
                <p className="font-semibold text-slate-100">{axes[1]} por {axes[0]}</p>
                <p className="mt-1">Vista demostrativa. Los puntos del gráfico requieren resultados calculados.</p>
                {assay === 'TI' && <p className="mt-1">Azul: incluido en el promedio. Rojo: excluido.</p>}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-navy-800 p-3 text-xs text-slate-400">
                Este ensayo no tiene gráfico de ajuste. Los resultados se informan por probeta y como promedio.
              </p>
            )}
          </section>
        </>
      )}
      {stale && <p role="status" className="rounded-lg border border-navy-800 px-3 py-2 text-xs text-slate-400">
        Los datos cambiaron después de la última vista previa. Pulsa Calcular para actualizarla.
      </p>}

      <ProposalField label="Observaciones del ensayo">
        <textarea rows={2} maxLength={4000} className={fieldClass}
          placeholder="Condición de muestra, incidencias, rotura, instrumentación, etc."
          value={details.observations} onChange={event => onDetailsChange({ observations: event.target.value })} />
      </ProposalField>
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
        QA/QC: resultados calculados para control interno. Revisar procedimiento, calibraciones, unidades y conformidad con el informe oficial del laboratorio antes de aprobar.
      </p>

      <div className="flex flex-wrap items-center gap-2 border-t border-navy-800 pt-3">
        <button type="button" className={buttonClass} disabled={errors.length > 0} onClick={() => setPreviewKey(draftKey)}>
          <Calculator size={15} aria-hidden="true" /> Calcular
        </button>
        <button type="button" className={buttonClass} disabled>
          <Save size={15} aria-hidden="true" /> Guardar en registro maestro
        </button>
        <button type="button" className={buttonClass} disabled>
          <FileText size={15} aria-hidden="true" /> Ver reporte
        </button>
        <span className="text-xs text-slate-400">El guardado y el reporte PDF están deshabilitados en esta demostración.</span>
      </div>
    </div>
  );
}

export default function ProposalLaboratory({ sampleAssay, borehole, sampleNumber, from, to, lithology }: ProposalLaboratoryProps) {
  const [lab, setLab] = useState<ProposalLab | ''>('UNI (LGM)');
  const [selection, setSelection] = useState<{ source: ProposalLaboratoryProps['sampleAssay']; assay: ProposalAssay | '' }>(
    () => ({ source: sampleAssay, assay: sampleAssay })
  );
  if (selection.source !== sampleAssay) setSelection({ source: sampleAssay, assay: sampleAssay });
  const assay = selection.source === sampleAssay ? selection.assay : sampleAssay;
  const [localLithology, setLocalLithology] = useState<{ source: string; text: string } | null>(null);
  const sourceLithology = lithology ?? '';
  const [details, setDetails] = useState(() => ({ operator: '', date: new Date().toISOString().slice(0, 10), observations: '' }));
  const code = [borehole?.trim().toUpperCase(), assay, sampleNumber.trim().toUpperCase()].filter(Boolean).join('-');

  function changeDetails({ lithology: edited, ...rest }: Partial<Details>) {
    if (edited !== undefined) setLocalLithology({ source: sourceLithology, text: edited });
    setDetails(previous => ({ ...previous, ...rest }));
  }

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-800 dark:text-sky-300">
        Demostración de laboratorio. Puedes explorar los formatos, cargar ejemplos y generar una vista previa con valores calculados vacíos. Los datos solo se mantienen mientras esta vista esté abierta.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_1.4fr_0.7fr_0.7fr]">
        <ProposalField label="Laboratorio">
          <select className={fieldClass} value={lab} onChange={event => setLab(event.target.value as ProposalLab | '')}>
            <option value="">Selecciona...</option>
            {proposalLabs.map(option => <option key={option}>{option}</option>)}
          </select>
        </ProposalField>
        <ProposalField label="Tipo de ensayo">
          <select className={fieldClass} value={assay} onChange={event => setSelection({ source: sampleAssay, assay: event.target.value as ProposalAssay | '' })}>
            <option value="">Selecciona...</option>
            {Object.entries(proposalAssays).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </ProposalField>
        <ProposalField label="Código de muestra (preliminar)"><input className={readonlyClass} readOnly value={code} /></ProposalField>
        <ProposalField label="Desde (m)"><input className={readonlyClass} readOnly value={from} /></ProposalField>
        <ProposalField label="Hasta (m)"><input className={readonlyClass} readOnly value={to} /></ProposalField>
      </div>

      {!assay && <p className="text-xs text-slate-400">Selecciona el tipo de ensayo en la validación de muestra para mostrar su formulario. También puedes elegir un formato aquí para explorarlo.</p>}
      {assay && !lab && <p className="text-xs text-slate-400">Selecciona el laboratorio para ver su formato.</p>}
      {lab && assay && <LaboratoryDraft key={lab + ':' + assay} lab={lab} assay={assay} code={code} interval={[from, to]}
        details={{ ...details, lithology: localLithology?.source === sourceLithology ? localLithology.text : sourceLithology }}
        onDetailsChange={changeDetails} />}
    </div>
  );
}
