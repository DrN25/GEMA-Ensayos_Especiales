# -*- coding: utf-8 -*-
"""
app/core/rules.py — Single Source of Truth (SSOT) para Ensayos Especiales (SIGEG/GEMA).
Define metadatos de las 47 columnas, límites físicos, fórmulas y motor de reglas QA/QC.
"""
import math
from typing import Dict, Any, List, Optional

COLUMNS_CONFIG: List[Dict[str, Any]] = [
    {"index": 1, "db_name": "idd", "excel_name": "IDD", "col_letter": "A", "type": "int", "module": "common", "validation": {"min": 1}},
    {"index": 2, "db_name": "sondaje", "excel_name": "Sondaje diamantino", "col_letter": "B", "type": "str", "module": "common"},
    {"index": 3, "db_name": "codigo_muestra", "excel_name": "Código de muestra", "col_letter": "C", "type": "str", "module": "common"},
    {"index": 4, "db_name": "laboratorio", "excel_name": "Laboratorio", "col_letter": "D", "type": "str", "module": "common"},
    {"index": 5, "db_name": "dia", "excel_name": "Día", "col_letter": "E", "type": "int", "module": "common", "validation": {"min": 1, "max": 31}},
    {"index": 6, "db_name": "mes", "excel_name": "Mes", "col_letter": "F", "type": "str", "module": "common"},
    {"index": 7, "db_name": "anio", "excel_name": "Año", "col_letter": "G", "type": "int", "module": "common", "validation": {"min": 1980, "max": 2050}},
    {"index": 8, "db_name": "proyecto", "excel_name": "Proyecto", "col_letter": "H", "type": "str", "module": "common"},
    {"index": 9, "db_name": "desde", "excel_name": "Desde (m)", "col_letter": "I", "type": "float", "module": "common", "validation": {"min": 0.0}},
    {"index": 10, "db_name": "hasta", "excel_name": "Hasta (m)", "col_letter": "J", "type": "float", "module": "common", "validation": {"min": 0.0}},
    {"index": 11, "db_name": "longitud_muestra", "excel_name": "Longitud de muestra (m)", "col_letter": "K", "type": "float", "module": "common", "formula": "hasta - desde"},
    {"index": 12, "db_name": "este", "excel_name": "Este (m)", "col_letter": "L", "type": "float", "module": "common", "validation": {"min": 0.0}},
    {"index": 13, "db_name": "norte", "excel_name": "Norte (m)", "col_letter": "M", "type": "float", "module": "common", "validation": {"min": 0.0}},
    {"index": 14, "db_name": "elevacion", "excel_name": "Elevación (msnm)", "col_letter": "N", "type": "float", "module": "common"},
    {"index": 15, "db_name": "sectores", "excel_name": "SECTORES", "col_letter": "O", "type": "str", "module": "common"},
    {"index": 16, "db_name": "lito1", "excel_name": "Lito 1", "col_letter": "P", "type": "str", "module": "common"},
    {"index": 17, "db_name": "lito2", "excel_name": "Lito 2", "col_letter": "Q", "type": "str", "module": "common"},
    {"index": 18, "db_name": "lito3", "excel_name": "Lito 3", "col_letter": "R", "type": "str", "module": "common"},
    {"index": 19, "db_name": "tipo_ensayo", "excel_name": "Tipo de ensayo", "col_letter": "S", "type": "str", "module": "common"},

    # Compresión Uniaxial (UCS)
    {"index": 20, "db_name": "ucs_diametro", "excel_name": "Diámetro del testigo (cm)", "col_letter": "T", "type": "float", "module": "ucs", "validation": {"min": 1.0, "max": 20.0}},
    {"index": 21, "db_name": "ucs_carga_rotura", "excel_name": "Carga de rotura (kN)", "col_letter": "U", "type": "float", "module": "ucs", "validation": {"min": 0.1}},
    {"index": 22, "db_name": "ucs_resistencia", "excel_name": "Resistencia a la compresión uniaxial (MPa)", "col_letter": "V", "type": "float", "module": "ucs", "validation": {"min": 0.1}},
    {"index": 23, "db_name": "ucs_resistencia_calculada", "excel_name": "Resistencia calculada (MPa)", "col_letter": "W", "type": "float", "module": "ucs"},
    {"index": 24, "db_name": "ucs_rotura", "excel_name": "Rotura", "col_letter": "X", "type": "str", "module": "ucs"},

    # Constantes Elásticas
    {"index": 25, "db_name": "elasticas_modulo_young", "excel_name": "Modulo de Young (GPa)", "col_letter": "Y", "type": "float", "module": "elasticas", "validation": {"min": 1.0, "max": 150.0}},
    {"index": 26, "db_name": "elasticas_poisson", "excel_name": "Relación de Poisson", "col_letter": "Z", "type": "float", "module": "elasticas", "validation": {"min": 0.05, "max": 0.45}},

    # Tracción Indirecta (Brasileño)
    {"index": 27, "db_name": "traccion_carga_promedio", "excel_name": "Carga de rotura promedio\n(kN)", "col_letter": "AA", "type": "float", "module": "traccion", "validation": {"min": 0.1}},
    {"index": 28, "db_name": "traccion_resistencia_kgcm2", "excel_name": "Resistencia promedio\n(kg/cm2)", "col_letter": "AB", "type": "float", "module": "traccion", "validation": {"min": 0.1}},
    {"index": 29, "db_name": "traccion_vacia_28", "excel_name": "Columna Vacía 28", "col_letter": "AC", "type": "str", "module": "traccion"},
    {"index": 30, "db_name": "traccion_resistencia_mpa", "excel_name": "Resistencia promedio\n(MPa)", "col_letter": "AD", "type": "float", "module": "traccion", "validation": {"min": 0.01}},

    # Corte Directo
    {"index": 31, "db_name": "corte_tipo_fractura", "excel_name": "Tipo de fractura", "col_letter": "AE", "type": "str", "module": "corte"},
    {"index": 32, "db_name": "corte_area", "excel_name": "Área de ensayo (cm2)", "col_letter": "AF", "type": "float", "module": "corte", "validation": {"min": 1.0}},
    {"index": 33, "db_name": "corte_esf_normal_kpa", "excel_name": "Esf Normal (kPa)", "col_letter": "AG", "type": "float", "module": "corte", "validation": {"min": 0.0}},
    {"index": 34, "db_name": "corte_esf_corte_kpa", "excel_name": "Esf Corte (kPa)", "col_letter": "AH", "type": "float", "module": "corte", "validation": {"min": 0.0}},
    {"index": 35, "db_name": "corte_esf_normal_mpa", "excel_name": "Esfuerzo Normal (MPa)", "col_letter": "AI", "type": "float", "module": "corte", "formula": "corte_esf_normal_kpa / 1000"},
    {"index": 36, "db_name": "corte_esf_corte_mpa", "excel_name": "Esfuerzo de Corte (MPa)", "col_letter": "AJ", "type": "float", "module": "corte", "formula": "corte_esf_corte_kpa / 1000"},
    {"index": 37, "db_name": "corte_cohesion_mpa", "excel_name": "Cohesion (Mpa)", "col_letter": "AK", "type": "float", "module": "corte", "validation": {"min": 0.0}},
    {"index": 38, "db_name": "corte_angulo_friccion", "excel_name": "Ang. Friccion (°)", "col_letter": "AL", "type": "float", "module": "corte", "validation": {"min": 0.0, "max": 90.0}},

    # Compresión Triaxial
    {"index": 39, "db_name": "triaxial_carga_confinamiento", "excel_name": "Carga de confinamiento (MPa)", "col_letter": "AM", "type": "float", "module": "triaxial", "validation": {"min": 0.0}},
    {"index": 40, "db_name": "triaxial_esfuerzo_maximo", "excel_name": "Esfuerzo máximo (MPa)", "col_letter": "AN", "type": "float", "module": "triaxial", "validation": {"min": 0.1}},
    {"index": 41, "db_name": "triaxial_resistencia_mpa", "excel_name": "Resistencia (Mpa)", "col_letter": "AO", "type": "float", "module": "triaxial", "validation": {"min": 0.1}},
    {"index": 42, "db_name": "triaxial_mi", "excel_name": "mi", "col_letter": "AP", "type": "float", "module": "triaxial", "validation": {"min": 0.1}},
    {"index": 43, "db_name": "triaxial_cohesion_mpa", "excel_name": "Cohesion (Mpa)", "col_letter": "AQ", "type": "float", "module": "triaxial", "validation": {"min": 0.0}},
    {"index": 44, "db_name": "triaxial_angulo_friccion", "excel_name": "Ang. Friccion (°)", "col_letter": "AR", "type": "float", "module": "triaxial", "validation": {"min": 0.0, "max": 90.0}},
    {"index": 45, "db_name": "triaxial_rotura", "excel_name": "Rotura", "col_letter": "AS", "type": "str", "module": "triaxial"},

    # Propiedades Físicas
    {"index": 46, "db_name": "prop_peso_unitario_geometrico", "excel_name": "Peso unitario geométrico\n(gr/cm3)", "col_letter": "AT", "type": "float", "module": "propiedades", "validation": {"min": 1.0, "max": 4.0}},

    # Cierre / Metadatos
    {"index": 47, "db_name": "observacion", "excel_name": "Observación", "col_letter": "AU", "type": "str", "module": "common"},
    {"index": 48, "db_name": "campana", "excel_name": "Campaña de Perforación", "col_letter": "AV", "type": "str", "module": "common"}
]

