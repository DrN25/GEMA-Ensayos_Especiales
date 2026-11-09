// frontend/src/features/grid/schema/validationEngine.ts
import type { ColumnSchema, QAQCAlert } from './types';
import { GLOBAL_EMPTY_TOKENS } from './types';
import { evaluateConditionalRules, evaluateToleranceRule } from './dependencyRules';

export interface ValidationContext {
  proyectos?: string[];
  laboratorios?: string[];
  [key: string]: any;
}

/**
 * Determina de forma pura si un valor debe considerarse "vacío".
 * REGLAS ACORDADAS:
 * - null, undefined o string vacío ('') son vacíos.
 * - GLOBAL_EMPTY_TOKENS: estrictamente '-' y '--'.
 * - extraTokens: opt-in por columna (ej: ['-1']).
 * - excludedTokens: tokens que la columna no permite tratar como vacío.
 */
export function isEmptyValue(
  val: any,
  extraTokens?: string[],
  excludedTokens?: string[]
): boolean {
  if (val === null || val === undefined) return true;

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return true;

    if (excludedTokens && excludedTokens.includes(trimmed)) {
      return false;
    }

    if (GLOBAL_EMPTY_TOKENS.includes(trimmed)) {
      return true;
    }

    if (extraTokens && extraTokens.includes(trimmed)) {
      return true;
    }
  }

  return false;
}

/**
 * Valida una única celda de forma pura contra su ColumnSchema.
 * PRECEDENCIA Y REGLA DE ORO:
 * Emite como máximo UNA alerta por celda (la más severa), eliminando
 * completamente la colisión doble CRÍTICO + AVISO.
 */
