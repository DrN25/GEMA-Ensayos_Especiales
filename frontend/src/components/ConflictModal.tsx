// frontend/src/components/ConflictModal.tsx
import React from 'react';
import { AlertCircle, Check, Server, User, X } from 'lucide-react';
import type { RowConflict } from '../features/grid/storage/types';

interface ConflictModalProps {
  isOpen: boolean;
  conflicts: RowConflict[];
  onResolve: (idd: number, decision: 'keep_local' | 'use_server') => void;
  onResolveAll: (decision: 'keep_local' | 'use_server') => void;
  onClose: () => void;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  isOpen,
  conflicts,
  onResolve,
  onResolveAll,
  onClose
}) => {
  if (!isOpen || conflicts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-sm animate-fade-in text-left">
      <div className="glass-panel w-full max-w-2xl p-6 rounded-2xl border border-amber-500/40 bg-navy-900/95 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-navy-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <AlertCircle size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                Conflicto de Sincronización Detectado
              </h3>
              <p className="text-[11px] text-slate-400">
                Se detectaron datos modificados en el servidor mientras tenías cambios locales pendientes.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-navy-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-slate-300 shrink-0">
          Revisa las diferencias por muestra y elige qué versión deseas conservar:
        </p>

        {/* Lista de conflictos con scroll si hay muchos */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {conflicts.map((c) => (
            <div
              key={c.idd}
              className="bg-navy-950/70 border border-navy-800 rounded-xl p-3.5 space-y-2.5 text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-200 font-mono flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 text-[10px]">
                    IDD #{c.idd}
                  </span>
                  <span>{c.sondaje || 'Muestra sin sondaje'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onResolve(c.idd, 'keep_local')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 border border-sky-500/30 text-[11px] font-bold transition-all"
                  >
                    <User size={12} />
                    <span>Mantener lo mío</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolve(c.idd, 'use_server')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-navy-800 text-slate-300 hover:text-white hover:bg-navy-750 border border-navy-700 text-[11px] font-bold transition-all"
                  >
                    <Server size={12} />
                    <span>Usar servidor</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-navy-900/60 p-2.5 rounded-lg text-[11px] font-mono border border-navy-850">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Campo</span>
                  <span className="text-amber-400 font-semibold">{c.field}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Servidor</span>
                  <span className="text-rose-300">{String(c.serverValue ?? '—')}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Mi Edición</span>
                  <span className="text-emerald-400 font-bold">{String(c.localValue ?? '—')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Acciones globales */}
        <div className="flex items-center justify-between border-t border-navy-800 pt-3 shrink-0">
          <span className="text-[11px] text-slate-400 font-semibold">
            {conflicts.length} conflicto(s) pendiente(s)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onResolveAll('use_server')}
              className="px-3 py-1.5 rounded-xl bg-navy-800 hover:bg-navy-750 text-slate-300 text-xs font-bold transition-colors border border-navy-700"
            >
              Usar servidor en todos
            </button>
            <button
              type="button"
              onClick={() => onResolveAll('keep_local')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md shadow-sky-900/30"
            >
              <Check size={13} />
              <span>Mantener todos mis cambios</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

