import { COLUMNS_CONFIG, type ColumnDef } from '../utils/columnsConfig';

export const assayTypes = {
  CE: 'Determinación de constantes elásticas',
  TI: 'Tracción indirecta',
  CD: 'Corte directo',
  TX: 'Compresión triaxial',
  UCS: 'UCS',
};

export type AssayType = keyof typeof assayTypes;

export const laboratories = ['Geomec', 'Ingeotest', 'LaboRock (GeoBlast)', 'UNI (LGM)'] as const;
export type Laboratory = typeof laboratories[number];

const labGroups = {
  ucs: { title: 'Compresión Uniaxial', columns: ['ucs_diametro', 'ucs_carga_rotura', 'ucs_resistencia', 'ucs_resistencia_calculada', 'ucs_rotura'] },
  elasticas: { title: 'Constantes Elásticas', columns: ['elasticas_modulo_young', 'elasticas_poisson'] },
  traccion: { title: 'Tracción Indirecta', columns: ['traccion_carga_promedio', 'traccion_resistencia_kgcm2', 'traccion_vacia_28', 'traccion_resistencia_mpa'] },
  corte: { title: 'Corte Directo', columns: ['corte_tipo_fractura', 'corte_area', 'corte_esf_normal_kpa', 'corte_esf_corte_kpa', 'corte_esf_normal_mpa', 'corte_esf_corte_mpa', 'corte_cohesion_mpa', 'corte_angulo_friccion'] },
  triaxial: { title: 'Compresión Triaxial', columns: ['triaxial_carga_confinamiento', 'triaxial_esfuerzo_maximo', 'triaxial_resistencia_mpa', 'triaxial_mi', 'triaxial_cohesion_mpa', 'triaxial_angulo_friccion', 'triaxial_rotura'] },
  propiedades: { title: 'Propiedades Físicas', columns: ['prop_peso_unitario_geometrico'] },
};

type LabGroup = keyof typeof labGroups;

const groupsByAssay: Record<AssayType, LabGroup[]> = {
  CE: ['ucs', 'elasticas'],
  TI: ['traccion'],
  CD: ['corte'],
  TX: ['triaxial'],
  UCS: ['ucs'],
};

export function getLabGroups(lab: Laboratory, assay: AssayType): { id: LabGroup; title: string; columns: ColumnDef[] }[] {
  const groups = [...groupsByAssay[assay]];
  if (lab === 'LaboRock (GeoBlast)' && (assay === 'CE' || assay === 'TX')) {
    groups.push('propiedades');
  }
  return groups.map(id => {
    const { title, columns } = labGroups[id];
    return { id, title, columns: COLUMNS_CONFIG.filter(field => columns.includes(field.dbName)) };
  });
}

export const assayFormatLabels: Record<AssayType, string> = {
  TX: 'Triaxial (TX)',
  UCS: 'Compresión uniaxial (UCS)',
  CD: 'Corte directo (CD)',
  TI: 'Tracción indirecta (TI)',
  CE: 'Constantes elásticas (E, ν)',
};

interface FormatReference {
  title: string;
  standard: string;
  note: string;
}

