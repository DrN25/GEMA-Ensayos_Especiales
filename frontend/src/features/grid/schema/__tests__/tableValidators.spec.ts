import { describe, it, expect } from 'vitest';
import {
  validateDesdeVsHasta,
  validateSampleOverlaps,
  validateDuplicateSampleCodes
} from '../tableValidators';

describe('Table-Level and Multi-Row Validators', () => {
  describe('validateDesdeVsHasta', () => {
    it('passes when desde < hasta', () => {
      const alerts = validateDesdeVsHasta({ idd: 1, sondaje: 'S1', desde: 10, hasta: 12.5 });
      expect(alerts).toHaveLength(0);
    });

    it('emits CRÍTICO when desde >= hasta', () => {
      const alerts = validateDesdeVsHasta({ idd: 2, sondaje: 'S1', desde: 50, hasta: 45 });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('CRÍTICO');
      expect(alerts[0].field).toBe('hasta');
      expect(alerts[0].message).toContain('debe ser menor que Hasta');

      const alertsEqual = validateDesdeVsHasta({ idd: 3, sondaje: 'S1', desde: 50, hasta: 50 });
      expect(alertsEqual).toHaveLength(1);
      expect(alertsEqual[0].type).toBe('CRÍTICO');
    });

    it('emits AVISO when depths are incomplete', () => {
      const alerts = validateDesdeVsHasta({ idd: 4, sondaje: 'S1', desde: 10, hasta: null });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('AVISO');
      expect(alerts[0].field).toBe('desde');
      expect(alerts[0].message).toContain('no están completas');
    });

    it('ignores completely empty row (no sondaje and no idd)', () => {
      const alerts = validateDesdeVsHasta({ desde: null, hasta: null });
      expect(alerts).toHaveLength(0);
    });
  });

  describe('validateSampleOverlaps', () => {
    it('detects overlapping intervals within the same sondaje', () => {
      const dataset = [
        { idd: 1, sondaje: 'DH-01', desde: 10, hasta: 20 },
        { idd: 2, sondaje: 'DH-01', desde: 18, hasta: 25 }, // Solapado con DH-01 (18 < 20)
        { idd: 3, sondaje: 'DH-01', desde: 25, hasta: 30 }
      ];
      const alerts = validateSampleOverlaps(dataset);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].idd).toBe(2);
      expect(alerts[0].type).toBe('AVISO');
      expect(alerts[0].message).toContain('Solapamiento de intervalo [18 - 25 m]');
    });

    it('allows overlapping numbers in DIFFERENT sondajes', () => {
      const dataset = [
        { idd: 1, sondaje: 'DH-01', desde: 10, hasta: 20 },
        { idd: 2, sondaje: 'DH-02', desde: 10, hasta: 20 }
      ];
      const alerts = validateSampleOverlaps(dataset);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('validateDuplicateSampleCodes', () => {
    it('detects duplicate sample codes across records', () => {
      const dataset = [
        { idd: 10, codigo_muestra: 'S01-UCS-M01' },
        { idd: 11, codigo_muestra: 'S01-UCS-M02' },
        { idd: 12, codigo_muestra: 'S01-UCS-M01' } // Duplicado de idd 10
      ];
      const alerts = validateDuplicateSampleCodes(dataset);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].idd).toBe(12);
      expect(alerts[0].type).toBe('AVISO');
      expect(alerts[0].message).toContain('Código de muestra duplicado "S01-UCS-M01"');
    });

    it('passes when all sample codes are unique', () => {
      const dataset = [
        { idd: 1, codigo_muestra: 'M-01' },
        { idd: 2, codigo_muestra: 'M-02' }
      ];
      expect(validateDuplicateSampleCodes(dataset)).toHaveLength(0);
    });
  });
});

