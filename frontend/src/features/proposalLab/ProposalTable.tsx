import { useState, type ReactNode } from 'react';
import { Eraser, FlaskConical, Plus, Trash2 } from 'lucide-react';
import { applyExample, clearedRow, rowHasMeasurements, type AssayExample } from './examples';
import type { ProposalAssay, ProposalColumn, ProposalRow } from './formats';

export const fieldClass = 'w-full min-w-0 rounded-lg border border-navy-800 bg-navy-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none disabled:opacity-60';
export const buttonClass = 'inline-flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-400 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50';

export function ProposalField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="block text-xs font-semibold text-slate-400">{label}</span>
      {children}
      {hint && <span className="block text-[11px] leading-snug text-slate-400">{hint}</span>}
    </label>
  );
}

export function proposalNumber(value: string | boolean | undefined) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ColumnInput({ column, value, onChange }: {
  column: ProposalColumn;
  value?: string | boolean;
  onChange: (value: string | boolean) => void;
}) {
  const label = column.label + (column.unidad ? ' (' + column.unidad + ')' : '');
  if (column.calc) {
    return <span aria-label={label + ' · Calculado, sin valor en esta demostración'} className="block text-slate-400">—</span>;
  }
  if (column.tipo === 'bool') {
    return <input type="checkbox" aria-label={label} title={column.ayuda} className="h-4 w-4 accent-rose-500"
      checked={value === true} onChange={event => onChange(event.target.checked)} />;
  }

  const text = typeof value === 'string' ? value : '';
  if (column.tipo === 'sel') {
    return <select aria-label={label} title={column.ayuda} className={fieldClass} value={text} onChange={event => onChange(event.target.value)}>
      <option value="">—</option>
      {column.opciones?.map(option => <option key={option}>{option}</option>)}
    </select>;
  }

  const numeric = column.tipo === 'num';
  const invalid = numeric && Boolean(text.trim()) && proposalNumber(text) === null;
  return (
    <input aria-label={label} aria-invalid={invalid} title={column.ayuda}
      className={fieldClass + (numeric ? ' text-right tabular-nums aria-[invalid=true]:border-red-500/70' : '')}
      inputMode={numeric ? 'decimal' : 'text'} placeholder={column.unidad} value={text}
      onChange={event => onChange(numeric ? event.target.value.replace(',', '.') : event.target.value)} />
  );
}

type TableAction = { kind: 'shrink'; rows: number } | { kind: 'clear' } | { kind: 'example' };

export function ProposalTableTools({ assay, columns, rows, blankRow, example, onChange }: {
  assay: ProposalAssay;
  columns: ProposalColumn[];
  rows: ProposalRow[];
  blankRow: () => ProposalRow;
  example: AssayExample | null;
  onChange: (rows: ProposalRow[]) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState<TableAction | null>(null);
  const units = assay === 'TI' ? 'discos' : assay === 'CD' ? 'etapas de carga' : 'probetas';

  function apply(action: TableAction, confirmed = false) {
    const affected = action.kind === 'shrink' ? rows.slice(action.rows) : rows;
    if (!confirmed && affected.some(row => rowHasMeasurements(columns, row))) {
      setPending(action);
      return;
    }

    if (action.kind === 'shrink') onChange(rows.slice(0, action.rows));
    if (action.kind === 'clear') onChange(rows.map((_, index) => clearedRow(columns, index)));
    if (action.kind === 'example' && example) onChange(applyExample(example, rows, blankRow));
    setPending(null);
    setDraft(null);
  }

  function commitCount() {
    if (draft === null) return;
    const count = Math.round(Number(draft));
    setDraft(null);
    if (!Number.isFinite(count) || count < 1 || count > 100) return;
    if (count < rows.length) apply({ kind: 'shrink', rows: count });
    if (count > rows.length) onChange([...rows, ...Array.from({ length: count - rows.length }, blankRow)]);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <ProposalField label={'Número de ' + units}>
            <input type="number" min={1} max={100} className={fieldClass} value={draft ?? String(rows.length)}
              onChange={event => setDraft(event.target.value)} onBlur={commitCount}
              onKeyDown={event => { if (event.key === 'Enter') commitCount(); }} />
          </ProposalField>
        </div>
        {example && <button type="button" className={buttonClass} onClick={() => apply({ kind: 'example' })}>
          <FlaskConical size={14} aria-hidden="true" /> Cargar ejemplo
        </button>}
        <button type="button" className={buttonClass} onClick={() => apply({ kind: 'clear' })}>
          <Eraser size={14} aria-hidden="true" /> Tabla vacía
        </button>
      </div>
      {example && (
        <p className="rounded-lg border border-navy-800 bg-navy-900/60 px-3 py-2 text-xs text-slate-400">
          <strong className="text-slate-100">{example.label}</strong> disponible ({example.source}). Sólo se carga si pulsas Cargar ejemplo; no se guarda automáticamente.
        </p>
      )}
      {pending && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <span className="flex-1">
            {pending.kind === 'shrink' ? `Reducir a ${pending.rows} eliminará filas con mediciones ingresadas.`
              : pending.kind === 'clear' ? 'Vaciar la tabla borrará las mediciones ingresadas.'
                : 'Cargar el ejemplo reemplazará las mediciones ingresadas.'}
          </span>
          <button type="button" className={buttonClass} onClick={() => apply(pending, true)}>Confirmar</button>
          <button type="button" className={buttonClass} onClick={() => { setPending(null); setDraft(null); }}>Cancelar</button>
        </div>
      )}
    </div>
  );
}

