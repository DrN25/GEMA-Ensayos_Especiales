// frontend/src/features/grid/storage/indexedDbDeltaStore.ts
import type { GridDelta } from './types';

const DB_NAME = 'sigeg_local_store';
const DB_VERSION = 1;
const STORE_NAME = 'pending_deltas';
const DELTA_KEY = 'current_delta';
export const CURRENT_DELTA_SCHEMA_VERSION = 1;

// Fallback en memoria si IndexedDB no está disponible (ej. entorno de tests Vitest / SSR)
let memoryStore: Record<string, any> = {};

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      return reject(new Error('IndexedDB no disponible en este entorno'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Valida si un objeto delta cumple con el esquema esperado o está corrupto / desactualizado.
 */
export function isDeltaCorrupted(data: any): boolean {
  if (!data || typeof data !== 'object') return true;
  if (data.version !== CURRENT_DELTA_SCHEMA_VERSION) return true;
  if (typeof data.timestamp !== 'number') return true;
  if (!data.modifiedRows || typeof data.modifiedRows !== 'object') return true;
  if (!Array.isArray(data.insertedRows)) return true;
  if (!Array.isArray(data.deletedRowIds)) return true;
  return false;
}

/**
 * Guarda el delta actual en IndexedDB (o fallback en memoria).
 */
export async function saveDelta(delta: GridDelta): Promise<void> {
  if (isDeltaCorrupted(delta)) {
    console.warn('[IndexedDbDeltaStore] Se intentó guardar un delta inválido/corrupto.');
    return;
  }

  if (!isIndexedDbAvailable()) {
    memoryStore[DELTA_KEY] = JSON.parse(JSON.stringify(delta));
    return;
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(delta, DELTA_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[IndexedDbDeltaStore] Error al guardar delta en IndexedDB, usando fallback:', err);
    memoryStore[DELTA_KEY] = JSON.parse(JSON.stringify(delta));
  }
}

/**
 * Carga el delta pendiente desde IndexedDB (o fallback en memoria).
 * Si está corrupto o es de una versión vieja del esquema, lo descarta limpiamente y retorna null.
 */
export async function loadDelta(): Promise<GridDelta | null> {
  if (!isIndexedDbAvailable()) {
    const raw = memoryStore[DELTA_KEY];
    if (!raw) return null;
    if (isDeltaCorrupted(raw)) {
      delete memoryStore[DELTA_KEY];
      return null;
    }
    return raw;
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(DELTA_KEY);

      req.onsuccess = () => {
        const val = req.result;
        if (!val) return resolve(null);
        if (isDeltaCorrupted(val)) {
          console.warn('[IndexedDbDeltaStore] Delta local corrupto o versión obsoleta detectada. Descartando.');
          clearDelta().catch(() => {});
          return resolve(null);
        }
        resolve(val as GridDelta);
      };

      req.onerror = () => {
        console.warn('[IndexedDbDeltaStore] Error de lectura en IndexedDB:', req.error);
        resolve(null);
      };
    });
  } catch (err) {
    console.warn('[IndexedDbDeltaStore] Error al abrir DB:', err);
    return null;
  }
}

/**
 * Borra el delta pendiente de IndexedDB (ej. tras guardar exitosamente o descartar).
 */
export async function clearDelta(): Promise<void> {
  delete memoryStore[DELTA_KEY];

  if (!isIndexedDbAvailable()) return;

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(DELTA_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve(); // No bloquear flujo
    });
  } catch {
    // Silencioso
  }
}

/**
 * Utilidad exclusiva para tests unitarios para limpiar el fallback en memoria.
 */
export function resetMemoryStoreForTesting(): void {
  memoryStore = {};
}

