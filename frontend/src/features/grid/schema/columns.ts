// frontend/src/features/grid/schema/columns.ts
import type { ColumnSchema, ColumnStyleConfig } from './types';

/*
================================================================================
GUÍA RÁPIDA: ESQUELETOS (BODY) PARA CREAR NUEVAS COLUMNAS EN EL ESQUEMA (SSOT)
================================================================================

Para agregar una nueva columna, copia uno de los siguientes esqueletos y agrégalo
al arreglo COLUMNS_SCHEMA.

1. DECIMAL (Para valores numéricos con coma flotante, límites físicos y geomecánicos):
--------------------------------------------------------------------------------
decimalColumn({
  id: 'mi_columna_decimal',          // Clave en BD / JSON
  header: 'Mi Decimal',              // Cabecera compacta en grid
  excelName: 'Mi Columna Decimal',   // Nombre formal en Excel
  group: 'Ensayo UCS',               // Grupo en cabecera nivel 0
  module: 'ucs',                     // Módulo geomecánico de pertenencia
  unit: 'MPa',                       // Unidad que se muestra entre paréntesis en cabecera
  decimals: 2,                       // Precisión decimal visual (el dato crudo no se trunca)
  displayHint: 'Vista a 2 decimales',// Tooltip explicativo de redondeo
  defaultWidth: 130,                 // Ancho inicial en píxeles (default: 120)
  minWidth: 80,                      // Ancho mínimo permitido al redimensionar
  maxWidth: 300,                     // Ancho máximo permitido (opcional)
  constraints: {
    positiveOnly: true,              // Si es <= 0 emite alerta CRÍTICA
    minHard: 0.01,                   // Límite físico infranqueable mínimo (CRÍTICO)
    maxHard: 500.0,                  // Límite físico infranqueable máximo (CRÍTICO)
    minSoft: 5.0,                    // Límite geomecánico recomendado inferior (AVISO)
    maxSoft: 250.0                   // Límite geomecánico recomendado superior (AVISO)
  },
  emptyPolicy: 'warn',               // 'allowed' (permite vacío) | 'warn' (AVISO) | 'block' (CRÍTICO)
  style: COLUMN_GROUP_STYLES.ucs,    // Estilo temático de cabecera y celdas
  visibleIn: ['ucs', 'registro_maestro'], // Módulos donde se muestra (opcional)
  hint: 'Descripción del parámetro'  // Mensaje en tooltip delegado,
    style: COLUMN_GROUP_STYLES.ucs,
}),

2. ENTERO (Para conteos, identificadores, días, años sin decimales):
--------------------------------------------------------------------------------
integerColumn({
  id: 'mi_columna_entera',
  header: 'Mi Entero',
  excelName: 'Mi Columna Entera',
  group: 'Datos Comunes de Campo',
  module: 'common',
  defaultWidth: 90,
  constraints: { positiveOnly: true, minHard: 1, maxHard: 100 },
  emptyPolicy: 'allowed',
  style: COLUMN_GROUP_STYLES.general,
    style: COLUMN_GROUP_STYLES.general,
}),

3. TEXTO (Para sondajes, códigos, observaciones, nombres de personas o zonas):
--------------------------------------------------------------------------------
textColumn({
  id: 'mi_columna_texto',
  header: 'Mi Texto',
  excelName: 'Mi Columna de Texto',
  group: 'Identificación de Muestra',
  module: 'common',
  defaultWidth: 140,
  constraints: { maxLength: 50 },
  emptyPolicy: 'block',              // Obligatorio para guardado
  style: { ...COLUMN_GROUP_STYLES.general, uppercase: true, bold: true }, // Mayúsculas y negrita
  // autoGenerate: (row) => row.sondaje ? `${row.sondaje}-AUTO` : '' // Generación automática opcional,
    style: COLUMN_GROUP_STYLES.general,
}),

4. SELECT (Para listas de opciones cerradas o catálogos dinámicos):
--------------------------------------------------------------------------------
selectColumn({
  id: 'mi_columna_select',
  header: 'Mi Selector',
  excelName: 'Mi Selector Desplegable',
  group: 'Datos Comunes de Campo',
  module: 'common',
  defaultWidth: 130,
  options: ['Opción A', 'Opción B', 'Opción C'], // Opciones estáticas
  // dynamicOptionsKey: 'proyectos',             // O 'laboratorios' para opciones desde BD
  emptyPolicy: 'allowed',
  style: COLUMN_GROUP_STYLES.general,
    style: COLUMN_GROUP_STYLES.general,
}),

5. CALCULADA / SOLO LECTURA (Derivada puramente en memoria, sin editor):
--------------------------------------------------------------------------------
calculatedColumn({
  id: 'mi_columna_calculada',
  header: 'Mi Calculada',
  excelName: 'Mi Columna Calculada (m)',
  group: 'Datos Comunes de Campo',
  module: 'common',
  unit: 'm',
  decimals: 2,
  calculate: (row) => (row.hasta != null && row.desde != null) ? Number(row.hasta) - Number(row.desde) : null,
  emptyPolicy: 'allowed',
  style: COLUMN_GROUP_STYLES.general,
    style: COLUMN_GROUP_STYLES.general,
}),

6. ACCIÓN / CONTROL UI (Botones de fila fijados a la derecha):
--------------------------------------------------------------------------------
actionColumn({
  id: 'acciones_col',
  header: 'Acciones',
  excelName: 'Acciones',
  group: 'Acciones',
  module: 'common',
  pinned: 'right',
  defaultWidth: 90,
  style: COLUMN_GROUP_STYLES.general,
    style: COLUMN_GROUP_STYLES.general,
})
================================================================================
*/

