// frontend/src/utils/idCollisionResolver.ts

export type CollisionReason = 'DUPLICADO_EN_ARCHIVO' | 'COLISION_BD_DIFERENTE_MUESTRA';

export interface IdCollision {
  excelRow: number;
  originalIdd: number;
  assignedIdd: number;
  sondaje: string;
  codigo_muestra: string;
  reason: CollisionReason;
  description: string;
}

export interface CollisionResolutionResult {
  resolvedRecords: Record<string, any>[];
  collisions: IdCollision[];
  hasCollisions: boolean;
  totalIncoming: number;
  assignedCount: number;
}

/**
 * Resuelve y previene colisiones de IDD antes de guardar o cargar en grilla:
 * (a) Detecta IDD repetidos dentro del archivo que se importa.
 * (b) Detecta IDD que ya existen en la base de datos:
 *     - Si sondaje y codigo_muestra coinciden -> actualización legítima (mantiene IDD).
 *     - Si difieren -> colisión (asigna IDD nuevo = maxExistingIdd + 1 sin reutilizar huecos).
 */
export function resolveIdCollisions(
  incomingRecords: Record<string, any>[],
  existingRecords: Map<number, Record<string, any>> | Record<string, any>[],
  startingMaxIdd?: number
): CollisionResolutionResult {
  // 1. Indexar registros existentes
  const existingMap = new Map<number, Record<string, any>>();
  let maxIdd = startingMaxIdd ?? 0;

  if (existingRecords instanceof Map) {
    for (const [id, rec] of existingRecords.entries()) {
      existingMap.set(id, rec);
      if (id > maxIdd) maxIdd = id;
    }
  } else if (Array.isArray(existingRecords)) {
    for (let i = 0; i < existingRecords.length; i++) {
      const rec = existingRecords[i];
      const id = Number(rec.idd);
      if (!isNaN(id)) {
        existingMap.set(id, rec);
        if (id > maxIdd) maxIdd = id;
      }
    }
  }

  // Considerar también los IDDs entrantes para que el nuevo IDD nunca solape con ninguno entrante
  for (let i = 0; i < incomingRecords.length; i++) {
    const rawId = Number(incomingRecords[i].idd);
    if (!isNaN(rawId) && rawId > maxIdd) {
      maxIdd = rawId;
    }
  }

  const seenIncoming = new Map<number, { index: number; sondaje: string; codigo_muestra: string }>();
  const collisions: IdCollision[] = [];
  const resolvedRecords: Record<string, any>[] = [];

  for (let i = 0; i < incomingRecords.length; i++) {
    const origRow = incomingRecords[i];
    const row = { ...origRow };
    const excelRow = row._excelRowNumber !== undefined ? Number(row._excelRowNumber) : (i + 1);

    const sondaje = String(row.sondaje || '').trim();
    const codigo_muestra = String(row.codigo_muestra || '').trim();

    const rawId = (row.idd !== undefined && row.idd !== null && row.idd !== '')
      ? Number(row.idd)
      : null;

    // Caso 0: Fila sin IDD en Excel -> asignar nuevo IDD
    if (rawId === null || isNaN(rawId)) {
      maxIdd++;
      row.idd = maxIdd;
      seenIncoming.set(maxIdd, { index: i, sondaje, codigo_muestra });
      resolvedRecords.push(row);
      continue;
    }

    // Caso (a): IDD repetido dentro del mismo archivo
    if (seenIncoming.has(rawId)) {
      maxIdd++;
      const assignedIdd = maxIdd;
      collisions.push({
        excelRow,
        originalIdd: rawId,
        assignedIdd,
        sondaje,
        codigo_muestra,
        reason: 'DUPLICADO_EN_ARCHIVO',
        description: `IDD ${rawId} duplicado dentro del archivo (ya utilizado por fila previa). Se asignó nuevo IDD ${assignedIdd}.`
      });
      row.idd = assignedIdd;
      seenIncoming.set(assignedIdd, { index: i, sondaje, codigo_muestra });
      resolvedRecords.push(row);
      continue;
    }

    // Caso (b): IDD ya existente en la base de datos
    if (existingMap.has(rawId)) {
      const existing = existingMap.get(rawId)!;
      const exSondaje = String(existing.sondaje || '').trim().toUpperCase();
      const exMuestra = String(existing.codigo_muestra || '').trim().toUpperCase();
      const inSondaje = sondaje.toUpperCase();
      const inMuestra = codigo_muestra.toUpperCase();

      const isLegitUpdate = (inSondaje === exSondaje && inMuestra === exMuestra);

      if (isLegitUpdate) {
        // Actualización legítima: conserva IDD
        row.idd = rawId;
        seenIncoming.set(rawId, { index: i, sondaje, codigo_muestra });
        resolvedRecords.push(row);
      } else {
        // Colisión: dos muestras distintas con el mismo IDD
        maxIdd++;
        const assignedIdd = maxIdd;
        collisions.push({
          excelRow,
          originalIdd: rawId,
          assignedIdd,
          sondaje,
          codigo_muestra,
          reason: 'COLISION_BD_DIFERENTE_MUESTRA',
          description: `Colisión en BD: IDD ${rawId} pertenece a '${existing.sondaje}' / '${existing.codigo_muestra}'. Se asignó nuevo IDD ${assignedIdd}.`
        });
        row.idd = assignedIdd;
        seenIncoming.set(assignedIdd, { index: i, sondaje, codigo_muestra });
        resolvedRecords.push(row);
      }
      continue;
    }

    // Caso (c): IDD único y no existente en BD
    row.idd = rawId;
    seenIncoming.set(rawId, { index: i, sondaje, codigo_muestra });
    resolvedRecords.push(row);
  }

  return {
    resolvedRecords,
    collisions,
    hasCollisions: collisions.length > 0,
    totalIncoming: incomingRecords.length,
    assignedCount: collisions.length
  };
}

/**
 * Genera el archivo CSV para descarga del informe de colisiones.
 */
export function generateCollisionsCsv(collisions: IdCollision[]): string {
  const headers = ['Fila Excel', 'IDD Original', 'IDD Asignado', 'Sondaje', 'Código Muestra', 'Motivo', 'Descripción'];
  const rows = collisions.map(c => [
    c.excelRow,
    c.originalIdd,
    c.assignedIdd,
    `"${String(c.sondaje || '').replace(/"/g, '""')}"`,
    `"${String(c.codigo_muestra || '').replace(/"/g, '""')}"`,
    `"${String(c.reason || '')}"`,
    `"${String(c.description || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
}

