export interface ColumnDef {
  index: number;
  dbName: string;
  excelName: string;
  colLetter: string;
  type: 'int' | 'float' | 'string';
  module: 'common' | 'ucs' | 'elasticas' | 'traccion' | 'corte' | 'triaxial' | 'propiedades';
  formula?: string;
  validation?: {
    min?: number;
    max?: number;
    options?: string[];
  };
}

export const COLUMNS_CONFIG: ColumnDef[] = [
  { index: 1, dbName: 'idd', excelName: 'IDD', colLetter: 'A', type: 'int', module: 'common', validation: { min: 1 } },
  { index: 2, dbName: 'sondaje', excelName: 'Sondaje diamantino', colLetter: 'B', type: 'string', module: 'common' },
  { index: 3, dbName: 'codigo_muestra', excelName: 'Código de muestra', colLetter: 'C', type: 'string', module: 'common' },
  { index: 4, dbName: 'laboratorio', excelName: 'Laboratorio', colLetter: 'D', type: 'string', module: 'common' },
  { index: 5, dbName: 'dia', excelName: 'Día', colLetter: 'E', type: 'int', module: 'common', validation: { min: 1, max: 31 } }, // NUEVO
  { index: 6, dbName: 'mes', excelName: 'Mes', colLetter: 'F', type: 'string', module: 'common' },
  { index: 7, dbName: 'anio', excelName: 'Año', colLetter: 'G', type: 'int', module: 'common', validation: { min: 1980, max: 2050 } },
  { index: 8, dbName: 'proyecto', excelName: 'Proyecto', colLetter: 'H', type: 'string', module: 'common' },
  { index: 9, dbName: 'desde', excelName: 'Desde (m)', colLetter: 'I', type: 'float', module: 'common', validation: { min: 0 } },
  { index: 10, dbName: 'hasta', excelName: 'Hasta (m)', colLetter: 'J', type: 'float', module: 'common', validation: { min: 0 } },
  { index: 11, dbName: 'longitud_muestra', excelName: 'Longitud de muestra (m)', colLetter: 'K', type: 'float', module: 'common', formula: 'hasta - desde' },
  { index: 12, dbName: 'este', excelName: 'Este (m)', colLetter: 'L', type: 'float', module: 'common', validation: { min: 0 } },
  { index: 13, dbName: 'norte', excelName: 'Norte (m)', colLetter: 'M', type: 'float', module: 'common', validation: { min: 0 } },
  { index: 14, dbName: 'elevacion', excelName: 'Elevación (msnm)', colLetter: 'N', type: 'float', module: 'common' },
  { index: 15, dbName: 'sectores', excelName: 'SECTORES', colLetter: 'O', type: 'string', module: 'common' },
  { index: 16, dbName: 'lito1', excelName: 'Lito 1', colLetter: 'P', type: 'string', module: 'common' },
  { index: 17, dbName: 'lito2', excelName: 'Lito 2', colLetter: 'Q', type: 'string', module: 'common' },
  { index: 18, dbName: 'lito3', excelName: 'Lito 3', colLetter: 'R', type: 'string', module: 'common' },
  { index: 19, dbName: 'tipo_ensayo', excelName: 'Tipo de ensayo', colLetter: 'S', type: 'string', module: 'common', validation: { options: ['UCS', 'Determinación de constantes elásticas', 'Tracción indirecta', 'Corte directo', 'Compresión triaxial'] } },

  // Compresión Uniaxial (UCS)
  { index: 20, dbName: 'ucs_diametro', excelName: 'Diámetro del testigo (cm)', colLetter: 'T', type: 'float', module: 'ucs', validation: { min: 1.0, max: 20.0 } },
  { index: 21, dbName: 'ucs_carga_rotura', excelName: 'Carga de rotura (kN)', colLetter: 'U', type: 'float', module: 'ucs', validation: { min: 0.1 } },
  { index: 22, dbName: 'ucs_resistencia', excelName: 'Resistencia a la compresión uniaxial (MPa)', colLetter: 'V', type: 'float', module: 'ucs', validation: { min: 0.1 } },
  { index: 23, dbName: 'ucs_resistencia_calculada', excelName: 'Resistencia calculada (MPa)', colLetter: 'W', type: 'float', module: 'ucs' },
  { index: 24, dbName: 'ucs_rotura', excelName: 'Rotura', colLetter: 'X', type: 'string', module: 'ucs' },

  // Constantes Elásticas
  { index: 25, dbName: 'elasticas_modulo_young', excelName: 'Modulo de Young (GPa)', colLetter: 'Y', type: 'float', module: 'elasticas', validation: { min: 1.0, max: 150.0 } },
  { index: 26, dbName: 'elasticas_poisson', excelName: 'Relación de Poisson', colLetter: 'Z', type: 'float', module: 'elasticas', validation: { min: 0.05, max: 0.45 } },

  // Tracción Indirecta
  { index: 27, dbName: 'traccion_carga_promedio', excelName: 'Carga de rotura promedio (kN)', colLetter: 'AA', type: 'float', module: 'traccion', validation: { min: 0.1 } },
  { index: 28, dbName: 'traccion_resistencia_kgcm2', excelName: 'Resistencia promedio (kg/cm2)', colLetter: 'AB', type: 'float', module: 'traccion', validation: { min: 0.1 } },
  { index: 29, dbName: 'traccion_vacia_28', excelName: 'Columna Vacía 28', colLetter: 'AC', type: 'string', module: 'traccion' },
  { index: 30, dbName: 'traccion_resistencia_mpa', excelName: 'Resistencia promedio (MPa)', colLetter: 'AD', type: 'float', module: 'traccion', validation: { min: 0.01 } },
  { index: 30.5, dbName: 'traccion_observaciones', excelName: 'Observaciones TI', colLetter: 'AD2', type: 'string', module: 'traccion' },

  // Corte Directo
  { index: 31, dbName: 'corte_tipo_fractura', excelName: 'Tipo de fractura', colLetter: 'AE', type: 'string', module: 'corte' },
  { index: 32, dbName: 'corte_area', excelName: 'Área de ensayo (cm2)', colLetter: 'AF', type: 'float', module: 'corte', validation: { min: 1.0 } },
  { index: 33, dbName: 'corte_esf_normal_kpa', excelName: 'Esf Normal (kPa)', colLetter: 'AG', type: 'float', module: 'corte', validation: { min: 0.0 } },
  { index: 34, dbName: 'corte_esf_corte_kpa', excelName: 'Esf Corte (kPa)', colLetter: 'AH', type: 'float', module: 'corte', validation: { min: 0.0 } },
  { index: 35, dbName: 'corte_esf_normal_mpa', excelName: 'Esfuerzo Normal (MPa)', colLetter: 'AI', type: 'float', module: 'corte' },
  { index: 36, dbName: 'corte_esf_corte_mpa', excelName: 'Esfuerzo de Corte (MPa)', colLetter: 'AJ', type: 'float', module: 'corte' },
  { index: 37, dbName: 'corte_cohesion_mpa', excelName: 'Cohesion (Mpa)', colLetter: 'AK', type: 'float', module: 'corte', validation: { min: 0.0 } },
  { index: 38, dbName: 'corte_angulo_friccion', excelName: 'Ang. Friccion (°)', colLetter: 'AL', type: 'float', module: 'corte', validation: { min: 0.0, max: 90.0 } },

  // Compresión Triaxial
  { index: 39, dbName: 'triaxial_carga_confinamiento', excelName: 'Carga de confinamiento (MPa)', colLetter: 'AM', type: 'float', module: 'triaxial', validation: { min: 0.0 } },
  { index: 40, dbName: 'triaxial_esfuerzo_maximo', excelName: 'Esfuerzo máximo (MPa)', colLetter: 'AN', type: 'float', module: 'triaxial', validation: { min: 0.1 } },
  { index: 41, dbName: 'triaxial_resistencia_mpa', excelName: 'Resistencia (Mpa)', colLetter: 'AO', type: 'float', module: 'triaxial', validation: { min: 0.1 } },
  { index: 42, dbName: 'triaxial_mi', excelName: 'mi', colLetter: 'AP', type: 'float', module: 'triaxial', validation: { min: 0.1 } },
  { index: 43, dbName: 'triaxial_cohesion_mpa', excelName: 'Cohesion (Mpa)', colLetter: 'AQ', type: 'float', module: 'triaxial', validation: { min: 0.0 } },
  { index: 44, dbName: 'triaxial_angulo_friccion', excelName: 'Ang. Friccion (°)', colLetter: 'AR', type: 'float', module: 'triaxial', validation: { min: 0.0, max: 90.0 } },
  { index: 45, dbName: 'triaxial_rotura', excelName: 'Rotura', colLetter: 'AS', type: 'string', module: 'triaxial' },

  // Propiedades Físicas
  { index: 46, dbName: 'prop_peso_unitario_geometrico', excelName: 'Peso unitario geométrico (gr/cm3)', colLetter: 'AT', type: 'float', module: 'propiedades', validation: { min: 1.0, max: 4.0 } },

  // Finalizadores
  { index: 47, dbName: 'observacion', excelName: 'Observación', colLetter: 'AU', type: 'string', module: 'common' },
  { index: 48, dbName: 'campana', excelName: 'Campaña de Perforación', colLetter: 'AV', type: 'string', module: 'common' }
];

