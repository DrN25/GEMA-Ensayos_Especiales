# -*- coding: utf-8 -*-
"""
tests/integration/test_ensayos_roundtrip.py
Pruebas dinámicas de integración con base de datos para verificar persistencia fidedigna (Round-Trip),
precisión decimal exacta (sin truncamiento), actualización atómica de campos y límites físicos.
"""
import pytest
from app.core.rules import COLUMNS_CONFIG

# Extracción dinámica de columnas según SSOT (app.core.rules)
FLOAT_COLS = [c for c in COLUMNS_CONFIG if c["type"] == "float" and "formula" not in c]
INT_COLS = [c for c in COLUMNS_CONFIG if c["type"] == "int" and c["db_name"] != "idd"]
STR_COLS = [c for c in COLUMNS_CONFIG if c["type"] == "str"]
VALIDATED_COLS = [c for c in COLUMNS_CONFIG if "validation" in c and ("min" in c["validation"] or "max" in c["validation"]) and c["db_name"] != "idd"]

def test_full_record_roundtrip_persistence(client, sample_ensayo_dict):
    """
    Verifica que un registro completo se guarde mediante batch-upsert y se recupere
    íntegramente campo por campo sin alteración ni pérdida de datos.
    """
    res_post = client.post("/api/ensayos/batch-upsert", json=[sample_ensayo_dict])
    assert res_post.status_code == 200
    assert res_post.json()["upserted_count"] == 1

    res_get = client.get(f"/api/ensayos/{sample_ensayo_dict['idd']}")
    assert res_get.status_code == 200
    saved = res_get.json()

    # Validar que los campos enviados coincidan exactamente
    for k, expected_v in sample_ensayo_dict.items():
        actual_v = saved.get(k)
        if expected_v is None:
            assert actual_v is None, f"Campo {k} esperaba None, obtuvo {actual_v}"
        else:
            assert actual_v == expected_v, f"Discrepancia en '{k}': esperado {expected_v}, obtenido {actual_v}"

    # Validar fórmulas derivadas automáticas
    expected_longitud = round(sample_ensayo_dict["hasta"] - sample_ensayo_dict["desde"], 4)
    assert saved["longitud_muestra"] == expected_longitud
    assert saved["corte_esf_normal_mpa"] == round(sample_ensayo_dict["corte_esf_normal_kpa"] / 1000.0, 4)
    assert saved["corte_esf_corte_mpa"] == round(sample_ensayo_dict["corte_esf_corte_kpa"] / 1000.0, 4)

@pytest.mark.parametrize("col", FLOAT_COLS, ids=lambda c: c["db_name"])
def test_float_fields_precision_roundtrip(client, sample_ensayo_dict, col):
    """
    Prueba parametrizada para CADA columna decimal/float:
    Garantiza que un valor con decimales (ej. 1.23 o 1.2345) NO se trunque (ej. a 1.2)
    ni sufra degradación de punto flotante al persistirse y recuperarse.
    """
    col_name = col["db_name"]
    client.post("/api/ensayos/batch-upsert", json=[sample_ensayo_dict])

    val_min = col.get("validation", {}).get("min", 1.0)
    val_max = col.get("validation", {}).get("max", None)
    if val_max is not None:
        # Asegurar un valor intermedio válido dentro del rango [min, max] con 4 decimales
        test_decimal = round(val_min + (val_max - val_min) * 0.45, 4)
    else:
        test_decimal = round(val_min + 1.2345, 4)

    # 1. Actualizar únicamente este campo decimal
    res_put = client.put(f"/api/ensayos/{sample_ensayo_dict['idd']}", json={col_name: test_decimal})
    assert res_put.status_code == 200

    # 2. Consultar y verificar la precisión exacta
    res_get = client.get(f"/api/ensayos/{sample_ensayo_dict['idd']}")
    assert res_get.status_code == 200
    retrieved_val = res_get.json()[col_name]
    assert retrieved_val == test_decimal, (
        f"Falla de precisión en columna '{col_name}': se guardó {test_decimal} pero se recuperó {retrieved_val}"
    )

@pytest.mark.parametrize("col", STR_COLS, ids=lambda c: c["db_name"])
def test_string_fields_persistence_roundtrip(client, sample_ensayo_dict, col):
    """
    Prueba parametrizada para CADA columna de texto/string del Registro Maestro:
    Garantiza que cadenas de texto se persistan y recuperen sin truncamiento,
    sin alterar formato y respetando caracteres válidos.
    """
    col_name = col["db_name"]
    client.post("/api/ensayos/batch-upsert", json=[sample_ensayo_dict])

    test_str = f"TEST_{col_name.upper()[:12]}"
    res_put = client.put(f"/api/ensayos/{sample_ensayo_dict['idd']}", json={col_name: test_str})
    assert res_put.status_code == 200

    res_get = client.get(f"/api/ensayos/{sample_ensayo_dict['idd']}")
    assert res_get.status_code == 200
    assert res_get.json()[col_name] == test_str

