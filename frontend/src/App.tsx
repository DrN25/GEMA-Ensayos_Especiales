import { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import DistribucionModulos from './components/DistribucionModulos';
import GeotechPage from './components/GeotechPage';
import ProyectosPage from './components/ProyectosPage';
import Reportes from './components/Reportes';
import ValidationPanel from './components/ValidationPanel';
import NotificationItem from './components/NotificationItem';
import ExcelImportModal from './components/ExcelImportModal';
import ExcelExportModal from './components/ExcelExportModal';
import CatalogsModal from './components/CatalogsModal';
import BulkAuditor from './features/auditor/BulkAuditor';

import { validateAllRecords, type QAQCAlert } from './utils/qaqcValidator';
import { getColumnsForModule } from './utils/columnsConfig';


const API_BASE = import.meta.env.VITE_API_BASE || "";

interface NotificationMsg {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

interface Proyecto {
  id?: number;
  nombre: string;
  sinonimos?: string;
}

export default function App() {
  // --- 1. ESTADOS DE CONTROL PRINCIPALES ---
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [history, setHistory] = useState<string[]>(['dashboard']);
  const [records, setRecords] = useState<Record<string, any>[]>([]);
  const [lastSavedRecords, setLastSavedRecords] = useState<Record<string, any>[]>([]);

  // Paginación y búsqueda Server-Side
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [lastSavedProyectos, setLastSavedProyectos] = useState<Proyecto[]>([]);

  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Estados de Modales
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);

  // Modal interactivo de proyectos no registrados al importar
  const [unrecognizedProjectModal, setUnrecognizedProjectModal] = useState<{ isOpen: boolean, tempRecords: any[], value: string } | null>(null);

  const [highlightedCell, setHighlightedCell] = useState<{ idd: number; field: string } | null>(null);
  const [notifications, setNotifications] = useState<NotificationMsg[]>([]);

  // Estados de conectividad y guardado
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<'synced' | 'unsaved' | 'error' | 'saving'>('synced');
  const [proyectosSaveStatus, setProyectosSaveStatus] = useState<'synced' | 'unsaved' | 'error' | 'saving'>('synced');
  const [dbInfo, setDbInfo] = useState<{ db_type: string; is_local_fallback: boolean; server?: string } | null>(null);

  const qaqcAlerts = useMemo(() => {
    return validateAllRecords(records);
  }, [records]);

  // --- 2. EFECTOS GLOBALES Y CONFIGURACIONES ---
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Bloqueo de traducción automática y Scroll de rueda del mouse en inputs
  useEffect(() => {
    document.documentElement.setAttribute('lang', 'es');
    document.documentElement.classList.add('notranslate');

    const handleWheel = (e: WheelEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT')) {
        (activeEl as HTMLElement).blur();
      }
    };
    document.addEventListener('wheel', handleWheel, { passive: true });
    return () => document.removeEventListener('wheel', handleWheel);
  }, []);

  const loadEnsayos = async (p = 1, ps = pageSize, q = searchQuery, tab = currentTab) => {
    try {
      const params = new URLSearchParams({
        page: String(p),
        page_size: String(ps),
      });
      if (q && q.trim()) params.append('q', q.trim());
      const testModules = ['ucs', 'elasticas', 'traccion', 'corte', 'triaxial', 'propiedades'];
      if (testModules.includes(tab)) {
        params.append('tipo_ensayo', tab);
      }
      const res = await fetch(`${API_BASE}/api/ensayos?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.items || []);
        setLastSavedRecords(JSON.parse(JSON.stringify(data.items || [])));
        setTotalPages(data.total_pages || 1);
        setTotalRecords(data.total_filtered || 0);
        setPage(data.page || 1);
        setSaveStatus('synced');
      }
    } catch (e) {
      console.warn("Fallo al cargar ensayos paginados", e);
    }
  };

  // Carga inicial de datos
  useEffect(() => {
    fetch(`${API_BASE}/api/db-status`)
      .then(res => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then(dbStatus => {
        setIsConnected(true);
        setDbInfo(dbStatus);

        // Cargar registros paginados
        loadEnsayos(1, 50, '', 'dashboard');

        // Cargar proyectos
        fetch(`${API_BASE}/api/proyectos`)
          .then(res => res.json())
          .then(data => {
            setProyectos(data);
            setLastSavedProyectos(JSON.parse(JSON.stringify(data)));
          });
      })
      .catch(() => {
        setIsConnected(false);
        setDbInfo({ db_type: "Offline", is_local_fallback: true });

        const cached = localStorage.getItem('sigeg_records_v2');
        if (cached) {
          const parsed = JSON.parse(cached);
          setRecords(parsed);
          setLastSavedRecords(JSON.parse(JSON.stringify(parsed)));
        }
        triggerNotification("Modo Offline", "Sin conexión con la API backend. Se trabajará de manera local.", "warning");
      });
  }, []);

  // Detectar cambios en registros
  useEffect(() => {
    if (saveStatus === 'saving') return;
    const hasChanges = JSON.stringify(records) !== JSON.stringify(lastSavedRecords);
    setSaveStatus(hasChanges ? 'unsaved' : 'synced');
  }, [records, lastSavedRecords]);

  // Detectar cambios en proyectos
  useEffect(() => {
    if (proyectosSaveStatus === 'saving') return;
    const hasChanges = JSON.stringify(proyectos) !== JSON.stringify(lastSavedProyectos);
    setProyectosSaveStatus(hasChanges ? 'unsaved' : 'synced');
  }, [proyectos, lastSavedProyectos]);

  // Notificar explícitamente al usuario qué base de datos está activa realmente
  useEffect(() => {
    if (isConnected && dbInfo) {
      if (dbInfo.is_local_fallback) {
        triggerNotification("Modo Local (SQLite)", "No se pudo conectar a SQL Server. El backend activó SQLite local automáticamente.", "warning");
      } else {
        triggerNotification("SQL Server Conectado", `Enlace de datos activo con: ${dbInfo.server}`, "success");
      }
    }
  }, [isConnected, dbInfo]);

  // --- 3. ACCIONES Y SINCRONIZACIÓN EN CALIENTE ---

  const triggerNotification = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setNotifications(prev => [...prev, { id: Date.now() + Math.random(), type, title, message }]);
  };

  const handleCloseNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const navigateToTab = (tabName: string) => {
    if (currentTab === tabName) return;
    setHistory(prev => [...prev, tabName]);
    setCurrentTab(tabName);
    const testModules = ['registro_maestro', 'ucs', 'elasticas', 'traccion', 'corte', 'triaxial', 'propiedades'];
    if (testModules.includes(tabName)) {
      setPage(1);
      loadEnsayos(1, pageSize, searchQuery, tabName);
    }
  };

  const handleBack = () => {
    if (history.length > 1) {
      const copy = [...history];
      copy.pop();
      const prev = copy[copy.length - 1];
      setHistory(copy);
      setCurrentTab(prev);
    }
  };

  const handleFocusField = (idd: number, field: string, tab: string) => {
    navigateToTab(tab);
    setTimeout(() => {
      setHighlightedCell({ idd, field });
    }, 150);
  };

  // INTERCEPTOR DE ACTUALIZACIÓN EN CALIENTE DE PROYECTOS (Frontend)
  const handleUpdateProyecto = (index: number, field: keyof Proyecto, value: string) => {
    const oldProject = proyectos[index];
    const newName = value.trim();

    // Si se está cambiando el nombre de un proyecto, actualizamos reactivamente todos los registros
    if (field === 'nombre' && oldProject && oldProject.nombre !== newName) {
      const oldName = oldProject.nombre;
      setRecords(prevRecords =>
        prevRecords.map(r => r.proyecto === oldName ? { ...r, proyecto: newName } : r)
      );
    }

    setProyectos(prev => prev.map((p, idx) => {
      if (idx !== index) return p;
      return { ...p, [field]: value };
    }));
  };

  // INTERCEPTOR DE ELIMINACIÓN EN CALIENTE DE PROYECTOS (Frontend)
  const handleDeleteProyecto = (index: number) => {
    const projectToDelete = proyectos[index];
    if (projectToDelete) {
      const deletedName = projectToDelete.nombre;

      // Limpiar reactivamente el campo 'proyecto' de todos los registros en memoria para evitar huérfanos
      setRecords(prevRecords =>
        prevRecords.map(r => r.proyecto === deletedName ? { ...r, proyecto: '' } : r)
      );
    }
    setProyectos(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleAddProyecto = () => {
    setProyectos(prev => [...prev, { nombre: '', sinonimos: '' }]);
  };

  const handleImportExcel = (importedData: Record<string, any>[]) => {
    let unmappedValue = '';
    const mapped = importedData.map(row => {
      const excelProj = String(row.proyecto || "").trim().toUpperCase();
      if (!excelProj) return row;

      const match = proyectos.find(p =>
        p.nombre.toUpperCase() === excelProj ||
        (p.sinonimos || '').toUpperCase().split(',').map(s => s.trim()).includes(excel_norm(excelProj))
      );

      if (match) {
        return { ...row, proyecto: match.nombre };
      } else {
        unmappedValue = row.proyecto;
        return row;
      }
    });

    if (unmappedValue) {
      setUnrecognizedProjectModal({
        isOpen: true,
        tempRecords: mapped,
        value: unmappedValue
      });
    } else {
      setRecords(prev => [...prev, ...mapped]);
      triggerNotification("Importación Exitosa", `Se han cargado ${importedData.length} registros geotécnicos.`, "success");
    }
  };

  const excel_norm = (val: string): string => {
    return val.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const handleResolveUnrecognized = async (action: 'empty' | 'associate' | 'create', selectedName?: string) => {
    if (!unrecognizedProjectModal) return;
    const { tempRecords, value } = unrecognizedProjectModal;

    let resolvedRecords = [...tempRecords];

    if (action === 'empty') {
      resolvedRecords = tempRecords.map(r => r.proyecto === value ? { ...r, proyecto: '' } : r);
      setRecords(prev => [...prev, ...resolvedRecords]);
      triggerNotification("Sincronización de Importación", "Los registros sin proyecto coincidente han sido inyectados vacíos.", "info");
    }
    else if (action === 'associate' && selectedName) {
      resolvedRecords = tempRecords.map(r => r.proyecto === value ? { ...r, proyecto: selectedName } : r);
      setRecords(prev => [...prev, ...resolvedRecords]);
      triggerNotification("Asociación de Importación", `Registros mapeados exitosamente al proyecto ${selectedName}.`, "success");
    }
    else if (action === 'create') {
      const newProj: Proyecto = { nombre: value.toUpperCase(), sinonimos: value.toUpperCase() };
      setProyectos(prev => [...prev, newProj]);
      resolvedRecords = tempRecords.map(r => r.proyecto === value ? { ...r, proyecto: newProj.nombre } : r);
      setRecords(prev => [...prev, ...resolvedRecords]);
      triggerNotification("Maestro Actualizado", `Se ha inyectado un nuevo proyecto '${newProj.nombre}' al maestro de SIGEG.`, "success");
    }

    setUnrecognizedProjectModal(null);
  };

  const handleSaveAll = async () => {
    if (qaqcAlerts.length > 0) {
      triggerNotification("Bloqueado", "No se puede guardar porque existen alertas de validación críticas.", "error");
      return;
    }
    setSaveStatus('saving');
    try {
      const res = await fetch(`${API_BASE}/api/ensayos/batch-upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records)
      });
      if (res.ok) {
        localStorage.setItem('sigeg_records_v2', JSON.stringify(records));
        setLastSavedRecords(JSON.parse(JSON.stringify(records)));
        setSaveStatus('synced');
        triggerNotification("Guardado Exitoso", "Registros sincronizados con éxito en SQL Server.", "success");
      } else {
        throw new Error();
      }
    } catch {
      localStorage.setItem('sigeg_records_v2', JSON.stringify(records));
      setLastSavedRecords(JSON.parse(JSON.stringify(records)));
      setSaveStatus('error');
      triggerNotification("Guardado Local", "Sincronización fallida. Cambios guardados de forma local.", "warning");
    }
  };

  const handleSaveSpecific = async (tabKey: string) => {
    if (qaqcAlerts.some(a => a.tab === tabKey && a.type === 'CRÍTICO')) {
      triggerNotification("Bloqueado", `No se puede guardar porque existen alertas críticas de QA/QC en el módulo ${tabKey.replace('_', ' ').toUpperCase()}.`, "error");
      return;
    }
    setSaveStatus('saving');

    const moduleCols = getColumnsForModule(tabKey);

    // Mapear los registros combinando únicamente las columnas del módulo modificado
    const recordsToSend = lastSavedRecords.map((lastRec) => {
      const currentRec = records.find(r => r.idd === lastRec.idd);
      if (!currentRec) return lastRec;

      const mergedRec = { ...lastRec };
      moduleCols.forEach(col => {
        mergedRec[col.dbName] = currentRec[col.dbName];
      });
      return mergedRec;
    });

    // Añadir filas completamente nuevas respetando únicamente las columnas comunes y del módulo activo
    const newRecords = records.filter(r => !lastSavedRecords.some(lr => lr.idd === r.idd));
    const newRecordsCleaned = newRecords.map(r => {
      const cleaned: Record<string, any> = { idd: r.idd };
      moduleCols.forEach(col => {
        cleaned[col.dbName] = r[col.dbName];
      });
      return cleaned;
    });

    const fullMergedList = [...recordsToSend, ...newRecordsCleaned];

    try {
      const res = await fetch(`${API_BASE}/api/ensayos/batch-upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullMergedList)
      });
      if (res.ok) {
        setLastSavedRecords(prevLastSaved => {
          return prevLastSaved.map(lastRec => {
            const currentRec = records.find(r => r.idd === lastRec.idd);
            if (!currentRec) return lastRec;
            const updated = { ...lastRec };
            moduleCols.forEach(col => {
              updated[col.dbName] = currentRec[col.dbName];
            });
            return updated;
          }).concat(newRecordsCleaned);
        });
        setSaveStatus('synced');
        triggerNotification("Guardado Segmentado", `Los cambios del módulo ${tabKey.replace('_', ' ').toUpperCase()} se han sincronizado correctamente.`, "success");
      } else {
        throw new Error();
      }
    } catch {
      setSaveStatus('error');
      triggerNotification("Error de Conexión", `Sincronización fallida. Los cambios del módulo ${tabKey.replace('_', ' ').toUpperCase()} se mantendrán de forma local.`, "warning");
    }
  };

  const handleSaveProyectos = async () => {
    setProyectosSaveStatus('saving');
    try {
      const res = await fetch(`${API_BASE}/api/proyectos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proyectos)
      });
      if (res.ok) {
        setLastSavedProyectos(JSON.parse(JSON.stringify(proyectos)));
        setProyectosSaveStatus('synced');
        triggerNotification("Maestros Actualizados", "La tabla de Proyectos se ha sincronizado con SQL Server.", "success");
      } else {
        throw new Error();
      }
    } catch {
      setProyectosSaveStatus('error');
      triggerNotification("Error de Sincronización", "No se pudo sincronizar Proyectos con SQL Server.", "error");
    }
  };

  const handleReconnect = async () => {
    fetch(`${API_BASE}/api/db-status`)
      .then(res => res.json())
      .then(dbStatus => {
        setIsConnected(true);
        setDbInfo(dbStatus);
        triggerNotification("Restablecido", "Enlace activo con SQL Server.", "success");
      })
      .catch(() => {
        triggerNotification("Error de Conexión", "SQL Server sigue inalcanzable.", "error");
      });
  };

  const checkModuleModified = (tabKey: string): boolean => {
    if (tabKey === 'dashboard' || tabKey === 'reportes') return false;

    const moduleCols = getColumnsForModule(tabKey);
    if (records.length !== lastSavedRecords.length) return true;

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      const lastRec = lastSavedRecords[i];
      if (!lastRec) return true;

      for (const col of moduleCols) {
        if (rec[col.dbName] !== lastRec[col.dbName]) {
          return true;
        }
      }
    }
    return false;
  };

  const qaqcAlertsCount = useMemo(() => {
    return qaqcAlerts.length;
  }, [qaqcAlerts]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* 1. SIDEBAR */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={navigateToTab}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        isConnected={isConnected}
        dbInfo={dbInfo}
        isCollapsed={isSidebarCollapsed}
      />

      {/* 2. MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative transition-all duration-300 ease-in-out">
        <TopBar
          currentTab={currentTab}
          setCurrentTab={navigateToTab}
          onBack={handleBack}
          canGoBack={history.length > 1}
          onOpenCatalogs={() => setIsCatalogModalOpen(true)}
          onSaveAll={currentTab === 'proyectos' ? handleSaveProyectos : handleSaveAll}
          onSaveSpecific={handleSaveSpecific}
          onReconnect={handleReconnect}
          isConnected={isConnected}
          saveStatus={currentTab === 'proyectos' ? proyectosSaveStatus : saveStatus}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          hasAlerts={qaqcAlertsCount > 0}
          checkModuleModified={checkModuleModified}
        />

        {/* CONTENEDOR DE PAGINAS */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {currentTab === 'dashboard' && (
            <Dashboard
              records={records}
              alertsCount={qaqcAlertsCount}
              onNavigateTab={navigateToTab}
            />
          )}

          {currentTab === 'distribucion' && (
            <DistribucionModulos
              records={records}
              qaqcAlerts={qaqcAlerts}
              onNavigateTab={navigateToTab}
            />
          )}

          {['registro_maestro', 'ucs', 'elasticas', 'traccion', 'corte', 'triaxial', 'propiedades'].includes(currentTab) && (
            <GeotechPage
              moduleName={currentTab}
              records={records}
              setRecords={setRecords}
              qaqcAlerts={qaqcAlerts}
              onOpenImport={() => setIsImportModalOpen(true)}
              onOpenExport={() => setIsExportModalOpen(true)}
              onValidate={handleSaveAll}
              highlightedCell={highlightedCell}
              clearHighlight={() => setHighlightedCell(null)}
              onFocusField={handleFocusField}
              proyectosList={proyectos}
              page={page}
              pageSize={pageSize}
              totalPages={totalPages}
              totalRecords={totalRecords}
              onPageChange={(newPage) => {
                setPage(newPage);
                loadEnsayos(newPage, pageSize, searchQuery, currentTab);
              }}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
                loadEnsayos(1, newSize, searchQuery, currentTab);
              }}
              onSearchServer={(q) => {
                setSearchQuery(q);
                setPage(1);
                loadEnsayos(1, pageSize, q, currentTab);
              }}
            />
          )}

          {currentTab === 'auditoria' && (
            <BulkAuditor
              apiBase={API_BASE}
              onAuditSynced={() => loadEnsayos(page, pageSize, searchQuery, currentTab)}
            />
          )}

          {currentTab === 'proyectos' && (
            <ProyectosPage
              proyectos={proyectos}
              onUpdateProyecto={handleUpdateProyecto}
              onDeleteProyecto={handleDeleteProyecto}
              onAddProyecto={handleAddProyecto}
              onSaveProyectos={handleSaveProyectos}
              syncStatus={proyectosSaveStatus}
            />
          )}

          {currentTab === 'reportes' && (
            <Reportes
              records={records}
              alertsCount={qaqcAlertsCount}
            />
          )}
        </main>

        {/* 3. ALERTA QA/QC FLOATING CHATBOT PANEL */}
        {qaqcAlertsCount > 0 && (
          <ValidationPanel
            alerts={qaqcAlerts}
            onFocusField={handleFocusField}
          />
        )}
      </div>

      {/* 4. COMPONENTE DE NOTIFICACIÓN EMERGENTE */}
      <div className="fixed top-20 right-6 z-50 flex flex-col gap-3 pointer-events-none w-80 sm:w-96 max-w-sm">
        {notifications.slice(0, 3).map((n) => (
          <NotificationItem
            key={n.id}
            id={n.id}
            type={n.type}
            title={n.title}
            message={n.message}
            onClose={handleCloseNotification}
          />
        ))}
      </div>

      {/* MODAL DECISORIO DE PROYECTOS NO DETECTADOS AL IMPORTAR */}
      {unrecognizedProjectModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-amber-500/30 bg-navy-900/95 shadow-2xl space-y-4">
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">Proyecto No Reconocido</h3>
            <p className="text-xs text-slate-300">
              El proyecto <strong className="text-amber-400 font-mono">'{unrecognizedProjectModal.value}'</strong> detectado en el archivo Excel no se encuentra en la base de datos oficial de SIGEG.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => handleResolveUnrecognized('empty')}
                className="w-full text-left p-3 rounded-lg bg-navy-950 border border-navy-800 text-xs font-semibold text-slate-300 hover:bg-navy-850 hover:text-white transition-colors"
              >
                1. Importar registros con el campo Proyecto vacío.
              </button>

              <div className="p-3 rounded-lg bg-navy-950 border border-navy-800 space-y-2">
                <span className="text-xs font-semibold text-slate-400">2. Asociar a un proyecto activo de la lista:</span>
                <select
                  onChange={(e) => handleResolveUnrecognized('associate', e.target.value)}
                  defaultValue=""
                  className="w-full bg-navy-900 border border-navy-850 text-xs rounded px-2.5 py-1 text-slate-200 outline-none"
                >
                  <option value="" disabled>— Seleccionar Proyecto —</option>
                  {proyectos.map((p) => (
                    <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => handleResolveUnrecognized('create')}
                className="w-full text-left p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/15 transition-colors"
              >
                3. Crear '{unrecognizedProjectModal.value.toUpperCase()}' como nuevo proyecto en SIGEG.
              </button>
            </div>
          </div>
        </div>
      )}

      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportExcel}
      />

      <ExcelExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        records={records}
        currentTab={currentTab}
      />

      <CatalogsModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
      />
    </div>
  );
}