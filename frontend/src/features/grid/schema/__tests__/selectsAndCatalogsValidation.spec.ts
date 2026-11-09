import { describe, it, expect } from 'vitest';
import { validateCell } from '../validationEngine';
import { COLUMNS_SCHEMA_MAP } from '../columns';

describe('Selects, Dynamic Catalogs and Elevation Validation', () => {
  const row = { idd: 10, sondaje: 'DH-10' };

  describe('Closed Selects: mes and tipo_ensayo (CRÍTICO on invalid)', () => {
    const mesCol = COLUMNS_SCHEMA_MAP.get('mes')!;
    const tipoCol = COLUMNS_SCHEMA_MAP.get('tipo_ensayo')!;

    it('accepts valid predefined options', () => {
      expect(validateCell('Enero', row, mesCol)).toBeNull();
      expect(validateCell('Diciembre', row, mesCol)).toBeNull();
      expect(validateCell('UCS', row, tipoCol)).toBeNull();
      expect(validateCell('Corte directo', row, tipoCol)).toBeNull();
    });

    it('emits CRÍTICO when value is not in closed options', () => {
      const alertMes = validateCell('Invierno', row, mesCol);
      expect(alertMes).not.toBeNull();
      expect(alertMes?.type).toBe('CRÍTICO');
      expect(alertMes?.message).toContain('no es una opción válida');

      const alertTipo = validateCell('Ensayo Inexistente', row, tipoCol);
      expect(alertTipo).not.toBeNull();
      expect(alertTipo?.type).toBe('CRÍTICO');
      expect(alertTipo?.message).toContain('no es una opción válida');
    });

    it('accepts empty value if policy is allowed', () => {
      expect(validateCell('', row, mesCol)).toBeNull();
      expect(validateCell('-', row, mesCol)).toBeNull();
      expect(validateCell(null, row, tipoCol)).toBeNull();
    });
  });

  describe('Dynamic Selects: proyecto and laboratorio (AVISO on unlisted)', () => {
    const proyCol = COLUMNS_SCHEMA_MAP.get('proyecto')!;
    const labCol = COLUMNS_SCHEMA_MAP.get('laboratorio')!;

    it('accepts any value when dynamic catalog is not yet loaded', () => {
      expect(validateCell('PROY_DESCONOCIDO', row, proyCol, {})).toBeNull();
      expect(validateCell('LAB_NUEVO', row, labCol, {})).toBeNull();
    });

    it('accepts values present in dynamic catalog', () => {
      const ctx = {
        proyectos: ['MINA_NORTE', 'MINA_SUR'],
        laboratorios: ['LAB_GEOTEC_A', 'LAB_GEOTEC_B']
      };
      expect(validateCell('MINA_NORTE', row, proyCol, ctx)).toBeNull();
      expect(validateCell('LAB_GEOTEC_A', row, labCol, ctx)).toBeNull();
    });

    it('emits AVISO (not CRÍTICO) when value is not in loaded catalog to avoid blocking field entries', () => {
      const ctx = {
        proyectos: ['MINA_NORTE', 'MINA_SUR'],
        laboratorios: ['LAB_GEOTEC_A']
      };

      const alertProy = validateCell('MINA_DESCONOCIDA', row, proyCol, ctx);
      expect(alertProy).not.toBeNull();
      expect(alertProy?.type).toBe('AVISO');
      expect(alertProy?.message).toContain('no figura en el catálogo de proyectos');

      const alertLab = validateCell('LAB_NO_REGISTRADO', row, labCol, ctx);
      expect(alertLab).not.toBeNull();
      expect(alertLab?.type).toBe('AVISO');
      expect(alertLab?.message).toContain('no figura en el catálogo de laboratorios');
    });
  });

  describe('Elevation Configuration (positiveOnly: true per ETAPA A)', () => {
    const elevCol = COLUMNS_SCHEMA_MAP.get('elevacion')!;

    it('accepts positive elevations without alert', () => {
      expect(validateCell(3800.5, row, elevCol)).toBeNull();
      expect(validateCell(0, row, elevCol)).toBeNull();
    });

    it('emits CRÍTICO on negative elevation per geographical context (positiveOnly: true)', () => {
      const alert = validateCell(-120.5, row, elevCol);
      expect(alert).not.toBeNull();
      expect(alert?.type).toBe('CRÍTICO');
      expect(alert?.message).toContain('no acepta valores negativos');
    });
  });
});