export function validateCell(
  val: any,
  row: Record<string, any>,
  col: ColumnSchema,
  context?: ValidationContext
): QAQCAlert | null {
  const idd = Number(row.idd) || 0;
  const tab = col.module === 'common' ? 'registro_maestro' : col.module;

  // -------------------------------------------------------------------------
  // 1. EVALUACIÓN DE VACÍOS
  // -------------------------------------------------------------------------
  if (isEmptyValue(val, col.extraEmptyTokens, col.emptyTokensExclude)) {
    if (col.emptyPolicy === 'block') {
      return {
        idd,
        field: col.id,
        type: 'CRÍTICO',
        message: `El campo "${col.excelName}" es requerido y no puede estar vacío.`,
        tab,
        value: val
      };
    }
    if (col.emptyPolicy === 'warn') {
      return {
        idd,
        field: col.id,
        type: 'AVISO',
        message: `El campo "${col.excelName}" está vacío.`,
        tab,
        value: val
      };
    }
    // emptyPolicy === 'allowed' -> Vacío legítimo, no genera alerta
    return null;
  }

  // -------------------------------------------------------------------------
  // 2. VERIFICACIÓN DE TIPO Y SINTAXIS (CRÍTICO)
  // -------------------------------------------------------------------------
  if (col.type === 'integer' || col.type === 'decimal') {
    const strVal = String(val).trim();
    const num = Number(strVal);

    if (isNaN(num)) {
      return {
        idd,
        field: col.id,
        type: 'CRÍTICO',
        message: `El campo "${col.excelName}" debe contener un valor numérico válido (recibido: "${val}").`,
        tab,
        value: val
      };
    }

    if (col.type === 'integer' && !Number.isInteger(num)) {
      return {
        idd,
        field: col.id,
        type: 'CRÍTICO',
        message: `El campo "${col.excelName}" debe ser un número entero (recibido: "${val}").`,
        tab,
        value: val
      };
    }

    // -----------------------------------------------------------------------
    // 3. LÍMITES FÍSICOS DUROS (CRÍTICO)
    // -----------------------------------------------------------------------
    if (col.constraints?.positiveOnly && num < 0) {
      return {
        idd,
        field: col.id,
        type: 'CRÍTICO',
        message: `El campo "${col.excelName}" no acepta valores negativos (${num}).`,
        tab,
        value: val
      };
    }

    if (col.constraints?.minHard !== undefined && num < col.constraints.minHard) {
      return {
        idd,
        field: col.id,
        type: 'CRÍTICO',
        message: `El campo "${col.excelName}" (${num}) está por debajo del límite físico mínimo de ${col.constraints.minHard}.`,
        tab,
        value: val
      };
    }

    if (col.constraints?.maxHard !== undefined && num > col.constraints.maxHard) {
      return {
        idd,
        field: col.id,
        type: 'CRÍTICO',
        message: `El campo "${col.excelName}" (${num}) supera el límite físico máximo de ${col.constraints.maxHard}.`,
        tab,
        value: val
      };
    }

    // -----------------------------------------------------------------------
    // 4. LÍMITES GEOMECÁNICOS BLANDOS (AVISO)
    // -----------------------------------------------------------------------
    if (col.constraints?.minSoft !== undefined && num < col.constraints.minSoft) {
      return {
        idd,
        field: col.id,
        type: 'AVISO',
        message: `El campo "${col.excelName}" (${num}) está por debajo de ${col.constraints.minSoft}.`,
        tab,
        value: val
      };
    }

    if (col.constraints?.maxSoft !== undefined && num > col.constraints.maxSoft) {
      let msg = `El campo "${col.excelName}" (${num}) supera el límite de ${col.constraints.maxSoft}.`;
      if (col.id === 'ucs_diametro') {
        msg = `El campo "${col.excelName}" (${num}) supera el límite de ${col.constraints.maxSoft} cm. Parece estar registrado en milímetros (mm); registre el valor en centímetros (cm).`;
      }
      return {
        idd,
        field: col.id,
        type: 'AVISO',
        message: msg,
        tab,
        value: val
      };
    }
  }

  // -------------------------------------------------------------------------
  // 5. VALIDACIÓN DE TEXTO Y LONGITUD
  // -------------------------------------------------------------------------
  if (col.type === 'text' && col.constraints?.maxLength) {
    const len = String(val).length;
    if (len > col.constraints.maxLength) {
      return {
        idd,
        field: col.id,
        type: 'CRÍTICO',
        message: `El campo "${col.excelName}" supera la longitud máxima permitida de ${col.constraints.maxLength} caracteres (${len}).`,
        tab,
        value: val
      };
    }
  }

  // -------------------------------------------------------------------------
  // 6. VALIDACIÓN DE SELECTS Y CATÁLOGOS
  // -------------------------------------------------------------------------
  if (col.type === 'select') {
    const selectedStr = String(val).trim();

    // Selects con opciones cerradas fijas (ej: mes, tipo_ensayo) -> CRÍTICO
    if (col.options && col.options.length > 0) {
      if (!col.options.includes(selectedStr)) {
        return {
          idd,
          field: col.id,
          type: 'CRÍTICO',
          message: `El valor "${selectedStr}" no es una opción válida para "${col.excelName}".`,
          tab,
          value: val
        };
      }
    }

    // Selects con catálogo dinámico (ej: proyectos, laboratorios) -> AVISO si no está en catálogo cargado
    if (col.dynamicOptionsKey && context && context[col.dynamicOptionsKey]) {
      const dynCatalog = context[col.dynamicOptionsKey];
      if (Array.isArray(dynCatalog) && dynCatalog.length > 0) {
        if (!dynCatalog.includes(selectedStr)) {
          return {
            idd,
            field: col.id,
            type: 'AVISO',
            message: `El valor "${selectedStr}" en "${col.excelName}" no figura en el catálogo de ${col.dynamicOptionsKey}.`,
            tab,
            value: val
          };
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 7. VALIDADORES PERSONALIZADOS DE COLUMNA
  // -------------------------------------------------------------------------
  if (col.customValidators && col.customValidators.length > 0) {
    for (const customValidator of col.customValidators) {
      const customAlert = customValidator(val, row);
      if (customAlert) return customAlert;
    }
  }

  return null;
}

/**
 * Valida un registro completo (todas sus celdas) evaluando cada columna.
 */
export function validateRow(
  row: Record<string, any>,
  columns: ColumnSchema[],
  context?: ValidationContext
): QAQCAlert[] {
  const alerts: QAQCAlert[] = [];

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    // Columnas de UI puras (acciones) no validan valor de datos
    if (col.id === 'acciones_col' || col.id === 'qaqc_validacion') continue;

    const val = row[col.id];
    const alert = validateCell(val, row, col, context);
    if (alert) {
      alerts.push(alert);
    }
  }

  // Reglas condicionales de dependencia entre columnas (Etapa B)
  const condAlerts = evaluateConditionalRules(row);
  for (let i = 0; i < condAlerts.length; i++) {
    alerts.push(condAlerts[i]);
  }

  // Regla de tolerancia entre columnas (si está activada)
  const tolAlert = evaluateToleranceRule(row);
  if (tolAlert) {
    alerts.push(tolAlert);
  }

  return alerts;
}

/**
 * Valida un dataset completo retornando todas las alertas encontradas.
 */
export function validateDataset(
  dataset: Record<string, any>[],
  columns: ColumnSchema[],
  context?: ValidationContext
): QAQCAlert[] {
  const allAlerts: QAQCAlert[] = [];

  for (let i = 0; i < dataset.length; i++) {
    const row = dataset[i];
    if (!row.sondaje && !row.idd) continue;

    const rowAlerts = validateRow(row, columns, context);
    for (let j = 0; j < rowAlerts.length; j++) {
      allAlerts.push(rowAlerts[j]);
    }
  }

  return allAlerts;
}

