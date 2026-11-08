import openpyxl
import json
import os

excel_path = 'c:/Users/DrN/UNSA/TRABAJO/GEMA/Ensayos_Especiales/Material/ENSAYOS_ESPECIALES.xlsx'
wb = openpyxl.load_workbook(excel_path, data_only=True)
ws = wb['Base_Datos (2)']

rows_iter = ws.iter_rows(values_only=True)
r0 = next(rows_iter) # Merged group headers
r1 = next(rows_iter) # Column subheaders

# Mapping exact Excel column indices (0-46) to canonical dbName/model fields
excel_col_map = {
    0: 'idd',                                 # IDD
    1: 'sondaje',                             # Sondaje diamantino
    2: 'codigo_muestra',                      # Código de muestra
    3: 'laboratorio',                         # Laboratorio
    4: 'mes',                                 # Mes (Nota: en Excel no existe 'dia')
    5: 'anio',                                # Año
    6: 'proyecto',                            # Proyecto
    7: 'desde',                               # Desde (m)
    8: 'hasta',                               # Hasta (m)
    9: 'longitud_muestra',                    # Longitud de muestra (m)
    10: 'este',                               # Este (m)
    11: 'norte',                              # Norte (m)
    12: 'elevacion',                          # Elevación (msnm)
    13: 'sectores',                           # SECTORES
    14: 'lito1',                              # Lito 1
    15: 'lito2',                              # Lito 2
    16: 'lito3',                              # Lito 3
    17: 'tipo_ensayo',                        # Tipo de ensayo
    18: 'ucs_diametro',                       # Diámetro del testigo (cm)
    19: 'ucs_carga_rotura',                   # Carga de rotura (kN)
    20: 'ucs_resistencia',                    # Resistencia a la compresión uniaxial (MPa)
    21: 'ucs_resistencia_calculada',          # Resistencia calculada (MPa)
    22: 'ucs_rotura',                         # Rotura
    23: 'elasticas_modulo_young',             # Modulo de Young (GPa)
    24: 'elasticas_poisson',                  # Relación de Poisson
    25: 'traccion_carga_promedio',            # Carga de rotura promedio (kN)
    26: 'traccion_resistencia_kgcm2',         # Resistencia promedio (kg/cm2)
    27: 'traccion_vacia_28',                  # Columna Vacía 28
    28: 'traccion_resistencia_mpa',           # Resistencia promedio (MPa)
    29: 'corte_tipo_fractura',                # Tipo de fractura
    30: 'corte_area',                         # Área de ensayo (cm2)
    31: 'corte_esf_normal_kpa',               # Esf Normal (kPa)
    32: 'corte_esf_corte_kpa',                # Esf Corte (kPa)
    33: 'corte_esf_normal_mpa',               # Esfuerzo Normal (MPa)
    34: 'corte_esf_corte_mpa',                # Esfuerzo de Corte (MPa)
    35: 'corte_cohesion_mpa',                 # Cohesion (Mpa)
    36: 'corte_angulo_friccion',              # Ang. Friccion (°)
    37: 'triaxial_carga_confinamiento',       # Carga de confinamiento (MPa)
    38: 'triaxial_esfuerzo_maximo',           # Esfuerzo máximo (MPa)
    39: 'triaxial_resistencia_mpa',           # Resistencia (Mpa)
    40: 'triaxial_mi',                        # mi
    41: 'triaxial_cohesion_mpa',              # Cohesion (Mpa)
    42: 'triaxial_angulo_friccion',           # Ang. Friccion (°)
    43: 'triaxial_rotura',                    # Rotura
    44: 'prop_peso_unitario_geometrico',      # Peso unitario geométrico (gr/cm3)
    45: 'observacion',                        # Observación
    46: 'campana'                             # Campaña de Perforación
}

data = []
for r_idx, row in enumerate(rows_iter, start=1):
    rec = {}
    # dia is nullable in database, not in original excel
    rec['dia'] = ''
    for col_idx, val in enumerate(row):
        col_name = excel_col_map.get(col_idx, f"col_{col_idx}")
        if val is None:
            rec[col_name] = ''
        else:
            rec[col_name] = val
    if not rec.get('idd') or rec.get('idd') == '':
        rec['idd'] = r_idx
    data.append(rec)

os.makedirs('scratch', exist_ok=True)
out_path = 'scratch/realData.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False)

print(f"Exported {len(data)} rows to {out_path} with 100% correct column mapping.")