/**
 * Paleta temática de colores por familia geomecánica para cabeceras y celdas.
 */
export const COLUMN_GROUP_STYLES: Record<string, ColumnStyleConfig> = {
  // Grupo inicial (Identificación y Datos Comunes) y Finales (Validación y Acciones): Slate sobrio
  general: {
    headerBg: 'bg-navy-900',
    headerText: 'text-slate-100'
  },
  // Ensayo UCS: Naranja
  ucs: {
    headerBg: 'bg-orange-100 dark:bg-orange-950/80',
    headerText: 'text-orange-950 dark:text-orange-200'
  },
  // Constantes Elásticas: Rojo
  elasticas: {
    headerBg: 'bg-rose-100 dark:bg-rose-950/80',
    headerText: 'text-rose-950 dark:text-rose-200'
  },
  // Tracción Indirecta: Amarillo / Ámbar
  traccion: {
    headerBg: 'bg-amber-100 dark:bg-amber-950/80',
    headerText: 'text-amber-950 dark:text-amber-200'
  },
  // Corte Directo: Verde Esmeralda
  corte: {
    headerBg: 'bg-emerald-100 dark:bg-emerald-950/80',
    headerText: 'text-emerald-950 dark:text-emerald-200'
  },
  // Compresión Triaxial: Guinda (Borgoña / Vino)
  triaxial: {
    headerBg: 'bg-pink-100 dark:bg-[#3b0d21]/90',
    headerText: 'text-pink-950 dark:text-[#fbcfe8]'
  },
  // Propiedades Físicas: Celeste / Cyan
  propiedades: {
    headerBg: 'bg-cyan-100 dark:bg-cyan-950/80',
    headerText: 'text-cyan-950 dark:text-cyan-200'
  }
};

import {
  textColumn,
  integerColumn,
  decimalColumn,
  selectColumn,
  calculatedColumn,
  actionColumn
} from './columnFactories';

export const MESES_OPTIONS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const TIPO_ENSAYO_OPTIONS = [
  'UCS',
  'Determinación de constantes elásticas',
  'Tracción indirecta',
  'Corte directo',
  'Compresión triaxial'
];

/**
 * Catálogo Single Source of Truth (SSOT) de todas las 50 columnas del sistema:
 * 48 columnas geomecánicas + 2 columnas de interfaz en grid (qaqc_validacion y acciones_col).
 *
 * NOTA DE DECISIÓN DE RANGOS: Se adoptan los valores de columnsConfig.ts como fuente por defecto:
 * - corte_area: min: 1.0 (en vez de 0.1)
 * - corte_esf_normal_kpa y corte_esf_corte_kpa: min: 0.0 (en vez de 0.1)
 * - prop_peso_unitario_geometrico: min: 1.0, max: 4.0 (en vez de 0.1 - 5.0)
 * - elevacion: negativeOnly deshabilitado; los valores negativos generan AVISO (minSoft: 0), no CRÍTICO.
 */
