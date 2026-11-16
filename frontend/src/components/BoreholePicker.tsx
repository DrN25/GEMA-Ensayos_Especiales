import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export interface Borehole {
  id: number;
  code: string;
  project: string | null;
}

export default function BoreholePicker({ holes, selected, disabled, placeholder, onSelect }: {
  holes: Borehole[];
  selected?: Borehole;
  disabled: boolean;
  placeholder: string;
  onSelect: (hole: Borehole) => void;
}) {
  const id = useId();
  const listId = id + '-options';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const term = query.trim().toLowerCase();
  const matches = holes.filter(hole => hole.code.toLowerCase().includes(term));
  const picker = useRef<HTMLDivElement>(null);
  const expanded = open && !disabled;

  useEffect(() => {
    if (!expanded) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !picker.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [expanded]);

  function openList() {
    setQuery('');
    setActive(-1);
    setOpen(true);
  }

  function select(hole: Borehole) {
    onSelect(hole);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!expanded) {
        openList();
        return;
      }
      if (!matches.length) return;
      const next = active < 0
        ? event.key === 'ArrowDown' ? 0 : matches.length - 1
        : Math.max(0, Math.min(matches.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1)));
      setActive(next);
      document.getElementById(listId + '-' + matches[next].id)?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && expanded && matches.length) {
      const exact = matches.find(hole => hole.code.toLowerCase() === term);
      const choice = matches[active] ?? exact ?? (matches.length === 1 ? matches[0] : undefined);
      if (choice) {
        event.preventDefault();
        select(choice);
      }
    }
  }

  return (
    <div ref={picker} className="relative min-w-0 space-y-1.5"
      onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-400">Sondaje</label>
      <div className="relative">
        <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          role="combobox"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={expanded && matches[active] ? listId + '-' + matches[active].id : undefined}
          autoComplete="off"
          disabled={disabled}
          value={expanded ? query : selected?.code ?? ''}
          placeholder={placeholder}
          className="w-full rounded-lg border border-navy-800 bg-navy-950 py-2 pl-9 pr-9 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none disabled:opacity-60"
          onFocus={openList}
          onClick={() => { if (!expanded) openList(); }}
          onChange={event => {
            setQuery(event.target.value);
            document.getElementById(listId)?.scrollTo({ top: 0 });
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
      {expanded && (
        <div className="absolute inset-x-0 z-30 overflow-hidden rounded-lg border border-navy-800 bg-navy-950 shadow-xl">
          <ul id={listId} role="listbox" aria-label="Sondajes disponibles" className="max-h-60 overflow-y-auto overscroll-contain p-1" onWheel={event => event.stopPropagation()}>
            {matches.map((hole, index) => (
              <li key={hole.id} id={listId + '-' + hole.id} role="option" aria-selected={selected?.id === hole.id}
                className={'flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm ' +
                  (active === index || selected?.id === hole.id ? 'bg-sky-500/10 text-sky-400' : 'text-slate-100 hover:bg-navy-800/60')}
                onMouseDown={event => event.preventDefault()} onClick={() => select(hole)}>
                <span className="font-mono">{hole.code}</span>
                {hole.project && <span className="truncate text-xs text-slate-400">{hole.project}</span>}
              </li>
            ))}
          </ul>
          {!matches.length && <p role="status" className="px-3 pb-3 text-xs text-slate-400">No hay sondajes que coincidan.</p>}
        </div>
      )}
    </div>
  );
}
