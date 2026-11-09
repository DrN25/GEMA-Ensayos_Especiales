import { describe, it, expect } from 'vitest';
import realDataRaw from './realData.json';
import {
  CONDITIONAL_DEPENDENCY_RULES,
  PARTIAL_TEST_DEPENDENCY_RULES,
  UCS_TOLERANCE_CONFIG,
  evaluateConditionalRules,
  evaluateToleranceRule
} from '../dependencyRules';
import type { ConditionalDependencyRule } from '../types';
import { COLUMNS_SCHEMA, COLUMNS_SCHEMA_MAP } from '../columns';
import { validateCell, validateDataset } from '../validationEngine';
import { validateDesdeVsHasta } from '../tableValidators';

const realData = realDataRaw as Record<string, any>[];

describe('ETAPA B: Motor de Reglas Nuevas (Dependencias, Tolerancia y Heurística)', () => {
  describe('1. Reglas Condicionales / De Dependencia Declarativas', () => {
    it('declara las 3 reglas con su configuración aprobada (2 activas, 1 desactivada)', () => {
      expect(CONDITIONAL_DEPENDENCY_RULES.length).toBe(3);

      const r1 = CONDITIONAL_DEPENDENCY_RULES.find(r => r.id === 'elasticas_requires_ucs_resistencia');
      expect(r1).toBeDefined();
      expect(r1!.enabled).toBe(true);
      expect(r1!.severity).toBe('CRÍTICO');

      const r2 = CONDITIONAL_DEPENDENCY_RULES.find(r => r.id === 'ucs_carga_requires_diametro');
      expect(r2).toBeDefined();
      expect(r2!.enabled).toBe(true);
      expect(r2!.severity).toBe('AVISO');

      const r3 = CONDITIONAL_DEPENDENCY_RULES.find(r => r.id === 'corte_directo_requires_tipo_fractura');
      expect(r3).toBeDefined();
      expect(r3!.enabled).toBe(false); // DESACTIVADA por defecto
      expect(r3!.severity).toBe('CRÍTICO');
    });

    it('Regla 1 (ACTIVA): Constantes elásticas exigen ucs_resistencia (CRÍTICO)', () => {
      // Caso 1: Tiene Young pero no ucs_resistencia -> CRÍTICO
      const rowWithYoung = { idd: 10, sondaje: 'DH-10', elasticas_modulo_young: 25.4, ucs_resistencia: '' };
      const alerts1 = evaluateConditionalRules(rowWithYoung);
      expect(alerts1.length).toBe(1);
      expect(alerts1[0].type).toBe('CRÍTICO');
      expect(alerts1[0].field).toBe('ucs_resistencia');
      expect(alerts1[0].message).toContain('requieren registrar la Resistencia UCS');

      // Caso 2: Tiene Poisson pero no ucs_resistencia -> CRÍTICO
      const rowWithPoisson = { idd: 11, sondaje: 'DH-11', elasticas_poisson: 0.22, ucs_resistencia: null };
      const alerts2 = evaluateConditionalRules(rowWithPoisson);
      expect(alerts2.length).toBe(1);
      expect(alerts2[0].type).toBe('CRÍTICO');

      // Caso 3: Tiene ambos y tiene ucs_resistencia -> Pasa limpio
      const rowComplete = { idd: 12, sondaje: 'DH-12', elasticas_modulo_young: 25.4, elasticas_poisson: 0.22, ucs_resistencia: 65.0 };
      expect(evaluateConditionalRules(rowComplete).length).toBe(0);

      // Caso 4: Fila sin constantes elásticas -> Pasa limpio
      const rowOther = { idd: 13, sondaje: 'DH-13', corte_area: 50.0 };
      expect(evaluateConditionalRules(rowOther).length).toBe(0);
    });

    it('Regla 2 (ACTIVA): UCS si hay carga de rotura, requiere diámetro (AVISO)', () => {
      // Caso 1: Tiene carga pero no diámetro -> AVISO
      const rowWithCarga = { idd: 20, sondaje: 'DH-20', ucs_carga_rotura: 150.5, ucs_diametro: '' };
      const alerts1 = evaluateConditionalRules(rowWithCarga);
      expect(alerts1.length).toBe(1);
      expect(alerts1[0].type).toBe('AVISO');
      expect(alerts1[0].field).toBe('ucs_diametro');
      expect(alerts1[0].message).toContain('se requiere registrar el diámetro de la probeta');

      // Caso 2: Tiene carga y diámetro -> Pasa limpio
      const rowValid = { idd: 21, sondaje: 'DH-21', ucs_carga_rotura: 150.5, ucs_diametro: 6.35 };
      expect(evaluateConditionalRules(rowValid).length).toBe(0);
    });

    it('Regla 3 (PREPARADA, DESACTIVADA): no emite alertas mientras esté desactivada', () => {
      const rowCorte = { idd: 30, sondaje: 'DH-30', tipo_ensayo: 'Corte directo', corte_tipo_fractura: '' };
      // Desactivada -> 0 alertas
      expect(evaluateConditionalRules(rowCorte).length).toBe(0);

      // Si se activa dinámicamente -> emite CRÍTICO
      const customRules = CONDITIONAL_DEPENDENCY_RULES.map(r =>
        r.id === 'corte_directo_requires_tipo_fractura' ? { ...r, enabled: true } : r
      );
      const alertsActive = evaluateConditionalRules(rowCorte, customRules);
      expect(alertsActive.length).toBe(1);
      expect(alertsActive[0].type).toBe('CRÍTICO');
      expect(alertsActive[0].field).toBe('corte_tipo_fractura');
    });

    it('verifica que las 2 reglas activas generan 0 violaciones en los 9.818 registros reales', () => {
      let r1Violations = 0;
      let r2Violations = 0;

      for (const row of realData) {
        const alerts = evaluateConditionalRules(row);
        for (const a of alerts) {
          if (a.field === 'ucs_resistencia') r1Violations++;
          if (a.field === 'ucs_diametro') r2Violations++;
        }
      }

      expect(r1Violations).toBe(0);
      expect(r2Violations).toBe(0);
    });

    it('mecanismo de reglas condicionales de ensayo parcial: lista real vacía y prueba con regla ejemplo en test', () => {
      // 1. Verificar que la lista oficial de producción está vacía por directiva
      expect(PARTIAL_TEST_DEPENDENCY_RULES).toBeDefined();
      expect(PARTIAL_TEST_DEPENDENCY_RULES.length).toBe(0);

      // 2. Definir regla de ejemplo de ensayo parcial estrictamente dentro del test (ej. caso IDD 3949)
      const examplePartialRule: ConditionalDependencyRule = {
        id: 'partial_test_corte_requires_normal',
        name: 'Ensayo parcial: Si hay área de corte, requiere esfuerzo normal',
        enabled: true,
        severity: 'AVISO',
        tab: 'corte',
        when: {
          fieldsWithAnyValue: ['corte_area']
        },
        then: {
          requiredField: 'corte_esfuerzo_normal',
          message: 'Ensayo parcial detectado: Se requiere registrar el esfuerzo normal si se ingresó el área.'
        }
      };

      // Fila con ensayo parcial incompleto: tiene corte_area pero falta corte_esfuerzo_normal
      const rowPartialIncomplete = { idd: 3949, sondaje: 'DH-3949', corte_area: 36.0, corte_esfuerzo_normal: '' };
      const alerts = evaluateConditionalRules(rowPartialIncomplete, [examplePartialRule]);
      expect(alerts.length).toBe(1);
      expect(alerts[0].field).toBe('corte_esfuerzo_normal');
      expect(alerts[0].type).toBe('AVISO');
      expect(alerts[0].message).toContain('Ensayo parcial detectado');

      // Fila completa: tiene ambos valores
      const rowPartialComplete = { idd: 3949, sondaje: 'DH-3949', corte_area: 36.0, corte_esfuerzo_normal: 12.5 };
      expect(evaluateConditionalRules(rowPartialComplete, [examplePartialRule]).length).toBe(0);

      // Fila sin corte_area: no activa la regla
      const rowOther = { idd: 3950, sondaje: 'DH-3950', ucs_resistencia: 50.0 };
      expect(evaluateConditionalRules(rowOther, [examplePartialRule]).length).toBe(0);
    });
  });

  describe('2. Regla de Tolerancia entre Columnas (ucs_resistencia vs calculada)', () => {
    it('está configurada con umbral 1.0% y DESACTIVADA por defecto', () => {
      expect(UCS_TOLERANCE_CONFIG.enabled).toBe(false);
      expect(UCS_TOLERANCE_CONFIG.thresholdPercent).toBe(1.0);
    });

    it('no emite alertas cuando está desactivada', () => {
      const rowDiff = { idd: 40, sondaje: 'DH-40', ucs_resistencia: 110.0, ucs_resistencia_calculada: 100.0 };
      expect(evaluateToleranceRule(rowDiff)).toBeNull();
    });

    it('evalúa correctamente los umbrales cuando se activa', () => {
      const activeConfig = { ...UCS_TOLERANCE_CONFIG, enabled: true };

      // Caso 1: Coincidencia exacta (< 0.001) -> null
      const exact = { idd: 41, ucs_resistencia: 100.0, ucs_resistencia_calculada: 100.0 };
      expect(evaluateToleranceRule(exact, activeConfig)).toBeNull();

      // Caso 2: Diferencia relativa < 1% (ej: 0.5%) -> AVISO
      const under1 = { idd: 42, ucs_resistencia: 100.5, ucs_resistencia_calculada: 100.0 };
      const alertAviso = evaluateToleranceRule(under1, activeConfig);
      expect(alertAviso).not.toBeNull();
      expect(alertAviso?.type).toBe('AVISO');
      expect(alertAviso?.message).toContain('ligera diferencia del 0.50%');

      // Caso 3: Diferencia relativa >= 1% (ej: 5%) -> CRÍTICO
      const over1 = { idd: 43, ucs_resistencia: 105.0, ucs_resistencia_calculada: 100.0 };
      const alertCritico = evaluateToleranceRule(over1, activeConfig);
      expect(alertCritico).not.toBeNull();
      expect(alertCritico?.type).toBe('CRÍTICO');
      expect(alertCritico?.message).toContain('superando el umbral crítico del 1%');

      // Caso 4: Campos vacíos o no numéricos -> null
      const empty = { idd: 44, ucs_resistencia: 100.0, ucs_resistencia_calculada: null };
      expect(evaluateToleranceRule(empty, activeConfig)).toBeNull();
    });

    it('regla de tolerancia con valor calculado = 0 o vacío retorna null de forma segura', () => {
      const activeConfig = { ...UCS_TOLERANCE_CONFIG, enabled: true };

      // Caso 1: calculado = 0 (evita división por cero)
      const calcZero = { idd: 45, ucs_resistencia: 100.0, ucs_resistencia_calculada: 0 };
      expect(evaluateToleranceRule(calcZero, activeConfig)).toBeNull();

      // Caso 2: calculado = 0 en string
      const calcZeroStr = { idd: 46, ucs_resistencia: 100.0, ucs_resistencia_calculada: '0' };
      expect(evaluateToleranceRule(calcZeroStr, activeConfig)).toBeNull();

      // Caso 3: calculado vacío (string vacío, null, undefined)
      expect(evaluateToleranceRule({ idd: 47, ucs_resistencia: 100.0, ucs_resistencia_calculada: '' }, activeConfig)).toBeNull();
      expect(evaluateToleranceRule({ idd: 48, ucs_resistencia: 100.0, ucs_resistencia_calculada: null }, activeConfig)).toBeNull();
      expect(evaluateToleranceRule({ idd: 49, ucs_resistencia: 100.0, ucs_resistencia_calculada: undefined }, activeConfig)).toBeNull();

      // Caso 4: calculado con tokens de vacío ("-", "--")
      expect(evaluateToleranceRule({ idd: 50, ucs_resistencia: 100.0, ucs_resistencia_calculada: '-' }, activeConfig)).toBeNull();
      expect(evaluateToleranceRule({ idd: 51, ucs_resistencia: 100.0, ucs_resistencia_calculada: '--' }, activeConfig)).toBeNull();

      // Caso 5: resistencia fuente vacía
      expect(evaluateToleranceRule({ idd: 52, ucs_resistencia: '', ucs_resistencia_calculada: 100.0 }, activeConfig)).toBeNull();
      expect(evaluateToleranceRule({ idd: 53, ucs_resistencia: '-', ucs_resistencia_calculada: 100.0 }, activeConfig)).toBeNull();
    });

    it('audita los 9.818 registros reales para informar la distribución exacta antes de activar', () => {
      const activeConfig = { ...UCS_TOLERANCE_CONFIG, enabled: true };
      let exactCount = 0;
      let avisoCount = 0;
      let criticoCount = 0;
      let nonComparable = 0;

      for (const row of realData) {
        const res = row.ucs_resistencia;
        const calc = row.ucs_resistencia_calculada;
        if (res === null || res === undefined || res === '' || res === '-' || res === '--' ||
            calc === null || calc === undefined || calc === '' || calc === '-' || calc === '--') {
          nonComparable++;
          continue;
        }

        const alert = evaluateToleranceRule(row, activeConfig);
        if (!alert) {
          exactCount++;
        } else if (alert.type === 'AVISO') {
          avisoCount++;
        } else if (alert.type === 'CRÍTICO') {
          criticoCount++;
        }
      }

      // Conteo medido sobre el dataset real:
      expect(exactCount).toBe(4);
      expect(avisoCount).toBe(22);
      expect(criticoCount).toBe(0); // Cero críticos en la base real
      expect(nonComparable).toBe(9792);
    });
  });

  describe('3. Heurística de Unidad en Diámetro (mm -> cm)', () => {
    const diamCol = COLUMNS_SCHEMA_MAP.get('ucs_diametro')!;

    it('sugiere registrar en cm si supera el límite de 20 cm (posible entrada en mm)', () => {
      const row = { idd: 50, sondaje: 'DH-50' };
      // 63.5 cm es típicamente un testigo HQ de 63.5 mm ingresado en mm
      const alert = validateCell(63.5, row, diamCol);
      expect(alert).not.toBeNull();
      expect(alert?.type).toBe('AVISO');
      expect(alert?.message).toContain('Parece estar registrado en milímetros (mm); registre el valor en centímetros (cm)');
    });

    it('emite el mensaje estándar para otras columnas que superan maxSoft', () => {
      const youngCol = COLUMNS_SCHEMA_MAP.get('elasticas_modulo_young')!;
      const row = { idd: 51, sondaje: 'DH-51' };
      // 180 GPa supera maxSoft 150 GPa
      const alert = validateCell(180, row, youngCol);
      expect(alert).not.toBeNull();
      expect(alert?.type).toBe('AVISO');
      expect(alert?.message).not.toContain('milímetros');
      expect(alert?.message).toContain('supera el límite de 150');
    });

    it('aplica la heurística a los 44 registros reales con diámetro > 20 cm sin modificar el conteo total', () => {
      let heuristicMatches = 0;
      for (const row of realData) {
        const alert = validateCell(row.ucs_diametro, row, diamCol);
        if (alert && alert.message.includes('Parece estar registrado en milímetros (mm)')) {
          heuristicMatches++;
        }
      }
      expect(heuristicMatches).toBe(44);
    });
  });

  describe('4. Paridad Total del Dataset (Exactamente 54 alertas honestas conservadas)', () => {
    it('el dataset completo conserva exactamente 54 alertas (1 CRÍTICO + 53 AVISO)', () => {
      const schemaAlerts = validateDataset(realData, COLUMNS_SCHEMA);
      const tableDepthAlerts: any[] = [];
      for (let i = 0; i < realData.length; i++) {
        const row = realData[i];
        if (row.sondaje) {
          const da = validateDesdeVsHasta(row);
          for (let j = 0; j < da.length; j++) {
            tableDepthAlerts.push(da[j]);
          }
        }
      }

      const totalAlerts = [...schemaAlerts, ...tableDepthAlerts];
      const criticos = totalAlerts.filter(a => a.type === 'CRÍTICO');
      const avisos = totalAlerts.filter(a => a.type === 'AVISO');

      expect(totalAlerts.length).toBe(54);
      expect(criticos.length).toBe(1); // IDD 6994 "170..99"
      expect(avisos.length).toBe(53);  // 44 diámetros con heurística + 8 poisson < 0.05 + 1 young
    });
  });
});

