import { describe, it, expect } from 'vitest';
import {
  textColumn,
  integerColumn,
  decimalColumn,
  selectColumn,
  calculatedColumn,
  actionColumn,
  formatInteger,
  formatDecimal
} from '../columnFactories';

describe('Column Factories and Formatters', () => {
  it('formatInteger formats numbers, rounded floats and handles null/empty', () => {
    expect(formatInteger(null)).toBe('');
    expect(formatInteger(undefined)).toBe('');
    expect(formatInteger('')).toBe('');
    expect(formatInteger(42)).toBe('42');
    expect(formatInteger(42.7)).toBe('43');
    expect(formatInteger('100')).toBe('100');
    expect(formatInteger('abc')).toBe('abc');
  });

  it('formatDecimal formats with specific precision and removes trailing zeros', () => {
    expect(formatDecimal(null)).toBe('');
    expect(formatDecimal(undefined)).toBe('');
    expect(formatDecimal('')).toBe('');
    expect(formatDecimal(12.3456, 2)).toBe('12.35');
    expect(formatDecimal(12.3, 2)).toBe('12.3');
    expect(formatDecimal(12.0, 2)).toBe('12');
    expect(formatDecimal(0.123456, 4)).toBe('0.1235');
    expect(formatDecimal('invalid', 2)).toBe('invalid');
  });

  it('textColumn creates schema with text defaults', () => {
    const col = textColumn({
      id: 'test_text',
      header: 'Texto',
      excelName: 'Texto Completo',
      group: 'Grupo A',
      module: 'common'
    });
    expect(col.type).toBe('text');
    expect(col.editor).toBe('text');
    expect(col.emptyPolicy).toBe('allowed');
    expect(col.defaultWidth).toBe(120);
    expect(col.format?.('  hola  ')).toBe('hola');
    expect(col.format?.(null)).toBe('');
  });

  it('integerColumn creates schema with integer defaults', () => {
    const col = integerColumn({
      id: 'test_int',
      header: 'Entero',
      excelName: 'Entero Excel',
      group: 'Grupo B',
      module: 'common'
    });
    expect(col.type).toBe('integer');
    expect(col.editor).toBe('number');
    expect(col.emptyPolicy).toBe('allowed');
    expect(col.format?.(55.2)).toBe('55');
  });

  it('decimalColumn creates schema with decimal defaults and custom precision', () => {
    const col = decimalColumn({
      id: 'test_dec',
      header: 'Decimal',
      excelName: 'Decimal Excel',
      group: 'Grupo C',
      module: 'ucs',
      decimals: 3
    });
    expect(col.type).toBe('decimal');
    expect(col.editor).toBe('number');
    expect(col.decimals).toBe(3);
    expect(col.format?.(10.5559)).toBe('10.556');
  });

  it('selectColumn creates schema with select editor and options', () => {
    const col = selectColumn({
      id: 'test_sel',
      header: 'Select',
      excelName: 'Select Excel',
      group: 'Grupo D',
      module: 'common',
      options: ['A', 'B', 'C']
    });
    expect(col.type).toBe('select');
    expect(col.editor).toBe('select');
    expect(col.options).toEqual(['A', 'B', 'C']);
  });

  it('calculatedColumn creates readonly column with calculate function', () => {
    const col = calculatedColumn({
      id: 'test_calc',
      header: 'Calc',
      excelName: 'Calculado',
      group: 'Grupo E',
      module: 'common',
      calculate: (row: Record<string, any>) => (row.a || 0) + (row.b || 0)
    });
    expect(col.type).toBe('readonly');
    expect(col.editor).toBe('none');
    expect(col.calculate?.({ a: 10, b: 20 })).toBe(30);
  });

  it('actionColumn creates pinned right column with none editor', () => {
    const col = actionColumn({
      id: 'acciones',
      header: 'Acciones',
      excelName: 'Acciones',
      group: 'Acciones',
      module: 'common'
    });
    expect(col.type).toBe('readonly');
    expect(col.editor).toBe('none');
    expect(col.pinned).toBe('right');
  });
});

