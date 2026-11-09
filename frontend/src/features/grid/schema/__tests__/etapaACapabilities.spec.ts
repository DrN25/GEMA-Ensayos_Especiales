import { describe, it, expect } from 'vitest';
import realDataRaw from './realData.json';
import { COLUMNS_SCHEMA, COLUMNS_SCHEMA_MAP } from '../columns';
import { decimalColumn, calculatedColumn } from '../columnFactories';
import { validateCell } from '../validationEngine';

const realData = realDataRaw as Record<string, any>[];

describe('ETAPA A: Capacidades sin ambigüedad del Esquema SSOT', () => {
  describe('1. Hints de unidad (unit y hint)', () => {
    it('verifica los casos puntuales requeridos expresamente', () => {
      const corteArea = COLUMNS_SCHEMA_MAP.get('corte_area')!;
      expect(corteArea.hint).toBe('Registrar en cm²');
      expect(corteArea.unit).toBe('cm²');

      const traccionCarga = COLUMNS_SCHEMA_MAP.get('traccion_carga_promedio')!;
      expect(traccionCarga.hint).toBe('Registre la unidad en kN');
      expect(traccionCarga.unit).toBe('kN');

      const traccionKgcm2 = COLUMNS_SCHEMA_MAP.get('traccion_resistencia_kgcm2')!;
      expect(traccionKgcm2.hint).toBe('Registre en kg/cm²');
      expect(traccionKgcm2.unit).toBe('kg/cm²');

      const traccionMpa = COLUMNS_SCHEMA_MAP.get('traccion_resistencia_mpa')!;
      expect(traccionMpa.hint).toBe('Registre en MPa');
      expect(traccionMpa.unit).toBe('MPa');
    });

    it('toda columna con unit tiene un hint explicativo de registro', () => {
      const colsWithUnit = COLUMNS_SCHEMA.filter(c => c.unit);
      expect(colsWithUnit.length).toBeGreaterThanOrEqual(20);

      for (const col of colsWithUnit) {
        expect(col.hint, `Columna ${col.id} con unidad ${col.unit} debe tener hint`).toBeDefined();
        expect(col.hint!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('2. Redondeo SOLO VISUAL (almacenamiento intacto y displayHint)', () => {
    it('genera automáticamente displayHint para columnas numéricas con redondeo visual', () => {
      const decCol = decimalColumn({
        id: 'test_dec',
        header: 'Test',
        excelName: 'Test',
        group: 'G',
        module: 'common',
        decimals: 2
      });
      expect(decCol.displayHint).toBe('Vista a 2 decimales; el valor guardado conserva su precisión original');

      const calcCol = calculatedColumn({
        id: 'test_calc',
        header: 'Calc',
        excelName: 'Calc',
        group: 'G',
        module: 'common',
        decimals: 4
      });
      expect(calcCol.displayHint).toBe('Vista a 4 decimales; el valor guardado conserva su precisión original');
    });

    it('permite sobrescribir displayHint en la definición de la columna', () => {
      const customCol = decimalColumn({
        id: 'test_custom',
        header: 'Test Custom',
        excelName: 'Test',
        group: 'G',
        module: 'common',
        decimals: 2,
        displayHint: 'Mensaje personalizado'
      });
      expect(customCol.displayHint).toBe('Mensaje personalizado');
    });

    it('mide con exactitud cuántos valores en los 9.818 registros difieren visualmente del valor guardado', () => {
      const numericCols = COLUMNS_SCHEMA.filter(
        c => (c.type === 'decimal' || c.type === 'readonly') && c.decimals !== undefined
      );

      let visualDiffCount = 0;
      const diffBreakdown: Record<string, number> = {};

      for (const row of realData) {
        for (const col of numericCols) {
          const val = row[col.id];
          if (val !== null && val !== undefined && val !== '' && val !== '-' && val !== '--') {
            const num = Number(val);
            if (!isNaN(num)) {
              const formatted = String(parseFloat(num.toFixed(col.decimals!)));
              const rawStr = String(val).trim();
              if (rawStr !== formatted && Number(rawStr) === num) {
                visualDiffCount++;
                diffBreakdown[col.id] = (diffBreakdown[col.id] || 0) + 1;
              }
            }
          }
        }
      }

      // Exactamente 47.666 celdas almacenan mayor precisión que la mostrada
      expect(visualDiffCount).toBe(47666);
      expect(diffBreakdown['longitud_muestra']).toBe(9080);
      expect(diffBreakdown['este']).toBe(9774);
      expect(diffBreakdown['norte']).toBe(9565);
      expect(diffBreakdown['elevacion']).toBe(9816);
    });
  });

  describe('3. Valores no negativos (positiveOnly: true)', () => {
    it('aplica positiveOnly: true en todas las columnas numéricas geomecánicas y elevacion', () => {
      const numericCols = COLUMNS_SCHEMA.filter(
        c => c.type === 'decimal' || c.type === 'integer'
      );

      for (const col of numericCols) {
        expect(
          col.constraints?.positiveOnly,
          `Columna numérica ${col.id} debe tener positiveOnly: true`
        ).toBe(true);
      }
    });

    it('verifica 0 violaciones de positiveOnly en los 9.818 registros reales', () => {
      const numericCols = COLUMNS_SCHEMA.filter(c => c.constraints?.positiveOnly);

      let negativeViolations = 0;
      for (const row of realData) {
        for (const col of numericCols) {
          const val = row[col.id];
          if (val !== null && val !== undefined && val !== '' && val !== '-' && val !== '--') {
            const num = Number(val);
            if (!isNaN(num) && num < 0) {
              negativeViolations++;
            }
          }
        }
      }

      expect(negativeViolations).toBe(0);
    });
  });

  describe('4. Límites de Poisson (límite crítico maxHard 0.50, minSoft 0.05)', () => {
    const poissonCol = COLUMNS_SCHEMA_MAP.get('elasticas_poisson')!;

    it('tiene configurados únicamente maxHard 0.50 y minSoft 0.05 (sin maxSoft 0.45)', () => {
      expect(poissonCol.constraints?.maxHard).toBe(0.50);
      expect(poissonCol.constraints?.maxSoft).toBeUndefined();
      expect(poissonCol.constraints?.minSoft).toBe(0.05);
      expect(poissonCol.constraints?.positiveOnly).toBe(true);
    });

    it('emite CRÍTICO si supera 0.50', () => {
      const row = { idd: 1, sondaje: 'DH-01' };
      const alertHard = validateCell(0.52, row, poissonCol);
      expect(alertHard).not.toBeNull();
      expect(alertHard?.type).toBe('CRÍTICO');
      expect(alertHard?.message).toContain('supera el límite físico máximo de 0.5');
    });

    it('mide que 0 registros reales en la base superan 0.50', () => {
      let overHard = 0;

      for (const row of realData) {
        const val = row['elasticas_poisson'];
        if (val !== null && val !== undefined && val !== '' && val !== '-' && val !== '--') {
          const num = Number(val);
          if (!isNaN(num)) {
            if (num > 0.50) overHard++;
          }
        }
      }

      expect(overHard).toBe(0);
    });
  });

  describe('5. Renombrado de sufijos EXCLUSIVAMENTE para columnas duplicadas por excelName', () => {
    it('renombra únicamente Cohesión (CD/TX), Fricción (CD/TX) y Rotura (UCS/TX)', () => {
      const expectedDuplicates = [
        { id: 'corte_cohesion_mpa', header: 'Cohesión_CD', excel: 'Cohesion (Mpa)' },
        { id: 'triaxial_cohesion_mpa', header: 'Cohesión_TX', excel: 'Cohesion (Mpa)' },
        { id: 'corte_angulo_friccion', header: 'Fricción_CD', excel: 'Ang. Friccion (°)' },
        { id: 'triaxial_angulo_friccion', header: 'Fricción_TX', excel: 'Ang. Friccion (°)' },
        { id: 'ucs_rotura', header: 'Rotura_UCS', excel: 'Rotura' },
        { id: 'triaxial_rotura', header: 'Rotura_TX', excel: 'Rotura' }
      ];

      for (const ren of expectedDuplicates) {
        const col = COLUMNS_SCHEMA_MAP.get(ren.id);
        expect(col, `Columna ${ren.id} debe existir`).toBeDefined();
        expect(col!.header).toBe(ren.header);
        expect(col!.excelName).toBe(ren.excel);
      }
    });

    it('las columnas no duplicadas conservan su nombre corto original', () => {
      const nonDuplicates = [
        { id: 'corte_area', header: 'Área' },
        { id: 'corte_esf_normal_kpa', header: 'Esf. Normal' },
        { id: 'corte_esf_corte_kpa', header: 'Esf. Corte' },
        { id: 'corte_esf_normal_mpa', header: 'Esf. Normal MPa' },
        { id: 'corte_esf_corte_mpa', header: 'Esf. Corte MPa' },
        { id: 'ucs_carga_rotura', header: 'Carga Rotura' },
        { id: 'traccion_carga_promedio', header: 'Carga Prom.' },
        { id: 'ucs_resistencia', header: 'Resistencia UCS' },
        { id: 'ucs_resistencia_calculada', header: 'Resistencia Calc.' },
        { id: 'traccion_resistencia_kgcm2', header: 'Resist. kg/cm²' },
        { id: 'traccion_resistencia_mpa', header: 'Resist. MPa' },
        { id: 'triaxial_resistencia_mpa', header: 'Resist. Triaxial' },
        { id: 'triaxial_carga_confinamiento', header: 'Confinamiento' },
        { id: 'triaxial_esfuerzo_maximo', header: 'Esfuerzo Máx.' }
      ];

      for (const nonDup of nonDuplicates) {
        const col = COLUMNS_SCHEMA_MAP.get(nonDup.id);
        expect(col, `Columna ${nonDup.id} debe existir`).toBeDefined();
        expect(col!.header).toBe(nonDup.header);
      }
    });
  });

  describe('6. Empty Policy y Límites Duros vs Blandos', () => {
    it('únicamente sondaje tiene emptyPolicy: "block"; idd es "allowed"', () => {
      const sondaje = COLUMNS_SCHEMA_MAP.get('sondaje')!;
      expect(sondaje.emptyPolicy).toBe('block');

      const idd = COLUMNS_SCHEMA_MAP.get('idd')!;
      expect(idd.emptyPolicy).toBe('allowed');

      const blockCols = COLUMNS_SCHEMA.filter(c => c.emptyPolicy === 'block');
      expect(blockCols.map(c => c.id)).toEqual(['sondaje']);
    });

    it('ucs_diametro y prop_peso_unitario_geometrico tienen límites blandos (AVISO) sin límites duros', () => {
      const diam = COLUMNS_SCHEMA_MAP.get('ucs_diametro')!;
      expect(diam.constraints?.minHard).toBeUndefined();
      expect(diam.constraints?.maxHard).toBeUndefined();
      expect(diam.constraints?.minSoft).toBe(1.0);
      expect(diam.constraints?.maxSoft).toBe(20.0);

      const peso = COLUMNS_SCHEMA_MAP.get('prop_peso_unitario_geometrico')!;
      expect(peso.constraints?.minHard).toBeUndefined();
      expect(peso.constraints?.maxHard).toBeUndefined();
      expect(peso.constraints?.minSoft).toBe(1.0);
      expect(peso.constraints?.maxSoft).toBe(4.0);
    });
  });
});
