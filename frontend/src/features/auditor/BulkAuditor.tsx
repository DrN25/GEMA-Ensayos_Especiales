import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  ShieldCheck,
  Download,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  Search,
  Database,
  Layers,
  ChevronLeft,
  ChevronRight,
  AlertOctagon,
  Info
} from 'lucide-react';

interface BulkAuditorProps {
  apiBase: string;
  onAuditSynced?: () => void;
}

interface AuditKpis {
  audit_id: string;
  filename: string;
  timestamp: string;
  total_filas: number;
  total_observaciones: number;
  filas_con_observacion: number;
  filas_conformes: number;
  tasa_calidad_pct: number;
  distribucion_severidad: Record<string, number>;
  top_campos_afectados: [string, number][];
}

interface Incidencia {
  fila_excel: number;
  sondaje: string;
  codigo_muestra: string;
  campo: string;
  columna_letra: string;
  valor_actual: any;
  tipo_error: string;
  mensaje: string;
  sugerencia: string;
}

export default function BulkAuditor({ apiBase, onAuditSynced }: BulkAuditorProps) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'loaded' | 'error'>('idle');
  const [selectedAuditId, setSelectedAuditId] = useState<string>('');
  const [kpis, setKpis] = useState<AuditKpis | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Incidencias paginadas
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalIncidencias, setTotalIncidencias] = useState<number>(0);
  const [loadingTable, setLoadingTable] = useState<boolean>(false);

  // Filtros de incidencias
  const [filterQ, setFilterQ] = useState<string>('');
  const [filterTipo, setFilterTipo] = useState<string>('');
  const [filterCampo, setFilterCampo] = useState<string>('');

  // Historial
  const [history, setHistory] = useState<any[]>([]);

  // Sincronización a BD
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  const pollingRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carga inicial de historial
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${apiBase}/api/auditoria/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (e) {
      console.warn("No se pudo cargar historial de auditoría", e);
    }
  };

  // Polling de estado si está procesando
  useEffect(() => {
    if (status === 'processing' && selectedAuditId) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${apiBase}/api/auditoria/status/${selectedAuditId}`);
          if (!res.ok) return;
          const data = await res.json();

          if (data.status === 'completed') {
            clearInterval(pollingRef.current);
            setStatus('loaded');
            loadKpis(selectedAuditId);
            fetchHistory();
          } else if (data.status === 'failed') {
            clearInterval(pollingRef.current);
            setStatus('error');
            setErrorMessage(data.message || data.detail || 'Error en auditoría');
          }
        } catch (e) {
          console.warn("Fallo polling", e);
        }
      }, 2000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [status, selectedAuditId]);

  // Cargar incidencias cuando cambia página o filtros
  useEffect(() => {
    if (status === 'loaded' && selectedAuditId) {
      loadIncidencias(page, filterQ, filterTipo, filterCampo);
    }
  }, [status, selectedAuditId, page, pageSize, filterTipo, filterCampo]);

  const loadKpis = async (auditId: string) => {
    try {
      const res = await fetch(`${apiBase}/api/auditoria/kpis?audit_id=${auditId}`);
      if (res.ok) {
        const data = await res.json();
        setKpis(data);
        setPage(1);
        loadIncidencias(1, filterQ, filterTipo, filterCampo);
      }
    } catch (e) {
      console.error("Error al cargar KPIs", e);
    }
  };

  const loadIncidencias = async (p: number, q: string, tipo: string, campo: string) => {
    setLoadingTable(true);
    try {
      const params = new URLSearchParams({
        audit_id: selectedAuditId,
        page: String(p),
        limit: String(pageSize),
      });
      if (q) params.append('q', q);
      if (tipo) params.append('tipo', tipo);
      if (campo) params.append('campo', campo);

      const res = await fetch(`${apiBase}/api/auditoria/incidencias?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setIncidencias(data.items || []);
        setTotalPages(data.total_pages || 1);
        setTotalIncidencias(data.total || 0);
        setPage(data.page || 1);
      }
    } catch (e) {
      console.error("Error al cargar incidencias", e);
    } finally {
      setLoadingTable(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('uploading');
    setErrorMessage('');
    setApplySuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${apiBase}/api/auditoria/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Error en subida' }));
        throw new Error(err.detail || 'Error al subir archivo');
      }

      const data = await res.json();
      setSelectedAuditId(data.audit_id);
      setStatus('processing');
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Error al procesar archivo');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyToDatabase = async () => {
    if (!selectedAuditId || isApplying) return;
    if (!confirm('¿Desea aplicar y sincronizar los registros corregidos y auditados a la Base de Datos?')) return;

    setIsApplying(true);
    setApplySuccess(null);

    try {
      const res = await fetch(`${apiBase}/api/auditoria/apply-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: selectedAuditId, action: 'upsert' })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Error al aplicar' }));
        throw new Error(err.detail || 'Error al aplicar');
      }

      const result = await res.json();
      setApplySuccess(`Sincronización completada: ${result.upserted_count || 0} registros actualizados en la base de datos.`);
      if (onAuditSynced) onAuditSynced();
    } catch (e: any) {
      alert(`Error al sincronizar: ${e.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  const handleDownloadExcel = () => {
    if (!selectedAuditId) return;
    window.open(`${apiBase}/api/auditoria/export-excel?audit_id=${selectedAuditId}`, '_blank');
  };

  const handleSelectHistory = (auditId: string) => {
    setSelectedAuditId(auditId);
    setStatus('loaded');
    loadKpis(auditId);
  };

  return (
    <div className="space-y-6 text-left select-none animate-fade-in text-xs font-semibold view-dashboard">
      {/* 1. Header Banner */}
      <div className="glass-panel flex flex-wrap justify-between items-center bg-navy-950/20 border border-navy-800 p-5 rounded-2xl gap-4 shadow-md">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-100 uppercase tracking-wider">
                Auditor Geotécnico QA/QC — Ensayos Especiales
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Evaluación masiva, validación de tolerancias físicas y detección automática de anomalías
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx, .xlsm"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={status === 'uploading' || status === 'processing'}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
          >
            <UploadCloud size={16} />
            <span>{status === 'uploading' ? 'Subiendo...' : status === 'processing' ? 'Auditando...' : 'Cargar Planilla Excel'}</span>
          </button>
        </div>
      </div>

      {/* 2. Loading State */}
      {(status === 'uploading' || status === 'processing') && (
        <div className="glass-panel p-12 rounded-2xl border border-indigo-500/30 text-center flex flex-col items-center gap-4 bg-indigo-950/10">
          <RefreshCw size={36} className="text-indigo-400 animate-spin" />
          <div>
            <h4 className="text-sm font-bold text-slate-200">
              {status === 'uploading' ? 'Subiendo archivo Excel...' : 'Ejecutando motor de reglas QA/QC...'}
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Verificando consistencia de 47 parámetros geotécnicos y tolerancias físicas.
            </p>
          </div>
        </div>
      )}

      {/* 3. Error Alert */}
      {status === 'error' && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3">
          <AlertOctagon size={20} className="shrink-0 text-rose-400" />
          <div className="flex-1 text-xs">
            <span className="font-bold">Error en la auditoría:</span> {errorMessage}
          </div>
          <button
            onClick={() => setStatus('idle')}
            className="text-xs underline hover:text-white"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* 4. Success Alert on DB Sync */}
      {applySuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-3">
          <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
          <div className="flex-1 text-xs font-bold">{applySuccess}</div>
        </div>
      )}

      {/* 5. Dashboard Loaded View */}
      {status === 'loaded' && kpis && (
        <div className="space-y-6">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-panel p-4 rounded-xl border border-navy-800 bg-navy-950/40">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs uppercase tracking-wider font-bold">Total Ensayos</span>
                <Layers size={16} className="text-indigo-400" />
              </div>
              <div className="text-2xl font-black text-slate-100 mt-2 font-mono">
                {kpis.total_filas.toLocaleString()}
              </div>
              <span className="text-xs text-slate-500 font-medium">Filas analizadas en planilla</span>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-navy-800 bg-navy-950/40">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs uppercase tracking-wider font-bold">Observaciones</span>
                <AlertTriangle size={16} className="text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-400 mt-2 font-mono">
                {kpis.total_observaciones.toLocaleString()}
              </div>
              <span className="text-xs text-slate-500 font-medium">En {kpis.filas_con_observacion} filas distintas</span>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-navy-800 bg-navy-950/40">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs uppercase tracking-wider font-bold">Tasa de Calidad</span>
                <CheckCircle2 size={16} className="text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400 mt-2 font-mono">
                {kpis.tasa_calidad_pct.toFixed(1)}%
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {kpis.filas_conformes.toLocaleString()} filas sin observaciones
              </span>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-navy-800 bg-navy-950/40">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs uppercase tracking-wider font-bold">Acciones QA/QC</span>
                <Database size={16} className="text-sky-400" />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleDownloadExcel}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 py-2 rounded-lg text-xs font-bold transition-all"
                  title="Descargar Excel auditado con observaciones y fórmulas"
                >
                  <Download size={13} />
                  <span>Reporte</span>
                </button>
                <button
                  onClick={handleApplyToDatabase}
                  disabled={isApplying}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                  title="Sincronizar y aplicar a base de datos de ensayos"
                >
                  <Database size={13} />
                  <span>{isApplying ? 'Aplicando...' : 'Aplicar BD'}</span>
                </button>
              </div>
              <span className="text-xs text-slate-500 font-medium block mt-1">Exportar o sincronizar a BD</span>
            </div>
          </div>

          {/* Top Campos Observados Badge Breakdown */}
          {kpis.top_campos_afectados && kpis.top_campos_afectados.length > 0 && (
            <div className="p-4 rounded-xl bg-navy-950/30 border border-navy-800 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mr-2 flex items-center gap-1">
                <Info size={13} className="text-indigo-400" /> Top Campos con Desviación:
              </span>
              {kpis.top_campos_afectados.slice(0, 6).map(([campo, count]) => (
                <button
                  key={campo}
                  onClick={() => setFilterCampo(filterCampo === campo ? '' : campo)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all border ${
                    filterCampo === campo
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                      : 'bg-navy-900 text-slate-300 border-navy-800 hover:border-slate-600'
                  }`}
                >
                  {campo}: <span className="font-bold">{count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Incidencias Table Section */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-navy-950/40 p-4 rounded-xl border border-navy-800">
              <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                <div className="relative flex-1 max-w-sm">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Buscar sondaje o muestra..."
                    value={filterQ}
                    onChange={(e) => setFilterQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setPage(1);
                        loadIncidencias(1, filterQ, filterTipo, filterCampo);
                      }
                    }}
                    className="w-full bg-navy-900 border border-navy-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 outline-none focus:border-indigo-500"
                  />
                </div>

                <select
                  value={filterTipo}
                  onChange={(e) => {
                    setFilterTipo(e.target.value);
                    setPage(1);
                  }}
                  className="bg-navy-900 border border-navy-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none"
                >
                  <option value="">Todas las severidades</option>
                  <option value="CRITICO">Crítico</option>
                  <option value="ALERTA">Alerta / Desviación</option>
                </select>

                {(filterQ || filterTipo || filterCampo) && (
                  <button
                    onClick={() => {
                      setFilterQ('');
                      setFilterTipo('');
                      setFilterCampo('');
                      setPage(1);
                      loadIncidencias(1, '', '', '');
                    }}
                    className="text-xs text-indigo-400 hover:underline"
                  >
                    Limpiar Filtros
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-400">
                Mostrando <span className="font-bold text-slate-200">{incidencias.length}</span> de{' '}
                <span className="font-bold text-slate-200">{totalIncidencias}</span> observaciones
              </div>
            </div>

            {/* Table Container */}
            <div className="border border-navy-800 rounded-xl overflow-hidden bg-navy-950/30">
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-navy-900/80 sticky top-0 z-10 text-slate-400 uppercase tracking-wider text-[11px] border-b border-navy-800">
                    <tr>
                      <th className="py-3 px-3 w-16">Fila</th>
                      <th className="py-3 px-3 w-28">Sondaje</th>
                      <th className="py-3 px-3 w-32">Muestra</th>
                      <th className="py-3 px-3 w-36">Campo</th>
                      <th className="py-3 px-3 w-24">Valor</th>
                      <th className="py-3 px-3 w-24 text-center">Tipo</th>
                      <th className="py-3 px-3">Mensaje / Detalle</th>
                      <th className="py-3 px-3">Sugerencia Corrección</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-800/60 font-sans">
                    {loadingTable ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500">
                          <RefreshCw size={20} className="animate-spin inline mr-2 text-indigo-400" />
                          Cargando observaciones...
                        </td>
                      </tr>
                    ) : incidencias.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500">
                          No se encontraron observaciones para los filtros aplicados.
                        </td>
                      </tr>
                    ) : (
                      incidencias.map((inc, idx) => (
                        <tr key={idx} className="hover:bg-navy-900/40 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-slate-400">#{inc.fila_excel}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-200">{inc.sondaje || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-300 font-mono">{inc.codigo_muestra || '—'}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-indigo-400 font-semibold">{inc.campo}</span>
                            <span className="text-[10px] text-slate-500 ml-1">({inc.columna_letra})</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-amber-300 font-bold">{String(inc.valor_actual ?? 'VACÍO')}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                inc.tipo_error === 'CRITICO'
                                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {inc.tipo_error}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate" title={inc.mensaje}>
                            {inc.mensaje}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate font-mono text-[11px]" title={inc.sugerencia}>
                            {inc.sugerencia || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between px-4 py-3 bg-navy-900/60 border-t border-navy-800 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span>Página {page} de {totalPages}</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="bg-navy-900 border border-navy-800 rounded px-2 py-1 text-slate-300 text-xs"
                  >
                    <option value={25}>25 filas</option>
                    <option value={50}>50 filas</option>
                    <option value={100}>100 filas</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg border border-navy-800 hover:bg-navy-800 disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg border border-navy-800 hover:bg-navy-800 disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. History List */}
      {history.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-navy-800">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Historial de Auditorías Recientes</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {history.map((h) => (
              <div
                key={h.audit_id}
                onClick={() => handleSelectHistory(h.audit_id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedAuditId === h.audit_id
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-navy-800 bg-navy-950/30 hover:border-navy-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 truncate">{h.filename}</span>
                  <span className="text-[10px] text-slate-500">{h.timestamp?.split('T')[0] || ''}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                  <span>Filas: {h.total_filas?.toLocaleString() || 0}</span>
                  <span className="text-amber-400 font-bold">{h.total_observaciones?.toLocaleString() || 0} obs</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
