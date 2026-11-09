// frontend/src/components/DiscardModal.tsx
import React from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';

interface DiscardModalProps {
  isOpen: boolean;
  counts: {
    modified: number;
    inserted: number;
    deleted: number;
    total: number;
  };
  onConfirm: () => void;
  onCancel: () => void;
}

export const DiscardModal: React.FC<DiscardModalProps> = ({
  isOpen,
  counts,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left">
      <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-rose-500/40 bg-navy-900/95 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-navy-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                Descartar Cambios Pendientes
              </h3>
              <p className="text-[11px] text-slate-400">Revertir el estado de la planilla al último guardado</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-navy-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          ¿Estás seguro de que deseas revertir todos los cambios locales no guardados? Esta acción descartará los datos en memoria e IndexedDB.
        </p>

        <div className="bg-navy-950/70 border border-navy-800 rounded-xl p-3.5 space-y-2 text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Resumen de cambios a descartar:
          </span>
          <div className="space-y-1 font-mono text-xs">
            <div className="flex justify-between items-center text-slate-300">
              <span>• Filas modificadas:</span>
              <strong className="text-amber-400 font-bold">{counts.modified}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span>• Filas nuevas insertadas:</span>
              <strong className="text-sky-400 font-bold">{counts.inserted}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span>• Filas eliminadas pendientes:</span>
              <strong className="text-rose-400 font-bold">{counts.deleted}</strong>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-navy-850 hover:bg-navy-800 text-slate-300 hover:text-white text-xs font-bold transition-colors border border-navy-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            data-testid="confirm-discard-btn"
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-900/30"
          >
            <RotateCcw size={13} />
            <span>Sí, descartar cambios</span>
          </button>
        </div>
      </div>
    </div>
  );
};