const formatReferences = {
  Geomec: {
    TX: {
      title: 'Resultados de ensayo de resistencia a la compresión triaxial – Testigos',
      standard: 'ASTM D7012 · Hoek-Brown (RocData) y Mohr-Coulomb',
      note: 'Hoek-Brown: UCS(i) y mi. Mohr-Coulomb: regresión lineal σ1–σ3. Valores en ROJO se excluyen del ajuste.',
    },
    UCS: {
      title: 'Resultados de ensayo de constantes elásticas / compresión uniaxial – Testigos',
      standard: 'ASTM D7012 / ISRM',
      note: 'UCS = P/(π d²/4). Geomec informa E con transductores y con strain gauges.',
    },
    CD: {
      title: 'Resultados de ensayo de resistencia al corte directo – Testigos – ASTM/ISRM',
      standard: 'ASTM D5607 / ISRM Suggested Method',
      note: 'Área del plano = π·D·L/4 (elipse). Cohesión (MPa) y ángulo de fricción pico (°) por ajuste lineal (ISRM).',
    },
    TI: {
      title: 'Resultados de ensayo de resistencia a la tracción indirecta – TI',
      standard: 'ISRM / ASTM D3967 (relación de esbeltez h/d ≈ 0.5)',
      note: 'Valores marcados en ROJO pueden ser considerados anómalos/errados; por recomendación del laboratorio se excluyen del promedio.',
    },
    CE: {
      title: 'Resultados de ensayo de constantes elásticas / constantes elásticas – Testigos',
      standard: 'ASTM D7012 / ISRM',
      note: 'UCS = P/(π d²/4). Geomec informa E con transductores y con strain gauges.',
    },
  },
  Ingeotest: {
    TX: {
      title: 'Ensayo de triaxial en roca',
      standard: 'ASTM D7012-A',
      note: 'Resultados del ensayo: ángulo de fricción y cohesión (más mi y UCS Hoek-Brown).',
    },
    UCS: {
      title: 'Ensayo de módulo de elasticidad – Datos del espécimen y resumen de resultados',
      standard: 'ASTM D7012-D',
      note: 'Diámetro y altura en cm, como en el informe Ingeotest.',
    },
    CD: {
      title: 'Ensayo de corte directo en roca',
      standard: 'ASTM D5607',
      note: 'Resultados del ensayo: ángulo de fricción y cohesión.',
    },
    TI: {
      title: 'Ensayo de resistencia a la tracción indirecta – Método brasilero',
      standard: 'ASTM D3967',
      note: 'Área = π d²/4. El promedio se informa al pie de la tabla.',
    },
    CE: {
      title: 'Ensayo de módulo de elasticidad – Datos del espécimen y resumen de resultados',
      standard: 'ASTM D7012-D',
      note: 'Diámetro y altura en cm, como en el informe Ingeotest.',
    },
  },
  'LaboRock (GeoBlast)': {
    TX: {
      title: 'Resultados de compresión triaxial',
      standard: 'ASTM D7012',
      note: 'σ1 = Carga / Área (como en la tabla de LaboRock). El informe no incluye el ajuste.',
    },
    UCS: {
      title: 'Resultados de compresión uniaxial',
      standard: 'ASTM D7012',
      note: 'Área = π d²/4 en mm².',
    },
    CD: {
      title: 'Resumen ensayo de corte directo',
      standard: 'ASTM D5607',
      note: 'Corregido = lectura × área pistón / área muestra. Se ajusta por separado el máximo y el residual.',
    },
    TI: {
      title: 'Resultados de tracciones indirectas',
      standard: 'ASTM D3967',
      note: 'σbt = 2P/(π D t). σt50 y σt se copian del informe (corrección propia del laboratorio).',
    },
    CE: {
      title: 'Resultados de constantes elásticas',
      standard: 'ASTM D7012',
      note: 'Área = π d²/4 en mm².',
    },
  },
  'UNI (LGM)': {
    TX: {
      title: 'Compresión triaxial – Resultados y parámetros',
      standard: 'ASTM D7012 · Hoek-Brown y Mohr-Coulomb equivalente (σ3max = σci/4)',
      note: 'Parámetros: ángulo de fricción (Φ), cohesión (c), mi y resistencia compresiva (σci).',
    },
    UCS: {
      title: 'Compresión uniaxial – Resultados',
      standard: 'ASTM D7012 / ASTM C39 (corrección por esbeltez)',
      note: 'La resistencia se corrige por esbeltez (factor 1.0 si L/D ≥ 1.94).',
    },
    CD: {
      title: 'Corte directo – Resultados y parámetros',
      standard: 'ASTM D5607',
      note: 'Parámetros: ángulo de fricción (Φ) y cohesión (c) en MPa.',
    },
    TI: {
      title: 'Tracción indirecta (brasilero) – Resultados',
      standard: 'ASTM D3967',
      note: 'Resultado: resistencia a la tracción promedio en kg/cm² y MPa.',
    },
    CE: {
      title: 'Compresión uniaxial – Resultados',
      standard: 'ASTM D7012 / ASTM C39 (corrección por esbeltez)',
      note: 'La resistencia se corrige por esbeltez (factor 1.0 si L/D ≥ 1.94).',
    },
  },
} satisfies Record<Laboratory, Record<AssayType, FormatReference>>;

export function getFormatReference(lab: Laboratory, assay: AssayType): FormatReference {
  return formatReferences[lab][assay];
}
