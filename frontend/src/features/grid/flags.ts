// frontend/src/features/grid/flags.ts
import type { GridVersion } from './types';

const STORAGE_KEY = 'sigeg_grid_version';

/**
 * Determina qué versión del componente de tabla está activa.
 * 1. Prioridad máxima: Parámetro URL `?grid=v1` o `?grid=v2`.
 * 2. Segunda prioridad: Preferencia guardada en localStorage.
 * 3. Valor predeterminado de seguridad: 'v1' (cero regresión en producción).
 */
export function getGridVersion(): GridVersion {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlVersion = params.get('grid');
      if (urlVersion === 'v1' || urlVersion === 'v2') {
        return urlVersion;
      }

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'v1' || stored === 'v2') {
        return stored;
      }
    } catch {
      // Entornos seguros o sin acceso a almacenamiento
    }
  }

  return 'v1';
}

/**
 * Actualiza la preferencia de versión de grilla en localStorage.
 */
export function setGridVersion(version: GridVersion): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, version);
    } catch (e) {
      console.warn('No se pudo persistir la versión de grilla en localStorage', e);
    }
  }
}
