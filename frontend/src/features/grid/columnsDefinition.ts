// frontend/src/features/grid/columnsDefinition.ts
import type { GridColumnDef, ColumnType } from './types';
import {
  COLUMNS_SCHEMA,
  COLUMNS_SCHEMA_MAP,
  MESES_OPTIONS,
  TIPO_ENSAYO_OPTIONS,
  getSchemaColumnsForModule,
  type ColumnSchema
} from './schema';

export { MESES_OPTIONS, TIPO_ENSAYO_OPTIONS };

/**
 * Convierte un ColumnSchema del nuevo esquema declarativo (SSOT)
 * a GridColumnDef para el renderizado en VirtualizedGrid y TanStack Table.
 */
export function schemaToGridColumnDef(col: ColumnSchema): GridColumnDef {
  let colType: ColumnType = 'string';
  if (col.type === 'decimal' || col.type === 'integer') {
    colType = 'number';
  } else if (col.type === 'readonly') {
    colType = 'readonly';
  } else if (col.type === 'select') {
    colType = 'select';
  }

  return {
    id: col.id,
    header: col.header,
    group: col.group,
    accessorKey: col.id,
    defaultWidth: col.defaultWidth,
    minWidth: col.minWidth,
    maxWidth: col.maxWidth,
    pinned: col.pinned,
    type: colType,
    editor: col.editor,
    options: col.options,
    validations: {
      min: col.constraints?.minSoft ?? col.constraints?.minHard,
      max: col.constraints?.maxSoft ?? col.constraints?.maxHard,
      required: col.emptyPolicy === 'block'
    },
    hint: col.hint,
    unit: col.unit,
    decimals: col.decimals,
    displayHint: col.displayHint,
    format: col.format
  };
}

/**
 * Array completo de columnas convertido desde el nuevo esquema SSOT.
 */
export const GRID_COLUMNS_DEFINITION: GridColumnDef[] = getSchemaColumnsForModule('registro_maestro').map(schemaToGridColumnDef);

/**
 * Filtra las definiciones de columna para el módulo geomecánico activo
 * consumiendo directamente el nuevo esquema declarativo.
 */
export function getGridColumnsForModule(
  moduleName: string,
  customSelectOptions?: { proyectos?: string[]; laboratorios?: string[] }
): GridColumnDef[] {
  const schemaCols = getSchemaColumnsForModule(moduleName, customSelectOptions);
  return schemaCols.map(schemaToGridColumnDef);
}
