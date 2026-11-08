# -*- coding: utf-8 -*-
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.rules import validate_record_qaqc, calculate_derived_fields, clamp_value

client = TestClient(app)

def test_root_and_health():
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["status"] == "online"

    res_h = client.get("/api/health")
    assert res_h.status_code == 200
    assert res_h.json()["bd"] == "ok"

def test_config_columnas_ssot():
    res = client.get("/api/config/columnas")
    assert res.status_code == 200
    data = res.json()
    assert "columns" in data
    assert len(data["columns"]) == 48
    assert "modules" in data

def test_rules_validation():
    # 1. Error de orden en profundidades
    bad_depth_record = {"idd": 999, "sondaje": "DH-01", "desde": 15.0, "hasta": 10.0}
    alerts = validate_record_qaqc(bad_depth_record)
    assert any(a["code"] == "ERR_PROF_ORDEN" for a in alerts)

    # 2. Error en relación de Poisson
    bad_poisson = {"idd": 999, "sondaje": "DH-01", "elasticas_poisson": 0.85}
    alerts = validate_record_qaqc(bad_poisson)
    assert any(a["code"] == "ERR_POISSON_BOUNDS" for a in alerts)

    # 3. Cálculo de longitud de muestra
    derived = calculate_derived_fields({"desde": 10.0, "hasta": 12.35})
    assert derived["longitud_muestra"] == 2.35

def test_ensayos_paginated_api():
    res = client.get("/api/ensayos?page=1&page_size=20")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total_filtered" in data
    assert "total_pages" in data
    assert data["page"] == 1

def test_batch_upsert_non_destructive():
    test_rows = [
        {
            "idd": 999901,
            "sondaje": "TEST-PONITAIL-01",
            "codigo_muestra": "TEST-01",
            "desde": 5.0,
            "hasta": 6.5,
            "campana": "2026",
            "tipo_ensayo": "UCS"
        }
    ]
    res = client.post("/api/ensayos/batch-upsert", json=test_rows)
    assert res.status_code == 200
    assert res.json()["upserted_count"] == 1

    # Verificar que existe
    res_get = client.get("/api/ensayos/999901")
    assert res_get.status_code == 200
    assert res_get.json()["sondaje"] == "TEST-PONITAIL-01"

    # Limpiar el registro de prueba
    res_del = client.delete("/api/ensayos/999901")
    assert res_del.status_code == 200

def test_legacy_aliases():
    res_db = client.get("/api/db-status")
    assert res_db.status_code == 200
    assert "db_type" in res_db.json()

    test_row = [{
        "idd": 999902,
        "sondaje": "TEST-ALIAS",
        "codigo_muestra": "TEST-AL-01"
    }]
    res_bulk = client.post("/api/records/bulk", json=test_row)
    assert res_bulk.status_code == 200
    assert res_bulk.json()["upserted_count"] == 1

    client.delete("/api/ensayos/999902")

def test_auditoria_history():
    res = client.get("/api/auditoria/history")
    assert res.status_code == 200
    assert "history" in res.json()


def test_ensayos_stats():
    res = client.get("/api/ensayos/stats")
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "counts" in data
    assert "recent" in data
    assert isinstance(data["counts"], dict)
    assert "ucs" in data["counts"]
    assert "elasticas" in data["counts"]

