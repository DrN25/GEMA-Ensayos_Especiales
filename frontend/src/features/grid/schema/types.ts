// frontend/src/features/grid/schema/types.ts

/**
 * Tipos de datos soportados por el esquema de columnas.
 * Nota: 'date' queda excluido hasta que exista una columna con formato fecha real.
 */
export type ColumnDataType = 'text' | 'integer' | 'decimal' | 'select' | 'readonly';

/**
 * Política de vacíos para cada columna:
 * - 'allowed': Acepta valor vacío (null, undefined, '', '-', '--') sin alerta.
 * - 'warn': Emite AVISO si está vacío.
 * - 'block': Emite CRÍTICO si está vacío (bloquea guardado bajo política estricta).
 */
export type EmptyPolicy = 'allowed' | 'warn' | 'block';

/**
 * Severidad de anomalías geomecánicas y de validación.
 */
export type AlertSeverity = 'CRÍTICO' | 'AVISO';

/**
 * Tokens globales reconocidos como vacío.
 * REGLA ACORDADA: Estrictamente '-' y '--'. 'N/A' y '—' quedan excluidos.
 * El token '-1' solo puede agregarse como opt-in por columna (extraEmptyTokens).
 */
export const GLOBAL_EMPTY_TOKENS: readonly string[] = ['-', '--'];

/**
 * Estructura de alerta QA/QC unificada en todo el sistema.
 */
export interface QAQCAlert {
  idd: number;
  field: string;
  type: AlertSeverity;
  message: string;
  tab: string;
  value?: any;
}

/**
 * Restricciones físicas y geomecánicas de una columna.
 */
export interface ColumnConstraints {
  /** Si es true y el valor es < 0, emite alerta CRÍTICA instantánea */
  positiveOnly?: boolean;
  /** Límite físico infranqueable mínimo (ej: gravedad o resistencia negativa) -> CRÍTICO */
  minHard?: number;
  /** Límite físico infranqueable máximo -> CRÍTICO */
  maxHard?: number;
  /** Límite geomecánico recomendado inferior -> AVISO */
  minSoft?: number;
  /** Límite geomecánico recomendado superior -> AVISO */
  maxSoft?: number;
  /** Longitud máxima de texto */
  maxLength?: number;
}

/**
 * Configuración visual y tipográfica opcional para una columna (cabecera y celdas).
 */
export interface ColumnStyleConfig {
  /** Color/clase de fondo para la cabecera <th> (ej: 'bg-orange-950/80', '#1c1917') */
  headerBg?: string;
  /** Color/clase de texto para la cabecera (ej: 'text-orange-200', '#fdba74') */
  headerText?: string;
  /** Color/clase de fondo para las celdas <td> (ej: 'bg-navy-950/40', '#0f172a') */
  cellBg?: string;
  /** Color/clase de texto para las celdas (ej: 'text-slate-200', '#e2e8f0') */
  cellText?: string;
  /** Si el texto de las celdas debe renderizarse en negrita */
  bold?: boolean;
  /** Si el texto de las celdas debe renderizarse en cursiva */
  italic?: boolean;
  /** Si el texto de las celdas debe forzarse a mayúsculas ('uppercase') */
  uppercase?: boolean;
}

/**
 * Contrato Single Source of Truth (SSOT) para una columna.
 */
export interface ColumnSchema<TRow = Record<string, any>> {
  id: string;                                   // Clave en base de datos / objeto
  header: string;                               // Etiqueta compacta en grid
  excelName: string;                            // Etiqueta formal en Excel
  group: string;                                // Grupo de 2 niveles
  module: string;                               // Módulo geomecánico
  /** Módulos específicos donde la columna es visible (ej: ['traccion']). Si se omite, se usa la regla estándar */
  visibleIn?: string[];
  type: ColumnDataType;
  decimals?: number;                            // Precisión decimal
  unit?: string;                                // Unidad ('m', 'cm', 'MPa', 'kN', '°')
  hint?: string;                                // Tooltip explicativo
  displayHint?: string;                         // Mensaje contextual de redondeo visual
  pinned?: 'left' | 'right' | false;            // Fijación lateral
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  editor: 'text' | 'select' | 'number' | 'none';

  // Configuración de estilo visual y tipográfico
  style?: ColumnStyleConfig;

  // Reglas de validación y vacíos
  constraints?: ColumnConstraints;
  emptyPolicy: EmptyPolicy;
  /** Tokens adicionales de vacío específicos de la columna (ej: ['-1'] en perforaciones) */
  extraEmptyTokens?: string[];
  /** Tokens que no deben considerarse vacíos aunque coincidan con los globales */
  emptyTokensExclude?: string[];
  /** Opciones estáticas para selects cerrados */
  options?: string[];
  /** Clave para inyección dinámica de catálogos (proyectos, laboratorios) */
  dynamicOptionsKey?: 'proyectos' | 'laboratorios';

  // Lógica funcional pura
  /** Autogeneración declarativa (ej: codigo_muestra a partir de sondaje e idd) */
  autoGenerate?: (row: TRow) => string;
  /** Cálculo puro en memoria para campos derivados (ej: hasta - desde) */
  calculate?: (row: TRow) => any;
  /** Formateador puro para visualización en celda */
  format?: (val: any) => string;
  /** Validadores específicos adicionales */
  customValidators?: ((val: any, row: TRow) => QAQCAlert | null)[];
}

/**
 * Regla condicional / de dependencia declarativa entre columnas.
 * "Si columna X tiene valor [o tipo_ensayo = T], entonces columna Y debe tener valor".
 */
export interface ConditionalDependencyRule {
  id: string;
  name: string;
  enabled: boolean;
  severity: AlertSeverity;
  tab?: string;
  when: {
    fieldsWithAnyValue?: string[];
    tipoEnsayoEquals?: string;
    customPredicate?: (row: Record<string, any>) => boolean;
  };
  then: {
    requiredField: string;
    message: string | ((row: Record<string, any>) => string);
  };
}

/**
 * Configuración de la regla de tolerancia entre columnas (ej: ucs_resistencia vs calculada).
 */
export interface ToleranceRuleConfig {
  id: string;
  name: string;
  enabled: boolean;
  sourceField: string;
  targetField: string;
  tab: string;
  /** Umbral de diferencia relativa en porcentaje (por defecto 1.0%) */
  thresholdPercent: number;
}
