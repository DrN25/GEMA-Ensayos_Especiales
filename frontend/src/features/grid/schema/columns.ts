// frontend/src/features/grid/schema/columns.ts
import type { ColumnSchema } from './types';
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
    hint: 'Identificador único del registro'
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
    hint: 'Identificador del sondaje diamantino'
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
      row.sondaje ? `${row.sondaje}-UCS-M${String(row.idd || 0).padStart(2, '0')}` : ''
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
    hint: 'Entidad ejecutora del ensayo'
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
    hint: 'Día de ejecución (1 - 31)'
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
    hint: 'Mes de ejecución del ensayo'
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
    hint: 'Año de ejecución (1980 - 2050)'
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
    hint: 'Proyecto minero o geológico asociado'
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
    hint: 'Registrar en metros (m)'
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
    hint: 'Registrar en metros (m)'
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
    }
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
    hint: 'Registrar en metros (m) UTM Este'
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
    hint: 'Registrar en metros (m) UTM Norte'
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
    hint: 'Registrar en msnm'
  }),
  textColumn({
    id: 'sectores',
    header: 'Sectores',
    excelName: 'SECTORES',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 110,
    minWidth: 80,
    hint: 'Sector o zona geomecánica'
  }),
  textColumn({
    id: 'lito1',
    header: 'Lito 1',
    excelName: 'Lito 1',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 90,
    minWidth: 70,
    hint: 'Litología principal del testigo'
  }),
  textColumn({
    id: 'lito2',
    header: 'Lito 2',
    excelName: 'Lito 2',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 90,
    minWidth: 70,
    hint: 'Litología secundaria'
  }),
  textColumn({
    id: 'lito3',
    header: 'Lito 3',
    excelName: 'Lito 3',
    group: 'Datos Comunes de Campo',
    module: 'common',
    defaultWidth: 90,
    minWidth: 70,
    hint: 'Litología terciaria o alteración'
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
    hint: 'Tipo de ensayo geomecánico de laboratorio'
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
    hint: 'Registrar en cm'
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
    hint: 'Registre la unidad en kN'
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
    hint: 'Registrar en MPa'
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
    }
  }),
  textColumn({
    id: 'ucs_rotura',
    header: 'Rotura_UCS',
    excelName: 'Rotura',
    group: 'Ensayo UCS',
    module: 'ucs',
    defaultWidth: 100,
    minWidth: 70,
    hint: 'Patrón o tipo de fracturamiento'
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
    hint: 'Registrar en GPa'
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
    hint: 'Relación de Poisson estática (0.05 - 0.45)'
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
    hint: 'Registre la unidad en kN'
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
    hint: 'Registre en kg/cm²'
  }),
  textColumn({
    id: 'traccion_vacia_28',
    header: 'Tracción 28',
    excelName: 'Columna Vacía 28',
    group: 'Tracción Indirecta',
    module: 'traccion',
    defaultWidth: 120,
    minWidth: 70,
    hint: 'Campo auxiliar de ensayo brasileño'
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
    hint: 'Registre en MPa'
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
    hint: 'Observaciones específicas de los ensayos de tracción indirecta'
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
    hint: 'Descripción del plano de discontinuidad'
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
    hint: 'Registrar en cm²'
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
    hint: 'Registrar en kPa'
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
    hint: 'Registrar en kPa'
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
    }
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
    }
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
    hint: 'Registrar en MPa'
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
    hint: 'Registrar en °'
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
    hint: 'Registrar en MPa'
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
    hint: 'Registrar en MPa'
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
    hint: 'Registrar en MPa'
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
    hint: 'Parámetro de Hoek-Brown para roca intacta'
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
    hint: 'Registrar en MPa'
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
    hint: 'Registrar en °'
  }),
  textColumn({
    id: 'triaxial_rotura',
    header: 'Rotura_TX',
    excelName: 'Rotura',
    group: 'Compresión Triaxial',
    module: 'triaxial',
    defaultWidth: 100,
    minWidth: 70,
    hint: 'Descripción de la superficie de falla triaxial'
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
    hint: 'Estado de validación geomecánica QA/QC'
  }),
  textColumn({
    id: 'observacion',
    header: 'Observación',
    excelName: 'Observación',
    group: 'Validación y Cierre',
    module: 'common',
    defaultWidth: 160,
    minWidth: 100,
    hint: 'Observaciones o notas de campo'
  }),
  textColumn({
    id: 'campana',
    header: 'Campaña',
    excelName: 'Campaña de Perforación',
    group: 'Validación y Cierre',
    module: 'common',
    defaultWidth: 130,
    minWidth: 80,
    hint: 'Campaña de perforación'
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
    hint: 'Registrar en g/cm³'
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
    hint: 'Operaciones rápidas sobre la fila'
  })
];

/** Mapa O(1) de columnas indexadas por ID */
export const COLUMNS_SCHEMA_MAP = new Map<string, ColumnSchema>(
  COLUMNS_SCHEMA.map(col => [col.id, col])
);

