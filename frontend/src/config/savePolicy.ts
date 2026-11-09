// frontend/src/config/savePolicy.ts
import type { QAQCAlert } from '../utils/qaqcValidator';

export type AlertSeverity = 'CRÍTICO' | 'CRITICO' | 'AVISO' | 'ADVERTENCIA' | 'INFO';
export type SaveBlockingScope = 'all' | 'dirty';

export interface SaveBlockingPolicy {
  /**
   * Lista de niveles de severidad que activan el bloqueo de guardado.
   * Por defecto: ['CRITICO'] (coincide con 'CRÍTICO' y 'CRITICO').
   */
  blockOn: AlertSeverity[];

  /**
   * Alcance de la verificación:
   * - 'all': Evalúa todas las alertas del dataset completo.
   * - 'dirty': Evalúa únicamente las alertas de las filas modificadas/insertadas (dirtyRowIds).
   */
  scope: SaveBlockingScope;
}

/**
 * Política de bloqueo de guardado del sistema SIGEG.
 * Configuración centralizada: puede modificarse aquí sin alterar la lógica de negocio.
 */
export const SAVE_BLOCKING_POLICY: SaveBlockingPolicy = {
  blockOn: ['CRITICO'],
  scope: 'all'
};

export interface BlockingEvaluationResult {
  isBlocked: boolean;
  blockingAlerts: QAQCAlert[];
  criticalCount: number;
  warningCount: number;
  totalBlockingCount: number;
  summaryMessage: string;
}

function normalizeSeverity(sev: string): 'CRITICO' | 'AVISO' | 'INFO' {
  const upper = (sev || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (upper === 'CRITICO') return 'CRITICO';
  if (upper === 'AVISO' || upper === 'ADVERTENCIA') return 'AVISO';
  return 'INFO';
}

/**
 * Evalúa si una lista de alertas debe bloquear el guardado según la política configurada.
 */
export function evaluateSaveBlocking(
  policy: SaveBlockingPolicy,
  alerts: QAQCAlert[],
  dirtyRowIds?: Set<number>
): BlockingEvaluationResult {
  const normalizedBlockOn = new Set(policy.blockOn.map(s => normalizeSeverity(s)));

  const blockingAlerts: QAQCAlert[] = [];
  let criticalCount = 0;
  let warningCount = 0;

  for (let i = 0; i < alerts.length; i++) {
    const a = alerts[i];
    const norm = normalizeSeverity(a.type);

    // Filtrar por scope
    if (policy.scope === 'dirty') {
      if (!dirtyRowIds || !dirtyRowIds.has(a.idd)) {
        continue;
      }
    }

    if (normalizedBlockOn.has(norm)) {
      blockingAlerts.push(a);
      if (norm === 'CRITICO') criticalCount++;
      else if (norm === 'AVISO') warningCount++;
    }
  }

  const isBlocked = blockingAlerts.length > 0;
  let summaryMessage = '';

  if (isBlocked) {
    const scopeDesc = policy.scope === 'all' ? 'en el dataset' : 'en las filas modificadas';
    if (criticalCount > 0 && warningCount > 0) {
      summaryMessage = `Guardado bloqueado: se detectaron ${criticalCount} error(es) crítico(s) y ${warningCount} advertencia(s) ${scopeDesc}.`;
    } else if (criticalCount > 0) {
      summaryMessage = `Guardado bloqueado: se detectaron ${criticalCount} error(es) crítico(s) de QA/QC ${scopeDesc}.`;
    } else {
      summaryMessage = `Guardado bloqueado: se detectaron ${warningCount} advertencia(s) de QA/QC ${scopeDesc}.`;
    }
  }

  return {
    isBlocked,
    blockingAlerts,
    criticalCount,
    warningCount,
    totalBlockingCount: blockingAlerts.length,
    summaryMessage
  };
}