@pytest.mark.parametrize("col", INT_COLS, ids=lambda c: c["db_name"])
def test_int_fields_persistence_roundtrip(client, sample_ensayo_dict, col):
    """
    Prueba parametrizada para CADA columna entera del Registro Maestro:
    Garantiza que se persista exactamente como tipo entero sin conversiones float no deseadas.
    """
    col_name = col["db_name"]
    client.post("/api/ensayos/batch-upsert", json=[sample_ensayo_dict])

    test_int = 28 if col_name == "dia" else 2030
    res_put = client.put(f"/api/ensayos/{sample_ensayo_dict['idd']}", json={col_name: test_int})
    assert res_put.status_code == 200

    res_get = client.get(f"/api/ensayos/{sample_ensayo_dict['idd']}")
    assert res_get.status_code == 200
    retrieved = res_get.json()[col_name]
    assert retrieved == test_int
    assert isinstance(retrieved, int)

def test_atomic_single_field_update_preserves_untouched_columns(client, sample_ensayo_dict):
    """
    Garantiza que actualizar UN SOLO campo (ej. modificar sondaje) no borre, altere ni
    blanquee las 47 columnas restantes ni sus campos derivados.
    """
    client.post("/api/ensayos/batch-upsert", json=[sample_ensayo_dict])

    # Modificar únicamente 'sondaje'
    res_put = client.put(f"/api/ensayos/{sample_ensayo_dict['idd']}", json={"sondaje": "DH-MODIFIED-99"})
    assert res_put.status_code == 200

    res_get = client.get(f"/api/ensayos/{sample_ensayo_dict['idd']}")
    assert res_get.status_code == 200
    updated = res_get.json()

    assert updated["sondaje"] == "DH-MODIFIED-99"
    # Verificar que los demás campos permanecen exactamente como fueron creados
    assert updated["codigo_muestra"] == sample_ensayo_dict["codigo_muestra"]
    assert updated["laboratorio"] == sample_ensayo_dict["laboratorio"]
    assert updated["desde"] == sample_ensayo_dict["desde"]
    assert updated["hasta"] == sample_ensayo_dict["hasta"]
    assert updated["longitud_muestra"] == round(sample_ensayo_dict["hasta"] - sample_ensayo_dict["desde"], 4)
    assert updated["elasticas_poisson"] == sample_ensayo_dict["elasticas_poisson"]
    assert updated["ucs_resistencia"] == sample_ensayo_dict["ucs_resistencia"]
    assert updated["triaxial_mi"] == sample_ensayo_dict["triaxial_mi"]

@pytest.mark.parametrize("col", VALIDATED_COLS, ids=lambda c: c["db_name"])
def test_boundary_clamping_behavior(client, sample_ensayo_dict, col):
    """
    Verifica que valores límite y fuera de rango sean normalizados según las reglas físicas del SSOT.
    """
    col_name = col["db_name"]
    val_rules = col["validation"]
    client.post("/api/ensayos/batch-upsert", json=[sample_ensayo_dict])

    # Si tiene mínimo, probar valor por debajo
    if "min" in val_rules:
        under_val = val_rules["min"] - (1.0 if col["type"] == "float" else 1)
        client.put(f"/api/ensayos/{sample_ensayo_dict['idd']}", json={col_name: under_val})
        res = client.get(f"/api/ensayos/{sample_ensayo_dict['idd']}")
        # Debe clampearse al mínimo establecido
        assert res.json()[col_name] == val_rules["min"], (
            f"Columna '{col_name}' no aplicó clamping al mínimo: enviado {under_val}, límite {val_rules['min']}"
        )

def test_derived_formula_updates_when_dependencies_change(client, sample_ensayo_dict):
    """
    Verifica que al cambiar 'desde' o 'hasta', 'longitud_muestra' se actualice automáticamente
    con el valor recalculado sin perder precisión.
    """
    client.post("/api/ensayos/batch-upsert", json=[sample_ensayo_dict])

    # Cambiar 'hasta' de 12.345 a 15.80
    client.put(f"/api/ensayos/{sample_ensayo_dict['idd']}", json={"hasta": 15.80})
    res = client.get(f"/api/ensayos/{sample_ensayo_dict['idd']}")
    assert res.status_code == 200
    expected_new_longitud = round(15.80 - sample_ensayo_dict["desde"], 4)
    assert res.json()["longitud_muestra"] == expected_new_longitud

