import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { X, Download, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { COLUMNS_CONFIG, getColumnsForModule } from '../utils/columnsConfig';

interface ExcelExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    records: Record<string, any>[];
    currentTab: string;
}

export default function ExcelExportModal({ isOpen, onClose, records, currentTab }: ExcelExportModalProps) {
    const [exportMode, setExportMode] = useState<'current' | 'all'>('current');

    if (!isOpen) return null;

    const handleExport = () => {
        const colsToExport = exportMode === 'current'
            ? getColumnsForModule(currentTab)
            : COLUMNS_CONFIG;

        const dataToExport = records.map((rec) => {
            const rowObj: Record<string, any> = {};
            colsToExport.forEach((col) => {
                rowObj[col.excelName] = rec[col.dbName] ?? '';
            });
            return rowObj;
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Base_Datos");

        const fileName = exportMode === 'current'
            ? `Ensayos_${currentTab.toUpperCase()}_Export.xlsx`
            : `Ensayos_Especiales_Maestro_Export.xlsx`;

        XLSX.writeFile(wb, fileName);
        onClose();
    };

    return (
        <div className="fixed inset-0 view-modal z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left">
            <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-navy-800 bg-navy-900/95 shadow-2xl flex flex-col overflow-hidden text-xs text-slate-100 space-y-4">
                <div className="flex justify-between items-center border-b border-navy-850 pb-3 shrink-0">
                    <div className="flex items-center gap-2">
                        <Download size={16} className="text-sky-400" />
                        <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest">Exportar Datos a Excel</h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-navy-800 text-slate-400 hover:text-slate-100 transition-colors">
                        <X size={14} />
                    </button>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Seleccione el Alcance del Archivo:</label>

                    <div className="grid grid-cols-1 gap-2.5">
                        <button
                            onClick={() => setExportMode('current')}
                            className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${exportMode === 'current'
                                ? 'bg-sky-500/10 border-sky-500/40 text-sky-400 font-bold shadow-md shadow-sky-500/5'
                                : 'bg-navy-950/40 border-navy-800 text-slate-400 hover:bg-navy-900/60'
                                }`}
                        >
                            <div className="flex justify-between items-center w-full">
                                <span className="text-xs uppercase font-extrabold tracking-wider">Módulo Activo</span>
                                {exportMode === 'current' && <CheckCircle2 size={14} />}
                            </div>
                            <p className="text-[10px] text-slate-400 leading-normal">
                                Exportar únicamente las columnas visibles del ensayo actual: <strong className="text-slate-100 capitalize">{currentTab.replace('_', ' ')}</strong>
                            </p>
                        </button>

                        <button
                            onClick={() => setExportMode('all')}
                            className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${exportMode === 'all'
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-bold shadow-md shadow-emerald-500/5'
                                : 'bg-navy-950/40 border-navy-800 text-slate-400 hover:bg-navy-900/60'
                                }`}
                        >
                            <div className="flex justify-between items-center w-full">
                                <span className="text-xs uppercase font-extrabold tracking-wider">Registro Maestro Completo</span>
                                {exportMode === 'all' && <CheckCircle2 size={14} />}
                            </div>
                            <p className="text-[10px] text-slate-400 leading-normal">
                                Exportar la matriz íntegra desnormalizada de 47 columnas de todos los ensayos especiales.
                            </p>
                        </button>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-navy-800/80">
                    <button onClick={onClose} className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 px-4 py-2 rounded-lg text-xs font-semibold">
                        Cancelar
                    </button>
                    <button
                        onClick={handleExport}
                        className="bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/25 text-sky-400 px-4.5 py-2 rounded-lg text-xs font-black flex items-center gap-1.5"
                    >
                        <FileSpreadsheet size={14} />
                        <span>Descargar Archivo</span>
                    </button>
                </div>
            </div>
        </div>
    );
}