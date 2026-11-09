// frontend/src/features/grid/schema/dependencyRules.ts
import type { QAQCAlert, ConditionalDependencyRule, ToleranceRuleConfig } from './types';
import { isEmptyValue } from './validationEngine';

/**
 * Catálogo declarativo de reglas de dependencia condicional entre columnas.
 * Principio general: Solo se activan las reglas explícitamente solicitadas;
 * las demás quedan declaradas y preparadas pero con enabled: false.
 */
export const CONDITIONAL_DEPENDENCY_RULES: ConditionalDependencyRule[] = [
  // 1. Regla 1 (ACTIVA): Constantes elásticas requieren Resistencia UCS -> CRÍTICO
  {
    id: 'elasticas_requires_ucs_resistencia',
    name: 'Constantes elásticas exigen Resistencia UCS',
    enabled: true,
    severity: 'CRÍTICO',
    tab: 'elasticas',
    when: {
      fieldsWithAnyValue: ['elasticas_modulo_young', 'elasticas_poisson']
    },
    then: {
      requiredField: 'ucs_resistencia',
      message: 'Los ensayos de constantes elásticas requieren registrar la Resistencia UCS.'
    }
  },

  // 2. Regla 2 (ACTIVA): UCS si hay carga de rotura, el diámetro debe existir -> AVISO
  {
    id: 'ucs_carga_requires_diametro',
    name: 'Carga de rotura UCS requiere Diámetro',
    enabled: true,
    severity: 'AVISO',
    tab: 'ucs',
    when: {
      fieldsWithAnyValue: ['ucs_carga_rotura']
    },
    then: {
      requiredField: 'ucs_diametro',
      message: 'Si se registra carga de rotura en UCS, se requiere registrar el diámetro de la probeta.'
    }
  },

  // 3. Regla 3 (PREPARADA, DESACTIVADA por defecto): Corte directo requiere tipo de fractura
  {
    id: 'corte_directo_requires_tipo_fractura',
    name: 'Corte directo requiere Tipo de Fractura',
    enabled: false, // DESACTIVADA hasta confirmación expresa
    severity: 'CRÍTICO',
    tab: 'corte',
    when: {
      tipoEnsayoEquals: 'Corte directo'
    },
    then: {
      requiredField: 'corte_tipo_fractura',
      message: 'El ensayo de Corte Directo requiere registrar el Tipo de Fractura.'
    }
  }
];

/**
 * Configuración de la regla de tolerancia entre ucs_resistencia ingresada vs calculada.
 * DESACTIVADA por defecto hasta que el usuario confirme los conteos y active la regla.
 */

/**
 * Lista de reglas condicionales de ensayo parcial (ej. IDD 3949).
 * Por directiva explícita: lista VACÍA por defecto hasta confirmación expresa.
 */
export const PARTIAL_TEST_DEPENDENCY_RULES: ConditionalDependencyRule[] = [];

export const UCS_TOLERANCE_CONFIG: ToleranceRuleConfig = {
  id: 'ucs_resistencia_vs_calculada_tolerance',
  name: 'Tolerancia entre Resistencia UCS ingresada y calculada',
  enabled: false, // DESACTIVADA por defecto
  sourceField: 'ucs_resistencia',
  targetField: 'ucs_resistencia_calculada',
  tab: 'ucs',
  thresholdPercent: 1.0 // 1%
};

/**
 * Evalúa de forma pura las reglas condicionales de dependencia para una fila.
 */
export function evaluateConditionalRules(
  row: Record<string, any>,
  rules: ConditionalDependencyRule[] = CONDITIONAL_DEPENDENCY_RULES
): QAQCAlert[] {
  const alerts: QAQCAlert[] = [];
  const idd = Number(row.idd) || 0;

  for (const rule of rules) {
    if (!rule.enabled) continue;

    let conditionMet = false;

    // Condición 1: Alguno de los campos detonantes tiene valor no vacío
    if (rule.when.fieldsWithAnyValue && rule.when.fieldsWithAnyValue.length > 0) {
      for (const field of rule.when.fieldsWithAnyValue) {
        if (!isEmptyValue(row[field])) {
          conditionMet = true;
          break;
        }
      }
    }

    // Condición 2: tipo_ensayo coincide
    if (rule.when.tipoEnsayoEquals) {
      const tipo = String(row.tipo_ensayo || '').trim().toLowerCase();
      if (tipo === rule.when.tipoEnsayoEquals.toLowerCase()) {
        conditionMet = true;
      }
    }

    // Condición 3: predicado personalizado
    if (rule.when.customPredicate && rule.when.customPredicate(row)) {
      conditionMet = true;
    }

    // Si la condición detonante se cumple, verificar que el campo requerido tenga valor
    if (conditionMet) {
      const reqVal = row[rule.then.requiredField];
      if (isEmptyValue(reqVal)) {
        const msg =
          typeof rule.then.message === 'function'
            ? rule.then.message(row)
            : rule.then.message;

        alerts.push({
          idd,
          field: rule.then.requiredField,
          type: rule.severity,
          message: msg,
          tab: rule.tab || 'registro_maestro',
          value: reqVal
        });
      }
    }
  }

  return alerts;
}

/**
 * Evalúa la regla de tolerancia entre resistencia ingresada vs calculada:
 * - diffRel < 1%: AVISO
 * - diffRel >= 1%: CRÍTICO
 * Retorna null si la regla está desactivada o si alguno de los valores está vacío.
 */
export function evaluateToleranceRule(
  row: Record<string, any>,
  config: ToleranceRuleConfig = UCS_TOLERANCE_CONFIG
): QAQCAlert | null {
  if (!config.enabled) return null;

  const resVal = row[config.sourceField];
  const calcVal = row[config.targetField];

  if (isEmptyValue(resVal) || isEmptyValue(calcVal)) {
    return null;
  }

  const res = Number(resVal);
  const calc = Number(calcVal);

  if (isNaN(res) || isNaN(calc) || calc <= 0) {
    return null;
  }

  const diffAbs = Math.abs(res - calc);
  const diffRelPct = (diffAbs / calc) * 100.0;

  // Si no hay diferencia numérica relevante (< 0.001 MPa), pasa limpio
  if (diffAbs < 0.001) {
    return null;
  }

  const idd = Number(row.idd) || 0;

  if (diffRelPct >= config.thresholdPercent) {
    return {
      idd,
      field: config.sourceField,
      type: 'CRÍTICO',
      message: `La Resistencia UCS ingresada (${res} MPa) difiere en un ${diffRelPct.toFixed(2)}% de la calculada (${calc} MPa), superando el umbral crítico del ${config.thresholdPercent}%.`,
      tab: config.tab,
      value: res
    };
  } else {
    return {
      idd,
      field: config.sourceField,
      type: 'AVISO',
      message: `La Resistencia UCS ingresada (${res} MPa) presenta una ligera diferencia del ${diffRelPct.toFixed(2)}% respecto a la calculada (${calc} MPa).`,
      tab: config.tab,
      value: res
    };
  }
}

