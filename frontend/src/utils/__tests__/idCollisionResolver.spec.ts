// frontend/src/utils/__tests__/idCollisionResolver.spec.ts
import { describe, it, expect } from 'vitest';
import {
  resolveIdCollisions,
  generateCollisionsCsv,
  type IdCollision
} from '../idCollisionResolver';

describe('Detector y Resolutor de Colisiones de IDD (resolveIdCollisions)', () => {
  // Fixture real basado en el Excel histórico:
  // Fila 8193: IDD 8191, FEHI24-032, FEHI24-032-TI-M10 (FRBB)
  // Fila 8194: IDD 8191, CHGT25-002, CHGT25-002-UCS-M01 (CHABB)
  const fixtureRow8193 = {
    _excelRowNumber: 8193,
    idd: 8191,
    sondaje: 'FEHI24-032',
    codigo_muestra: 'FEHI24-032-TI-M10',
    proyecto: 'FRBB'
  };

  const fixtureRow8194 = {
    _excelRowNumber: 8194,
    idd: 8191,
    sondaje: 'CHGT25-002',
    codigo_muestra: 'CHGT25-002-UCS-M01',
    proyecto: 'CHABB'
  };

  it('1. Caso (a): Detecta IDD repetido dentro del mismo archivo Excel (caso real 8191)', () => {
    const incoming = [
      { ...fixtureRow8193 },
      { ...fixtureRow8194 },
      { _excelRowNumber: 8195, idd: 8193, sondaje: 'CHGT25-002', codigo_muestra: 'CHGT25-002-UCS-M02' }
    ];
    const existing = new Map<number, any>();

    const result = resolveIdCollisions(incoming, existing, 9817);

    expect(result.hasCollisions).toBe(true);
    expect(result.collisions.length).toBe(1);

    const collision = result.collisions[0];
    expect(collision.excelRow).toBe(8194);
    expect(collision.originalIdd).toBe(8191);
    expect(collision.assignedIdd).toBe(9818); // maxExisting (9817) + 1
    expect(collision.reason).toBe('DUPLICADO_EN_ARCHIVO');
    expect(collision.sondaje).toBe('CHGT25-002');
    expect(collision.codigo_muestra).toBe('CHGT25-002-UCS-M01');

    // La primera fila conserva 8191
    expect(result.resolvedRecords[0].idd).toBe(8191);
    // La segunda fila en conflicto recibe 9818 sin sobrescribir en silencio
    expect(result.resolvedRecords[1].idd).toBe(9818);
    // La tercera fila conserva su 8193 legítimo
    expect(result.resolvedRecords[2].idd).toBe(8193);
  });

  it('2. Caso (b): Detecta colisión cuando IDD ya existe en BD con diferente muestra', () => {
    // La base de datos ya tiene FEHI24-032 con IDD 8191
    const existing = new Map<number, any>([
      [8191, { idd: 8191, sondaje: 'FEHI24-032', codigo_muestra: 'FEHI24-032-TI-M10' }],
      [9000, { idd: 9000, sondaje: 'S-9000', codigo_muestra: 'M-9000' }]
    ]);

    // El archivo entrante intenta usar IDD 8191 para una muestra completamente diferente (CHGT25-002)
    const incoming = [
      { ...fixtureRow8194 }
    ];

    const result = resolveIdCollisions(incoming, existing);

    expect(result.hasCollisions).toBe(true);
    expect(result.collisions.length).toBe(1);

    const col = result.collisions[0];
    expect(col.reason).toBe('COLISION_BD_DIFERENTE_MUESTRA');
    expect(col.originalIdd).toBe(8191);
    expect(col.assignedIdd).toBe(9001); // maxExisting (9000) + 1
    expect(result.resolvedRecords[0].idd).toBe(9001);
  });

  it('3. Actualización legítima: Mismo IDD, sondaje y código de muestra se actualizan sin colisión', () => {
    // La base ya tiene IDD 100 con sondaje S-01 y muestra M-01
    const existing = new Map<number, any>([
      [100, { idd: 100, sondaje: 'S-01', codigo_muestra: 'M-01', desde: 10.5, hasta: 11.0 }]
    ]);

    // Archivo entrante actualiza el valor de hasta a 11.2 con los mismos sondaje y muestra
    const incoming = [
      { _excelRowNumber: 5, idd: 100, sondaje: 'S-01', codigo_muestra: 'M-01', desde: 10.5, hasta: 11.2 }
    ];

    const result = resolveIdCollisions(incoming, existing);

    expect(result.hasCollisions).toBe(false);
    expect(result.collisions.length).toBe(0);
    expect(result.resolvedRecords[0].idd).toBe(100);
    expect(result.resolvedRecords[0].hasta).toBe(11.2);
  });

  it('4. Generación de informe CSV', () => {
    const collisions: IdCollision[] = [
      {
        excelRow: 8194,
        originalIdd: 8191,
        assignedIdd: 9818,
        sondaje: 'CHGT25-002',
        codigo_muestra: 'CHGT25-002-UCS-M01',
        reason: 'DUPLICADO_EN_ARCHIVO',
        description: 'IDD duplicado'
      }
    ];

    const csv = generateCollisionsCsv(collisions);
    expect(csv).toContain('Fila Excel,IDD Original,IDD Asignado,Sondaje,Código Muestra,Motivo,Descripción');
    expect(csv).toContain('8194,8191,9818,"CHGT25-002","CHGT25-002-UCS-M01","DUPLICADO_EN_ARCHIVO","IDD duplicado"');
  });
});
