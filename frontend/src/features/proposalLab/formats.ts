export const proposalAssays = {
  TX: "Triaxial (TX)",
  UCS: "Compresión uniaxial (UCS)",
  CD: "Corte directo (CD)",
  TI: "Tracción indirecta (TI)",
  CE: "Constantes elásticas (E, ν)",
  PF: "Propiedades físicas (PF)",
} as const;

export const proposalLabs = ["Geomec", "Ingeotest", "LaboRock (GeoBlast)", "UNI (LGM)"] as const;

export type ProposalAssay = keyof typeof proposalAssays;
export type ProposalLab = typeof proposalLabs[number];
export type ProposalRow = Record<string, string | boolean>;

export interface ProposalColumn {
  key: string;
  label: string;
  tipo: 'num' | 'txt' | 'sel' | 'bool';
  unidad?: string;
  calc?: boolean;
  opciones?: string[];
  ayuda?: string;
  fmt?: string;
  defecto?: string | number | boolean;
}

export interface ProposalFormat {
  titulo: string;
  norma: string;
  notas: string;
  filas: number;
  cabecera: ProposalColumn[];
  columnas: ProposalColumn[];
  metodo_mc?: string;
}

// Formats transcribed from the Replit prototype, including calculated columns.
const physicalProperties: ProposalFormat = {
  titulo: "Propiedades físicas",
  norma: "ISRM / ASTM C97",
  cabecera: [
    { key: "informe", label: "Informe N°", tipo: "txt" },
  ],
  columnas: [
    { key: "probeta", label: "Probeta", tipo: "txt" },
    { key: "m_nat", label: "Masa natural", tipo: "num", unidad: "g" },
    { key: "m_seca", label: "Masa seca", tipo: "num", unidad: "g" },
    { key: "m_sat", label: "Masa saturada", tipo: "num", unidad: "g" },
    { key: "m_sum", label: "Masa sumergida", tipo: "num", unidad: "g", ayuda: "Si se ingresa, el volumen se calcula por Arquímedes." },
    { key: "vol", label: "Volumen", tipo: "num", unidad: "cm³" },
    { key: "dens_nat", label: "Densidad natural", tipo: "num", unidad: "g/cm³", calc: true },
    { key: "dens_seca", label: "Densidad seca", tipo: "num", unidad: "g/cm³", calc: true },
    { key: "absor", label: "Absorción", tipo: "num", unidad: "%", calc: true },
    { key: "poros", label: "Porosidad aparente", tipo: "num", unidad: "%", calc: true },
    { key: "peso_esp", label: "Peso específico", tipo: "num", unidad: "kN/m³", calc: true },
  ],
  filas: 1,
  notas: "Porosidad aparente = (Msat − Mseca)/(ρw·V).",
};