DB_NAME_MAP = {col["db_name"]: col for col in COLUMNS_CONFIG}
EXCEL_NAME_MAP = {col["excel_name"].strip().lower().replace("\n", " "): col for col in COLUMNS_CONFIG}

MODULES_CATALOG = [
    {"id": "registro_maestro", "label": "Registro Maestro", "color": "cyan"},
    {"id": "ucs", "label": "Compresión Uniaxial", "color": "orange"},
    {"id": "elasticas", "label": "Constantes Elásticas", "color": "red"},
    {"id": "traccion", "label": "Tracción Indirecta", "color": "yellow"},
    {"id": "corte", "label": "Corte Directo", "color": "emerald"},
    {"id": "triaxial", "label": "Compresión Triaxial", "color": "purple"},
    {"id": "propiedades", "label": "Propiedades Físicas", "color": "sky"},
]

def calculate_derived_fields(row: Dict[str, Any]) -> Dict[str, Any]:
    """Calcula campos dependientes en memoria de forma segura."""
    # 1. Longitud de muestra = Hasta - Desde
    try:
        desde = float(row.get("desde")) if row.get("desde") is not None else None
        hasta = float(row.get("hasta")) if row.get("hasta") is not None else None
        if desde is not None and hasta is not None:
            row["longitud_muestra"] = round(hasta - desde, 4)
        else:
            row["longitud_muestra"] = None
    except (ValueError, TypeError):
        row["longitud_muestra"] = None

    # 2. Conversión kPa -> MPa en Corte Directo
    try:
        if row.get("corte_esf_normal_kpa") is not None and row.get("corte_esf_normal_mpa") is None:
            row["corte_esf_normal_mpa"] = round(float(row["corte_esf_normal_kpa"]) / 1000.0, 4)
        if row.get("corte_esf_corte_kpa") is not None and row.get("corte_esf_corte_mpa") is None:
            row["corte_esf_corte_mpa"] = round(float(row["corte_esf_corte_kpa"]) / 1000.0, 4)
    except (ValueError, TypeError):
        pass

    # 3. Resistencia UCS calculada si se dispone de carga y diámetro
    try:
        d_cm = float(row.get("ucs_diametro")) if row.get("ucs_diametro") is not None else None
        p_kn = float(row.get("ucs_carga_rotura")) if row.get("ucs_carga_rotura") is not None else None
        if d_cm and p_kn and d_cm > 0 and row.get("ucs_resistencia_calculada") is None:
            # Area en mm2 = pi * (d_cm * 10 / 2)^2 = pi * (d_mm)^2 / 4
            # Resistencia (MPa) = Carga (N) / Area (mm2) = (P_kN * 1000) / (pi * (d_cm * 10)^2 / 4)
            area_mm2 = math.pi * ((d_cm * 10.0) ** 2) / 4.0
            row["ucs_resistencia_calculada"] = round((p_kn * 1000.0) / area_mm2, 2)
    except (ValueError, TypeError):
        pass

    return row

