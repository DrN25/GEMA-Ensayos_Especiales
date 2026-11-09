// frontend/src/config/__tests__/savePolicy.spec.ts
import { describe, it, expect } from 'vitest';
import {
  evaluateSaveBlocking,
  SAVE_BLOCKING_POLICY,
  type SaveBlockingPolicy
} from '../savePolicy';
import type { QAQCAlert } from '../../utils/qaqcValidator';

describe('Política de Bloqueo Configurable (SAVE_BLOCKING_POLICY)', () => {
  const mockAlerts: QAQCAlert[] = [
    { idd: 10, field: 'hasta', type: 'CRÍTICO', message: 'Desde >= Hasta', tab: 'registro_maestro' },
    { idd: 20, field: 'ucs_diametro', type: 'AVISO', message: 'Valor < min', tab: 'ucs' },
    { idd: 30, field: 'elasticas_modulo_young', type: 'CRÍTICO', message: 'Texto no numérico', tab: 'elasticas' },
    { idd: 40, field: 'corte_angulo_friccion', type: 'AVISO', message: 'Valor > max', tab: 'corte' },
  ];

  it('1. Política por defecto { blockOn: ["CRITICO"], scope: "all" } bloquea por cualquier crítico en el dataset', () => {
    const result = evaluateSaveBlocking(SAVE_BLOCKING_POLICY, mockAlerts);
    expect(result.isBlocked).toBe(true);
    expect(result.criticalCount).toBe(2);
    expect(result.warningCount).toBe(0);
    expect(result.blockingAlerts.map(a => a.idd)).toEqual([10, 30]);
    expect(result.summaryMessage).toContain('2 error(es) crítico(s)');
    expect(result.summaryMessage).toContain('en el dataset');
  });

  it('2. Scope "all" ignora advertencias si blockOn es solo CRITICO', () => {
    const onlyWarnings: QAQCAlert[] = [
      { idd: 20, field: 'ucs_diametro', type: 'AVISO', message: 'Valor < min', tab: 'ucs' },
      { idd: 40, field: 'corte_angulo_friccion', type: 'AVISO', message: 'Valor > max', tab: 'corte' },
    ];
    const result = evaluateSaveBlocking(SAVE_BLOCKING_POLICY, onlyWarnings);
    expect(result.isBlocked).toBe(false);
    expect(result.blockingAlerts.length).toBe(0);
  });

  it('3. Scope "dirty" evalúa únicamente las filas modificadas', () => {
    const dirtyPolicy: SaveBlockingPolicy = { blockOn: ['CRITICO'], scope: 'dirty' };
    const dirtyRowIds = new Set([20, 40]); // Solo filas con avisos modificadas; las filas críticas 10 y 30 no fueron tocadas

    const result = evaluateSaveBlocking(dirtyPolicy, mockAlerts, dirtyRowIds);
    expect(result.isBlocked).toBe(false);
    expect(result.blockingAlerts.length).toBe(0);
  });

  it('4. Scope "dirty" bloquea si una fila modificada tiene un error crítico', () => {
    const dirtyPolicy: SaveBlockingPolicy = { blockOn: ['CRITICO'], scope: 'dirty' };
    const dirtyRowIds = new Set([10]); // Fila 10 tiene crítico

    const result = evaluateSaveBlocking(dirtyPolicy, mockAlerts, dirtyRowIds);
    expect(result.isBlocked).toBe(true);
    expect(result.criticalCount).toBe(1);
    expect(result.blockingAlerts[0].idd).toBe(10);
    expect(result.summaryMessage).toContain('en las filas modificadas');
  });

  it('5. Política combinada blockOn: ["CRITICO", "ADVERTENCIA"] en scope "all" bloquea por ambos', () => {
    const strictPolicy: SaveBlockingPolicy = { blockOn: ['CRITICO', 'ADVERTENCIA'], scope: 'all' };
    const result = evaluateSaveBlocking(strictPolicy, mockAlerts);
    expect(result.isBlocked).toBe(true);
    expect(result.criticalCount).toBe(2);
    expect(result.warningCount).toBe(2);
    expect(result.totalBlockingCount).toBe(4);
    expect(result.summaryMessage).toContain('2 error(es) crítico(s) y 2 advertencia(s)');
  });

  it('6. Política combinada en scope "dirty" filtra por severidad y filas sucias simultáneamente', () => {
    const combinedPolicy: SaveBlockingPolicy = { blockOn: ['CRITICO', 'AVISO'], scope: 'dirty' };
    const dirtyRowIds = new Set([20]); // Solo fila 20 (que es AVISO)

    const result = evaluateSaveBlocking(combinedPolicy, mockAlerts, dirtyRowIds);
    expect(result.isBlocked).toBe(true);
    expect(result.criticalCount).toBe(0);
    expect(result.warningCount).toBe(1);
    expect(result.blockingAlerts[0].idd).toBe(20);
  });

  it('7. Dataset sin alertas nunca bloquea', () => {
    const result = evaluateSaveBlocking(SAVE_BLOCKING_POLICY, []);
    expect(result.isBlocked).toBe(false);
    expect(result.blockingAlerts.length).toBe(0);
  });
});
