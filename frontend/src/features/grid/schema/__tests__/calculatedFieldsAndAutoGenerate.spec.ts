import { describe, it, expect } from 'vitest';
import { COLUMNS_SCHEMA_MAP } from '../columns';

describe('Calculated Fields and AutoGenerate Declarations', () => {
  describe('longitud_muestra (hasta - desde)', () => {
    const col = COLUMNS_SCHEMA_MAP.get('longitud_muestra')!;

    it('calculates difference rounded to 2 decimals', () => {
      expect(col.calculate?.({ desde: 100.5, hasta: 102.75 })).toBe(2.25);
      expect(col.calculate?.({ desde: '50.1', hasta: '51.32' })).toBe(1.22);
    });

    it('returns null if either desde or hasta is missing, empty or null', () => {
      expect(col.calculate?.({ desde: null, hasta: 100 })).toBeNull();
      expect(col.calculate?.({ desde: 50, hasta: '' })).toBeNull();
      expect(col.calculate?.({ desde: undefined, hasta: undefined })).toBeNull();
    });
  });

  describe('ucs_resistencia_calculada (4P / (pi * D^2))', () => {
    const col = COLUMNS_SCHEMA_MAP.get('ucs_resistencia_calculada')!;

    it('calculates UCS resistance in MPa correctly from kN and cm', () => {
      // D = 5.0 cm = 50 mm -> Area = pi * 50^2 / 4 = 1963.495 mm2
      // P = 200 kN = 200,000 N
      // Sigma = 200,000 / 1963.495 = 101.86 MPa
      const res = col.calculate?.({ ucs_carga_rotura: 200, ucs_diametro: 5.0 });
      expect(res).toBe(101.86);
    });

    it('returns null if diameter or load is missing or non-positive', () => {
      expect(col.calculate?.({ ucs_carga_rotura: null, ucs_diametro: 5.0 })).toBeNull();
      expect(col.calculate?.({ ucs_carga_rotura: 100, ucs_diametro: 0 })).toBeNull();
      expect(col.calculate?.({ ucs_carga_rotura: 100, ucs_diametro: -2 })).toBeNull();
    });
  });

  describe('corte_esf_normal_mpa and corte_esf_corte_mpa (kPa / 1000)', () => {
    const colNormal = COLUMNS_SCHEMA_MAP.get('corte_esf_normal_mpa')!;
    const colCorte = COLUMNS_SCHEMA_MAP.get('corte_esf_corte_mpa')!;

    it('converts kPa to MPa with 4 decimals', () => {
      expect(colNormal.calculate?.({ corte_esf_normal_kpa: 250 })).toBe(0.25);
      expect(colNormal.calculate?.({ corte_esf_normal_kpa: 1234.5 })).toBe(1.2345);
      expect(colCorte.calculate?.({ corte_esf_corte_kpa: 750 })).toBe(0.75);
    });

    it('returns null if kPa is missing or null', () => {
      expect(colNormal.calculate?.({ corte_esf_normal_kpa: null })).toBeNull();
      expect(colNormal.calculate?.({ corte_esf_normal_kpa: '' })).toBeNull();
    });
  });

  describe('codigo_muestra autoGenerate', () => {
    const col = COLUMNS_SCHEMA_MAP.get('codigo_muestra')!;

    it('autogenerates standard format sondaje-UCS-M{idd}', () => {
      expect(col.autoGenerate?.({ sondaje: 'DH24-001', idd: 7 })).toBe('DH24-001-UCS-M07');
      expect(col.autoGenerate?.({ sondaje: 'S-99', idd: 125 })).toBe('S-99-UCS-M125');
    });

    it('returns empty string if sondaje is empty', () => {
      expect(col.autoGenerate?.({ sondaje: '', idd: 7 })).toBe('');
      expect(col.autoGenerate?.({ sondaje: null, idd: 7 })).toBe('');
    });
  });
});

