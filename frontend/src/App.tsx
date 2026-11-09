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
import { SaveBlockingModal } from './components/SaveBlockingModal';
import { IdCollisionModal } from './components/IdCollisionModal';
import { SAVE_BLOCKING_POLICY, evaluateSaveBlocking } from './config/savePolicy';
import { resolveIdCollisions, type IdCollision } from './utils/idCollisionResolver';

import { validateAllRecords, type QAQCAlert } from './utils/qaqcValidator';
import { getColumnsForModule } from './utils/columnsConfig';
import { getStoredDarkMode, persistTheme } from './utils/theme';
import { getGridVersion } from './features/grid/flags';
import { useGridStore } from './features/grid/gridStore';


const API_BASE = import.meta.env.VITE_API_BASE || (
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? `${window.location.protocol}//${window.location.hostname}:8002`
    : ''
);

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
  const isV2 = getGridVersion() === 'v2';
  const gridDirtyCount = useGridStore(s => s.dirtyRowIds.size);
  const gridDeletedCount = useGridStore(s => s.deletedRowIds.size);
  const gridDataVersion = useGridStore(s => s.dataVersion);
  const [records, setRecords] = useState<Record<string, any>[]>([]);
  const [lastSavedRecords, setLastSavedRecords] = useState<Record<string, any>[]>([]);

  // Paginación y búsqueda Server-Side
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFetchingEnsayos, setIsFetchingEnsayos] = useState<boolean>(false);
  const [hasUnsavedImport, setHasUnsavedImport] = useState<boolean>(false);
  const [pendingDeleteIdds, setPendingDeleteIdds] = useState<number[]>([]);

  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [lastSavedProyectos, setLastSavedProyectos] = useState<Proyecto[]>([]);

  const [darkMode, setDarkMode] = useState<boolean>(() => getStoredDarkMode());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Estados de Modales
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);

  // Modal interactivo de proyectos no registrados al importar
  const [unrecognizedProjectModal, setUnrecognizedProjectModal] = useState<{ isOpen: boolean, tempRecords: any[], value: string } | null>(null);

  // Modales de colisiones de IDD y bloqueo de guardado configurable
  const [saveBlockingModalData, setSaveBlockingModalData] = useState<{
    isOpen: boolean;
    alerts: QAQCAlert[];
    summaryMessage: string;
  } | null>(null);

  const [idCollisionModalData, setIdCollisionModalData] = useState<{
    isOpen: boolean;
    collisions: IdCollision[];
    pendingRecords: Record<string, any>[];
  } | null>(null);

  const [highlightedCell, setHighlightedCell] = useState<{ idd: number; field: string } | null>(null);
  const [notifications, setNotifications] = useState<NotificationMsg[]>([]);

  // Estados de conectividad y guardado
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<'synced' | 'unsaved' | 'error' | 'saving'>('synced');
  const [proyectosSaveStatus, setProyectosSaveStatus] = useState<'synced' | 'unsaved' | 'error' | 'saving'>('synced');
  const [dbInfo, setDbInfo] = useState<{ db_type: string; is_local_fallback: boolean; server?: string } | null>(null);

  const qaqcAlerts = useMemo(() => {
    if (isV2) {
      return useGridStore.getState().getQaqcAlerts();
    }
    return validateAllRecords(records);
  }, [records, isV2, gridDataVersion]);

  // --- 2. EFECTOS GLOBALES Y CONFIGURACIONES ---
  useEffect(() => {
    persistTheme(darkMode);
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

  // ponytail: safe storage prevents browser QuotaExceededError when caching large datasets (+9000 rows)
  const safeSaveLocalStorage = (key: string, data: any) => {
    try {
      const dataToSave = Array.isArray(data) && data.length > 100 ? data.slice(0, 100) : data;
      localStorage.setItem(key, JSON.stringify(dataToSave));
    } catch (e) {
      console.warn("localStorage quota exceeded, skipping local cache", e);
    }
  };

  const loadEnsayos = async (p = 1, ps = pageSize, q = searchQuery, tab = currentTab) => {
    setIsFetchingEnsayos(true);
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
        const loadedItems = data.items || [];
        setRecords(loadedItems);
        setLastSavedRecords(JSON.parse(JSON.stringify(loadedItems)));
        if (isV2) {
          useGridStore.getState().setInitialRecords(loadedItems);
        }
        setTotalPages(data.total_pages || 1);
        setTotalRecords(data.total_filtered || 0);
        setPage(data.page || 1);
        setSaveStatus('synced');
        setHasUnsavedImport(false);
        setPendingDeleteIdds([]);
      }
    } catch (e) {
      console.warn("Fallo al cargar ensayos paginados", e);
    } finally {
      setIsFetchingEnsayos(false);
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
          if (isV2) {
            useGridStore.getState().setInitialRecords(parsed);
          }
        }
        triggerNotification("Modo Offline", "Sin conexión con la API backend. Se trabajará de manera local.", "warning");
      });
  }, []);

  // Detectar cambios en registros y eliminaciones pendientes (O(1) en v2 sin JSON.stringify)
  useEffect(() => {
    if (saveStatus === 'saving') return;
    if (isV2) {
      const hasChanges = gridDirtyCount > 0 || gridDeletedCount > 0 || pendingDeleteIdds.length > 0;
      setSaveStatus(hasChanges ? 'unsaved' : 'synced');
    } else {
      const hasChanges = JSON.stringify(records) !== JSON.stringify(lastSavedRecords) || pendingDeleteIdds.length > 0;
      setSaveStatus(hasChanges ? 'unsaved' : 'synced');
    }
  }, [isV2, gridDirtyCount, gridDeletedCount, records, lastSavedRecords, pendingDeleteIdds]);

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
      // En v2 el store normalizado contiene la planilla completa en memoria.
      // Cambiar de módulo solo reconfigura las columnas visibles del grid sin destruir cambios pendientes.
      if (!isV2 || useGridStore.getState().rowIds.length === 0) {
        loadEnsayos(1, pageSize, searchQuery, tabName);
      }
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
      if (isV2) {
        const rowIds = useGridStore.getState().rowIds;
        const rowIdx = rowIds.indexOf(idd);
        if (rowIdx >= 0) {
          useGridStore.getState().setActiveCell({ rowIdx, colKey: field, rowId: idd });
        }
      }
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

  const handleDeleteRow = (id: number) => {
    if (isV2) {
      useGridStore.getState().deleteRow(id);
    }
    setRecords(prev => prev.filter(r => r.idd !== id));
    setPendingDeleteIdds(prev => prev.includes(id) ? prev : [...prev, id]);
    setSaveStatus('unsaved');
  };

  const handleClearDatabase = async () => {
    const confirmed = window.confirm(
      "ADVERTENCIA DE PRUEBA:\n\n" +
      "¿Estás completamente seguro de que deseas ELIMINAR TODOS los registros de Ensayos Especiales de la Base de Datos?\n\n" +
      "Esta acción es irreversible y vaciará la tabla registro_maestro para permitir pruebas de importación limpia."
    );
    if (!confirmed) return;

    setIsFetchingEnsayos(true);
    try {
      const res = await fetch(`${API_BASE}/api/ensayos/clear-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error al vaciar base de datos");
      }
      const data = await res.json();
      if (isV2) {
        useGridStore.getState().clearAll();
      }
      setRecords([]);
      setLastSavedRecords([]);
      setPendingDeleteIdds([]);
      setTotalRecords(0);
      setTotalPages(1);
      setPage(1);
      setSaveStatus('synced');
      setHasUnsavedImport(false);
      safeSaveLocalStorage('sigeg_records_v2', []);
      triggerNotification("Base de Datos Vaciada", `Se eliminaron ${data.deleted_count ?? 0} registros correctamente. La base de datos está lista para pruebas.`, "success");
    } catch (e: any) {
      triggerNotification("Error", e?.message || "No se pudo vaciar la base de datos.", "error");
    } finally {
      setIsFetchingEnsayos(false);
    }
  };

  const proceedWithImportedRecords = (importedData: Record<string, any>[]) => {
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
      if (isV2) {
        useGridStore.getState().importRecords(mapped);
      }
      setRecords(mapped);
      setTotalRecords(mapped.length);
      setTotalPages(Math.max(1, Math.ceil(mapped.length / pageSize)));
      setPage(1);
      setHasUnsavedImport(true);
      setSaveStatus('unsaved');
      triggerNotification("Importación en Grilla", `Se han cargado ${importedData.length} registros en la grilla para revisión.`, "success");
    }
  };

  const handleImportExcel = (importedData: Record<string, any>[]) => {
    // Detección y resolución de colisiones en memoria ANTES de inyectar o enviar a la base
    const existingRecordsMap = isV2
      ? useGridStore.getState().recordsById
      : new Map(records.map(r => [Number(r.idd), r]));

    const collisionResult = resolveIdCollisions(importedData, existingRecordsMap);

    if (collisionResult.hasCollisions) {
      setIdCollisionModalData({
        isOpen: true,
        collisions: collisionResult.collisions,
        pendingRecords: collisionResult.resolvedRecords
      });
    } else {
      proceedWithImportedRecords(collisionResult.resolvedRecords);
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
      setRecords(resolvedRecords);
      setTotalRecords(resolvedRecords.length);
      setTotalPages(Math.max(1, Math.ceil(resolvedRecords.length / pageSize)));
      setPage(1);
      setHasUnsavedImport(true);
      setSaveStatus('unsaved');
      triggerNotification("Sincronización de Importación", "Los registros sin proyecto coincidente han sido inyectados vacíos.", "info");
    }
    else if (action === 'associate' && selectedName) {
      resolvedRecords = tempRecords.map(r => r.proyecto === value ? { ...r, proyecto: selectedName } : r);
      setRecords(resolvedRecords);
      setTotalRecords(resolvedRecords.length);
      setTotalPages(Math.max(1, Math.ceil(resolvedRecords.length / pageSize)));
      setPage(1);
      setHasUnsavedImport(true);
      setSaveStatus('unsaved');
      triggerNotification("Asociación de Importación", `Registros mapeados exitosamente al proyecto ${selectedName}.`, "success");
    }
    else if (action === 'create') {
      const newProj: Proyecto = { nombre: value.toUpperCase(), sinonimos: value.toUpperCase() };
      setProyectos(prev => [...prev, newProj]);
      resolvedRecords = tempRecords.map(r => r.proyecto === value ? { ...r, proyecto: newProj.nombre } : r);
      setRecords(resolvedRecords);
      setTotalRecords(resolvedRecords.length);
      setTotalPages(Math.max(1, Math.ceil(resolvedRecords.length / pageSize)));
      setPage(1);
      setHasUnsavedImport(true);
      setSaveStatus('unsaved');
      triggerNotification("Maestro Actualizado", `Se ha inyectado un nuevo proyecto '${newProj.nombre}' al maestro de SIGEG.`, "success");
    }

    if (isV2) {
      useGridStore.getState().importRecords(resolvedRecords);
    }
    setUnrecognizedProjectModal(null);
  };

  const handleSaveAll = async () => {
    const dirtyIds = isV2 ? useGridStore.getState().dirtyRowIds : new Set(records.map(r => Number(r.idd)));
    const blockEval = evaluateSaveBlocking(SAVE_BLOCKING_POLICY, qaqcAlerts, dirtyIds);
    if (blockEval.isBlocked) {
      setSaveBlockingModalData({
        isOpen: true,
        alerts: blockEval.blockingAlerts,
        summaryMessage: blockEval.summaryMessage
      });
      triggerNotification("Guardado Bloqueado", blockEval.summaryMessage, "error");
      return;
    }
    setSaveStatus('saving');
    setIsFetchingEnsayos(true);
    try {
      // 1. Eliminar filas pendientes de borrado en base de datos
      const storeDeleted = isV2 ? Array.from(useGridStore.getState().deletedRowIds) : [];
      const allDeletes = [...new Set([...pendingDeleteIdds, ...storeDeleted])];

      if (allDeletes.length > 0) {
        const delRes = await fetch(`${API_BASE}/api/ensayos/batch-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(allDeletes)
        });
        if (!delRes.ok) throw new Error("Fallo al sincronizar eliminaciones en la base de datos");
        setPendingDeleteIdds([]);
      }

      // 2. Filas a sincronizar: En v2 se envían ÚNICAMENTE las modificadas/insertadas
      if (isV2) {
        const dirtyRecords = useGridStore.getState().getDirtyRecords();
        if (dirtyRecords.length > 0) {
          const chunkSize = 500;
          for (let i = 0; i < dirtyRecords.length; i += chunkSize) {
            const chunk = dirtyRecords.slice(i, i + chunkSize);
            const res = await fetch(`${API_BASE}/api/ensayos/batch-upsert`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(chunk)
            });
            if (!res.ok) throw new Error("Fallo en sincronización por lote");
          }
        }
        useGridStore.getState().clearDirty();
        setSaveStatus('synced');
        setHasUnsavedImport(false);
        triggerNotification("Guardado Exitoso", `Se sincronizaron ${dirtyRecords.length} registros modificados con éxito en SQL Server.`, "success");
      } else {
        // En v1 se conserva el comportamiento original
        const chunkSize = 500;
        for (let i = 0; i < records.length; i += chunkSize) {
          const chunk = records.slice(i, i + chunkSize);
          const res = await fetch(`${API_BASE}/api/ensayos/batch-upsert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chunk)
          });
          if (!res.ok) throw new Error("Fallo en sincronización por lote");
        }

        safeSaveLocalStorage('sigeg_records_v2', records);
        setLastSavedRecords(JSON.parse(JSON.stringify(records)));
        setSaveStatus('synced');
        setHasUnsavedImport(false);
        triggerNotification("Guardado Exitoso", `Se sincronizaron ${records.length} registros con éxito en SQL Server.`, "success");
      }

      await loadEnsayos(1, pageSize, searchQuery, currentTab);
    } catch {
      if (isV2) {
        const allRecords = useGridStore.getState().getAllRecords();
        safeSaveLocalStorage('sigeg_records_v2', allRecords);
      } else {
        safeSaveLocalStorage('sigeg_records_v2', records);
        setLastSavedRecords(JSON.parse(JSON.stringify(records)));
      }
      setSaveStatus('error');
      triggerNotification("Guardado Fallido", "Sincronización fallida con SQL Server.", "warning");
    } finally {
      setIsFetchingEnsayos(false);
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
      const storeDeleted = isV2 ? Array.from(useGridStore.getState().deletedRowIds) : [];
      const allDeletes = [...new Set([...pendingDeleteIdds, ...storeDeleted])];

      if (allDeletes.length > 0) {
        const delRes = await fetch(`${API_BASE}/api/ensayos/batch-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(allDeletes)
        });
        if (!delRes.ok) throw new Error("Fallo al sincronizar eliminaciones en la base de datos");
        setPendingDeleteIdds([]);
      }

      if (isV2) {
        const dirtyRecords = useGridStore.getState().getDirtyRecords();
        if (dirtyRecords.length > 0) {
          const chunkSize = 500;
          for (let i = 0; i < dirtyRecords.length; i += chunkSize) {
            const chunk = dirtyRecords.slice(i, i + chunkSize);
            const res = await fetch(`${API_BASE}/api/ensayos/batch-upsert`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(chunk)
            });
            if (!res.ok) throw new Error("Fallo en sincronización por lote");
          }
        }
        useGridStore.getState().clearDirty();
        setSaveStatus('synced');
        triggerNotification("Guardado Segmentado", `Los cambios del módulo ${tabKey.replace('_', ' ').toUpperCase()} se han sincronizado correctamente.`, "success");
      } else {
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

    if (isV2) {
      const { dirtyRowIds, deletedRowIds, recordsById, originalRecordsById } = useGridStore.getState();
      if (dirtyRowIds.size === 0 && deletedRowIds.size === 0) return false;
      if (tabKey === 'registro_maestro') return true;

      const moduleCols = getColumnsForModule(tabKey);
      for (const id of dirtyRowIds) {
        const cur = recordsById.get(id);
        const orig = originalRecordsById.get(id);
        if (!cur || !orig) return true; // Fila nueva insertada
        for (const col of moduleCols) {
          if (cur[col.dbName] !== orig[col.dbName]) return true;
        }
      }
      return false;
    }

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

  const hasSavingBlockingAlerts = useMemo(() => {
    if (isV2) {
      const dirtyIds = useGridStore.getState().dirtyRowIds;
      if (dirtyIds.size === 0) return false;
      return qaqcAlerts.some(a => dirtyIds.has(a.idd) && a.type === 'CRÍTICO');
    }
    return qaqcAlerts.some(a => a.type === 'CRÍTICO');
  }, [qaqcAlerts, isV2, gridDirtyCount]);

  return (
    <div className="flex h-screen overflow-hidden bg-navy-950 text-slate-100 font-sans">
      {/* 1. SIDEBAR */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={navigateToTab}
        darkMode={darkMode}
        setDarkMode={(dark) => {
          setDarkMode(dark);
          persistTheme(dark);
        }}
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
          hasAlerts={hasSavingBlockingAlerts}
          checkModuleModified={checkModuleModified}
        />

        {/* CONTENEDOR DE PAGINAS */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 view-dashboard view-mapeo view-modal">
          {currentTab === 'dashboard' && (
            <Dashboard
              records={records}
              alertsCount={qaqcAlertsCount}
              onNavigateTab={navigateToTab}
              apiBase={API_BASE}
            />
          )}

          {currentTab === 'distribucion' && (
            <DistribucionModulos
              records={records}
              qaqcAlerts={qaqcAlerts}
              onNavigateTab={navigateToTab}
              apiBase={API_BASE}
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
              isLoading={isFetchingEnsayos}
              onDeleteRow={handleDeleteRow}
              onClearDatabase={handleClearDatabase}
              onPageChange={(newPage) => {
                setPage(newPage);
                if (!hasUnsavedImport) {
                  loadEnsayos(newPage, pageSize, searchQuery, currentTab);
                }
              }}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
                if (!hasUnsavedImport) {
                  loadEnsayos(1, newSize, searchQuery, currentTab);
                }
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
        <div className="fixed inset-0 view-modal z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-amber-500/30 bg-navy-900/95 shadow-2xl space-y-4">
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">Proyecto No Reconocido</h3>
            <p className="text-xs text-slate-300">
              El proyecto <strong className="text-amber-400 font-mono">'{unrecognizedProjectModal.value}'</strong> detectado en el archivo Excel no se encuentra en la base de datos oficial de SIGEG.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => handleResolveUnrecognized('empty')}
                className="w-full text-left p-3 rounded-lg bg-navy-950 border border-navy-800 text-xs font-semibold text-slate-300 hover:bg-navy-850 hover:text-slate-100 transition-colors"
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
        apiBase={API_BASE}
        onDirectSaveComplete={() => {
          loadEnsayos(1, pageSize, searchQuery, currentTab);
          triggerNotification("Sincronización Masiva", "Planilla guardada directamente en la base de datos.", "success");
        }}
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

      <SaveBlockingModal
        isOpen={!!saveBlockingModalData?.isOpen}
        onClose={() => setSaveBlockingModalData(null)}
        blockingAlerts={saveBlockingModalData?.alerts || []}
        summaryMessage={saveBlockingModalData?.summaryMessage || ''}
        onNavigateToCell={handleFocusField}
      />

      <IdCollisionModal
        isOpen={!!idCollisionModalData?.isOpen}
        onClose={() => setIdCollisionModalData(null)}
        collisions={idCollisionModalData?.collisions || []}
        onConfirm={() => {
          if (idCollisionModalData?.pendingRecords) {
            proceedWithImportedRecords(idCollisionModalData.pendingRecords);
          }
        }}
      />
    </div>
  );
}