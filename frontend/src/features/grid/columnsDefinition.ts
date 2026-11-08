// frontend/src/features/grid/columnsDefinition.ts
import type { GridColumnDef } from './types';

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

export const GRID_COLUMNS_DEFINITION: GridColumnDef[] = [
  // =========================================================================
  // GRUPO 1: Identificación de Muestra (Pinned Left)
  // =========================================================================
  {
    id: 'idd',
    header: 'IDD',
    group: 'Identificación de Muestra',
    accessorKey: 'idd',
    defaultWidth: 80,
    minWidth: 60,
    maxWidth: 120,
    pinned: 'left',
    type: 'readonly',
    editor: 'none',
    hint: 'Identificador único del registro'
  },
  {
    id: 'sondaje',
    header: 'Sondaje',
    group: 'Identificación de Muestra',
    accessorKey: 'sondaje',
    defaultWidth: 130,
    minWidth: 90,
    maxWidth: 200,
    pinned: 'left',
    type: 'string',
    editor: 'text',
    hint: 'Identificador del sondaje diamantino'
  },
  {
    id: 'codigo_muestra',
    header: 'Código Muestra',
    group: 'Identificación de Muestra',
    accessorKey: 'codigo_muestra',
    defaultWidth: 160,
    minWidth: 110,
    maxWidth: 240,
    pinned: 'left',
    type: 'string',
    editor: 'text',
    hint: 'Código único de la probeta para geotecnia'
  },

  // =========================================================================
  // GRUPO 2: Datos Comunes de Campo
  // =========================================================================
  {
    id: 'laboratorio',
    header: 'Laboratorio',
    group: 'Datos Comunes de Campo',
    accessorKey: 'laboratorio',
    defaultWidth: 110,
    minWidth: 80,
    type: 'string',
    editor: 'text',
    hint: 'Entidad ejecutora del ensayo'
  },
  {
    id: 'dia',
    header: 'Día',
    group: 'Datos Comunes de Campo',
    accessorKey: 'dia',
    defaultWidth: 70,
    minWidth: 50,
    type: 'number',
    editor: 'number',
    validations: { min: 1, max: 31 },
    hint: 'Día de ejecución (1 - 31)'
  },
  {
    id: 'mes',
    header: 'Mes',
    group: 'Datos Comunes de Campo',
    accessorKey: 'mes',
    defaultWidth: 90,
    minWidth: 80,
    type: 'select',
    editor: 'select',
    options: MESES_OPTIONS,
    hint: 'Mes de ejecución del ensayo'
  },
  {
    id: 'anio',
    header: 'Año',
    group: 'Datos Comunes de Campo',
    accessorKey: 'anio',
    defaultWidth: 80,
    minWidth: 60,
    type: 'number',
    editor: 'number',
    validations: { min: 1980, max: 2050 },
    hint: 'Año de ejecución (1980 - 2050)'
  },
  {
    id: 'proyecto',
    header: 'Proyecto',
    group: 'Datos Comunes de Campo',
    accessorKey: 'proyecto',
    defaultWidth: 130,
    minWidth: 90,
    type: 'select',
    editor: 'select',
    hint: 'Proyecto minero o geológico asociado'
  },
  {
    id: 'desde',
    header: 'Desde',
    group: 'Datos Comunes de Campo',
    accessorKey: 'desde',
    defaultWidth: 90,
    minWidth: 70,
    type: 'number',
    editor: 'number',
    validations: { min: 0 },
    unit: 'm',
    hint: 'Profundidad inicial en metros'
  },
  {
    id: 'hasta',
    header: 'Hasta',
    group: 'Datos Comunes de Campo',
    accessorKey: 'hasta',
    defaultWidth: 90,
    minWidth: 70,
    type: 'number',
    editor: 'number',
    validations: { min: 0 },
    unit: 'm',
    hint: 'Profundidad final en metros'
  },
  {
    id: 'longitud_muestra',
    header: 'Longitud Muestra',
    group: 'Datos Comunes de Campo',
    accessorKey: 'longitud_muestra',
    defaultWidth: 140,
    minWidth: 90,
    type: 'readonly',
    editor: 'none',
    unit: 'm',
    formula: 'hasta - desde',
    hint: 'Longitud calculada de la muestra (hasta - desde)'
  },
  {
    id: 'este',
    header: 'Este',
    group: 'Datos Comunes de Campo',
    accessorKey: 'este',
    defaultWidth: 100,
    minWidth: 70,
    type: 'number',
    editor: 'number',
    validations: { min: 0 },
    unit: 'm',
    hint: 'Coordenada Este UTM (m)'
  },
  {
    id: 'norte',
    header: 'Norte',
    group: 'Datos Comunes de Campo',
    accessorKey: 'norte',
    defaultWidth: 100,
    minWidth: 70,
    type: 'number',
    editor: 'number',
    validations: { min: 0 },
    unit: 'm',
    hint: 'Coordenada Norte UTM (m)'
  },
  {
    id: 'elevacion',
    header: 'Elevación',
    group: 'Datos Comunes de Campo',
    accessorKey: 'elevacion',
    defaultWidth: 100,
    minWidth: 70,
    type: 'number',
    editor: 'number',
    unit: 'msnm',
    hint: 'Elevación topográfica en metros sobre el nivel del mar'
  },
  {
    id: 'sectores',
    header: 'Sectores',
    group: 'Datos Comunes de Campo',
    accessorKey: 'sectores',
    defaultWidth: 110,
    minWidth: 80,
    type: 'string',
    editor: 'text',
    hint: 'Sector o zona geomecánica'
  },
  {
    id: 'lito1',
    header: 'Lito 1',
    group: 'Datos Comunes de Campo',
    accessorKey: 'lito1',
    defaultWidth: 90,
    minWidth: 70,
    type: 'string',
    editor: 'text',
    hint: 'Litología principal del testigo'
  },
  {
    id: 'lito2',
    header: 'Lito 2',
    group: 'Datos Comunes de Campo',
    accessorKey: 'lito2',
    defaultWidth: 90,
    minWidth: 70,
    type: 'string',
    editor: 'text',
    hint: 'Litología secundaria'
  },
  {
    id: 'lito3',
    header: 'Lito 3',
    group: 'Datos Comunes de Campo',
    accessorKey: 'lito3',
    defaultWidth: 90,
    minWidth: 70,
    type: 'string',
    editor: 'text',
    hint: 'Litología terciaria o alteración'
  },
  {
    id: 'tipo_ensayo',
    header: 'Tipo Ensayo',
    group: 'Datos Comunes de Campo',
    accessorKey: 'tipo_ensayo',
    defaultWidth: 150,
    minWidth: 100,
    type: 'select',
    editor: 'select',
    options: TIPO_ENSAYO_OPTIONS,
    hint: 'Tipo de ensayo geomecánico de laboratorio'
  },
  {
    id: 'observacion',
    header: 'Observación',
    group: 'Datos Comunes de Campo',
    accessorKey: 'observacion',
    defaultWidth: 160,
    minWidth: 100,
    type: 'string',
    editor: 'text',
    hint: 'Observaciones o notas de campo'
  },
  {
    id: 'campana',
    header: 'Campaña',
    group: 'Datos Comunes de Campo',
    accessorKey: 'campana',
    defaultWidth: 130,
    minWidth: 80,
    type: 'string',
    editor: 'text',
    hint: 'Campaña de perforación'
  },

  // =========================================================================
  // GRUPO 3: Ensayo de Compresión Simple (UCS)
  // =========================================================================
  {
    id: 'ucs_diametro',
    header: 'Diámetro',
    group: 'Ensayo UCS',
    accessorKey: 'ucs_diametro',
    defaultWidth: 120,
    minWidth: 80,
    type: 'number',
    editor: 'number',
    validations: { min: 1.0, max: 20.0 },
    unit: 'cm',
    hint: 'Diámetro del testigo cilíndrico (1.0 - 20.0 cm)'
  },
  {
    id: 'ucs_carga_rotura',
    header: 'Carga Rotura',
    group: 'Ensayo UCS',
    accessorKey: 'ucs_carga_rotura',
    defaultWidth: 120,
    minWidth: 80,
    type: 'number',
    editor: 'number',
    validations: { min: 0.1 },
    unit: 'kN',
    hint: 'Carga máxima aplicada al fallo (kN)'
  },
  {
    id: 'ucs_resistencia',
    header: 'Resistencia UCS',
    group: 'Ensayo UCS',
    accessorKey: 'ucs_resistencia',
    defaultWidth: 140,
    minWidth: 90,
    type: 'number',
    editor: 'number',
    validations: { min: 0.1 },
    unit: 'MPa',
    hint: 'Resistencia a compresión uniaxial reportada (MPa)'
  },
  {
    id: 'ucs_resistencia_calculada',
    header: 'Resistencia Calc.',
    group: 'Ensayo UCS',
    accessorKey: 'ucs_resistencia_calculada',
    defaultWidth: 140,
    minWidth: 90,
    type: 'readonly',
    editor: 'none',
    unit: 'MPa',
    hint: 'Resistencia calculada a partir de carga y diámetro'
  },
  {
    id: 'ucs_rotura',
    header: 'Modo Rotura',
    group: 'Ensayo UCS',
    accessorKey: 'ucs_rotura',
    defaultWidth: 100,
    minWidth: 70,
    type: 'string',
    editor: 'text',
    hint: 'Patrón o tipo de fracturamiento'
  },

  // =========================================================================
  // GRUPO 4: Constantes Elásticas
  // =========================================================================
  {
    id: 'elasticas_modulo_young',
    header: 'Módulo Young',
    group: 'Constantes Elásticas',
    accessorKey: 'elasticas_modulo_young',
    defaultWidth: 130,
    minWidth: 80,
    type: 'number',
    editor: 'number',
    validations: { min: 1.0, max: 150.0 },
    unit: 'GPa',
    hint: 'Módulo de elasticidad estático (1.0 - 150.0 GPa)'
  },
  {
    id: 'elasticas_poisson',
    header: 'Relación Poisson',
    group: 'Constantes Elásticas',
    accessorKey: 'elasticas_poisson',
    defaultWidth: 110,
    minWidth: 70,
    type: 'number',
    editor: 'number',
    validations: { min: 0.05, max: 0.45 },
    hint: 'Relación de Poisson estática (0.05 - 0.45)'
  },

  // =========================================================================
  // GRUPO 5: Tracción Indirecta (Brasileño)
  // =========================================================================
  {
    id: 'traccion_carga_promedio',
    header: 'Carga Prom.',
    group: 'Tracción Indirecta',
    accessorKey: 'traccion_carga_promedio',
    defaultWidth: 140,
    minWidth: 80,
    type: 'number',
    editor: 'number',
    validations: { min: 0.1 },
    unit: 'kN',
    hint: 'Carga de rotura promedio (kN)'
  },
  {
    id: 'traccion_resistencia_kgcm2',
    header: 'Resist. kg/cm²',
    group: 'Tracción Indirecta',
    accessorKey: 'traccion_resistencia_kgcm2',
    defaultWidth: 140,
    minWidth: 80,
    type: 'number',
    editor: 'number',
    unit: 'kg/cm²',
    hint: 'Resistencia a la tracción indirecta en kg/cm²'
  },
  {
    id: 'traccion_vacia_28',
    header: 'Tracción 28',
    group: 'Tracción Indirecta',
    accessorKey: 'traccion_vacia_28',
    defaultWidth: 120,
    minWidth: 70,
    type: 'number',
    editor: 'number',
    hint: 'Campo auxiliar de ensayo brasileño'
  },
  {
    id: 'traccion_resistencia_mpa',
    header: 'Resist. MPa',
    group: 'Tracción Indirecta',
    accessorKey: 'traccion_resistencia_mpa',
    defaultWidth: 140,
    minWidth: 80,
    type: 'number',
    editor: 'number',
    unit: 'MPa',
    hint: 'Resistencia a la tracción indirecta en MPa'
  },

  // =========================================================================
  // GRUPO 6: Corte Directo en Roca
  // =========================================================================
  {
    id: 'corte_tipo_fractura',
    header: 'Tipo Fractura',
    group: 'Corte Directo',
    accessorKey: 'corte_tipo_fractura',
    defaultWidth: 130,
    minWidth: 80,
    type: 'string',
    editor: 'text',
    hint: 'Descripción del plano de discontinuidad'
  },
  {
    id: 'corte_area',
    header: 'Área',
    group: 'Corte Directo',
    accessorKey: 'corte_area',
    defaultWidth: 120,
    minWidth: 70,
    type: 'number',
    editor: 'number',
    validations: { min: 0.1 },
    unit: 'cm²',
    hint: 'Área nominal de la sección de corte (cm²)'
  },
  {
    id: 'corte_esf_normal_kpa',
    header: 'Esf. Normal',
    group: 'Corte Directo',
    accessorKey: 'corte_esf_normal_kpa',
    defaultWidth: 120,
    minWidth: 70,
    type: 'number',
    editor: 'number',
    validations: { min: 0.1 },
    unit: 'kPa',
    hint: 'Esfuerzo normal aplicado (kPa)'
  },
  {
    id: 'corte_esf_corte_kpa',
    header: 'Esf. Corte',
    group: 'Corte Directo',
    accessorKey: 'corte_esf_corte_kpa',
    defaultWidth: 120,
    minWidth: 70,
    type: 'number',
    editor: 'number',
    validations: { min: 0.1 },
    unit: 'kPa',
    hint: 'Esfuerzo cortante medido al pico (kPa)'
  },
  {
    id: 'corte_esf_normal_mpa',
    header: 'Esf. Normal MPa',
    group: 'Corte Directo',
    accessorKey: 'corte_esf_normal_mpa',
    defaultWidth: 130,
    minWidth: 70,
    type: 'number',
    editor: 'number',
    unit: 'MPa',
    hint: 'Esfuerzo normal convertido a MPa'
  },
  {
    id: 'corte_esf_corte_mpa',
    header: 'Esf. Corte MPa',
    group: 'Corte Directo',
    accessorKey: 'corte_esf_corte_mpa',
    defaultWidth: 130,
    minWidth: 70,
    type: 'number',
    editor: 'number',
    unit: 'MPa',
    hint: 'Esfuerzo cortante convertido a MPa'
  },
  {
    id: 'corte_cohesion_mpa',
    header: 'Cohesión (c)',
    group: 'Corte Directo',
    accessorKey: 'corte_cohesion_mpa',
    defaultWidth: 110,
    minWidth: 70,
    type: 'number',
    editor: 'number',
    unit: 'MPa',
    hint: 'Cohesión del contacto o roca intacta (MPa)'
  },
  {
    id: 'corte_angulo_friccion',
    header: 'Fricción (φ)',
    group: 'Corte Directo',
    accessorKey: 'corte_angulo_friccion',
    defaultWidth: 110,
    minWidth: 70,
    type: 'number',
    editor: 'number',
    validations: { min: 0, max: 90 },
    unit: '°',
    hint: 'Ángulo de fricción interna (0° - 90°)'
  },

  // =========================================================================
  // GRUPO 7: Compresión Triaxial
  // =========================================================================
  {
    id: 'triaxial_carga_confinamiento',
    header: 'Confinamiento',
    group: 'Compresión Triaxial',
    accessorKey: 'triaxial_carga_confinamiento',
    defaultWidth: 140,
    minWidth: 80,
    type: 'number',
    editor: 'number',
    validations: { min: 0 },
    unit: 'MPa',
    hint: 'Presión de confinamiento σ3 (MPa)'
  },
  {
    id: 'triaxial_esfuerzo_maximo',
    header: 'Esfuerzo Máx.',
    group: 'Compresión Triaxial',
    accessorKey: 'triaxial_esfuerzo_maximo',
    defaultWidth: 130,
    minWidth: 80,
    type: 'number',
    editor: 'number',
    validations: { min: 0.1 },
    unit: 'MPa',
    hint: 'Esfuerzo desviador o principal al fallo σ1 (MPa)'
  },
  {
    id: 'triaxial_resistencia_mpa',
    header: 'Resist. Triaxial',
    group: 'Compresión Triaxial',
    accessorKey: 'triaxial_resistencia_mpa',
    defaultWidth: 120,
    minWidth: 80,
    type: 'number',
    editor: 'number',
    unit: 'MPa',
    hint: 'Resistencia a compresión confinada'
  },
  {
    id: 'triaxial_mi',
    header: 'Parámetro mi',
    group: 'Compresión Triaxial',
    accessorKey: 'triaxial_mi',
    defaultWidth: 100,
    minWidth: 70,
    type: 'number',
    editor: 'number',
    hint: 'Parámetro de Hoek-Brown para roca intacta'
  },
  {
    id: 'triaxial_cohesion_mpa',
    header: 'Cohesión TX',
    group: 'Compresión Triaxial',
    accessorKey: 'triaxial_cohesion_mpa',
    defaultWidth: 110,
    minWidth: 70,
    type: 'number',
    editor: 'number',
    unit: 'MPa',
    hint: 'Cohesión equivalente Mohr-Coulomb (MPa)'
  },
  {
    id: 'triaxial_angulo_friccion',
    header: 'Fricción TX',
    group: 'Compresión Triaxial',
    accessorKey: 'triaxial_angulo_friccion',
    defaultWidth: 110,
    minWidth: 70,
    type: 'number',
    editor: 'number',
    validations: { min: 0, max: 90 },
    unit: '°',
    hint: 'Ángulo de fricción equivalente Mohr-Coulomb'
  },
  {
    id: 'triaxial_rotura',
    header: 'Rotura TX',
    group: 'Compresión Triaxial',
    accessorKey: 'triaxial_rotura',
    defaultWidth: 100,
    minWidth: 70,
    type: 'string',
    editor: 'text',
    hint: 'Descripción de la superficie de falla triaxial'
  },

  // =========================================================================
  // GRUPO 8: Propiedades Físicas
  // =========================================================================
  {
    id: 'prop_peso_unitario_geometrico',
    header: 'Peso Unit. Geom.',
    group: 'Propiedades Físicas',
    accessorKey: 'prop_peso_unitario_geometrico',
    defaultWidth: 160,
    minWidth: 90,
    type: 'number',
    editor: 'number',
    validations: { min: 0.1, max: 5.0 },
    unit: 'g/cm³',
    hint: 'Densidad o peso unitario por método geométrico (0.1 - 5.0 g/cm³)'
  },

  // =========================================================================
  // GRUPO 9: Acciones Fijas (Pinned Right)
  // =========================================================================
  {
    id: 'acciones_col',
    header: 'Acciones',
    group: 'Acciones',
    accessorKey: 'acciones_col',
    defaultWidth: 90,
    minWidth: 80,
    maxWidth: 120,
    pinned: 'right',
    type: 'readonly',
    editor: 'none',
    hint: 'Operaciones rápidas sobre la fila'
  }
];