export const COLUMNS_SCHEMA: ColumnSchema[] = [
  // =========================================================================
  // GRUPO 1: Identificación de Muestra (Pinned Left)
  // =========================================================================
  integerColumn({
    id: 'idd',
    header: 'IDD',
    excelName: 'IDD',
    group: 'Identificación de Muestra',
    module: 'common',
    defaultWidth: 80,
    minWidth: 60,
    maxWidth: 120,
    pinned: 'left',
    editor: 'none',
    emptyPolicy: 'allowed',
    constraints: { positiveOnly: true, minHard: 1 },
    hint: 'Identificador único del registro',
    style: { ...COLUMN_GROUP_STYLES.general, bold: true },
  }),
  textColumn({
    id: 'sondaje',
    header: 'Sondaje',
    excelName: 'Sondaje diamantino',
    group: 'Identificación de Muestra',
    module: 'common',
    defaultWidth: 130,
    minWidth: 90,
    maxWidth: 200,
    pinned: 'left',
    emptyPolicy: 'block',
    constraints: { maxLength: 50 },
    hint: 'Identificador del sondaje diamantino',
    style: { ...COLUMN_GROUP_STYLES.general, bold: true, uppercase: true },
  }),
  textColumn({
    id: 'codigo_muestra',
    header: 'Código Muestra',
    excelName: 'Código de muestra',
    group: 'Identificación de Muestra',
    module: 'common',
    defaultWidth: 160,
    minWidth: 110,
    maxWidth: 240,
    pinned: 'left',
    emptyPolicy: 'allowed',
    constraints: { maxLength: 50 },
    hint: 'Código único de la probeta para geotecnia',
    autoGenerate: (row: Record<string, any>) =>
      row.sondaje ? `${row.sondaje}-UCS-M${String(row.idd || 0).padStart(2, '0')}` : '',
    style: { ...COLUMN_GROUP_STYLES.general, bold: true, uppercase: true },
  }),

  // =========================================================================
  // GRUPO 2: Datos Comunes de Campo
  // =========================================================================
  selectColumn({
    id: 'laboratorio',
    header: 'Laboratorio',
    excelName: 'Laboratorio',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 110,
    minWidth: 80,
    dynamicOptionsKey: 'laboratorios',
    hint: 'Entidad ejecutora del ensayo',
    style: COLUMN_GROUP_STYLES.general,
  }),
  integerColumn({
    id: 'dia',
    header: 'Día',
    excelName: 'Día',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 70,
    minWidth: 50,
    constraints: { positiveOnly: true, minHard: 1, maxHard: 31 },
    hint: 'Día de ejecución (1 - 31)',
    style: COLUMN_GROUP_STYLES.general,
  }),
  selectColumn({
    id: 'mes',
    header: 'Mes',
    excelName: 'Mes',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 90,
    minWidth: 80,
    options: MESES_OPTIONS,
    hint: 'Mes de ejecución del ensayo',
    style: COLUMN_GROUP_STYLES.general,
  }),
  integerColumn({
    id: 'anio',
    header: 'Año',
    excelName: 'Año',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 80,
    minWidth: 60,
    constraints: { positiveOnly: true, minHard: 1980, maxHard: 2050 },
    hint: 'Año de ejecución (1980 - 2050)',
    style: COLUMN_GROUP_STYLES.general,
  }),
  selectColumn({
    id: 'proyecto',
    header: 'Proyecto',
    excelName: 'Proyecto',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 130,
    minWidth: 90,
    dynamicOptionsKey: 'proyectos',
    hint: 'Proyecto minero o geológico asociado',
    style: COLUMN_GROUP_STYLES.general,
  }),
  decimalColumn({
    id: 'desde',
    header: 'Desde',
    excelName: 'Desde (m)',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 90,
    minWidth: 70,
    unit: 'm',
    decimals: 2,
    constraints: { positiveOnly: true, minHard: 0.0 },
    hint: 'Registrar en metros (m)',
    style: COLUMN_GROUP_STYLES.general,
  }),
  decimalColumn({
    id: 'hasta',
    header: 'Hasta',
    excelName: 'Hasta (m)',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 90,
    minWidth: 70,
    unit: 'm',
    decimals: 2,
    constraints: { positiveOnly: true, minHard: 0.0 },
    hint: 'Registrar en metros (m)',
    style: COLUMN_GROUP_STYLES.general,
  }),
  calculatedColumn({
    id: 'longitud_muestra',
    header: 'Longitud Muestra',
    excelName: 'Longitud de muestra (m)',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 140,
    minWidth: 90,
    unit: 'm',
    decimals: 2,
    hint: 'Longitud calculada de la muestra en metros (m)',
    calculate: (row: Record<string, any>) => {
      const d = Number(row.desde);
      const h = Number(row.hasta);
      if (
        row.desde !== null &&
        row.desde !== undefined &&
        row.desde !== '' &&
        row.hasta !== null &&
        row.hasta !== undefined &&
        row.hasta !== '' &&
        !isNaN(d) &&
        !isNaN(h)
      ) {
        return Number((h - d).toFixed(2));
      }
      return null;
    },
    style: COLUMN_GROUP_STYLES.general,
  }),
  decimalColumn({
    id: 'este',
    header: 'Este',
    excelName: 'Este (m)',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 100,
    minWidth: 70,
    unit: 'm',
    decimals: 2,
    constraints: { positiveOnly: true, minHard: 0.0 },
    hint: 'Registrar en metros (m) UTM Este',
    style: COLUMN_GROUP_STYLES.general,
  }),
  decimalColumn({
    id: 'norte',
    header: 'Norte',
    excelName: 'Norte (m)',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 100,
    minWidth: 70,
    unit: 'm',
    decimals: 2,
    constraints: { positiveOnly: true, minHard: 0.0 },
    hint: 'Registrar en metros (m) UTM Norte',
    style: COLUMN_GROUP_STYLES.general,
  }),
  decimalColumn({
    id: 'elevacion',
    header: 'Elevación',
    excelName: 'Elevación (msnm)',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 100,
    minWidth: 70,
    unit: 'msnm',
    decimals: 2,
    constraints: { positiveOnly: true },
    hint: 'Registrar en msnm',
    style: COLUMN_GROUP_STYLES.general,
  }),
  textColumn({
    id: 'sectores',
    header: 'Sectores',
    excelName: 'SECTORES',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 110,
    minWidth: 80,
    hint: 'Sector o zona geomecánica',
    style: COLUMN_GROUP_STYLES.general,
  }),
  textColumn({
    id: 'lito1',
    header: 'Lito 1',
    excelName: 'Lito 1',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 90,
    minWidth: 70,
    hint: 'Litología principal del testigo',
    style: COLUMN_GROUP_STYLES.general,
  }),
  textColumn({
    id: 'lito2',
    header: 'Lito 2',
    excelName: 'Lito 2',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 90,
    minWidth: 70,
    hint: 'Litología secundaria',
    style: COLUMN_GROUP_STYLES.general,
  }),
  textColumn({
    id: 'lito3',
    header: 'Lito 3',
    excelName: 'Lito 3',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 90,
    minWidth: 70,
    hint: 'Litología terciaria o alteración',
    style: COLUMN_GROUP_STYLES.general,
  }),
  selectColumn({
    id: 'tipo_ensayo',
    header: 'Tipo Ensayo',
    excelName: 'Tipo de ensayo',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 150,
    minWidth: 100,
    options: TIPO_ENSAYO_OPTIONS,
    hint: 'Tipo de ensayo geomecánico de laboratorio',
    style: COLUMN_GROUP_STYLES.general,
  }),

  // =========================================================================
  // GRUPO 3: Ensayo de Compresión Simple (UCS)
  // =========================================================================
  decimalColumn({
    id: 'ucs_diametro',
    header: 'Diámetro',
    excelName: 'Diámetro del testigo (cm)',
    group: 'Ensayo UCS',
    module: 'ucs',
    defaultWidth: 120,
    minWidth: 80,
    unit: 'cm',
    decimals: 2,
    constraints: { positiveOnly: true, minSoft: 1.0, maxSoft: 20.0 },
    hint: 'Registrar en cm',
    style: COLUMN_GROUP_STYLES.ucs,
  }),
  decimalColumn({
    id: 'ucs_carga_rotura',
    header: 'Carga Rotura',
    excelName: 'Carga de rotura (kN)',
    group: 'Ensayo UCS',
    module: 'ucs',
    defaultWidth: 120,
    minWidth: 80,
    unit: 'kN',
    decimals: 2,
    constraints: { positiveOnly: true, minSoft: 0.1 },
    hint: 'Registre la unidad en kN',
    style: COLUMN_GROUP_STYLES.ucs,
  }),
  decimalColumn({
    id: 'ucs_resistencia',
    header: 'Resistencia UCS',
    excelName: 'Resistencia a la compresión uniaxial (MPa)',
    group: 'Ensayo UCS',
    module: 'ucs',
    defaultWidth: 140,
    minWidth: 90,
    unit: 'MPa',
    decimals: 2,
    constraints: { positiveOnly: true, minSoft: 0.1 },
    hint: 'Registrar en MPa',
    style: COLUMN_GROUP_STYLES.ucs,
  }),
  calculatedColumn({
    id: 'ucs_resistencia_calculada',
    header: 'Resistencia Calc.',
    excelName: 'Resistencia calculada (MPa)',
    group: 'Ensayo UCS',
    module: 'ucs',
    defaultWidth: 140,
    minWidth: 90,
    unit: 'MPa',
    decimals: 2,
    hint: 'Resistencia calculada en MPa',
    calculate: (row: Record<string, any>) => {
      const p = Number(row.ucs_carga_rotura);
      const d = Number(row.ucs_diametro);
      if (
        row.ucs_carga_rotura !== null &&
        row.ucs_carga_rotura !== undefined &&
        row.ucs_carga_rotura !== '' &&
        row.ucs_diametro !== null &&
        row.ucs_diametro !== undefined &&
        row.ucs_diametro !== '' &&
        !isNaN(p) &&
        !isNaN(d) &&
        d > 0
      ) {
        // Area mm2 = pi * (d_cm * 10)^2 / 4
        const areaMm2 = (Math.PI * Math.pow(d * 10.0, 2)) / 4.0;
        return Number(((p * 1000.0) / areaMm2).toFixed(2));
      }
      return null;
    },
    style: COLUMN_GROUP_STYLES.ucs,
  }),
  textColumn({
    id: 'ucs_rotura',
    header: 'Rotura_UCS',
    excelName: 'Rotura',
    group: 'Ensayo UCS',
    module: 'ucs',
    defaultWidth: 100,
    minWidth: 70,
    hint: 'Patrón o tipo de fracturamiento',
    style: COLUMN_GROUP_STYLES.ucs,
  }),

  // =========================================================================
  // GRUPO 4: Constantes Elásticas
  // =========================================================================
  decimalColumn({
    id: 'elasticas_modulo_young',
    header: 'Módulo Young',
    excelName: 'Modulo de Young (GPa)',
    group: 'Constantes Elásticas',
    module: 'elasticas',
    defaultWidth: 130,
    minWidth: 80,
    unit: 'GPa',
    decimals: 2,
    constraints: { positiveOnly: true, minSoft: 1.0, maxSoft: 150.0 },
    hint: 'Registrar en GPa',
    style: COLUMN_GROUP_STYLES.elasticas,
  }),
  decimalColumn({
    id: 'elasticas_poisson',
    header: 'Relación Poisson',
    excelName: 'Relación de Poisson',
    group: 'Constantes Elásticas',
    module: 'elasticas',
    defaultWidth: 110,
    minWidth: 70,
    decimals: 3,
    constraints: { positiveOnly: true, minSoft: 0.05, maxHard: 0.50 },
    hint: 'Relación de Poisson estática (0.05 - 0.45)',
    style: COLUMN_GROUP_STYLES.elasticas,
  }),

  // =========================================================================
  // GRUPO 5: Tracción Indirecta (Brasileño)
  // =========================================================================
  decimalColumn({
    id: 'traccion_carga_promedio',
    header: 'Carga Prom.',
    excelName: 'Carga de rotura promedio (kN)',
    group: 'Tracción Indirecta',
    module: 'traccion',
    defaultWidth: 140,
    minWidth: 80,
    unit: 'kN',
    decimals: 2,
    constraints: { positiveOnly: true, minSoft: 0.1 },
    hint: 'Registre la unidad en kN',
    style: COLUMN_GROUP_STYLES.traccion,
  }),
  decimalColumn({
    id: 'traccion_resistencia_kgcm2',
    header: 'Resist. kg/cm²',
    excelName: 'Resistencia promedio (kg/cm2)',
    group: 'Tracción Indirecta',
    module: 'traccion',
    defaultWidth: 140,
    minWidth: 80,
    unit: 'kg/cm²',
    decimals: 2,
    constraints: { positiveOnly: true, minSoft: 0.1 },
    hint: 'Registre en kg/cm²',
    style: COLUMN_GROUP_STYLES.traccion,
  }),
  textColumn({
    id: 'traccion_vacia_28',
    header: 'Tracción 28',
    excelName: 'Columna Vacía 28',
    group: 'Tracción Indirecta',
    module: 'traccion',
    defaultWidth: 120,
    minWidth: 70,
    hint: 'Campo auxiliar de ensayo brasileño',
    style: COLUMN_GROUP_STYLES.traccion,
  }),
  decimalColumn({
    id: 'traccion_resistencia_mpa',
    header: 'Resist. MPa',
    excelName: 'Resistencia promedio (MPa)',
    group: 'Tracción Indirecta',
    module: 'traccion',
    defaultWidth: 140,
    minWidth: 80,
    unit: 'MPa',
    decimals: 2,
    constraints: { positiveOnly: true, minSoft: 0.01 },
    hint: 'Registre en MPa',
    style: COLUMN_GROUP_STYLES.traccion,
  }),
  textColumn({
    id: 'traccion_observaciones',
    header: 'Observaciones TI',
    excelName: 'Observaciones Tracción Indirecta',
    group: 'Tracción Indirecta',
    module: 'traccion',
    visibleIn: ['traccion'],
    defaultWidth: 180,
    minWidth: 100,
    hint: 'Observaciones específicas de los ensayos de tracción indirecta',
    style: COLUMN_GROUP_STYLES.traccion,
  }),

  // =========================================================================
  // GRUPO 6: Corte Directo en Roca
  // =========================================================================
  textColumn({
    id: 'corte_tipo_fractura',
    header: 'Tipo Fractura',
    excelName: 'Tipo de fractura',
    group: 'Corte Directo',
    module: 'corte',
    defaultWidth: 130,
    minWidth: 80,
    hint: 'Descripción del plano de discontinuidad',
    style: COLUMN_GROUP_STYLES.corte,
  }),
  decimalColumn({
    id: 'corte_area',
    header: 'Área',
    excelName: 'Área de ensayo (cm2)',
    group: 'Corte Directo',
    module: 'corte',
    defaultWidth: 120,
    minWidth: 70,
    unit: 'cm²',
    decimals: 2,
    constraints: { positiveOnly: true, minSoft: 1.0 },
    hint: 'Registrar en cm²',
    style: COLUMN_GROUP_STYLES.corte,
  }),
  decimalColumn({
    id: 'corte_esf_normal_kpa',
    header: 'Esf. Normal',
    excelName: 'Esf Normal (kPa)',
    group: 'Corte Directo',
    module: 'corte',
    defaultWidth: 120,
    minWidth: 70,
    unit: 'kPa',
    decimals: 2,
    constraints: { positiveOnly: true, minHard: 0.0 },
    hint: 'Registrar en kPa',
    style: COLUMN_GROUP_STYLES.corte,
  }),
  decimalColumn({
    id: 'corte_esf_corte_kpa',
    header: 'Esf. Corte',
    excelName: 'Esf Corte (kPa)',
    group: 'Corte Directo',
    module: 'corte',
    defaultWidth: 120,
    minWidth: 70,
    unit: 'kPa',
    decimals: 2,
    constraints: { positiveOnly: true, minHard: 0.0 },
    hint: 'Registrar en kPa',
    style: COLUMN_GROUP_STYLES.corte,
  }),
  calculatedColumn({
    id: 'corte_esf_normal_mpa',
    header: 'Esf. Normal MPa',
    excelName: 'Esfuerzo Normal (MPa)',
    group: 'Corte Directo',
    module: 'corte',
    defaultWidth: 130,
    minWidth: 70,
    unit: 'MPa',
    decimals: 4,
    hint: 'Esfuerzo normal calculado en MPa',
    calculate: (row: Record<string, any>) => {
      const kpa = Number(row.corte_esf_normal_kpa);
      if (
        row.corte_esf_normal_kpa !== null &&
        row.corte_esf_normal_kpa !== undefined &&
        row.corte_esf_normal_kpa !== '' &&
        !isNaN(kpa)
      ) {
        return Number((kpa / 1000.0).toFixed(4));
      }
      return null;
    },
    style: COLUMN_GROUP_STYLES.corte,
  }),
  calculatedColumn({
    id: 'corte_esf_corte_mpa',
    header: 'Esf. Corte MPa',
    excelName: 'Esfuerzo de Corte (MPa)',
    group: 'Corte Directo',
    module: 'corte',
    defaultWidth: 130,
    minWidth: 70,
    unit: 'MPa',
    decimals: 4,
    hint: 'Esfuerzo de corte calculado en MPa',
    calculate: (row: Record<string, any>) => {
      const kpa = Number(row.corte_esf_corte_kpa);
      if (
        row.corte_esf_corte_kpa !== null &&
        row.corte_esf_corte_kpa !== undefined &&
        row.corte_esf_corte_kpa !== '' &&
        !isNaN(kpa)
      ) {
        return Number((kpa / 1000.0).toFixed(4));
      }
      return null;
    },
    style: COLUMN_GROUP_STYLES.corte,
  }),
  decimalColumn({
    id: 'corte_cohesion_mpa',
    header: 'Cohesión_CD',
    excelName: 'Cohesion (Mpa)',
    group: 'Corte Directo',
    module: 'corte',
    defaultWidth: 110,
    minWidth: 70,
    unit: 'MPa',
    decimals: 2,
    constraints: { positiveOnly: true, minHard: 0.0 },
    hint: 'Registrar en MPa',
    style: COLUMN_GROUP_STYLES.corte,
  }),
  decimalColumn({
    id: 'corte_angulo_friccion',
    header: 'Fricción_CD',
    excelName: 'Ang. Friccion (°)',
    group: 'Corte Directo',
    module: 'corte',
    defaultWidth: 110,
    minWidth: 70,
    unit: '°',
    decimals: 2,
    constraints: { positiveOnly: true, minHard: 0.0, maxHard: 90.0 },
    hint: 'Registrar en °',
    style: COLUMN_GROUP_STYLES.corte,
  }),

  // =========================================================================
  // GRUPO 7: Compresión Triaxial
  // =========================================================================
  decimalColumn({
    id: 'triaxial_carga_confinamiento',
    header: 'Confinamiento',
    excelName: 'Carga de confinamiento (MPa)',
    group: 'Compresión Triaxial',
    module: 'triaxial',
    defaultWidth: 140,
    minWidth: 80,
    unit: 'MPa',
    decimals: 2,
    constraints: { positiveOnly: true, minHard: 0.0 },
    hint: 'Registrar en MPa',
    style: COLUMN_GROUP_STYLES.triaxial,
  }),
  decimalColumn({
    id: 'triaxial_esfuerzo_maximo',
    header: 'Esfuerzo Máx.',
    excelName: 'Esfuerzo máximo (MPa)',
    group: 'Compresión Triaxial',
    module: 'triaxial',
    defaultWidth: 130,
    minWidth: 80,
    unit: 'MPa',
    decimals: 2,
    constraints: { positiveOnly: true, minSoft: 0.1 },
    hint: 'Registrar en MPa',
    style: COLUMN_GROUP_STYLES.triaxial,
  }),
  decimalColumn({
    id: 'triaxial_resistencia_mpa',
    header: 'Resist. Triaxial',
    excelName: 'Resistencia (Mpa)',
    group: 'Compresión Triaxial',
    module: 'triaxial',
    defaultWidth: 120,
    minWidth: 80,
    unit: 'MPa',
    decimals: 2,
    constraints: { positiveOnly: true, minSoft: 0.1 },
    hint: 'Registrar en MPa',
    style: COLUMN_GROUP_STYLES.triaxial,
  }),
  decimalColumn({
    id: 'triaxial_mi',
    header: 'Parámetro mi',
    excelName: 'mi',
    group: 'Compresión Triaxial',
    module: 'triaxial',
    defaultWidth: 100,
    minWidth: 70,
    decimals: 2,
    constraints: { positiveOnly: true, minSoft: 0.1 },
    hint: 'Parámetro de Hoek-Brown para roca intacta',
    style: COLUMN_GROUP_STYLES.triaxial,
  }),
  decimalColumn({
    id: 'triaxial_cohesion_mpa',
    header: 'Cohesión_TX',
    excelName: 'Cohesion (Mpa)',
    group: 'Compresión Triaxial',
    module: 'triaxial',
    defaultWidth: 110,
    minWidth: 70,
    unit: 'MPa',
    decimals: 2,
    constraints: { positiveOnly: true, minHard: 0.0 },
    hint: 'Registrar en MPa',
    style: COLUMN_GROUP_STYLES.triaxial,
  }),
  decimalColumn({
    id: 'triaxial_angulo_friccion',
    header: 'Fricción_TX',
    excelName: 'Ang. Friccion (°)',
    group: 'Compresión Triaxial',
    module: 'triaxial',
    defaultWidth: 110,
    minWidth: 70,
    unit: '°',
    decimals: 2,
    constraints: { positiveOnly: true, minHard: 0.0, maxHard: 90.0 },
    hint: 'Registrar en °',
    style: COLUMN_GROUP_STYLES.triaxial,
  }),
  textColumn({
    id: 'triaxial_rotura',
    header: 'Rotura_TX',
    excelName: 'Rotura',
    group: 'Compresión Triaxial',
    module: 'triaxial',
    defaultWidth: 100,
    minWidth: 70,
    hint: 'Descripción de la superficie de falla triaxial',
    style: COLUMN_GROUP_STYLES.triaxial,
  }),

  // =========================================================================
  // GRUPO 8: Validación y Cierre
  // =========================================================================
  calculatedColumn({
    id: 'qaqc_validacion',
    header: 'Validación QA/QC',
    excelName: 'Validación QA/QC',
    group: 'Validación y Cierre',
    module: 'common',
    defaultWidth: 125,
    minWidth: 100,
    maxWidth: 160,
    hint: 'Estado de validación geomecánica QA/QC',
    style: COLUMN_GROUP_STYLES.general,
  }),
  textColumn({
    id: 'observacion',
    header: 'Observación',
    excelName: 'Observación',
    group: 'Validación y Cierre',
    module: 'common',
    defaultWidth: 160,
    minWidth: 100,
    hint: 'Observaciones o notas de campo',
    style: COLUMN_GROUP_STYLES.general,
  }),
  textColumn({
    id: 'campana',
    header: 'Campaña',
    excelName: 'Campaña de Perforación',
    group: 'Validación y Cierre',
    module: 'common',
    defaultWidth: 130,
    minWidth: 80,
    hint: 'Campaña de perforación',
    style: COLUMN_GROUP_STYLES.general,
  }),

  // =========================================================================
  // GRUPO 9: Propiedades Físicas
  // =========================================================================
  decimalColumn({
    id: 'prop_peso_unitario_geometrico',
    header: 'Peso Unit. Geom.',
    excelName: 'Peso unitario geométrico (gr/cm3)',
    group: 'Propiedades Físicas',
    module: 'propiedades',
    defaultWidth: 160,
    minWidth: 90,
    unit: 'g/cm³',
    decimals: 2,
    constraints: { positiveOnly: true, minSoft: 1.0, maxSoft: 4.0 },
    hint: 'Registrar en g/cm³',
    style: COLUMN_GROUP_STYLES.propiedades,
  }),

  // =========================================================================
  // GRUPO 10: Acciones Fijas (Pinned Right)
  // =========================================================================
  actionColumn({
    id: 'acciones_col',
    header: 'Acciones',
    excelName: 'Acciones',
    group: 'Acciones',
    module: 'common',
    defaultWidth: 90,
    minWidth: 80,
    maxWidth: 120,
    pinned: 'right',
    hint: 'Operaciones rápidas sobre la fila',
    style: COLUMN_GROUP_STYLES.general,
  })
];

/** Mapa O(1) de columnas indexadas por ID */
export const COLUMNS_SCHEMA_MAP = new Map<string, ColumnSchema>(
  COLUMNS_SCHEMA.map(col => [col.id, col])
);