def test_type_coercion_string_numbers_and_whitespace(client, sample_ensayo_dict):
    """
    Verifica que números enviados con formato coma decimal ('12,34') o cadenas con espacios
    sean sanitizados e insertados limpiamente en la base de datos.
    """
    dirty_record = {
        "idd": 1002,
        "sondaje": "  DH-DIRTY-02  ",
        "codigo_muestra": " M-DIRTY ",
        "desde": "10,50",
        "hasta": "13,75",
        "dia": "20",
        "anio": "2025",
        "proyecto": "CHABB",
        "observacion": "   Observación con espacios extras   "
    }
    res = client.post("/api/ensayos/batch-upsert", json=[dirty_record])
    assert res.status_code == 200

    res_get = client.get("/api/ensayos/1002")
    assert res_get.status_code == 200
    cleaned = res_get.json()

    assert cleaned["sondaje"] == "DH-DIRTY-02"
    assert cleaned["codigo_muestra"] == "M-DIRTY"
    assert cleaned["desde"] == 10.5
    assert cleaned["hasta"] == 13.75
    assert cleaned["longitud_muestra"] == 3.25
    assert cleaned["dia"] == 20
    assert cleaned["anio"] == 2025
    assert cleaned["observacion"] == "Observación con espacios extras"

def test_real_production_archetypes_roundtrip(client, real_production_samples):
    """
    Verifica que los 4 perfiles reales de ensayos geomecánicos (Corte Directo, Triaxial,
    UCS/Elásticas y Tracción Indirecta) tomados de la base de datos de producción
    se persistan, validen en QA/QC y recuperen exactamente como en el entorno real.
    """
    for archetype in real_production_samples:
        payload = {k: v for k, v in archetype.items() if not k.startswith("_")}
        idd = payload["idd"]

        # 1. Inserción mediante Batch Upsert
        res_post = client.post("/api/ensayos/batch-upsert", json=[payload])
        assert res_post.status_code == 200, f"Fallo al insertar arquetipo {archetype.get('_label')}"
        assert res_post.json()["upserted_count"] == 1

        # 2. Lectura y validación campo por campo
        res_get = client.get(f"/api/ensayos/{idd}")
        assert res_get.status_code == 200
        saved = res_get.json()

        for k, v in payload.items():
            if v is not None:
                assert saved[k] == v, f"Discrepancia en {archetype['_label']} campo '{k}': esperado {v}, obtenido {saved[k]}"

        # 3. Comprobar que dia sea None (realidad geomecánica donde solo se reporta mes/año)
        assert saved["dia"] is None

        # 4. Validar cálculo automático de longitud de muestra
        expected_len = round(payload["hasta"] - payload["desde"], 4)
        assert saved["longitud_muestra"] == expected_len

        # 5. Comprobar que en la API paginada pase sin errores críticos de QA/QC
        res_paged = client.get(f"/api/ensayos?q={payload['codigo_muestra']}")
        assert res_paged.status_code == 200
        items = res_paged.json()["items"]
        assert len(items) >= 1
        item = items[0]
        assert item["_has_errors"] is False, f"Arquetipo {archetype['_label']} generó errores críticos de QA/QC"

def test_utm_high_magnitude_coordinates_precision(client, sample_ensayo_dict):
    """
    Verifica que coordenadas UTM de 6 y 7 cifras (Este ~785948.60, Norte ~8443345.13)
    no sufran degradación, redondeo destructivo a enteros ni notación científica en la BD.
    """
    client.post("/api/ensayos/batch-upsert", json=[sample_ensayo_dict])

    real_este = 785961.87
    real_norte = 8443358.97
    real_elev = 4471.77

    client.put(f"/api/ensayos/{sample_ensayo_dict['idd']}", json={
        "este": real_este,
        "norte": real_norte,
        "elevacion": real_elev
    })

    res = client.get(f"/api/ensayos/{sample_ensayo_dict['idd']}")
    assert res.status_code == 200
    data = res.json()

    assert data["este"] == real_este
    assert data["norte"] == real_norte
    assert data["elevacion"] == real_elev

def test_real_world_sparse_nulls_atomic_update(client, real_production_samples):
    """
    Verifica que actualizar un único campo en un registro real disperso (donde más del 50%
    de las columnas son NULL legítimas) no altere los campos nulos ni los existentes.
    """
    corte_real = [s for s in real_production_samples if "Corte" in s["_label"]][0]
    payload = {k: v for k, v in corte_real.items() if not k.startswith("_")}
    client.post("/api/ensayos/batch-upsert", json=[payload])

    # Modificar únicamente el ángulo de fricción de 32.98 a 35.50
    res_put = client.put(f"/api/ensayos/{payload['idd']}", json={"corte_angulo_friccion": 35.50})
    assert res_put.status_code == 200

    res_get = client.get(f"/api/ensayos/{payload['idd']}")
    assert res_get.status_code == 200
    updated = res_get.json()

    assert updated["corte_angulo_friccion"] == 35.50
    assert updated["corte_cohesion_mpa"] == 0.1
    # Asegurar que los campos no pertenecientes a Corte siguen siendo estrictamente None
    assert updated["triaxial_resistencia_mpa"] is None
    assert updated["ucs_resistencia"] is None
    assert updated["traccion_resistencia_mpa"] is None