def clamp_value(db_name: str, val: Any) -> Any:
    """Aplica límites físicos al valor según la configuración SSOT."""
    if val is None or val == "":
        return None

    conf = DB_NAME_MAP.get(db_name)
    if not conf:
        return val

    vtype = conf["type"]
    validation = conf.get("validation", {})

    if vtype in ("int", "float"):
        try:
            num = float(str(val).replace(",", ".").replace(" ", ""))
            if "min" in validation and num < validation["min"]:
                num = validation["min"]
            if "max" in validation and num > validation["max"]:
                num = validation["max"]
            return int(round(num)) if vtype == "int" else round(num, 4)
        except (ValueError, TypeError):
            return None
    return str(val).strip()

def validate_record_qaqc(record: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Evalúa reglas de consistencia física y devuelve lista de anomalías."""
    alerts = []
    idd = record.get("idd")
    sondaje = record.get("sondaje") or "DESCONOCIDO"

    # 1. Profundidades Desde vs Hasta
    desde = record.get("desde")
    hasta = record.get("hasta")
    if desde is not None and hasta is not None:
        try:
            f_desde = float(desde)
            f_hasta = float(hasta)
            if f_desde >= f_hasta:
                alerts.append({
                    "idd": idd, "sondaje": sondaje, "field": "hasta",
                    "severity": "CRÍTICO", "code": "ERR_PROF_ORDEN",
                    "category": "Geometría de Muestra",
                    "message": f"Profundidad 'Desde' ({f_desde}m) debe ser menor que 'Hasta' ({f_hasta}m)."
                })
            elif (f_hasta - f_desde) > 5.0:
                alerts.append({
                    "idd": idd, "sondaje": sondaje, "field": "longitud_muestra",
                    "severity": "ADVERTENCIA", "code": "WARN_LONG_EXCESIVA",
                    "category": "Geometría de Muestra",
                    "message": f"Longitud de muestra ({round(f_hasta - f_desde, 2)}m) inusualmente alta (> 5m)."
                })
        except (ValueError, TypeError):
            pass

    # 2. Relación de Poisson (0.05 a 0.45)
    poisson = record.get("elasticas_poisson")
    if poisson is not None:
        try:
            f_poisson = float(poisson)
            if f_poisson < 0.05 or f_poisson > 0.45:
                alerts.append({
                    "idd": idd, "sondaje": sondaje, "field": "elasticas_poisson",
                    "severity": "CRÍTICO", "code": "ERR_POISSON_BOUNDS",
                    "category": "Constantes Elásticas",
                    "message": f"Relación de Poisson ({f_poisson}) fuera del rango físico (0.05 - 0.45)."
                })
        except (ValueError, TypeError):
            pass

    # 3. Peso Unitario Geométrico (1.0 a 4.0 gr/cm3)
    dens = record.get("prop_peso_unitario_geometrico")
    if dens is not None:
        try:
            f_dens = float(dens)
            if f_dens < 1.0 or f_dens > 4.0:
                alerts.append({
                    "idd": idd, "sondaje": sondaje, "field": "prop_peso_unitario_geometrico",
                    "severity": "CRÍTICO", "code": "ERR_DENSIDAD_BOUNDS",
                    "category": "Propiedades Físicas",
                    "message": f"Peso unitario ({f_dens} gr/cm³) fuera del rango de roca común (1.0 - 4.0 gr/cm³)."
                })
        except (ValueError, TypeError):
            pass

    # 4. Angulo de Fricción (0° a 90°)
    for fld, cat in [("corte_angulo_friccion", "Corte Directo"), ("triaxial_angulo_friccion", "Compresión Triaxial")]:
        ang = record.get(fld)
        if ang is not None:
            try:
                f_ang = float(ang)
                if f_ang < 0.0 or f_ang > 90.0:
                    alerts.append({
                        "idd": idd, "sondaje": sondaje, "field": fld,
                        "severity": "CRÍTICO", "code": "ERR_ANGULO_FRICCION",
                        "category": cat,
                        "message": f"Ángulo de fricción ({f_ang}°) excede el rango admisible (0° - 90°)."
                    })
            except (ValueError, TypeError):
                pass

    # 5. Cohesión no negativa
    for fld, cat in [("corte_cohesion_mpa", "Corte Directo"), ("triaxial_cohesion_mpa", "Compresión Triaxial")]:
        coh = record.get(fld)
        if coh is not None:
            try:
                f_coh = float(coh)
                if f_coh < 0.0:
                    alerts.append({
                        "idd": idd, "sondaje": sondaje, "field": fld,
                        "severity": "CRÍTICO", "code": "ERR_COHESION_NEGATIVA",
                        "category": cat,
                        "message": f"Cohesión ({f_coh} MPa) no puede ser negativa."
                    })
            except (ValueError, TypeError):
                pass

    # 6. Resistencia UCS vs Carga y Diámetro
    ucs_res = record.get("ucs_resistencia")
    ucs_calc = record.get("ucs_resistencia_calculada")
    if ucs_res is not None and ucs_calc is not None:
        try:
            f_res = float(ucs_res)
            f_calc = float(ucs_calc)
            # Si difiere en más de 20%
            if f_calc > 0 and abs(f_res - f_calc) / f_calc > 0.25:
                alerts.append({
                    "idd": idd, "sondaje": sondaje, "field": "ucs_resistencia",
                    "severity": "ADVERTENCIA", "code": "WARN_UCS_DISCREPANCIA",
                    "category": "Compresión Uniaxial",
                    "message": f"Discrepancia entre UCS reportada ({f_res} MPa) y calculada ({f_calc} MPa)."
                })
        except (ValueError, TypeError):
            pass

    return alerts
