// frontend/src/features/grid/storage/types.ts

export interface ModifiedRowDelta {
  current: Record<string, any>;
  original: Record<string, any>;
  updatedAt: number;
}

export interface GridDelta {
  version: number; // Esquema del delta (actualmente 1)
  timestamp: number;
  modifiedRows: Record<number, ModifiedRowDelta>;
  insertedRows: Record<string, any>[];
  deletedRowIds: number[];
}

export interface RowConflict {
  idd: number;
  sondaje?: string;
  field: string;
  serverValue: any;
  localValue: any;
  originalValue: any;
  serverRecord: Record<string, any>;
  localRecord: Record<string, any>;
  originalRecord: Record<string, any>;
}