type ProposalTableProps = { columns: ProposalColumn[]; rows: ProposalRow[] } & (
  | { mode: 'edit'; onChange: (rows: ProposalRow[]) => void; blankRow: () => ProposalRow }
  | { mode: 'preview' }
);

function previewValue(column: ProposalColumn, value?: string | boolean) {
  if (column.calc) return '—';
  if (column.tipo === 'bool') return value ? 'Sí' : '';
  if (column.tipo !== 'num') return String(value ?? '');

  const parsed = proposalNumber(value);
  if (parsed === null) return '';
  const decimals = Number(column.fmt?.match(/\.(\d+)f$/)?.[1] ?? 2);
  return parsed.toFixed(decimals);
}

export function ProposalAssayTable(props: ProposalTableProps) {
  const { rows } = props;
  const editable = props.mode === 'edit';
  const columns = editable ? props.columns.filter(column => !column.calc) : props.columns;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-navy-800">
        <table className="w-full text-left text-xs" aria-label={editable ? 'Mediciones de laboratorio' : 'Tabla del formato con columnas calculadas'}>
          <thead className="bg-navy-900 text-slate-400">
            <tr>
              <th scope="col" className="px-3 py-2">#</th>
              {columns.map(column => (
                <th key={column.key} scope="col" title={column.ayuda} className={'min-w-28 px-2 py-2 align-bottom ' + (column.calc ? 'bg-sky-500/10' : '')}>
                  {column.label}
                  {column.unidad && <span className="block font-mono text-[11px] font-normal">[{column.unidad}]</span>}
                  {column.calc && <span className="block text-[10px] font-normal uppercase">Calculado</span>}
                </th>
              ))}
              {editable && <th scope="col" className="px-3 py-2">Acción</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className={'border-t border-navy-800 ' + (row.excluir ? 'bg-red-500/10' : '')}>
                <th scope="row" className="px-3 py-2 text-slate-400">{index + 1}</th>
                {columns.map(column => (
                  <td key={column.key} className={'px-2 py-2 ' + (column.tipo === 'bool' ? 'text-center' : column.calc ? 'text-right text-slate-400' : '')}>
                    {props.mode === 'edit' ? (
                      <ColumnInput column={column} value={row[column.key]} onChange={value => props.onChange(
                        rows.map((item, i) => i === index ? { ...item, [column.key]: value } : item)
                      )} />
                    ) : previewValue(column, row[column.key])}
                  </td>
                ))}
                {props.mode === 'edit' && <td className="px-3 py-2">
                  <button type="button" disabled={rows.length <= 1} aria-label={'Quitar fila ' + (index + 1)}
                    className="rounded-md p-2 text-rose-400 hover:bg-rose-500/10 disabled:opacity-40"
                    onClick={() => props.onChange(rows.filter((_, i) => i !== index))}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {props.mode === 'edit' && <button type="button" className={buttonClass} disabled={rows.length >= 100}
        onClick={() => props.onChange([...rows, props.blankRow()])}>
        <Plus size={14} aria-hidden="true" /> Agregar fila
      </button>}
    </div>
  );
}
