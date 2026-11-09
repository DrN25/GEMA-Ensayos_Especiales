// frontend/src/features/grid/schema/index.ts
export * from './types';
export * from './columnFactories';
export * from './columns';
export * from './validationEngine';
export * from './tableValidators';
export * from './dependencyRules';
export * from './convertiblePairs';

import { COLUMNS_SCHEMA } from './columns';
import type { ColumnSchema } from './types';

/**
 * Obtiene las definiciones de columnas correspondientes al módulo geomecánico seleccionado.
 * En vistas de ensayos específicos (ucs, traccion, corte, etc.) mantiene exactamente la paridad
 * de columnas que tenía la v1 clásica, ocultando campos comunes irrelevantes para foco visual.
 */
export function getSchemaColumnsForModule(
  moduleName: string,
  customSelectOptions?: { proyectos?: string[]; laboratorios?: string[] }
): ColumnSchema[] {
  const isMaster = moduleName === 'registro_maestro';

  return COLUMNS_SCHEMA.filter(col => {
    // 1. Visibilidad explícita declarada por módulo (prevalece sobre maestro y grupos)
    if (col.visibleIn && col.visibleIn.length > 0) {
      return col.visibleIn.includes(moduleName);
    }

    if (isMaster) return true;

    // En vistas de ensayos específicos (idéntico a v1):
    // 2. Identificación básica fija
    if (col.id === 'idd' || col.id === 'sondaje' || col.id === 'codigo_muestra') return true;

    // 3. Columnas exclusivas de la familia de ensayo
    if (moduleName === 'ucs' && col.group === 'Ensayo UCS') return true;
    if (moduleName === 'elasticas' && col.group === 'Constantes Elásticas') return true;
    if (moduleName === 'traccion' && col.group === 'Tracción Indirecta') return true;
    if (moduleName === 'corte' && col.group === 'Corte Directo') return true;
    if (moduleName === 'triaxial' && col.group === 'Compresión Triaxial') return true;
    if (moduleName === 'propiedades' && col.group === 'Propiedades Físicas') return true;

    // 4. Validación QA/QC y Observación general al final (igual que v1)
    if (col.id === 'qaqc_validacion' || col.id === 'observacion') return true;

    return false;
  }).map(col => {
    // Inyectar dinámicamente opciones si se proporcionan
    if (col.id === 'proyecto' && customSelectOptions?.proyectos) {
      return { ...col, options: customSelectOptions.proyectos };
    }
    if (col.id === 'laboratorio' && customSelectOptions?.laboratorios) {
      return { ...col, options: customSelectOptions.laboratorios };
    }
    return col;
  });
}
