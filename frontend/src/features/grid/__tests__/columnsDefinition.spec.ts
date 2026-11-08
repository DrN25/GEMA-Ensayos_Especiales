// frontend/src/features/grid/__tests__/columnsDefinition.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  GRID_COLUMNS_DEFINITION,
  getGridColumnsForModule,
  MESES_OPTIONS,
  TIPO_ENSAYO_OPTIONS
} from '../columnsDefinition';
import { getGridVersion, setGridVersion } from '../flags';

describe('Bloque 1: Declaración de Columnas y Tipos (GridColumnDef)', () => {
  it('debe definir todas las 48 columnas del sistema geomecánico más la columna de acciones', () => {
    // 48 columnas de datos geomecánicos + 1 columna de acciones fijas = 49 columnas totales
    expect(GRID_COLUMNS_DEFINITION.length).toBe(49);

    const ids = GRID_COLUMNS_DEFINITION.map(c => c.id);
    expect(ids).toContain('idd');
    expect(ids).toContain('sondaje');
    expect(ids).toContain('codigo_muestra');
    expect(ids).toContain('ucs_diametro');
    expect(ids).toContain('elasticas_modulo_young');
    expect(ids).toContain('traccion_resistencia_mpa');
    expect(ids).toContain('corte_cohesion_mpa');
    expect(ids).toContain('triaxial_resistencia_mpa');
    expect(ids).toContain('prop_peso_unitario_geometrico');
    expect(ids).toContain('acciones_col');
  });

  it('debe configurar columnas fijas a la izquierda (Pinned Left) y a la derecha (Pinned Right)', () => {
    const pinnedLeft = GRID_COLUMNS_DEFINITION.filter(c => c.pinned === 'left');
    expect(pinnedLeft.map(c => c.id)).toEqual(['idd', 'sondaje', 'codigo_muestra']);

    const pinnedRight = GRID_COLUMNS_DEFINITION.filter(c => c.pinned === 'right');
    expect(pinnedRight.map(c => c.id)).toEqual(['acciones_col']);
  });

  it('debe tener cabeceras de 2 niveles coherentes agrupadas por tipo de ensayo geomecánico', () => {
    const groups = new Set(GRID_COLUMNS_DEFINITION.map(c => c.group));
    expect(groups.has('Identificación de Muestra')).toBe(true);
    expect(groups.has('Datos Comunes de Campo')).toBe(true);
    expect(groups.has('Ensayo UCS')).toBe(true);
    expect(groups.has('Constantes Elásticas')).toBe(true);
    expect(groups.has('Tracción Indirecta')).toBe(true);
    expect(groups.has('Corte Directo')).toBe(true);
    expect(groups.has('Compresión Triaxial')).toBe(true);
    expect(groups.has('Propiedades Físicas')).toBe(true);
    expect(groups.has('Acciones')).toBe(true);
  });

  it('debe asignar hints y unidades físicas exactas en columnas numéricas clave', () => {
    const ucs = GRID_COLUMNS_DEFINITION.find(c => c.id === 'ucs_resistencia');
    expect(ucs?.unit).toBe('MPa');
    expect(ucs?.type).toBe('number');
    expect(ucs?.validations?.min).toBe(0.1);

    const young = GRID_COLUMNS_DEFINITION.find(c => c.id === 'elasticas_modulo_young');
    expect(young?.unit).toBe('GPa');
    expect(young?.validations?.min).toBe(1.0);
    expect(young?.validations?.max).toBe(150.0);

    const dia = GRID_COLUMNS_DEFINITION.find(c => c.id === 'dia');
    expect(dia?.validations?.min).toBe(1);
    expect(dia?.validations?.max).toBe(31);
  });

  it('debe filtrar correctamente las columnas por módulo geomecánico', () => {
    const maestroCols = getGridColumnsForModule('registro_maestro');
    expect(maestroCols.length).toBe(49);

    const ucsCols = getGridColumnsForModule('ucs');
    const ucsGroups = new Set(ucsCols.map(c => c.group));
    expect(ucsGroups.has('Identificación de Muestra')).toBe(true);
    expect(ucsGroups.has('Datos Comunes de Campo')).toBe(true);
    expect(ucsGroups.has('Ensayo UCS')).toBe(true);
    expect(ucsGroups.has('Acciones')).toBe(true);
    expect(ucsGroups.has('Constantes Elásticas')).toBe(false);
    expect(ucsGroups.has('Compresión Triaxial')).toBe(false);
  });

  it('debe inyectar opciones dinámicas en columnas de selección (proyecto y laboratorio)', () => {
    const cols = getGridColumnsForModule('registro_maestro', {
      proyectos: ['PROYECTO_ALPHA', 'PROYECTO_BETA'],
      laboratorios: ['LAB_CENTRAL', 'LAB_SUR']
    });

    const proyectoCol = cols.find(c => c.id === 'proyecto');
    expect(proyectoCol?.options).toEqual(['PROYECTO_ALPHA', 'PROYECTO_BETA']);

    const labCol = cols.find(c => c.id === 'laboratorio');
    expect(labCol?.options).toEqual(['LAB_CENTRAL', 'LAB_SUR']);
  });
});

describe('Bloque 1: Feature Flag de Convivencia (v1 / v2)', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    (globalThis as any).window = {
      location: { search: '' },
      localStorage: {
        getItem: (k: string) => mockStorage[k] || null,
        setItem: (k: string, v: string) => { mockStorage[k] = v; },
        clear: () => { mockStorage = {}; }
      }
    };
    (globalThis as any).localStorage = (globalThis as any).window.localStorage;
  });

  afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
  });

  it('debe retornar v1 por defecto para garantizar cero regresión en producción', () => {
    expect(getGridVersion()).toBe('v1');
  });

  it('debe respetar el parámetro de consulta URL ?grid=v2 prioritariamente', () => {
    (globalThis as any).window.location.search = '?grid=v2';
    expect(getGridVersion()).toBe('v2');
  });

  it('debe respetar el almacenamiento en localStorage si se activa v2 sin parámetro URL', () => {
    setGridVersion('v2');
    expect(getGridVersion()).toBe('v2');

    setGridVersion('v1');
    expect(getGridVersion()).toBe('v1');
  });
});
