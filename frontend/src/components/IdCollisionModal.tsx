// frontend/src/components/IdCollisionModal.tsx
import React from 'react';
import { AlertCircle, Download, CheckCircle2 } from 'lucide-react';
import { generateCollisionsCsv, type IdCollision } from '../utils/idCollisionResolver';

interface IdCollisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collisions: IdCollision[];
  onConfirm: () => void;
}

export const IdCollisionModal: React.FC<IdCollisionModalProps> = ({
  isOpen,
  onClose,
  collisions,
  onConfirm,
}) => {
  if (!isOpen || collisions.length === 0) return null;

  const handleDownloadCsv = () => {
    const csvContent = generateCollisionsCsv(collisions);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `informe_colisiones_idd_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left">
      <div className="glass-panel w-full max-w-4xl max-h-[85vh] flex flex-col border border-amber-500/40 rounded-2xl shadow-2xl bg-navy-900/95 text-xs text-slate-100 overflow-hidden">
        {/* Banner superior */}
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 w-full shrink-0" />

        {/* Encabezado */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-navy-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <AlertCircle size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                Colisiones de IDD Detectadas al Importar
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold">
                Se detectaron {collisions.length} registro(s) con IDD duplicado o colisionado. Se les asignó automáticamente un IDD correlativo nuevo para no sobrescribir datos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-750 border border-navy-700 text-slate-200 hover:text-white font-bold transition-all text-xs"
            title="Descargar informe completo en formato CSV"
          >
            <Download size={13} className="text-amber-400" />
            <span>Descargar CSV</span>
          </button>
        </div>

        {/* Tabla de colisiones */}
        <div className="p-6 overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-navy-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-2.5 px-2">Fila Excel</th>
                <th className="pb-2.5 px-2">IDD Original</th>
                <th className="pb-2.5 px-2">IDD Asignado</th>
                <th className="pb-2.5 px-2">Sondaje</th>
                <th className="pb-2.5 px-2">Código Muestra</th>
                <th className="pb-2.5 px-2">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-850 font-mono text-xs">
              {collisions.map((col, idx) => (
                <tr key={idx} className="hover:bg-navy-850/50 transition-colors">
                  <td className="py-2.5 px-2 text-slate-400">Fila {col.excelRow}</td>
                  <td className="py-2.5 px-2 text-rose-400 font-bold line-through">{col.originalIdd}</td>
                  <td className="py-2.5 px-2 text-emerald-400 font-bold">{col.assignedIdd}</td>
                  <td className="py-2.5 px-2 text-slate-200">{col.sondaje}</td>
                  <td className="py-2.5 px-2 text-slate-300">{col.codigo_muestra}</td>
                  <td className="py-2.5 px-2 font-sans text-[11px] text-amber-300/90">{col.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-navy-800/80 shrink-0 bg-navy-950/40">
          <span className="text-[11px] text-slate-400">
            Total colisiones resueltas: <strong className="text-amber-400 font-mono">{collisions.length}</strong>
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-navy-900 border border-navy-800 text-slate-400 hover:text-white text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 hover:text-white text-xs font-black shadow-lg shadow-emerald-500/10 transition-all"
            >
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>Aceptar y Continuar a Grilla</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

