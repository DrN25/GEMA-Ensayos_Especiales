// frontend/src/features/grid/__tests__/convertibleLockingBehavior.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGridStore } from '../gridStore';
import {
  getConvertibleLockInfo,
  isConvertibleFieldReadOnly,
  computeConvertiblePairUpdate,
  CONVERTIBLE_PAIRS
} from '../schema/convertiblePairs';

describe('Bloqueo de Pares Convertibles (Tracción Indirecta kg/cm² <-> MPa)', () => {
  beforeEach(() => {
    useGridStore.getState().clearAll();
  });

  it('1. escribir en kg/cm² bloquea MPa y calcula su valor', () => {
    const row = { idd: 1, traccion_resistencia_kgcm2: '', traccion_resistencia_mpa: '' };

    // Inicialmente ambos desbloqueados
    expect(isConvertibleFieldReadOnly('traccion_resistencia_kgcm2', row)).toBe(false);
    expect(isConvertibleFieldReadOnly('traccion_resistencia_mpa', row)).toBe(false);

    // Escribir en kg/cm²: 100
    const updates = computeConvertiblePairUpdate('traccion_resistencia_kgcm2', 100, row);
    Object.assign(row, updates);

    // MPa calculado con factor 0.0980665
    expect(row.traccion_resistencia_mpa).toBeCloseTo(9.80665, 3);

    // kg/cm² queda editable, MPa queda BLOQUEADO
    expect(isConvertibleFieldReadOnly('traccion_resistencia_kgcm2', row)).toBe(false);
    expect(isConvertibleFieldReadOnly('traccion_resistencia_mpa', row)).toBe(true);

    const lockInfo = getConvertibleLockInfo('traccion_resistencia_mpa', row);
    expect(lockInfo.isReadOnly).toBe(true);
    expect(lockInfo.message).toBe('Calculado automáticamente. Para modificarlo, edita o limpia su celda equivalente');
  });

  it('2. escribir en MPa bloquea kg/cm² y calcula su valor', () => {
    const row = { idd: 2, traccion_resistencia_kgcm2: '', traccion_resistencia_mpa: '' };

    // Escribir en MPa: 9.80665
    const updates = computeConvertiblePairUpdate('traccion_resistencia_mpa', 9.80665, row);
    Object.assign(row, updates);

    // kg/cm² calculado con factor 1 / 0.0980665
    expect(row.traccion_resistencia_kgcm2).toBe(100);

    // MPa queda editable, kg/cm² queda BLOQUEADO
    expect(isConvertibleFieldReadOnly('traccion_resistencia_mpa', row)).toBe(false);
    expect(isConvertibleFieldReadOnly('traccion_resistencia_kgcm2', row)).toBe(true);

    const lockInfo = getConvertibleLockInfo('traccion_resistencia_kgcm2', row);
    expect(lockInfo.isReadOnly).toBe(true);
    expect(lockInfo.message).toBe('Calculado automáticamente. Para modificarlo, edita o limpia su celda equivalente');
  });

  it('3. vaciar la celda de origen desbloquea ambas y limpia ambos valores', () => {
    const row = { idd: 3, traccion_resistencia_kgcm2: '', traccion_resistencia_mpa: '' };

    // 1. Escribir primero en kg/cm²
    const updates1 = computeConvertiblePairUpdate('traccion_resistencia_kgcm2', 50, row);
    Object.assign(row, updates1);
    expect(isConvertibleFieldReadOnly('traccion_resistencia_mpa', row)).toBe(true);

    // 2. Vaciar el campo activo
    const updates2 = computeConvertiblePairUpdate('traccion_resistencia_kgcm2', '', row);
    Object.assign(row, updates2);

    expect(row.traccion_resistencia_kgcm2).toBe('');
    expect(row.traccion_resistencia_mpa).toBe('');

    // Ambas quedan desbloqueadas
    expect(isConvertibleFieldReadOnly('traccion_resistencia_kgcm2', row)).toBe(false);
    expect(isConvertibleFieldReadOnly('traccion_resistencia_mpa', row)).toBe(false);
  });

  it('4. fila histórica con ambos llenos (249 casos reales) queda con AMBOS editables', () => {
    const rowHistoricalBoth = {
      idd: 4,
      traccion_resistencia_kgcm2: 118.7,
      traccion_resistencia_mpa: 11.64
    };

    // Sin flag _sourceField (cargada tal cual de BD): ninguno se bloquea
    expect(isConvertibleFieldReadOnly('traccion_resistencia_kgcm2', rowHistoricalBoth)).toBe(false);
    expect(isConvertibleFieldReadOnly('traccion_resistencia_mpa', rowHistoricalBoth)).toBe(false);

    // Al editar uno de ellos, el otro se recalcula y se bloquea
    const updates = computeConvertiblePairUpdate('traccion_resistencia_kgcm2', 200, rowHistoricalBoth);
    Object.assign(rowHistoricalBoth, updates);

    expect(rowHistoricalBoth.traccion_resistencia_mpa).toBe(19.6133);
    expect(isConvertibleFieldReadOnly('traccion_resistencia_kgcm2', rowHistoricalBoth)).toBe(false);
    expect(isConvertibleFieldReadOnly('traccion_resistencia_mpa', rowHistoricalBoth)).toBe(true);
  });

  it('5. fila histórica con solo uno lleno: la celda vacía se bloquea sin alteración retroactiva', () => {
    // Ejemplo de las 659 filas reales con solo MPa lleno
    const rowOnlyMpa = {
      idd: 5,
      traccion_resistencia_kgcm2: null,
      traccion_resistencia_mpa: 11.64
    };

    // La celda vacía (kg/cm²) está bloqueada; la celda llena (MPa) está editable
    expect(isConvertibleFieldReadOnly('traccion_resistencia_kgcm2', rowOnlyMpa)).toBe(true);
    expect(isConvertibleFieldReadOnly('traccion_resistencia_mpa', rowOnlyMpa)).toBe(false);

    // El valor vacío no se rellena retroactivamente
    expect(rowOnlyMpa.traccion_resistencia_kgcm2).toBeNull();
  });

  it('6. la configuración del bloqueo reside en convertiblePairs, no lógica fija', () => {
    const pair = CONVERTIBLE_PAIRS.find(p => p.id === 'traccion_resistencia_pair');
    expect(pair).toBeDefined();
    expect(pair?.lockedMessage).toBe('Calculado automáticamente. Para modificarlo, edita o limpia su celda equivalente');
    expect(pair?.fieldA).toBe('traccion_resistencia_kgcm2');
    expect(pair?.fieldB).toBe('traccion_resistencia_mpa');
  });
});
