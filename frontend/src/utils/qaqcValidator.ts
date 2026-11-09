import { COLUMNS_CONFIG } from './columnsConfig';

export interface QAQCAlert {
  idd: number;
  field: string;
  type: 'CRÍTICO' | 'AVISO';
  message: string;
  tab: string;
}

/**
 * Valida un único registro en tiempo O(1) evaluando reglas de QA/QC.
 */
export function validateSingleRecord(rec: Record<string, any>): QAQCAlert[] {
  const alerts: QAQCAlert[] = [];
  const idd = Number(rec.idd) || 0;

  if (!rec.sondaje) return alerts;

  // 1. Validar Desde vs Hasta (Profundidades)
  const desde = rec.desde !== undefined && rec.desde !== null && rec.desde !== '' ? Number(rec.desde) : null;
  const hasta = rec.hasta !== undefined && rec.hasta !== null && rec.hasta !== '' ? Number(rec.hasta) : null;

  if (desde !== null && hasta !== null) {
    if (desde >= hasta) {
      alerts.push({
        idd,
        field: 'hasta',
        type: 'CRÍTICO',
        message: `La profundidad Desde (${desde} m) debe ser menor que Hasta (${hasta} m).`,
        tab: 'registro_maestro'
      });
    }
  } else {
    alerts.push({
      idd,
      field: 'desde',
      type: 'AVISO',
      message: 'Las profundidades Desde y Hasta no están completas.',
      tab: 'registro_maestro'
    });
  }

  // 2. Validación de columnas configuradas
  for (let c = 0; c < COLUMNS_CONFIG.length; c++) {
    const col = COLUMNS_CONFIG[c];
    if (col.dbName === 'idd' || col.dbName === 'desde' || col.dbName === 'hasta') continue;

    const val = rec[col.dbName];
    const colTab = col.module === 'common' ? 'registro_maestro' : col.module;

    if (val === undefined || val === null || val === '') continue;

    if (col.type === 'int' || col.type === 'float') {
      const numVal = Number(val);
      if (isNaN(numVal)) {
        alerts.push({
          idd,
          field: col.dbName,
          type: 'CRÍTICO',
          message: `El campo "${col.excelName}" debe contener un valor numérico.`,
          tab: colTab
        });
        continue;
      }

      if (numVal < 0 && col.dbName !== 'dia') {
        alerts.push({
          idd,
          field: col.dbName,
          type: 'CRÍTICO',
          message: `El campo "${col.excelName}" no acepta valores negativos.`,
          tab: colTab
        });
      }

      if (col.validation) {
        if (col.validation.min !== undefined && numVal < col.validation.min) {
          alerts.push({
            idd,
            field: col.dbName,
            type: 'AVISO',
            message: `El campo "${col.excelName}" (${numVal}) está por debajo de ${col.validation.min}.`,
            tab: colTab
          });
        }
        if (col.validation.max !== undefined && numVal > col.validation.max) {
          alerts.push({
            idd,
            field: col.dbName,
            type: 'AVISO',
            message: `El campo "${col.excelName}" (${numVal}) supera el límite de ${col.validation.max}.`,
            tab: colTab
          });
        }
      }
    }
  }

  return alerts;
}

/**
 * Valida un arreglo completo de registros.
 */
export function validateAllRecords(records: Record<string, any>[]): QAQCAlert[] {
  const alerts: QAQCAlert[] = [];
  for (let i = 0; i < records.length; i++) {
    const rowAlerts = validateSingleRecord(records[i]);
    if (rowAlerts.length > 0) {
      for (let j = 0; j < rowAlerts.length; j++) {
        alerts.push(rowAlerts[j]);
      }
    }
  }
  return alerts;
}