export const getColumnsForModule = (moduleName: string): ColumnDef[] => {
  const commonColumns = COLUMNS_CONFIG.filter(col => col.module === 'common');
  if (moduleName === 'registro_maestro') {
    return COLUMNS_CONFIG;
  }
  const specColumns = COLUMNS_CONFIG.filter(col => col.module === moduleName);
  return [...commonColumns, ...specColumns];
};

export const clampValue = (dbName: string, value: any): any => {
  if (value === null || value === undefined || value === '') return '';

  const col = COLUMNS_CONFIG.find(c => c.dbName === dbName);
  if (!col) return value;

  if (col.type === 'int' || col.type === 'float') {
    let parsed = parseFloat(String(value).replace(/,/g, ''));
    if (isNaN(parsed)) return '';

    // Aplicación estricta de límites min/max definidos en el JSON de columnas
    if (col.validation) {
      if (col.validation.min !== undefined && parsed < col.validation.min) {
        parsed = col.validation.min;
      }
      if (col.validation.max !== undefined && parsed > col.validation.max) {
        parsed = col.validation.max;
      }
    }

    // Filtro para impedir valores negativos
    if (parsed < 0) parsed = 0;

    if (col.type === 'int') {
      return Math.round(parsed);
    } else {
      return parseFloat(parsed.toFixed(2));
    }
  }

  return String(value).trim();
};