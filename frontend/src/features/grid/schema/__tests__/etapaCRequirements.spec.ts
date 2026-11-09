import { describe, it, expect } from 'vitest';
import realDataRaw from './realData.json';
import {
  CONVERTIBLE_PAIRS,
  isConvertibleFieldReadOnly,
  computeConvertiblePairUpdate,
  auditConvertiblePairDataset
} from '../convertiblePairs';
import { COLUMNS_SCHEMA, COLUMNS_SCHEMA_MAP } from '../columns';
import { getSchemaColumnsForModule } from '../index';
import { validateDataset } from '../validationEngine';

const realData = realDataRaw as Record<string, any>[];

describe('ETAPA C: Capacidad de Pares Convertibles y Visibilidad por Módulo (visibleIn)', () => {
  describe('1. Conversión Bidireccional Genérica (kg/cm² <-> MPa)', () => {
    const pair = CONVERTIBLE_PAIRS[0];

    it('declara el par de resistencia de tracción indirecta con factor exacto 0.0980665', () => {
      expect(pair).toBeDefined();
      expect(pair.id).toBe('traccion_resistencia_pair');
      expect(pair.fieldA).toBe('traccion_resistencia_kgcm2');
      expect(pair.fieldB).toBe('traccion_resistencia_mpa');
      expect(pair.factorAtoB).toBe(0.0980665);
      expect(pair.unitA).toBe('kg/cm²');
      expect(pair.unitB).toBe('MPa');
    });

    it('cuando ambos están vacíos, ninguno está bloqueado (ambos editables)', () => {
      const emptyRow = { idd: 1, sondaje: 'DH-01' };
      expect(isConvertibleFieldReadOnly('traccion_resistencia_kgcm2', emptyRow)).toBe(false);
      expect(isConvertibleFieldReadOnly('traccion_resistencia_mpa', emptyRow)).toBe(false);
    });

    it('al llenar fieldA (kg/cm²), fieldB (MPa) se calcula automáticamente y pasa a sólo lectura', () => {
      const initialRow = { idd: 2, sondaje: 'DH-02', traccion_resistencia_kgcm2: '', traccion_resistencia_mpa: '' };

      // Usuario ingresa 100 kg/cm²
      const updates = computeConvertiblePairUpdate('traccion_resistencia_kgcm2', 100.0, initialRow);
      expect(updates.traccion_resistencia_kgcm2).toBe(100.0);
      // 100 * 0.0980665 = 9.8067
      expect(updates.traccion_resistencia_mpa).toBe(9.8066);

      const updatedRow = { ...initialRow, ...updates };
      // fieldA sigue editable, fieldB queda bloqueado (readonly)
      expect(isConvertibleFieldReadOnly('traccion_resistencia_kgcm2', updatedRow)).toBe(false);
      expect(isConvertibleFieldReadOnly('traccion_resistencia_mpa', updatedRow)).toBe(true);
    });

    it('al llenar fieldB (MPa), fieldA (kg/cm²) se calcula automáticamente y pasa a sólo lectura', () => {
      const initialRow = { idd: 3, sondaje: 'DH-03', traccion_resistencia_kgcm2: '', traccion_resistencia_mpa: '' };

      // Usuario ingresa 9.80665 MPa
      const updates = computeConvertiblePairUpdate('traccion_resistencia_mpa', 9.80665, initialRow);
      expect(updates.traccion_resistencia_mpa).toBe(9.80665);
      // 9.80665 / 0.0980665 = 100.0
      expect(updates.traccion_resistencia_kgcm2).toBe(100.0);

      const updatedRow = { ...initialRow, ...updates };
      // fieldB sigue editable, fieldA queda bloqueado (readonly)
      expect(isConvertibleFieldReadOnly('traccion_resistencia_mpa', updatedRow)).toBe(false);
      expect(isConvertibleFieldReadOnly('traccion_resistencia_kgcm2', updatedRow)).toBe(true);
    });

    it('si el usuario borra el campo activo, ambos campos se limpian y se desbloquean', () => {
      // Estado previo: A lleno, B derivado
      const rowFilled = {
        idd: 4,
        sondaje: 'DH-04',
        traccion_resistencia_kgcm2: 150.0,
        traccion_resistencia_mpa: 14.71,
        _sourceField: 'traccion_resistencia_kgcm2'
      };

      // Usuario borra fieldA
      const updates = computeConvertiblePairUpdate('traccion_resistencia_kgcm2', '', rowFilled);
      expect(updates.traccion_resistencia_kgcm2).toBe('');
      expect(updates.traccion_resistencia_mpa).toBe('');

      const clearedRow = { ...rowFilled, ...updates };
      // Ambos desbloqueados nuevamente
      expect(isConvertibleFieldReadOnly('traccion_resistencia_kgcm2', clearedRow)).toBe(false);
      expect(isConvertibleFieldReadOnly('traccion_resistencia_mpa', clearedRow)).toBe(false);
    });

    it('en datos históricos preexistentes con ambos valores llenos, ninguno se bloquea arbitrariamente', () => {
      // Caso de los 249 registros reales con ambos campos llenos desde BD
      const existingRow = {
        idd: 5,
        sondaje: 'DH-05',
        traccion_resistencia_kgcm2: 78.4,
        traccion_resistencia_mpa: 7.68
      };
      expect(isConvertibleFieldReadOnly('traccion_resistencia_kgcm2', existingRow)).toBe(false);
      expect(isConvertibleFieldReadOnly('traccion_resistencia_mpa', existingRow)).toBe(false);
    });
  });

  describe('2. Auditoría del Dataset Real (9.818 Registros)', () => {
    it('audita la distribución exacta de kg/cm² y MPa en la base de datos real sin mutar datos', () => {
      const audit = auditConvertiblePairDataset(realData);

      // Métricas medidas sobre el dataset real:
      expect(audit.totalRecords).toBe(9818);
      expect(audit.onlyAFilled).toBe(0); // Cero filas con solo kg/cm²
      expect(audit.onlyBFilled).toBe(659); // 659 filas con solo MPa
      expect(audit.bothFilled).toBe(249); // 249 filas con ambos valores llenos
      expect(audit.neitherFilled).toBe(8910); // 8,910 filas vacías

      // Consistencia mutua bajo factor 0.0980665 en los 249 registros con ambos llenos:
      expect(audit.diffUnder1Pct).toBe(249); // 100.0% consistentes con diff < 1%
      expect(audit.diffOver1Pct).toBe(0); // Cero discrepancias relevantes
    });
  });

  describe('3. Visibilidad por Módulo (visibleIn)', () => {
    const obsCol = COLUMNS_SCHEMA_MAP.get('traccion_observaciones');

    it('define la columna Observaciones TI en el esquema con visibleIn: ["traccion"]', () => {
      expect(obsCol).toBeDefined();
      expect(obsCol?.header).toBe('Observaciones TI');
      expect(obsCol?.group).toBe('Tracción Indirecta');
      expect(obsCol?.module).toBe('traccion');
      expect(obsCol?.visibleIn).toEqual(['traccion']);
    });

    it('es visible únicamente en el módulo "traccion"', () => {
      const traccionCols = getSchemaColumnsForModule('traccion');
      const hasObsInTraccion = traccionCols.some(c => c.id === 'traccion_observaciones');
      expect(hasObsInTraccion).toBe(true);
    });

    it('está oculta en el "registro_maestro"', () => {
      const maestroCols = getSchemaColumnsForModule('registro_maestro');
      const hasObsInMaestro = maestroCols.some(c => c.id === 'traccion_observaciones');
      expect(hasObsInMaestro).toBe(false);
    });

    it('está oculta en otros módulos específicos (ucs, corte, triaxial, etc.)', () => {
      expect(getSchemaColumnsForModule('ucs').some(c => c.id === 'traccion_observaciones')).toBe(false);
      expect(getSchemaColumnsForModule('corte').some(c => c.id === 'traccion_observaciones')).toBe(false);
      expect(getSchemaColumnsForModule('elasticas').some(c => c.id === 'traccion_observaciones')).toBe(false);
      expect(getSchemaColumnsForModule('triaxial').some(c => c.id === 'traccion_observaciones')).toBe(false);
      expect(getSchemaColumnsForModule('propiedades').some(c => c.id === 'traccion_observaciones')).toBe(false);
    });

    it('preserva exactamente 50 columnas en el registro maestro', () => {
      const maestroCols = getSchemaColumnsForModule('registro_maestro');
      expect(maestroCols.length).toBe(50);
    });
  });

  describe('4. Invarianza de Alertas QA/QC en los 9.818 Registros Reales', () => {
    it('mantiene el conteo exacto de 54 alertas en el dataset real tras la Etapa C', () => {
      const alerts = validateDataset(realData, COLUMNS_SCHEMA);
      expect(alerts.length).toBe(54);
    });
  });
});