const formats = {
  "Geomec": {
    UCS: {
      titulo: "Resultados de ensayo de constantes elásticas / compresión uniaxial – Testigos",
      norma: "ASTM D7012 / ISRM",
      cabecera: [
        { key: "tiempo", label: "Tiempo de ensayo (s)", tipo: "num" },
      ],
      columnas: [
        { key: "d", label: "Diá. \"d\"", tipo: "num", unidad: "mm", defecto: 60 },
        { key: "h", label: "Alt. \"h\"", tipo: "num", unidad: "mm", defecto: 147 },
        { key: "p", label: "Carga", tipo: "num", unidad: "kN" },
        { key: "ucs", label: "Resistencia a la compresión uniaxial UCS(d)", tipo: "num", unidad: "MPa", calc: true },
        { key: "e", label: "Módulo de Young E (transductores)", tipo: "num", unidad: "GPa" },
        { key: "e2", label: "Módulo de Young E (strain gauges)", tipo: "num", unidad: "GPa" },
        { key: "nu", label: "Relación de Poisson ν (strain gauges)", tipo: "num", unidad: "-", fmt: "%.3f" },
        { key: "rotura", label: "Tipo de rotura", tipo: "sel", opciones: ["MATRIZ", "MIXTA", "ESTRUCTURA"], defecto: "MATRIZ" },
        { key: "clase", label: "Clase", tipo: "sel", opciones: ["I", "II", "III", "IV", "V"], defecto: "II" },
        { key: "tiempo", label: "Tiempo", tipo: "num", unidad: "s" },
      ],
      filas: 1,
      notas: "UCS = P/(π d²/4). Geomec informa E con transductores y con strain gauges.",
    },
    TI: {
      titulo: "Resultados de ensayo de resistencia a la tracción indirecta – TI",
      norma: "ISRM / ASTM D3967 (relación de esbeltez h/d ≈ 0.5)",
      cabecera: [],
      columnas: [
        { key: "d", label: "Diá. \"d\"", tipo: "num", unidad: "mm", defecto: 60.8 },
        { key: "t", label: "Alt. \"h\"", tipo: "num", unidad: "mm", defecto: 31 },
        { key: "p", label: "Carga", tipo: "num", unidad: "kN" },
        { key: "st", label: "Resistencia a la tracción indirecta", tipo: "num", unidad: "MPa", calc: true },
        { key: "rotura", label: "Tipo de rotura", tipo: "sel", opciones: ["MATRIZ", "MIXTA", "ESTRUCTURA"], defecto: "MATRIZ" },
        { key: "rotura2", label: "Tipo de rotura (posición)", tipo: "sel", opciones: ["Central", "Central Múltiple", "Central Lateral", "No Central"], defecto: "Central Múltiple" },
        { key: "excluir", label: "Excluir (rojo)", tipo: "bool", ayuda: "Marca los valores que el laboratorio pinta en ROJO (anómalos). No entran al promedio ni al ajuste.", defecto: false },
      ],
      filas: 3,
      notas: "Valores marcados en ROJO pueden ser considerados anómalos/errados; por recomendación del laboratorio se excluyen del promedio.",
    },
    TX: {
      titulo: "Resultados de ensayo de resistencia a la compresión triaxial – Testigos",
      norma: "ASTM D7012 · Hoek-Brown (RocData) y Mohr-Coulomb",
      cabecera: [],
      columnas: [
        { key: "probeta", label: "Código de probeta", tipo: "txt", ayuda: "Ej. FEGT23-001-TX-M01 o M02A / M02B" },
        { key: "d", label: "Diá. \"d\"", tipo: "num", unidad: "mm", defecto: 61 },
        { key: "h", label: "Alt. \"h\"", tipo: "num", unidad: "mm", defecto: 125 },
        { key: "s3", label: "Conf. σ3", tipo: "num", unidad: "MPa" },
        { key: "s1", label: "Esfuerzo comp. σ1", tipo: "num", unidad: "MPa" },
        { key: "clase", label: "Tipo de rotura (clase)", tipo: "sel", opciones: ["I", "II", "III", "IV", "V"], defecto: "II" },
        { key: "rotura", label: "Tipo de rotura", tipo: "sel", opciones: ["MATRIZ", "MIXTA", "ESTRUCTURA"], defecto: "MATRIZ" },
        { key: "excluir", label: "Excluir (rojo)", tipo: "bool", ayuda: "Marca los valores que el laboratorio pinta en ROJO (anómalos). No entran al promedio ni al ajuste.", defecto: false },
      ],
      filas: 3,
      metodo_mc: "lineal",
      notas: "Hoek-Brown: UCS(i) y mi. Mohr-Coulomb: regresión lineal σ1–σ3. Valores en ROJO se excluyen del ajuste.",
    },
    CD: {
      titulo: "Resultados de ensayo de resistencia al corte directo – Testigos – ASTM/ISRM",
      norma: "ASTM D5607 / ISRM Suggested Method",
      cabecera: [
        { key: "ancho", label: "Ancho \"D\" (mm)", tipo: "num", defecto: 61.6 },
        { key: "largo", label: "Largo \"L\" (mm)", tipo: "num", defecto: 83.5 },
        { key: "tipo_disc", label: "Tipo de discontinuidad", tipo: "sel", opciones: ["D. Natural", "Cortada/preparada", "Otra"], defecto: "D. Natural" },
        { key: "alfa", label: "Ángulo α (°)", tipo: "num" },
        { key: "jrc", label: "JRC", tipo: "num" },
      ],
      columnas: [
        { key: "etapa", label: "Etapa", tipo: "txt" },
        { key: "fn", label: "Fuerza normal", tipo: "num", unidad: "kN" },
        { key: "ft", label: "Fuerza de corte", tipo: "num", unidad: "kN" },
        { key: "sn_kpa", label: "Esfuerzo normal", tipo: "num", unidad: "kPa", calc: true },
        { key: "tau_kpa", label: "Esfuerzo de corte", tipo: "num", unidad: "kPa", calc: true },
        { key: "excluir", label: "Excluir (rojo)", tipo: "bool", ayuda: "Marca los valores que el laboratorio pinta en ROJO (anómalos). No entran al promedio ni al ajuste.", defecto: false },
      ],
      filas: 4,
      notas: "Área del plano = π·D·L/4 (elipse). Cohesión (MPa) y ángulo de fricción pico (°) por ajuste lineal (ISRM).",
    },
  },
  "Ingeotest": {
    UCS: {
      titulo: "Ensayo de módulo de elasticidad – Datos del espécimen y resumen de resultados",
      norma: "ASTM D7012-D",
      cabecera: [
        { key: "informe", label: "Informe N°", tipo: "txt" },
      ],
      columnas: [
        { key: "probeta", label: "Probeta N°", tipo: "txt", defecto: "1" },
        { key: "d", label: "Diámetro", tipo: "num", unidad: "cm", defecto: 6.11 },
        { key: "h", label: "Altura", tipo: "num", unidad: "cm", defecto: 13.03 },
        { key: "ld", label: "Relación largo/diámetro (L/D)", tipo: "num", unidad: "-", calc: true },
        { key: "razon", label: "Razón de deformación", tipo: "num", unidad: "MPa/s", defecto: 0.6 },
        { key: "p", label: "Carga máxima", tipo: "num", unidad: "kN", ayuda: "Necesaria para calcular el UCS (el informe no la muestra)." },
        { key: "ucs", label: "Resistencia a la compresión uniaxial", tipo: "num", unidad: "MPa", calc: true },
        { key: "e", label: "Módulo de Young E", tipo: "num", unidad: "GPa" },
        { key: "nu", label: "Relación de Poisson ν", tipo: "num", unidad: "-", fmt: "%.3f" },
        { key: "rotura", label: "Tipo de rotura", tipo: "txt" },
      ],
      filas: 1,
      notas: "Diámetro y altura en cm, como en el informe Ingeotest.",
    },
    TI: {
      titulo: "Ensayo de resistencia a la tracción indirecta – Método brasilero",
      norma: "ASTM D3967",
      cabecera: [
        { key: "informe", label: "Informe N°", tipo: "txt" },
      ],
      columnas: [
        { key: "probeta", label: "Probeta N°", tipo: "txt" },
        { key: "d", label: "Diámetro del espécimen", tipo: "num", unidad: "mm", defecto: 60.3 },
        { key: "t", label: "Altura del espécimen", tipo: "num", unidad: "mm", defecto: 27.5 },
        { key: "ld", label: "Relación largo/diámetro", tipo: "num", unidad: "-", calc: true },
        { key: "razon", label: "Razón de deformación", tipo: "num", unidad: "MPa/s", defecto: 0.35 },
        { key: "area", label: "Área", tipo: "num", unidad: "mm²", calc: true },
        { key: "p", label: "Carga de rotura", tipo: "num", unidad: "kN" },
        { key: "st", label: "Resistencia a la tracción indirecta", tipo: "num", unidad: "MPa", calc: true },
        { key: "excluir", label: "Excluir (rojo)", tipo: "bool", ayuda: "Marca los valores que el laboratorio pinta en ROJO (anómalos). No entran al promedio ni al ajuste.", defecto: false },
      ],
      filas: 3,
      notas: "Área = π d²/4. El promedio se informa al pie de la tabla.",
    },
    TX: {
      titulo: "Ensayo de triaxial en roca",
      norma: "ASTM D7012-A",
      cabecera: [
        { key: "informe", label: "Informe N°", tipo: "txt" },
      ],
      columnas: [
        { key: "probeta", label: "Item", tipo: "txt" },
        { key: "d", label: "Diámetro", tipo: "num", unidad: "cm", defecto: 6.07 },
        { key: "h", label: "Altura", tipo: "num", unidad: "cm", defecto: 13.1 },
        { key: "area", label: "Área", tipo: "num", unidad: "cm²", calc: true },
        { key: "ld", label: "Relación largo/diámetro", tipo: "num", unidad: "-", calc: true },
        { key: "razon", label: "Razón de deformación", tipo: "num", unidad: "MPa/s", defecto: 0.7 },
        { key: "s3", label: "Esfuerzo de confinamiento σ3", tipo: "num", unidad: "MPa" },
        { key: "s1", label: "Resistencia a la compresión triaxial σ1", tipo: "num", unidad: "MPa" },
        { key: "excluir", label: "Excluir (rojo)", tipo: "bool", ayuda: "Marca los valores que el laboratorio pinta en ROJO (anómalos). No entran al promedio ni al ajuste.", defecto: false },
      ],
      filas: 3,
      metodo_mc: "lineal",
      notas: "Resultados del ensayo: ángulo de fricción y cohesión (más mi y UCS Hoek-Brown).",
    },
    CD: {
      titulo: "Ensayo de corte directo en roca",
      norma: "ASTM D5607",
      cabecera: [
        { key: "informe", label: "Informe N°", tipo: "txt" },
      ],
      columnas: [
        { key: "probeta", label: "Probeta N°", tipo: "txt" },
        { key: "d", label: "Diámetro", tipo: "num", unidad: "cm", defecto: 6 },
        { key: "h", label: "Altura", tipo: "num", unidad: "cm", defecto: 12.94 },
        { key: "area", label: "Área", tipo: "num", unidad: "cm²", ayuda: "Si se deja vacío se calcula π d²/4." },
        { key: "ld", label: "Relación largo/diámetro", tipo: "num", unidad: "-", calc: true },
        { key: "razon", label: "Razón de deformación", tipo: "num", unidad: "mm/min", defecto: 0.14 },
        { key: "sn", label: "Esfuerzo normal σn", tipo: "num", unidad: "MPa" },
        { key: "tau", label: "Esfuerzo de corte τ", tipo: "num", unidad: "MPa" },
        { key: "excluir", label: "Excluir (rojo)", tipo: "bool", ayuda: "Marca los valores que el laboratorio pinta en ROJO (anómalos). No entran al promedio ni al ajuste.", defecto: false },
      ],
      filas: 4,
      notas: "Resultados del ensayo: ángulo de fricción y cohesión.",
    },
  },
  "LaboRock (GeoBlast)": {
    UCS: {
      titulo: "Resultados de compresión uniaxial",
      norma: "ASTM D7012",
      cabecera: [
        { key: "grupo", label: "Grupo / tabla", tipo: "txt" },
      ],
      columnas: [
        { key: "lb", label: "LB N°", tipo: "txt", defecto: "1" },
        { key: "d", label: "Diámetro", tipo: "num", unidad: "mm", defecto: 60.5 },
        { key: "h", label: "Longitud", tipo: "num", unidad: "mm", defecto: 140.5 },
        { key: "area", label: "Área", tipo: "num", unidad: "mm²", calc: true },
        { key: "ld", label: "Relación L/D", tipo: "num", unidad: "-", calc: true },
        { key: "p", label: "Carga ruptura", tipo: "num", unidad: "kN" },
        { key: "ucs", label: "Esfuerzo a la compresión", tipo: "num", unidad: "MPa", calc: true },
        { key: "e", label: "Módulo de Young", tipo: "num", unidad: "GPa" },
        { key: "nu", label: "Coeficiente de Poisson", tipo: "num", unidad: "-", fmt: "%.3f" },
        { key: "rotura", label: "Ruptura", tipo: "sel", opciones: ["Matriz", "Estructura", "Matriz-Estructura"], defecto: "Matriz" },
      ],
      filas: 1,
      notas: "Área = π d²/4 en mm².",
    },
    TI: {
      titulo: "Resultados de tracciones indirectas",
      norma: "ASTM D3967",
      cabecera: [
        { key: "grupo", label: "Grupo / tabla", tipo: "txt" },
      ],
      columnas: [
        { key: "disco", label: "LB N° (disco)", tipo: "txt" },
        { key: "d", label: "Diám.", tipo: "num", unidad: "mm", defecto: 60.4 },
        { key: "t", label: "Espesor", tipo: "num", unidad: "mm", defecto: 27 },
        { key: "peso", label: "Peso", tipo: "num", unidad: "g" },
        { key: "p", label: "Carga máx.", tipo: "num", unidad: "kN" },
        { key: "sbt", label: "σbt", tipo: "num", unidad: "MPa", calc: true },
        { key: "st50", label: "σt50 (informe)", tipo: "num", unidad: "MPa", ayuda: "Valor corregido a 50 mm según el informe del laboratorio." },
        { key: "st", label: "σt (informe)", tipo: "num", unidad: "MPa", ayuda: "σt final del informe. Si se deja vacío se usa σbt." },
        { key: "rotura", label: "Ruptura", tipo: "sel", opciones: ["M", "E", "M-E"], defecto: "M" },
        { key: "orient", label: "Orientación", tipo: "sel", opciones: ["V", "V-D", "V-H"], defecto: "V" },
        { key: "excluir", label: "Excluir (rojo)", tipo: "bool", ayuda: "Marca los valores que el laboratorio pinta en ROJO (anómalos). No entran al promedio ni al ajuste.", defecto: false },
      ],
      filas: 3,
      notas: "σbt = 2P/(π D t). σt50 y σt se copian del informe (corrección propia del laboratorio).",
    },
    TX: {
      titulo: "Resultados de compresión triaxial",
      norma: "ASTM D7012",
      cabecera: [
        { key: "grupo", label: "Grupo / tabla", tipo: "txt" },
      ],
      columnas: [
        { key: "probeta", label: "N° muestra", tipo: "txt" },
        { key: "d", label: "Diámetro", tipo: "num", unidad: "mm", defecto: 60.7 },
        { key: "h", label: "Longitud", tipo: "num", unidad: "mm", defecto: 140.5 },
        { key: "area", label: "Área", tipo: "num", unidad: "mm²", calc: true },
        { key: "ld", label: "Relación L/D", tipo: "num", unidad: "-", calc: true },
        { key: "p", label: "Carga ruptura", tipo: "num", unidad: "kN" },
        { key: "s1", label: "Compresión triaxial σ1", tipo: "num", unidad: "MPa", calc: true },
        { key: "s3", label: "σ3", tipo: "num", unidad: "MPa" },
        { key: "angulo", label: "Ángulo ruptura", tipo: "num", unidad: "°" },
        { key: "rotura", label: "Ruptura", tipo: "sel", opciones: ["Matriz", "Estructura", "Matriz-Estructura"], defecto: "Matriz" },
        { key: "excluir", label: "Excluir (rojo)", tipo: "bool", ayuda: "Marca los valores que el laboratorio pinta en ROJO (anómalos). No entran al promedio ni al ajuste.", defecto: false },
      ],
      filas: 3,
      metodo_mc: "lineal",
      notas: "σ1 = Carga / Área (como en la tabla de LaboRock). El informe no trae ajuste; aquí se calcula.",
    },
    CD: {
      titulo: "Resumen ensayo de corte directo",
      norma: "ASTM D5607",
      cabecera: [
        { key: "area_m", label: "Área muestra (cm²)", tipo: "num", defecto: 36.63 },
        { key: "area_p", label: "Área pistón (cm²)", tipo: "num", ayuda: "El informe lo escribe 11,389 (coma decimal).", defecto: 11.389 },
        { key: "jrc", label: "JRC aprox.", tipo: "num" },
      ],
      columnas: [
        { key: "modo", label: "Ángulo de fricción", tipo: "sel", opciones: ["Máximo", "Residual"], defecto: "Máximo" },
        { key: "fn", label: "Carga normal", tipo: "num", unidad: "kN" },
        { key: "sn_m", label: "Esfuerzo normal (manómetro)", tipo: "num", unidad: "MPa" },
        { key: "tau_m", label: "Esfuerzo corte (manómetro)", tipo: "num", unidad: "MPa" },
        { key: "sn", label: "Esfuerzo normal corregido", tipo: "num", unidad: "MPa", calc: true },
        { key: "tau", label: "Esfuerzo corte corregido", tipo: "num", unidad: "MPa", calc: true },
        { key: "excluir", label: "Excluir (rojo)", tipo: "bool", ayuda: "Marca los valores que el laboratorio pinta en ROJO (anómalos). No entran al promedio ni al ajuste.", defecto: false },
      ],
      filas: 6,
      notas: "Corregido = lectura × área pistón / área muestra. Se ajusta por separado el máximo y el residual.",
    },
  },
  "UNI (LGM)": {
    UCS: {
      titulo: "Compresión uniaxial – Resultados",
      norma: "ASTM D7012 / ASTM C39 (corrección por esbeltez)",
      cabecera: [
        { key: "informe", label: "Informe N°", tipo: "txt" },
        { key: "humedad", label: "Contenido de humedad (%)", tipo: "num" },
      ],
      columnas: [
        { key: "d", label: "Diámetro", tipo: "num", unidad: "cm", defecto: 6.1 },
        { key: "h", label: "Altura", tipo: "num", unidad: "cm", defecto: 12.58 },
        { key: "ld", label: "Esbeltez", tipo: "num", unidad: "-", calc: true },
        { key: "rotura", label: "Tipo de rotura", tipo: "sel", opciones: ["1 Corte plano diagonal", "2 Fracturas verticales", "3 Corte por discontinuidad", "4 Cónico", "5 Desprendimiento", "6 Otros"], defecto: "3 Corte por discontinuidad" },
        { key: "p", label: "Carga de rotura", tipo: "num", unidad: "kN" },
        { key: "kgcm2", label: "Resistencia corregida", tipo: "num", unidad: "kg/cm²", calc: true },
        { key: "ucs", label: "Resistencia corregida", tipo: "num", unidad: "MPa", calc: true },
        { key: "e", label: "Módulo de Young E", tipo: "num", unidad: "GPa" },
        { key: "nu", label: "Relación de Poisson ν", tipo: "num", unidad: "-", fmt: "%.3f" },
      ],
      filas: 1,
      notas: "La resistencia se corrige por esbeltez (factor 1.0 si L/D ≥ 1.94).",
    },
    TI: {
      titulo: "Tracción indirecta (brasilero) – Resultados",
      norma: "ASTM D3967",
      cabecera: [
        { key: "informe", label: "Informe N°", tipo: "txt" },
        { key: "humedad", label: "Contenido de humedad (%)", tipo: "num" },
      ],
      columnas: [
        { key: "probeta", label: "Probeta", tipo: "txt" },
        { key: "d", label: "Diámetro", tipo: "num", unidad: "cm", defecto: 6.1 },
        { key: "t", label: "Altura", tipo: "num", unidad: "cm", defecto: 3.5 },
        { key: "p", label: "Carga de rotura", tipo: "num", unidad: "kN" },
        { key: "st", label: "σt", tipo: "num", unidad: "MPa", calc: true },
        { key: "excluir", label: "Excluir (rojo)", tipo: "bool", ayuda: "Marca los valores que el laboratorio pinta en ROJO (anómalos). No entran al promedio ni al ajuste.", defecto: false },
      ],
      filas: 5,
      notas: "Resultado: resistencia a la tracción promedio en kg/cm² y MPa.",
    },
    TX: {
      titulo: "Compresión triaxial – Resultados y parámetros",
      norma: "ASTM D7012 · Hoek-Brown y Mohr-Coulomb equivalente (σ3max = σci/4)",
      cabecera: [
        { key: "informe", label: "Informe N°", tipo: "txt" },
        { key: "humedad", label: "Contenido de humedad (%)", tipo: "num" },
      ],
      columnas: [
        { key: "probeta", label: "Código", tipo: "txt" },
        { key: "d", label: "Diámetro", tipo: "num", unidad: "cm", defecto: 6.09 },
        { key: "h", label: "Altura", tipo: "num", unidad: "cm", defecto: 12.5 },
        { key: "ld", label: "Esbeltez", tipo: "num", unidad: "-", calc: true },
        { key: "s3", label: "Confinam.", tipo: "num", unidad: "MPa" },
        { key: "p", label: "Carga (opcional)", tipo: "num", unidad: "kN", ayuda: "Si se ingresa, σ1 = σ3 + P/A." },
        { key: "s1", label: "Resistencia corregida σ1", tipo: "num", unidad: "MPa" },
        { key: "excluir", label: "Excluir (rojo)", tipo: "bool", ayuda: "Marca los valores que el laboratorio pinta en ROJO (anómalos). No entran al promedio ni al ajuste.", defecto: false },
      ],
      filas: 3,
      metodo_mc: "equivalente",
      notas: "Parámetros: ángulo de fricción (Φ), cohesión (c), mi y resistencia compresiva (σci).",
    },
    CD: {
      titulo: "Corte directo – Resultados y parámetros",
      norma: "ASTM D5607",
      cabecera: [
        { key: "informe", label: "Informe N°", tipo: "txt" },
        { key: "humedad", label: "Contenido de humedad al ensayar (%)", tipo: "num" },
        { key: "tipo_disc", label: "Tipo de discontinuidad", tipo: "sel", opciones: ["Natural", "Inducida", "Otra"], defecto: "Natural" },
      ],
      columnas: [
        { key: "sn", label: "Esfuerzo normal", tipo: "num", unidad: "MPa" },
        { key: "tau", label: "Esfuerzo de corte", tipo: "num", unidad: "MPa" },
        { key: "excluir", label: "Excluir (rojo)", tipo: "bool", ayuda: "Marca los valores que el laboratorio pinta en ROJO (anómalos). No entran al promedio ni al ajuste.", defecto: false },
      ],
      filas: 5,
      notas: "Parámetros: ángulo de fricción (Φ) y cohesión (c) en MPa.",
    },
  },
} satisfies Record<ProposalLab, Record<Exclude<ProposalAssay, 'CE' | 'PF'>, ProposalFormat>>;

