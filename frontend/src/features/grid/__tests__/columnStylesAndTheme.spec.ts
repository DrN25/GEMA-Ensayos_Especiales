// frontend/src/features/grid/__tests__/columnStylesAndTheme.spec.ts
import { describe, it, expect } from 'vitest';
import { COLUMNS_SCHEMA, COLUMN_GROUP_STYLES } from '../schema/columns';
import { getGridColumnsForModule } from '../columnsDefinition';

describe('Estilos Declarativos de Columnas y Cabeceras', () => {
  it('todas las columnas deben tener definido un estilo en COLUMNS_SCHEMA', () => {
    expect(COLUMNS_SCHEMA.length).toBe(51);
    for (const col of COLUMNS_SCHEMA) {
      expect(col.style).toBeDefined();
      expect(col.style?.headerBg).toBeDefined();
      expect(col.style?.headerText).toBeDefined();
    }
  });

  it('los grupos geomecánicos deben tener asignados los colores temáticos correctos', () => {
    // Grupo inicial: Slate / Navy
    const sondaje = COLUMNS_SCHEMA.find(c => c.id === 'sondaje');
    expect(sondaje?.style?.headerBg).toBe(COLUMN_GROUP_STYLES.general.headerBg);
    expect(sondaje?.style?.bold).toBe(true);
    expect(sondaje?.style?.uppercase).toBe(true);

    // UCS: Naranja
    const ucsCol = COLUMNS_SCHEMA.find(c => c.id === 'ucs_resistencia');
    expect(ucsCol?.style?.headerBg).toBe(COLUMN_GROUP_STYLES.ucs.headerBg);
    expect(ucsCol?.style?.headerBg).toContain('orange');

    // Constantes Elásticas: Rojo
    const elasCol = COLUMNS_SCHEMA.find(c => c.id === 'elasticas_modulo_young');
    expect(elasCol?.style?.headerBg).toBe(COLUMN_GROUP_STYLES.elasticas.headerBg);
    expect(elasCol?.style?.headerBg).toContain('rose');

    // Tracción Indirecta: Amarillo / Ámbar
    const tracCol = COLUMNS_SCHEMA.find(c => c.id === 'traccion_resistencia_mpa');
    expect(tracCol?.style?.headerBg).toBe(COLUMN_GROUP_STYLES.traccion.headerBg);
    expect(tracCol?.style?.headerBg).toContain('amber');

    // Corte Directo: Verde Esmeralda
    const corteCol = COLUMNS_SCHEMA.find(c => c.id === 'corte_cohesion_mpa');
    expect(corteCol?.style?.headerBg).toBe(COLUMN_GROUP_STYLES.corte.headerBg);
    expect(corteCol?.style?.headerBg).toContain('emerald');

    // Compresión Triaxial: Guinda
    const triaxCol = COLUMNS_SCHEMA.find(c => c.id === 'triaxial_resistencia_mpa');
    expect(triaxCol?.style?.headerBg).toBe(COLUMN_GROUP_STYLES.triaxial.headerBg);
    expect(triaxCol?.style?.headerBg).toContain('#3b0d21');

    // Propiedades Físicas: Celeste / Cyan
    const propCol = COLUMNS_SCHEMA.find(c => c.id === 'prop_peso_unitario_geometrico');
    expect(propCol?.style?.headerBg).toBe(COLUMN_GROUP_STYLES.propiedades.headerBg);
    expect(propCol?.style?.headerBg).toContain('cyan');

    // Grupos finales: Mismo color que el grupo inicial
    const qaqcCol = COLUMNS_SCHEMA.find(c => c.id === 'qaqc_validacion');
    expect(qaqcCol?.style?.headerBg).toBe(COLUMN_GROUP_STYLES.general.headerBg);
    const obsCol = COLUMNS_SCHEMA.find(c => c.id === 'observacion');
    expect(obsCol?.style?.headerBg).toBe(COLUMN_GROUP_STYLES.general.headerBg);
  });

  it('los estilos deben propagarse correctamente a GridColumnDef a través de getGridColumnsForModule', () => {
    const ucsGridCols = getGridColumnsForModule('ucs');
    const ucsRes = ucsGridCols.find(c => c.id === 'ucs_resistencia');
    expect(ucsRes?.style).toBeDefined();
    expect(ucsRes?.style?.headerBg).toContain('orange');

    const sondaje = ucsGridCols.find(c => c.id === 'sondaje');
    expect(sondaje?.style?.uppercase).toBe(true);
    expect(sondaje?.style?.bold).toBe(true);
  });

  it('rendimiento: la resolución de estilos para 50 columnas debe completarse en menos de 5 ms', () => {
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) {
      getGridColumnsForModule('registro_maestro');
    }
    const elapsed = performance.now() - t0;
    // 1000 iteraciones completas de resolución de columnas
    expect(elapsed).toBeLessThan(100); // Promedio < 0.1 ms por resolución
  });
});
