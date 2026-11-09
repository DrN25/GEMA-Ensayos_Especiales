import { describe, it, expect } from 'vitest';
import { isEmptyValue, validateCell } from '../validationEngine';
import { decimalColumn, integerColumn, textColumn } from '../columnFactories';

describe('Empty Policy and Numeric Validation Engine', () => {
  describe('isEmptyValue pure evaluation', () => {
    it('recognizes null, undefined and empty string as empty', () => {
      expect(isEmptyValue(null)).toBe(true);
      expect(isEmptyValue(undefined)).toBe(true);
      expect(isEmptyValue('')).toBe(true);
      expect(isEmptyValue('   ')).toBe(true);
    });

    it('recognizes strictly global tokens "-" and "--" as empty', () => {
      expect(isEmptyValue('-')).toBe(true);
      expect(isEmptyValue(' - ')).toBe(true);
      expect(isEmptyValue('--')).toBe(true);
      expect(isEmptyValue(' -- ')).toBe(true);
    });

    it('does NOT recognize "N/A", "NA" or "—" as empty globally', () => {
      expect(isEmptyValue('N/A')).toBe(false);
      expect(isEmptyValue('NA')).toBe(false);
      expect(isEmptyValue('—')).toBe(false);
    });

    it('supports extraEmptyTokens opt-in per column (e.g. "-1")', () => {
      expect(isEmptyValue('-1')).toBe(false);
      expect(isEmptyValue('-1', ['-1'])).toBe(true);
      expect(isEmptyValue(' -1 ', ['-1'])).toBe(true);
    });

    it('supports emptyTokensExclude to prevent false positive empty', () => {
      expect(isEmptyValue('-', undefined, ['-'])).toBe(false);
    });
  });

  describe('Empty Policy Enforcement in validateCell', () => {
    const colAllowed = decimalColumn({
      id: 'val_allowed',
      header: 'Permitido',
      excelName: 'Permitido Excel',
      group: 'G',
      module: 'ucs',
      emptyPolicy: 'allowed'
    });

    const colWarn = decimalColumn({
      id: 'val_warn',
      header: 'Advertencia',
      excelName: 'Advertencia Excel',
      group: 'G',
      module: 'ucs',
      emptyPolicy: 'warn'
    });

    const colBlock = decimalColumn({
      id: 'val_block',
      header: 'Bloqueado',
      excelName: 'Bloqueado Excel',
      group: 'G',
      module: 'ucs',
      emptyPolicy: 'block'
    });

    const row = { idd: 101, sondaje: 'DH-01' };

    it('emptyPolicy "allowed" produces null on empty tokens', () => {
      expect(validateCell(null, row, colAllowed)).toBeNull();
      expect(validateCell('', row, colAllowed)).toBeNull();
      expect(validateCell('-', row, colAllowed)).toBeNull();
      expect(validateCell(' - ', row, colAllowed)).toBeNull();
      expect(validateCell('--', row, colAllowed)).toBeNull();
    });

    it('emptyPolicy "warn" produces AVISO on empty tokens', () => {
      const alert = validateCell('-', row, colWarn);
      expect(alert).not.toBeNull();
      expect(alert?.type).toBe('AVISO');
      expect(alert?.field).toBe('val_warn');
    });

    it('emptyPolicy "block" produces CRÍTICO on empty tokens', () => {
      const alert = validateCell('-', row, colBlock);
      expect(alert).not.toBeNull();
      expect(alert?.type).toBe('CRÍTICO');
      expect(alert?.field).toBe('val_block');
    });
  });

  describe('Numeric Syntax and Garbage Text (CRÍTICO)', () => {
    const decCol = decimalColumn({
      id: 'diametro',
      header: 'Diámetro',
      excelName: 'Diámetro del testigo (cm)',
      group: 'UCS',
      module: 'ucs',
      constraints: { positiveOnly: true, minSoft: 1.0, maxSoft: 20.0 }
    });

    const intCol = integerColumn({
      id: 'dia',
      header: 'Día',
      excelName: 'Día',
      group: 'Común',
      module: 'common',
      constraints: { minHard: 1, maxHard: 31 }
    });

    const row = { idd: 6994, sondaje: 'DH-6994' };

    it('detects double decimal dot garbage text "170..99" as CRÍTICO', () => {
      const alert = validateCell('170..99', row, decCol);
      expect(alert).not.toBeNull();
      expect(alert?.type).toBe('CRÍTICO');
      expect(alert?.message).toContain('debe contener un valor numérico válido');
    });

    it('detects alphabetic text in numeric column as CRÍTICO', () => {
      const alert = validateCell('cinco', row, decCol);
      expect(alert).not.toBeNull();
      expect(alert?.type).toBe('CRÍTICO');
      expect(alert?.message).toContain('debe contener un valor numérico válido');
    });

    it('detects non-integer in integer column as CRÍTICO', () => {
      const alert = validateCell('15.5', row, intCol);
      expect(alert).not.toBeNull();
      expect(alert?.type).toBe('CRÍTICO');
      expect(alert?.message).toContain('debe ser un número entero');
    });
  });

  describe('Precedence: Exactly ONE Alert per Cell (No Double CRÍTICO+AVISO)', () => {
    const colWithBoth = decimalColumn({
      id: 'corte_esf_normal_kpa',
      header: 'Esf. Normal',
      excelName: 'Esf Normal (kPa)',
      group: 'Corte Directo',
      module: 'corte',
      constraints: { positiveOnly: true, minSoft: 0.0, maxSoft: 5000.0 }
    });

    const row = { idd: 500, sondaje: 'DH-500' };

    it('negative value produces ONLY CRÍTICO for positiveOnly, avoiding double AVISO for minSoft', () => {
      // In old validator, -5 generated BOTH CRÍTICO (no negativos) AND AVISO (< 0)
      const alert = validateCell(-5, row, colWithBoth);
      expect(alert).not.toBeNull();
      expect(alert?.type).toBe('CRÍTICO');
      expect(alert?.message).toContain('no acepta valores negativos');
    });

    it('value within physical bounds but outside soft range produces AVISO', () => {
      const ucsCol = decimalColumn({
        id: 'ucs_diametro',
        header: 'Diámetro',
        excelName: 'Diámetro (cm)',
        group: 'UCS',
        module: 'ucs',
        constraints: { positiveOnly: true, minSoft: 1.0, maxSoft: 20.0, maxHard: 100.0 }
      });

      // 63.5 cm (historical mm input) is < maxHard (100) but > maxSoft (20.0) -> AVISO
      const alert = validateCell(63.5, row, ucsCol);
      expect(alert).not.toBeNull();
      expect(alert?.type).toBe('AVISO');
      expect(alert?.message).toContain('supera el límite de 20');
    });

    it('value exceeding hard limit produces CRÍTICO', () => {
      const ucsCol = decimalColumn({
        id: 'ucs_diametro',
        header: 'Diámetro',
        excelName: 'Diámetro (cm)',
        group: 'UCS',
        module: 'ucs',
        constraints: { positiveOnly: true, minSoft: 1.0, maxSoft: 20.0, maxHard: 100.0 }
      });

      // 150 cm exceeds physical hard limit (100) -> CRÍTICO
      const alert = validateCell(150, row, ucsCol);
      expect(alert).not.toBeNull();
      expect(alert?.type).toBe('CRÍTICO');
      expect(alert?.message).toContain('supera el límite físico máximo de 100');
    });
  });
});