export function proposalFormat(lab: ProposalLab, assay: ProposalAssay): ProposalFormat {
  if (assay === 'PF') return physicalProperties;
  if (assay !== 'CE') return formats[lab][assay];

  const uniaxial = formats[lab].UCS;
  return {
    ...uniaxial,
    titulo: uniaxial.titulo.replace('compresión uniaxial', 'constantes elásticas'),
    notas: uniaxial.notas + ' Para CE son obligatorios E y ν.',
  };
}

export function proposalDefaults(columns: ProposalColumn[]): ProposalRow {
  return Object.fromEntries(columns.filter(column => !column.calc).map(column => [
    column.key, column.tipo === 'bool' ? column.defecto === true : String(column.defecto ?? ''),
  ]));
}

const numberedColumns = new Set(['probeta', 'etapa', 'disco', 'lb']);

export function initialProposalRows(lab: ProposalLab, assay: ProposalAssay, format: ProposalFormat): ProposalRow[] {
  const defaults = proposalDefaults(format.columnas);
  const numbered = format.columnas.filter(column =>
    !column.calc && (column.tipo === 'txt' || column.tipo === 'sel') && numberedColumns.has(column.key)
  );
  return Array.from({ length: format.filas }, (_, index) => {
    const row = { ...defaults };
    for (const column of numbered) row[column.key] = String(index + 1);
    if (assay === 'CD' && lab === 'LaboRock (GeoBlast)') {
      row.modo = index < Math.ceil(format.filas / 2) ? 'Máximo' : 'Residual';
    }
    return row;
  });
}
