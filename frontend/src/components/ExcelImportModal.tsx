import React, { useState, useRef, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { X, FileSpreadsheet, Upload, AlertTriangle, Check, ArrowRight, Filter, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { COLUMNS_CONFIG, type ColumnDef, clampValue } from '../utils/columnsConfig';

interface ExcelImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (importedData: Record<string, any>[]) => void;
    apiBase?: string;
    onDirectSaveComplete?: () => void;
}

// Sinonimos para detectar automaticamente la fila de cabecera en el Excel
const EXPECTED_FIELDS = [
    { dbName: 'idd', synonyms: ['idd', 'id', 'idd_val', 'key', 'index'] },
    { dbName: 'sondaje', synonyms: ['sondaje', 'sondaje diamantino', 'drillhole', 'hole', 'sondaje_diamantino', 'borehole'] },
    { dbName: 'codigo_muestra', synonyms: ['codigo de muestra', 'muestra', 'sample', 'codigo_muestra', 'sample_code'] },
    { dbName: 'desde', synonyms: ['desde', 'desde (m)', 'from', 'desde_m', 'depth_from'] },
    { dbName: 'hasta', synonyms: ['hasta', 'hasta (m)', 'to', 'hasta_m', 'depth_to'] },
    { dbName: 'laboratorio', synonyms: ['laboratorio', 'lab', 'laboratory'] },
    { dbName: 'proyecto', synonyms: ['proyecto', 'project'] }
];

const MODULE_GROUPS: Record<string, string> = {
    common: "Datos Comunes de Campo",
    ucs: "Compresión Uniaxial (UCS)",
    elasticas: "Constantes Elásticas",
    traccion: "Tracción Indirecta (Brasileño)",
    corte: "Corte Directo en Discontinuidades",
    triaxial: "Compresión Triaxial",
    propiedades: "Propiedades Físicas"
};

const CRITICAL_IMPORT_FIELDS = ['sondaje', 'desde', 'hasta', 'proyecto'];

export default function ExcelImportModal({ isOpen, onClose, onImport, apiBase, onDirectSaveComplete }: ExcelImportModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string>('');
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);

    const [rawGrid, setRawGrid] = useState<any[][] | null>(null);
    const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [mappings, setMappings] = useState<Record<string, number>>({});

    const [importedState, setImportedState] = useState<Record<string, any>[]>([]);
    const [importMode, setImportMode] = useState<'single' | 'all'>('single');
    const [selectedSondajes, setSelectedSondajes] = useState<string[]>([]);

    // Estado del Accordion para el mapeo lateral por secciones
    const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
        common: true,
        ucs: false,
        elasticas: false,
        traccion: false,
        corte: false,
        triaxial: false,
        propiedades: false
    });

    // Estados de Confirmaciones Internas
    const [showConfirmMasivo, setShowConfirmMasivo] = useState<boolean>(false);
    const [showSuccessOverlay, setShowSuccessOverlay] = useState<boolean>(false);
    const [successCount, setSuccessCount] = useState<number>(0);
    const [isParsingFile, setIsParsingFile] = useState<boolean>(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = () => {
        setFile(null);
        setSheets([]);
        setSelectedSheet('');
        setWorkbook(null);
        setRawGrid(null);
        setHeaderRowIdx(0);
        setExcelHeaders([]);
        setMappings({});
        setImportedState([]);
        setImportMode('single');
        setSelectedSondajes([]);
        setShowConfirmMasivo(false);
        setShowSuccessOverlay(false);
        setSuccessCount(0);
        setIsParsingFile(false);
        setOpenAccordions({
            common: true,
            ucs: false,
            elasticas: false,
            traccion: false,
            corte: false,
            triaxial: false,
            propiedades: false
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;
        loadWorkbook(selectedFile);
    };

    const loadWorkbook = (selectedFile: File) => {
        setFile(selectedFile);
        setIsParsingFile(true);
        const reader = new FileReader();
        reader.onload = (evt) => {
            setTimeout(() => {
                try {
                    const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                    const wb = XLSX.read(data, { type: 'array' });
                    setWorkbook(wb);
                    setSheets(wb.SheetNames);
                    setSelectedSheet(wb.SheetNames[0]);
                    processSheet(wb, wb.SheetNames[0]);
                } catch (err) {
                    alert("Error al parsear el libro de Excel.");
                    resetState();
                } finally {
                    setIsParsingFile(false);
                }
            }, 30);
        };
        reader.readAsArrayBuffer(selectedFile);
    };

    const processSheet = (wb: XLSX.WorkBook, sheetName: string) => {
        const ws = wb.Sheets[sheetName];
        if (!ws) return;
        const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];
        if (grid.length === 0) return;
        parseFlatTable(grid);
    };

    const normalize = (val: any): string => {
        if (val === null || val === undefined) return '';
        return String(val).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
    };

    const parseFlatTable = (grid: any[][]) => {
        setRawGrid(grid);
        let bestRowIdx = 0;
        let maxMatches = -1;
        const maxScan = Math.min(15, grid.length);

        for (let r = 0; r < maxScan; r++) {
            const row = grid[r];
            if (!row) continue;
            let matches = 0;
            const normalizedCells = row.map(c => normalize(c));

            EXPECTED_FIELDS.forEach(f => {
                const hasMatch = f.synonyms.some(s => normalizedCells.includes(normalize(s)));
                if (hasMatch) matches++;
            });

            if (matches > maxMatches) {
                maxMatches = matches;
                bestRowIdx = r;
            }
        }

        setHeaderRowIdx(bestRowIdx);
        const headerRow = grid[bestRowIdx] || [];
        setExcelHeaders(headerRow.map((h, i) => h ? `${XLSX.utils.encode_col(i)}: ${String(h).trim()}` : `${XLSX.utils.encode_col(i)}: [Vacío]`));

        const suggested: Record<string, number> = {};
        const normalizedHeaders = headerRow.map(h => normalize(h));
        const used = new Set<number>();

        COLUMNS_CONFIG.forEach(f => {
            const normExcel = normalize(f.excelName);
            const normDb = normalize(f.dbName);

            for (let i = 0; i < normalizedHeaders.length; i++) {
                if (used.has(i)) continue;
                const nh = normalizedHeaders[i];
                if (!nh) continue; // Omitir columnas vacías para evitar asignaciones accidentales

                if (nh === normExcel || nh === normDb) {
                    suggested[f.dbName] = i;
                    used.add(i);
                    break;
                }
            }
        });

        COLUMNS_CONFIG.forEach(f => {
            if (suggested[f.dbName] !== undefined) return;
            const normExcel = normalize(f.excelName);
            const normDb = normalize(f.dbName);

            for (let i = 0; i < normalizedHeaders.length; i++) {
                if (used.has(i)) continue;
                const nh = normalizedHeaders[i];
                if (!nh) continue; // Omitir columnas vacías para evitar asignaciones accidentales

                if (nh.includes(normExcel) || normExcel.includes(nh)) {
                    suggested[f.dbName] = i;
                    used.add(i);
                    break;
                }
            }
        });

        setMappings(suggested);
        runGrouping(grid, bestRowIdx, suggested);
    };

    const handleMappingChange = (dbName: string, colIdx: number) => {
        setMappings(prev => {
            const next = { ...prev };
            if (colIdx === -1) {
                delete next[dbName];
            } else {
                next[dbName] = colIdx;
            }
            if (rawGrid) {
                runGrouping(rawGrid, headerRowIdx, next);
            }
            return next;
        });
    };

    const runGrouping = (grid: any[][], headerRowIndex: number, currentMappings: Record<string, number>) => {
        const list: any[] = [];
        const getVal = (row: any[], dbName: string) => {
            const idx = currentMappings[dbName];
            return idx !== undefined ? row[idx] : undefined;
        };

        for (let r = headerRowIndex + 1; r < grid.length; r++) {
            const row = grid[r];
            if (!row || row.length === 0) continue;

            const sondaje = String(getVal(row, 'sondaje') || '').trim();
            if (!sondaje) continue;

            const record: Record<string, any> = { id: Date.now() + r };

            COLUMNS_CONFIG.forEach(c => {
                if (c.dbName === 'idd') {
                    const rawIdd = getVal(row, 'idd');
                    record.idd = Math.round(Number(clampValue('idd', rawIdd))) || r;
                    return;
                }
                const rawVal = getVal(row, c.dbName);
                record[c.dbName] = clampValue(c.dbName, rawVal);
            });

            // Respetar Código de muestra manual importado, sino autogenerar plantilla
            const excelSampleCode = getVal(row, 'codigo_muestra');
            record.codigo_muestra = excelSampleCode
                ? String(excelSampleCode).trim()
                : `${record.sondaje}-UCS-M${String(record.idd).padStart(2, '0')}`;

            // Cálculo automatizado de Longitud de muestra
            const desde = record.desde !== undefined && record.desde !== null && record.desde !== '' ? Number(record.desde) : null;
            const hasta = record.hasta !== undefined && record.hasta !== null && record.hasta !== '' ? Number(record.hasta) : null;
            record.longitud_muestra = (desde !== null && hasta !== null) ? parseFloat((hasta - desde).toFixed(2)) : '';

            list.push(record);
        }
        setImportedState(list);
    };

    const detectedSondajes = useMemo(() => {
        const map: Record<string, number> = {};
        importedState.forEach(row => {
            const sName = String(row.sondaje || "").trim();
            if (sName) {
                map[sName] = (map[sName] || 0) + 1;
            }
        });
        return Object.entries(map)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [importedState]);

    useEffect(() => {
        if (detectedSondajes.length > 0 && selectedSondajes.length === 0) {
            setSelectedSondajes([detectedSondajes[0].name]);
        }
    }, [detectedSondajes]);

    const handleAddSondaje = (name: string) => {
        if (name && !selectedSondajes.includes(name)) {
            setSelectedSondajes(prev => [...prev, name]);
        }
    };

    const handleRemoveSondaje = (name: string) => {
        setSelectedSondajes(prev => prev.filter(s => s !== name));
    };

    const rowsToImport = useMemo(() => {
        if (importMode === 'single') {
            return importedState.filter(r => selectedSondajes.includes(String(r.sondaje).trim()));
        }
        return importedState;
    }, [importMode, selectedSondajes, importedState]);

    const showPerfWarning = importMode === 'all' && importedState.length > 500;

    const toggleAccordion = (key: string) => {
        setOpenAccordions(prev => ({ ...prev, [key]: !prev[key] }));
    };



    const handleImportClick = () => {
        if (rowsToImport.length === 0) return;
        if (rowsToImport.length > 500) {
            setShowConfirmMasivo(true);
        } else {
            triggerActualImport();
        }
    };

    const triggerActualImport = () => {
        onImport(rowsToImport);
        setSuccessCount(rowsToImport.length);
        setShowSuccessOverlay(true);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 view-modal z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left">
            <div className="glass-panel w-full max-w-5xl max-h-[90vh] flex flex-col border border-navy-800 rounded-2xl shadow-2xl relative overflow-hidden bg-navy-900/95 text-xs text-slate-100">
                <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 w-full shrink-0" />

                <div className="flex justify-between items-center px-6 py-4 border-b border-navy-800/80 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                            <FileSpreadsheet size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-100 uppercase tracking-wider">Importación de Ensayos Especiales</h3>
                            <p className="text-xs text-slate-400 font-medium">Asignación paramétrica avanzada y pre-validación de datos consistente</p>
                        </div>
                    </div>
                    <button onClick={() => { onClose(); resetState(); }} className="p-1.5 rounded-lg hover:bg-navy-800 text-slate-400 hover:text-slate-200 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {!file ? (
                        <div
                            onClick={() => !isParsingFile && fileInputRef.current?.click()}
                            className="border-2 border-dashed border-navy-800 hover:border-emerald-500/40 bg-navy-950/45 hover:bg-navy-950/70 rounded-xl p-10 text-center cursor-pointer transition-all space-y-4 group"
                        >
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" className="hidden" disabled={isParsingFile} />
                            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                                {isParsingFile ? (
                                    <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
                                ) : (
                                    <Upload size={22} />
                                )}
                            </div>
                            <p className="text-sm font-bold text-slate-200">{isParsingFile ? "Leyendo y analizando planilla Excel..." : "Arrastra tu planilla de Ensayos aquí o haz clic para explorar"}</p>
                            <p className="text-xs text-slate-500 font-mono">{isParsingFile ? "Detectando cabeceras y mapeando columnas..." : "Soporta planillas .xlsx y .xls masivas (+9,000 registros)"}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Panel Lateral: Mapeo agrupado por Acordeones */}
                            <div className="lg:col-span-1 glass-panel p-4 rounded-xl border border-navy-800 space-y-3 max-h-[60vh] overflow-y-auto bg-navy-950/40 custom-scrollbar">
                                <div className="flex items-center gap-2 text-emerald-400 border-b border-navy-800 pb-2">
                                    <Filter size={16} />
                                    <h4 className="text-xs font-black uppercase tracking-wider">Mapear Base de Datos</h4>
                                </div>
                                <div className="space-y-2">
                                    {Object.entries(MODULE_GROUPS).map(([modKey, modLabel]) => {
                                        const modCols = COLUMNS_CONFIG.filter(c => c.module === modKey && c.dbName !== 'idd');
                                        if (modCols.length === 0) return null;

                                        const isOpenSection = openAccordions[modKey];
                                        return (
                                            <div key={modKey} className="border border-navy-850 rounded-lg overflow-hidden bg-navy-950/25">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAccordion(modKey)}
                                                    className="w-full flex items-center justify-between p-2.5 bg-navy-950/50 hover:bg-navy-900/40 transition-colors text-[10px] font-black uppercase tracking-wider text-slate-300"
                                                >
                                                    <span>{modLabel}</span>
                                                    {isOpenSection ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                </button>
                                                {isOpenSection && (
                                                    <div className="p-2.5 space-y-3.5 bg-navy-950/10 border-t border-navy-850">
                                                        {modCols.map(f => {
                                                            const colIdx = mappings[f.dbName];
                                                            const isCritical = CRITICAL_IMPORT_FIELDS.includes(f.dbName);
                                                            return (
                                                                <div key={f.dbName} className="space-y-1 text-left">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="font-semibold text-slate-300">
                                                                            {f.excelName} {isCritical && <span className="text-red-400">*</span>}
                                                                        </span>
                                                                        {colIdx !== undefined ? (
                                                                            <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Mapeado</span>
                                                                        ) : isCritical ? (
                                                                            <span className="text-[9px] text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Requerido</span>
                                                                        ) : (
                                                                            <span className="text-[9px] text-slate-500 font-bold bg-slate-500/10 px-1.5 py-0.5 rounded border border-slate-500/20">Opcional</span>
                                                                        )}
                                                                    </div>
                                                                    <select
                                                                        value={colIdx ?? -1}
                                                                        onChange={(e) => handleMappingChange(f.dbName, parseInt(e.target.value))}
                                                                        className="w-full bg-navy-900 border text-xs rounded-lg px-2 py-1.5 focus:outline-none border-navy-800 text-slate-400 font-semibold"
                                                                    >
                                                                        <option value={-1}>— No Asignado —</option>
                                                                        {excelHeaders.map((eh, idx) => (
                                                                            <option key={idx} value={idx}>{eh}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Panel Principal: Visualización previa y filtros */}
                            <div className="lg:col-span-2 space-y-4 animate-fade-in">
                                {importedState.length > 0 && (
                                    <div className="space-y-3 bg-navy-950/20 border border-navy-850 p-4 rounded-xl">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Opciones de Filtrado de Sondajes:</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                                            {/* Selección de Uno o Varios Sondajes */}
                                            <button
                                                type="button"
                                                onClick={() => setImportMode('single')}
                                                className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${importMode === 'single'
                                                    ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-400 font-bold shadow-md shadow-emerald-500/5'
                                                    : 'bg-navy-950/40 border-navy-800 text-slate-400 hover:bg-navy-900/40'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-center w-full">
                                                    <span className="text-xs uppercase font-extrabold tracking-wider">Sondajes Seleccionados</span>
                                                    {importMode === 'single' && <Check size={14} className="text-emerald-400" />}
                                                </div>
                                                <p className="text-[10px] text-slate-500 leading-normal">
                                                    Importar únicamente los registros asociados a los sondajes marcados a continuación.
                                                </p>

                                                {importMode === 'single' && detectedSondajes.length > 0 && (
                                                    <div className="mt-3 space-y-2.5 w-full" onClick={e => e.stopPropagation()}>
                                                        <select
                                                            onChange={e => {
                                                                handleAddSondaje(e.target.value);
                                                                e.target.value = "";
                                                            }}
                                                            defaultValue=""
                                                            className="bg-navy-900 border border-navy-800 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none text-[11px] w-full cursor-pointer font-bold"
                                                        >
                                                            <option value="" disabled>— Seleccionar Sondaje para Agregar —</option>
                                                            {detectedSondajes.map(s => (
                                                                <option
                                                                    key={s.name}
                                                                    value={s.name}
                                                                    className="bg-navy-950 text-slate-300"
                                                                    disabled={selectedSondajes.includes(s.name)}
                                                                >
                                                                    {s.name} ({s.count} filas)
                                                                </option>
                                                            ))}
                                                        </select>

                                                        {/* Lista de Sondajes Seleccionados con Botón de Eliminar */}
                                                        {selectedSondajes.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1.5 bg-navy-950/40 p-2.5 rounded-lg border border-navy-850 max-h-[100px] overflow-y-auto custom-scrollbar">
                                                                {selectedSondajes.map(sName => {
                                                                    const match = detectedSondajes.find(ds => ds.name === sName);
                                                                    return (
                                                                        <span
                                                                            key={sName}
                                                                            className="flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/35 px-2.5 py-1 rounded-lg text-[10px] font-bold"
                                                                        >
                                                                            <span>{sName} ({match?.count || 0} filas)</span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleRemoveSondaje(sName)}
                                                                                className="text-slate-400 hover:text-rose-400 transition-colors focus:outline-none"
                                                                            >
                                                                                <X size={11} className="stroke-[2.5]" />
                                                                            </button>
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] text-rose-400 font-semibold italic pl-1 flex items-center gap-1">
                                                                <AlertTriangle size={12} className="shrink-0" />
                                                                <span>Seleccione al menos un sondaje para importar.</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setImportMode('all')}
                                                className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${importMode === 'all'
                                                    ? 'bg-orange-500/10 border-orange-500/35 text-orange-400 font-bold shadow-md shadow-orange-500/5'
                                                    : 'bg-navy-950/40 border-navy-800 text-slate-400 hover:bg-navy-900/40'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-center w-full">
                                                    <span className="text-xs uppercase font-extrabold tracking-wider">Planilla Completa</span>
                                                    {importMode === 'all' && <Check size={14} className="text-orange-400" />}
                                                </div>
                                                <p className="text-[10px] text-slate-500 leading-normal">
                                                    Importar todos los sondajes detectados sin discriminación.
                                                </p>
                                                <span className="text-[10px] mt-2 bg-orange-500/20 border border-orange-500/35 px-2.5 py-0.5 rounded-full w-fit font-black font-mono">
                                                    {importedState.length} registros totales
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {showPerfWarning && (
                                    <div className="flex gap-3 p-3 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg text-xs leading-relaxed animate-pulse">
                                        <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={16} />
                                        <div>
                                            <span className="font-black uppercase tracking-wider text-[9px] block mb-0.5">Alerta de Rendimiento:</span>
                                            El archivo tiene <strong className="text-white font-mono">{importedState.length}</strong> registros. Importar todo de golpe ralentizará la base de datos de React. Se aconseja filtrar por sondaje.
                                        </div>
                                    </div>
                                )}

                                {rowsToImport.length > 0 && (
                                    <div className="space-y-2 animate-fade-in">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Vista Previa Filtrada ({importMode === 'single' ? `${selectedSondajes.length} sondajes` : 'Todo'} — Primeras 5 Filas):</h4>
                                        <div className="overflow-x-auto border border-navy-850 rounded-lg">
                                            <table className="w-full text-xs text-left border-collapse text-slate-300">
                                                <thead>
                                                    <tr className="bg-navy-950 text-slate-400 font-semibold border-b border-navy-850 text-[10px] uppercase">
                                                        <th className="py-2 px-3 border-r border-navy-850">IDD</th>
                                                        <th className="py-2 px-3 border-r border-navy-850">Sondaje</th>
                                                        <th className="py-2 px-3 border-r border-navy-850">Muestra</th>
                                                        <th className="py-2 px-3">Proyecto</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rowsToImport.slice(0, 5).map((row, i) => (
                                                        <tr key={i} className="border-b border-navy-900/40 bg-navy-900/10">
                                                            <td className="py-2 px-3 font-semibold text-slate-200 border-r border-navy-900/20">{row.idd}</td>
                                                            <td className="py-2 px-3 border-r border-navy-900/20 font-bold text-orange-400">{row.sondaje}</td>
                                                            <td className="py-2 px-3 font-bold text-indigo-400 border-r border-navy-900/20">{row.codigo_muestra}</td>
                                                            <td className="py-2 px-3">{row.proyecto}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 justify-end px-6 py-4 border-t border-navy-800/80 shrink-0 bg-navy-950/40">
                    <button type="button" onClick={() => { onClose(); resetState(); }} className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 px-4 py-2 rounded-lg text-xs font-semibold">
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleImportClick}
                        disabled={rowsToImport.length === 0}
                        className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 hover:text-white px-5 py-2 rounded-lg text-xs font-black flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10 transition-all"
                        title="Carga los registros en la grilla para revisión antes de guardar"
                    >
                        <FileSpreadsheet size={14} className="text-emerald-400" />
                        <span>Cargar en Grilla ({rowsToImport.length.toLocaleString()})</span>
                    </button>
                </div>

                {showConfirmMasivo && (
                    <div className="absolute inset-0 z-40 bg-navy-950/85 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
                        <div className="glass-panel w-full max-w-sm p-6 rounded-2xl border border-navy-800 bg-navy-900/95 shadow-2xl space-y-4 text-center">
                            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full w-12 h-12 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(244,63,94,0.1)]">
                                <AlertTriangle size={20} />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider">Carga Volumétrica Masiva</h4>
                                <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                                    Vas a procesar <span className="text-rose-400 font-bold font-mono">{rowsToImport.length}</span> registros de un solo golpe.
                                    Cargar planillas muy masivas de una sola vez puede congelar temporalmente el navegador.
                                </p>
                            </div>
                            <div className="flex gap-2 justify-center pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmMasivo(false)}
                                    className="bg-navy-950 border border-navy-800 hover:bg-navy-900 text-slate-400 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                                >
                                    Atrás
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowConfirmMasivo(false);
                                        triggerActualImport();
                                    }}
                                    className="bg-rose-500/15 border border-rose-500/30 hover:bg-rose-500/25 text-rose-400 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all"
                                >
                                    Confirmar Ingesta
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showSuccessOverlay && (
                    <div className="absolute inset-0 z-50 bg-navy-950/90 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
                        <div className="glass-panel w-full max-w-sm p-6 rounded-2xl border border-navy-800 bg-navy-900/95 shadow-2xl space-y-4 text-center">
                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full w-12 h-12 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                                <CheckCircle2 size={22} className="animate-scale-up" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider">Importación Completada</h4>
                                <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                                    Se han ingresado con éxito <span className="text-emerald-400 font-bold font-mono">{successCount}</span> nuevos registros geotécnicos especiales.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    resetState();
                                }}
                                className="w-full bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/25 text-emerald-400 py-2 rounded-lg text-xs font-black transition-all"
                            >
                                Finalizar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}