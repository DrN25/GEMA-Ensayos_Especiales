// frontend/src/features/grid/schema/convertiblePairs.ts
import { isEmptyValue } from './validationEngine';

/**
 * Configuración genérica y reutilizable de par de columnas convertibles bidireccionalmente.
 */
export interface ConvertiblePairConfig {
  id: string;
  name: string;
  fieldA: string;
  fieldB: string;
  unitA: string;
  unitB: string;
  factorAtoB: number; // Multiplicador para pasar de A a B: B = A * factorAtoB
  decimalsA?: number;
  decimalsB?: number;
}

/**
 * Catálogo declarativo de pares convertibles del sistema.
 * Factor exacto acordado: 1 kg/cm² = 0.0980665 MPa.
 */
export const CONVERTIBLE_PAIRS: ConvertiblePairConfig[] = [
  {
    id: 'traccion_resistencia_pair',
    name: 'Resistencia Tracción Indirecta (kg/cm² <-> MPa)',
    fieldA: 'traccion_resistencia_kgcm2',
    fieldB: 'traccion_resistencia_mpa',
    unitA: 'kg/cm²',
    unitB: 'MPa',
    factorAtoB: 0.0980665,
    decimalsA: 2,
    decimalsB: 2
  }
];

/**
 * Determina si un campo de un par convertible debe estar en modo sólo lectura para una fila dada:
 * - Si ambos están vacíos: ninguno es solo lectura (ambos editables).
 * - Si fieldA tiene valor y fieldB estaba vacío o fue derivado: fieldB es sólo lectura.
 * - Si fieldB tiene valor y fieldA estaba vacío o fue derivado: fieldA es sólo lectura.
 * - En datos preexistentes con ambos llenos: ninguno se bloquea arbitrariamente para no alterar datos existentes.
 */
export function isConvertibleFieldReadOnly(
  field: string,
  row?: Record<string, any>,
  pairs: ConvertiblePairConfig[] = CONVERTIBLE_PAIRS
): boolean {
  if (!row) return false;

  for (const pair of pairs) {
    if (field !== pair.fieldA && field !== pair.fieldB) continue;

    const valA = row[pair.fieldA];
    const valB = row[pair.fieldB];
    const hasA = !isEmptyValue(valA);
    const hasB = !isEmptyValue(valB);

    // Caso 1: Ambos vacíos -> ambos desbloqueados
    if (!hasA && !hasB) {
      return false;
    }

    // Caso 2: Si la fila tiene flag explícito de origen (_sourceField)
    const source = row._sourceField;
    if (source) {
      if (field === pair.fieldA && source === pair.fieldB) return true;
      if (field === pair.fieldB && source === pair.fieldA) return true;
      return false;
    }

    // Caso 3: Solo A lleno -> B es solo lectura
    if (hasA && !hasB) {
      return field === pair.fieldB;
    }

    // Caso 4: Solo B lleno -> A es solo lectura
    if (!hasA && hasB) {
      return field === pair.fieldA;
    }

    // Caso 5: Ambos llenos (datos históricos) -> ninguno bloqueado
    return false;
  }

  return false;
}

/**
 * Calcula la actualización pura de una fila al editar un campo perteneciente a un par convertible:
 * - Si el usuario llena fieldA -> fieldB se calcula como A * factorAtoB y queda en solo lectura.
 * - Si el usuario llena fieldB -> fieldA se calcula como B / factorAtoB y queda en solo lectura.
 * - Si el usuario borra el campo activo -> ambos campos se limpian y se desbloquean.
 */
export function computeConvertiblePairUpdate(
  fieldEdited: string,
  newValue: any,
  currentRow: Record<string, any>,
  pairs: ConvertiblePairConfig[] = CONVERTIBLE_PAIRS
): Record<string, any> {
  const updates: Record<string, any> = { [fieldEdited]: newValue };

  for (const pair of pairs) {
    if (fieldEdited !== pair.fieldA && fieldEdited !== pair.fieldB) continue;

    const isFieldA = fieldEdited === pair.fieldA;
    const targetField = isFieldA ? pair.fieldB : pair.fieldA;

    // Si se vacía el campo -> limpiar ambos y desbloquear
    if (isEmptyValue(newValue)) {
      updates[fieldEdited] = '';
      updates[targetField] = '';
      updates._sourceField = undefined;
      return updates;
    }

    const numVal = Number(newValue);
    if (isNaN(numVal)) {
      return updates;
    }

    if (isFieldA) {
      // Ingresó kg/cm² -> calcular MPa: B = A * 0.0980665
      const mpaCalc = parseFloat((numVal * pair.factorAtoB).toFixed(4));
      updates[pair.fieldB] = mpaCalc;
      updates._sourceField = pair.fieldA;
    } else {
      // Ingresó MPa -> calcular kg/cm²: A = B / 0.0980665
      const kgCalc = parseFloat((numVal / pair.factorAtoB).toFixed(4));
      updates[pair.fieldA] = kgCalc;
      updates._sourceField = pair.fieldB;
    }

    return updates;
  }

  return updates;
}

/**
 * Auditoría formal sobre el dataset real para verificar consistencia entre columnas de un par convertible.
 */
export function auditConvertiblePairDataset(
  dataset: Record<string, any>[],
  pair: ConvertiblePairConfig = CONVERTIBLE_PAIRS[0]
) {
  let onlyAFilled = 0;
  let onlyBFilled = 0;
  let bothFilled = 0;
  let neitherFilled = 0;
  let diffUnder1Pct = 0;
  let diffOver1Pct = 0;

  for (const row of dataset) {
    const valA = row[pair.fieldA];
    const valB = row[pair.fieldB];
    const hasA = !isEmptyValue(valA);
    const hasB = !isEmptyValue(valB);

    if (hasA && hasB) {
      bothFilled++;
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB) && numA > 0) {
        const expectedB = numA * pair.factorAtoB;
        const diffRelPct = (Math.abs(numB - expectedB) / expectedB) * 100.0;
        if (diffRelPct < 1.0) {
          diffUnder1Pct++;
        } else {
          diffOver1Pct++;
        }
      }
    } else if (hasA) {
      onlyAFilled++;
    } else if (hasB) {
      onlyBFilled++;
    } else {
      neitherFilled++;
    }
  }

  return {
    totalRecords: dataset.length,
    pairId: pair.id,
    onlyAFilled,
    onlyBFilled,
    bothFilled,
    neitherFilled,
    diffUnder1Pct,
    diffOver1Pct
  };
}

