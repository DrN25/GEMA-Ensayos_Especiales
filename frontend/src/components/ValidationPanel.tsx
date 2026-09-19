import React, { useState } from 'react';
import { ShieldCheck, X, AlertCircle, HelpCircle, ArrowLeft } from 'lucide-react';
import type { QAQCAlert } from '../utils/qaqcValidator';

interface ValidationPanelProps {
  alerts: QAQCAlert[];
  onFocusField: (idd: number, field: string, tab: string) => void;
}

const TAB_LABELS: Record<string, string> = {
  registro_maestro: "Registro Maestro",
  ucs: "Compresión Uniaxial",
  elasticas: "Constantes Elásticas",
  traccion: "Tracción Indirecta",
  corte: "Corte Directo",
  triaxial: "Compresión Triaxial",
  propiedades: "Propiedades Físicas"
};

export default function ValidationPanel({ alerts, onFocusField }: ValidationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('principal');

  if (alerts.length === 0) return null;

  const criticos = alerts.filter(a => a.type === 'CRÍTICO');
  const alertColorClass = criticos.length > 0
    ? 'from-rose-600 to-red-500 shadow-rose-500/20'
    : 'from-amber-500 to-yellow-400 shadow-amber-500/20';

  return (
    <div className="fixed bottom-6 right-6 z-50 select-none">
      {/* 1. Botón Flotante Chatbot */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setActiveTab('principal');
          }}
          className={`flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r text-white shadow-2xl font-black text-xs hover:brightness-110 transition-all active:scale-95 animate-pulse ${alertColorClass}`}
        >
          <ShieldCheck size={16} />
          <span>Alertas QA/QC ({alerts.length})</span>
        </button>
      )}

      {/* 2. Modal Colapsable Tipo Chatbot */}
      {isOpen && (
        <div className="w-96 rounded-2xl border border-navy-800 bg-navy-950/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden animate-scale-up text-left">
          {/* Header del Modal */}
          <div className="flex items-center justify-between p-3.5 border-b border-navy-900 bg-navy-950/40 shrink-0">
            <span className="text-xs font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
              {activeTab !== 'principal' && (
                <button
                  onClick={() => setActiveTab('principal')}
                  className="p-1 rounded hover:bg-navy-900 text-slate-400 hover:text-slate-200"
                >
                  <ArrowLeft size={14} />
                </button>
              )}
              <ShieldCheck size={14} className={criticos.length > 0 ? "text-rose-400" : "text-amber-400"} />
              <span>QA/QC — {activeTab === 'principal' ? 'Dashboard' : TAB_LABELS[activeTab]}</span>
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-navy-900 text-slate-400 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Cuerpo del Modal */}
          <div className="max-h-80 overflow-y-auto p-4 space-y-3 custom-scrollbar flex-1 bg-navy-950/15">
            {activeTab === 'principal' ? (
              <div className="space-y-2">
                <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Resumen de Auditoría</p>
                {Object.entries(TAB_LABELS).map(([tabKey, label]) => {
                  const moduleAlerts = alerts.filter(a => a.tab === tabKey);
                  const mCriticos = moduleAlerts.filter(a => a.type === 'CRÍTICO').length;
                  const mAvisos = moduleAlerts.filter(a => a.type === 'AVISO').length;

                  return (
                    <div
                      key={tabKey}
                      onClick={() => setActiveTab(tabKey)}
                      className={`p-3 rounded-xl border flex justify-between items-center cursor-pointer transition-all hover:bg-navy-900/40 ${moduleAlerts.length > 0
                          ? mCriticos > 0
                            ? 'border-rose-500/20 bg-rose-950/10 hover:border-rose-500/40'
                            : 'border-amber-500/20 bg-amber-950/10 hover:border-amber-500/40'
                          : 'border-navy-900 bg-navy-950/20 hover:border-navy-800'
                        }`}
                    >
                      <div>
                        <h5 className="font-bold text-xs text-slate-200">{label}</h5>
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                          {moduleAlerts.length === 0 ? "✓ Todo Consistente" : "Requiere Revisión"}
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {moduleAlerts.length === 0 ? (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 uppercase">
                            OK
                          </span>
                        ) : (
                          <div className="flex gap-1">
                            {mCriticos > 0 && (
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-400">
                                {mCriticos} C
                              </span>
                            )}
                            {mAvisos > 0 && (
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400">
                                {mAvisos} A
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {alerts
                  .filter(a => a.tab === activeTab)
                  .sort((a, b) => (a.type === 'CRÍTICO' ? -1 : 1))
                  .map((alert, idx) => {
                    const isCritico = alert.type === 'CRÍTICO';
                    return (
                      <div
                        key={idx}
                        onClick={() => onFocusField(alert.idd, alert.field, alert.tab)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer hover:bg-navy-900/40 transition-all active:scale-98 ${isCritico
                            ? 'border-rose-500/25 bg-rose-950/10 hover:border-rose-500/55'
                            : 'border-amber-500/25 bg-amber-950/10 hover:border-amber-500/55'
                          }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className={`font-black uppercase tracking-wider text-xs flex items-center gap-1 ${isCritico ? 'text-rose-400' : 'text-amber-400'
                            }`}>
                            {isCritico ? <AlertCircle size={12} /> : <HelpCircle size={12} />}
                            <span>IDD: {alert.idd} ({alert.type})</span>
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            {alert.field}
                          </span>
                        </div>
                        <p className="text-slate-300 font-medium leading-relaxed">{alert.message}</p>
                        <div className="mt-2 text-xs text-blue-400 font-black tracking-wider uppercase select-none hover:underline">
                          Ir a la Celda &raquo;
                        </div>
                      </div>
                    );
                  })}

                {alerts.filter(a => a.tab === activeTab).length === 0 && (
                  <div className="p-8 text-center text-slate-500 italic font-semibold">
                    No se registran alertas en este módulo.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}