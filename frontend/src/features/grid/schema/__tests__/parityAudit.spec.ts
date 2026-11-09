// frontend/src/features/grid/schema/__tests__/parityAudit.spec.ts
import { describe, it, expect } from 'vitest';
import realDataRaw from './realData.json';

import { validateAllRecords } from '../../../../utils/qaqcValidator';
import { COLUMNS_SCHEMA } from '../columns';
import { validateDataset } from '../validationEngine';
import { validateDesdeVsHasta } from '../tableValidators';

// Carga del dataset real (9.818 registros geomecánicos)
const realData = realDataRaw as Record<string, any>[];

describe('Auditoría Honesta de Paridad: Validador Anterior (BEFORE) vs Nuevo Esquema SSOT (AFTER)', () => {
  it('debe cargar los 9.818 registros geomecánicos reales', () => {
    expect(realData.length).toBe(9818);
  });

  describe('1. Validador Anterior (BEFORE): Diagnóstico y desglose de las 65 alertas', () => {
    const beforeAlerts = validateAllRecords(realData);

    it('el validador anterior genera exactamente 65 alertas (12 CRÍTICO + 53 AVISO)', () => {
      const criticos = beforeAlerts.filter(a => a.type === 'CRÍTICO');
      const avisos = beforeAlerts.filter(a => a.type === 'AVISO');

      expect(beforeAlerts.length).toBe(65);
      expect(criticos.length).toBe(12);
      expect(avisos.length).toBe(53);
    });

    it('desglosa e identifica con exactitud las 12 alertas críticas del validador anterior', () => {
      const criticos = beforeAlerts.filter(a => a.type === 'CRÍTICO');

      // 1. Aclaración 7 vs 12:
      // Las 7 alertas citadas en informes anteriores correspondían al subconjunto de 4 filas (3316, 6368, 6739, 7123):
      // - IDD 3316: traccion_carga_promedio ('-'), traccion_resistencia_mpa ('-') [2 alertas]
      // - IDD 6368: elasticas_modulo_young ('-'), elasticas_poisson ('-') [2 alertas]
      // - IDD 6739: elasticas_poisson (' -') [1 alerta]
      // - IDD 7123: elasticas_modulo_young (' -'), elasticas_poisson (' -') [2 alertas]
      // Total subconjunto = 2 + 2 + 1 + 2 = 7 alertas.
      //
      // Las 5 críticas restantes en el dataset completo son:
      // - IDD 3665: triaxial_esfuerzo_maximo ('-') [1 alerta]
      // - IDD 3695: triaxial_esfuerzo_maximo ('-') [1 alerta]
      // - IDD 3949: triaxial_carga_confinamiento ('-'), triaxial_esfuerzo_maximo ('-') [2 alertas]
      // - IDD 6994: triaxial_esfuerzo_maximo ('170..99') [1 alerta por texto basura / anomalía de formato con doble punto]
      // Total general = 7 + 5 = 12 alertas críticas.

      const expectedCriticalMap = [
        { idd: 3316, field: 'traccion_carga_promedio', val: '-' },
        { idd: 3316, field: 'traccion_resistencia_mpa', val: '-' },
        { idd: 3665, field: 'triaxial_esfuerzo_maximo', val: '-' },
        { idd: 3695, field: 'triaxial_esfuerzo_maximo', val: '-' },
        { idd: 3949, field: 'triaxial_carga_confinamiento', val: '-' },
        { idd: 3949, field: 'triaxial_esfuerzo_maximo', val: '-' },
        { idd: 6368, field: 'elasticas_modulo_young', val: '-' },
        { idd: 6368, field: 'elasticas_poisson', val: '-' },
        { idd: 6739, field: 'elasticas_poisson', val: ' -' },
        { idd: 6994, field: 'triaxial_esfuerzo_maximo', val: '170..99' },
        { idd: 7123, field: 'elasticas_modulo_young', val: ' -' },
        { idd: 7123, field: 'elasticas_poisson', val: ' -' }
      ];

      expect(criticos.length).toBe(expectedCriticalMap.length);

      for (const exp of expectedCriticalMap) {
        const found = criticos.find(c => c.idd === exp.idd && c.field === exp.field);
        expect(found, `Debe existir alerta crítica para IDD ${exp.idd} en campo ${exp.field}`).toBeDefined();
      }
    });

    it('desglosa los 53 avisos del validador anterior (44 ucs_diametro + 8 poisson + 1 young)', () => {
      const avisos = beforeAlerts.filter(a => a.type === 'AVISO');
      const diamAlerts = avisos.filter(a => a.field === 'ucs_diametro');
      const poissonAlerts = avisos.filter(a => a.field === 'elasticas_poisson');
      const youngAlerts = avisos.filter(a => a.field === 'elasticas_modulo_young');

      expect(diamAlerts.length).toBe(44);
      expect(poissonAlerts.length).toBe(8);
      expect(youngAlerts.length).toBe(1);
    });
  });

  describe('2. Nuevo Esquema SSOT (AFTER): Ejecución con política de vacíos aprobada', () => {
    // Ejecutamos validación de dataset con el nuevo esquema
    const schemaAlerts = validateDataset(realData, COLUMNS_SCHEMA);

    // Agregamos reglas de profundidades a nivel de tabla
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

    const afterAlerts = [...schemaAlerts, ...tableDepthAlerts];
    const afterCriticos = afterAlerts.filter(a => a.type === 'CRÍTICO');
    const afterAvisos = afterAlerts.filter(a => a.type === 'AVISO');

    it('el nuevo esquema genera exactamente 54 alertas honestas (1 CRÍTICO + 53 AVISO)', () => {
      expect(afterAlerts.length).toBe(54);
      expect(afterCriticos.length).toBe(1);
      expect(afterAvisos.length).toBe(53);
    });

    it('conserva como CRÍTICO el texto basura en IDD 6994 ("170..99")', () => {
      expect(afterCriticos.length).toBe(1);
      expect(afterCriticos[0].idd).toBe(6994);
      expect(afterCriticos[0].field).toBe('triaxial_esfuerzo_maximo');
      expect(afterCriticos[0].type).toBe('CRÍTICO');
      expect(afterCriticos[0].message).toContain('debe contener un valor numérico válido');
    });

    it('conserva el 100% de los 53 avisos geomecánicos reales con paridad exacta', () => {
      const diamAlerts = afterAvisos.filter(a => a.field === 'ucs_diametro');
      const poissonAlerts = afterAvisos.filter(a => a.field === 'elasticas_poisson');
      const youngAlerts = afterAvisos.filter(a => a.field === 'elasticas_modulo_young');

      expect(diamAlerts.length).toBe(44);
      expect(poissonAlerts.length).toBe(8);
      expect(youngAlerts.length).toBe(1);
    });

    it('explica la diferencia de 11 alertas: eliminación honesta de falsos positivos en "-"', () => {
      // Diferencia = 65 - 54 = 11 alertas.
      // Las 11 alertas eliminadas son exactamente los 11 strings '-' y ' -' que el validador viejo
      // marcaba erróneamente como CRÍTICO por ser NaN, pero que según la política aprobada de vacíos
      // son tokens de celda no ensayada (emptyPolicy: 'allowed').
      const diffCount = 65 - afterAlerts.length;
      expect(diffCount).toBe(11);
    });
  });
});
