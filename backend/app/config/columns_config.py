# -*- coding: utf-8 -*-
"""
Configuración centralizada de las 47 columnas de la Base de Datos del Excel original.
Permite realizar mapeo, validación, cálculo dinámico y migración automática.
"""

COLUMNS_CONFIG = [
    {"index": 1, "db_name": "idd", "excel_name": "IDD", "col_letter": "A", "type": "int", "module": "common"},
    {"index": 2, "db_name": "sondaje", "excel_name": "Sondaje diamantino", "col_letter": "B", "type": "str", "module": "common"},
    {"index": 3, "db_name": "codigo_muestra", "excel_name": "Código de muestra", "col_letter": "C", "type": "str", "module": "common"},
    {"index": 4, "db_name": "laboratorio", "excel_name": "Laboratorio", "col_letter": "D", "type": "str", "module": "common"},
    {"index": 5, "db_name": "mes", "excel_name": "Mes", "col_letter": "E", "type": "str", "module": "common"},
    {"index": 6, "db_name": "anio", "excel_name": "Año", "col_letter": "F", "type": "int", "module": "common"},
    {"index": 7, "db_name": "proyecto", "excel_name": "Proyecto", "col_letter": "G", "type": "str", "module": "common"},
    {"index": 8, "db_name": "desde", "excel_name": "Desde (m)", "col_letter": "H", "type": "float", "module": "common"},
    {"index": 9, "db_name": "hasta", "excel_name": "Hasta (m)", "col_letter": "I", "type": "float", "module": "common"},
    {"index": 10, "db_name": "longitud_muestra", "excel_name": "Longitud de muestra (m)", "col_letter": "J", "type": "float", "module": "common", "formula": "hasta - desde"},
    {"index": 11, "db_name": "este", "excel_name": "Este (m)", "col_letter": "K", "type": "float", "module": "common"},
    {"index": 12, "db_name": "norte", "excel_name": "Norte (m)", "col_letter": "L", "type": "float", "module": "common"},
    {"index": 13, "db_name": "elevacion", "excel_name": "Elevación (msnm)", "col_letter": "M", "type": "float", "module": "common"},
    {"index": 14, "db_name": "sectores", "excel_name": "SECTORES", "col_letter": "N", "type": "str", "module": "common"},
    {"index": 15, "db_name": "lito1", "excel_name": "Lito 1", "col_letter": "O", "type": "str", "module": "common"},
    {"index": 16, "db_name": "lito2", "excel_name": "Lito 2", "col_letter": "P", "type": "str", "module": "common"},
    {"index": 17, "db_name": "lito3", "excel_name": "Lito 3", "col_letter": "Q", "type": "str", "module": "common"},
    {"index": 18, "db_name": "tipo_ensayo", "excel_name": "Tipo de ensayo", "col_letter": "R", "type": "str", "module": "common"},
    
    # Compresión Uniaxial (UCS)
    {"index": 19, "db_name": "ucs_diametro", "excel_name": "Diámetro del testigo (cm)", "col_letter": "S", "type": "float", "module": "ucs"},
    {"index": 20, "db_name": "ucs_carga_rotura", "excel_name": "Carga de rotura (kN)", "col_letter": "T", "type": "float", "module": "ucs"},
    {"index": 21, "db_name": "ucs_resistencia", "excel_name": "Resistencia a la compresión uniaxial (MPa)", "col_letter": "U", "type": "float", "module": "ucs"},
    {"index": 22, "db_name": "ucs_resistencia_calculada", "excel_name": "Resistencia calculada (MPa)", "col_letter": "V", "type": "float", "module": "ucs", "formula": "4*ucs_carga_rotura*1000/(pi*(ucs_diametro*10)^2)"},
    {"index": 23, "db_name": "ucs_rotura", "excel_name": "Rotura", "col_letter": "W", "type": "str", "module": "ucs"},
    
    # Constantes Elásticas
    {"index": 24, "db_name": "elasticas_modulo_young", "excel_name": "Modulo de Young (GPa)", "col_letter": "X", "type": "float", "module": "elasticas"},
    {"index": 25, "db_name": "elasticas_poisson", "excel_name": "Relación de Poisson", "col_letter": "Y", "type": "float", "module": "elasticas"},
    
    # Tracción Indirecta
    {"index": 26, "db_name": "traccion_carga_promedio", "excel_name": "Carga de rotura promedio\n(kN)", "col_letter": "Z", "type": "float", "module": "traccion"},
    {"index": 27, "db_name": "traccion_resistencia_kgcm2", "excel_name": "Resistencia promedio\n(kg/cm2)", "col_letter": "AA", "type": "float", "module": "traccion"},
    {"index": 28, "db_name": "traccion_vacia_28", "excel_name": "Columna Vacía 28", "col_letter": "AB", "type": "str", "module": "traccion"},
    {"index": 29, "db_name": "traccion_resistencia_mpa", "excel_name": "Resistencia promedio\n(MPa)", "col_letter": "AC", "type": "float", "module": "traccion"},
    
    # Corte Directo
    {"index": 30, "db_name": "corte_tipo_fractura", "excel_name": "Tipo de fractura", "col_letter": "AD", "type": "str", "module": "corte"},
    {"index": 31, "db_name": "corte_area", "excel_name": "Área de ensayo (cm2)", "col_letter": "AE", "type": "float", "module": "corte"},
    {"index": 32, "db_name": "corte_esf_normal_kpa", "excel_name": "Esf Normal (kPa)", "col_letter": "AF", "type": "float", "module": "corte"},
    {"index": 33, "db_name": "corte_esf_corte_kpa", "excel_name": "Esf Corte (kPa)", "col_letter": "AG", "type": "float", "module": "corte"},
    {"index": 34, "db_name": "corte_esf_normal_mpa", "excel_name": "Esfuerzo Normal (MPa)", "col_letter": "AH", "type": "float", "module": "corte", "formula": "corte_esf_normal_kpa / 1000"},
    {"index": 35, "db_name": "corte_esf_corte_mpa", "excel_name": "Esfuerzo de Corte (MPa)", "col_letter": "AI", "type": "float", "module": "corte", "formula": "corte_esf_corte_kpa / 1000"},
    {"index": 36, "db_name": "corte_cohesion_mpa", "excel_name": "Cohesion (Mpa)", "col_letter": "AJ", "type": "float", "module": "corte"},
    {"index": 37, "db_name": "corte_angulo_friccion", "excel_name": "Ang. Friccion (°)", "col_letter": "AK", "type": "float", "module": "corte"},
    
    # Compresión Triaxial
    {"index": 38, "db_name": "triaxial_carga_confinamiento", "excel_name": "Carga de confinamiento (MPa)", "col_letter": "AL", "type": "float", "module": "triaxial"},
    {"index": 39, "db_name": "triaxial_esfuerzo_maximo", "excel_name": "Esfuerzo máximo (MPa)", "col_letter": "AM", "type": "float", "module": "triaxial"},
    {"index": 40, "db_name": "triaxial_resistencia_mpa", "excel_name": "Resistencia (Mpa)", "col_letter": "AN", "type": "float", "module": "triaxial"},
    {"index": 41, "db_name": "triaxial_mi", "excel_name": "mi", "col_letter": "AO", "type": "float", "module": "triaxial"},
    {"index": 42, "db_name": "triaxial_cohesion_mpa", "excel_name": "Cohesion (Mpa)", "col_letter": "AP", "type": "float", "module": "triaxial"},
    {"index": 43, "db_name": "triaxial_angulo_friccion", "excel_name": "Ang. Friccion (°)", "col_letter": "AQ", "type": "float", "module": "triaxial"},
    {"index": 44, "db_name": "triaxial_rotura", "excel_name": "Rotura", "col_letter": "AR", "type": "str", "module": "triaxial"},
    
    # Propiedades Físicas
    {"index": 45, "db_name": "prop_peso_unitario_geometrico", "excel_name": "Peso unitario geométrico\n(gr/cm3)", "col_letter": "AS", "type": "float", "module": "propiedades"},
    
    # Cierre / Metadatos finales
    {"index": 46, "db_name": "observacion", "excel_name": "Observación", "col_letter": "AT", "type": "str", "module": "common"},
    {"index": 47, "db_name": "campana", "excel_name": "Campaña de Perforación", "col_letter": "AU", "type": "str", "module": "common"}
]

# Mapa de búsquedas rápidas por db_name y excel_name
DB_NAME_MAP = {col["db_name"]: col for col in COLUMNS_CONFIG}
EXCEL_NAME_MAP = {col["excel_name"]: col for col in COLUMNS_CONFIG}