/**
 * Filtra las definiciones de columna para el módulo geomecánico activo.
 */
export function getGridColumnsForModule(
  moduleName: string,
  customSelectOptions?: { proyectos?: string[]; laboratorios?: string[] }
): GridColumnDef[] {
  const isMaster = moduleName === 'registro_maestro';

  return GRID_COLUMNS_DEFINITION.filter(col => {
    if (isMaster) return true;

    // Para un módulo específico, siempre incluir columnas de Identificación y Acciones
    if (col.group === 'Identificación de Muestra' || col.group === 'Acciones') {
      return true;
    }

    // Datos Comunes
    if (col.group === 'Datos Comunes de Campo') {
      return true;
    }

    // Filtro por ensayo
    if (moduleName === 'ucs' && col.group === 'Ensayo UCS') return true;
    if (moduleName === 'elasticas' && col.group === 'Constantes Elásticas') return true;
    if (moduleName === 'traccion' && col.group === 'Tracción Indirecta') return true;
    if (moduleName === 'corte' && col.group === 'Corte Directo') return true;
    if (moduleName === 'triaxial' && col.group === 'Compresión Triaxial') return true;
    if (moduleName === 'propiedades' && col.group === 'Propiedades Físicas') return true;

    return false;
  }).map(col => {
    // Inyectar dinámicamente opciones personalizadas de proyectos si existen
    if (col.id === 'proyecto' && customSelectOptions?.proyectos) {
      return { ...col, options: customSelectOptions.proyectos };
    }
    if (col.id === 'laboratorio' && customSelectOptions?.laboratorios) {
      return { ...col, options: customSelectOptions.laboratorios };
    }
    return col;
  });
}
