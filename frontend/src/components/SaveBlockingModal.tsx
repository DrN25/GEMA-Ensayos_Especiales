// frontend/src/components/SaveBlockingModal.tsx
import React from 'react';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import type { QAQCAlert } from '../utils/qaqcValidator';

interface SaveBlockingModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockingAlerts: QAQCAlert[];
  summaryMessage: string;
  onNavigateToCell: (idd: number, field: string, tab: string) => void;
}

export const SaveBlockingModal: React.FC<SaveBlockingModalProps> = ({
  isOpen,
  onClose,
  blockingAlerts,
  summaryMessage,
  onNavigateToCell,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left">
      <div className="glass-panel w-full max-w-2xl max-h-[85vh] flex flex-col border border-rose-500/40 rounded-2xl shadow-2xl bg-navy-900/95 text-xs text-slate-100 overflow-hidden">
        {/* Banner de alerta */}
        <div className="h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600 w-full shrink-0" />

        {/* Encabezado */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-navy-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                Guardado Bloqueado por QA/QC
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold">{summaryMessage}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-navy-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Lista de alertas bloqueantes */}
        <div className="p-6 overflow-y-auto space-y-2 flex-1">
          <p className="text-slate-300 mb-3 text-[11px]">
            Haga clic en cualquiera de las siguientes alertas para navegar directamente a la celda en conflicto y corregirla:
          </p>

          <div className="space-y-2">
            {blockingAlerts.map((alert, idx) => (
              <div
                key={`${alert.idd}-${alert.field}-${idx}`}
                className="flex items-center justify-between p-3 rounded-xl bg-navy-950 border border-navy-800 hover:border-rose-500/40 hover:bg-navy-850/60 transition-all group"
              >
                <div className="space-y-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      alert.type === 'CRÍTICO' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {alert.type}
                    </span>
                    <span className="font-mono font-bold text-slate-200">
                      Fila IDD {alert.idd}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      Campo: <span className="text-cyan-400 font-semibold">{alert.field}</span>
                    </span>
                    <span className="text-slate-500 text-[10px]">
                      ({alert.tab.replace('_', ' ')})
                    </span>
                  </div>
                  <p className="text-slate-300 text-xs">
                    {alert.message}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onNavigateToCell(alert.idd, alert.field, alert.tab);
                    onClose();
                  }}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-900 border border-navy-700 text-cyan-400 hover:text-cyan-200 hover:border-cyan-500/50 hover:bg-cyan-950/40 text-xs font-bold transition-all shadow-sm"
                  title="Navegar a esta celda"
                >
                  <span>Ir a Celda</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3.5 border-t border-navy-800/80 shrink-0 bg-navy-950/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-navy-850 border border-navy-750 text-slate-300 hover:text-white hover:bg-navy-800 text-xs font-bold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
