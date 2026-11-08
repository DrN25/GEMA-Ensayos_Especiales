# -*- coding: utf-8 -*-
"""
tests/conftest.py — Configuración de pruebas con aislamiento 100% seguro en memoria (SQLite).
Garantiza que NINGUNA prueba toque, mute ni dependa de la base de datos remota SQL Server.
"""
import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

# 1. FORZAR Base de Datos SQLite en memoria ANTES de cualquier import de app
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["DB_SERVER"] = "SQLITE_TEST_MEMORY"

from app.database import Base, get_db
from app import models
from app.main import app

@pytest.fixture(scope="session")
def engine():
    """Motor SQLite en memoria compartido para la sesión de pruebas."""
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=test_engine)
    yield test_engine
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture(scope="function")
def db_session(engine):
    """
    Sesión transaccional por prueba:
    Ejecuta cada test dentro de una transacción externa que se revierte (ROLLBACK) al terminar.
    Garantiza estado limpio y cero persistencia entre pruebas con ejecución sub-milisegundo.
    """
    connection = engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()

    yield session

    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="function")
def client(db_session):
    """Cliente de pruebas FastAPI con inyección de la sesión aislada en get_db."""
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def sample_ensayo_dict():
    """Registro válido canónico con datos de prueba realistas para pruebas de persistencia."""
    return {
        "idd": 1001,
        "sondaje": "DH-TEST-01",
        "codigo_muestra": "M-1001",
        "laboratorio": "GEO-LAB",
        "dia": 15,
        "mes": "MARZO",
        "anio": 2026,
        "proyecto": "CHABB",
        "desde": 10.0,
        "hasta": 12.345,
        "este": 250123.456,
        "norte": 8200456.789,
        "elevacion": 3450.5,
        "sectores": "SECTOR-NORTE",
        "lito1": "ANDESITA",
        "lito2": "DACITA",
        "lito3": None,
        "tipo_ensayo": "UCS",
        "ucs_diametro": 6.35,
        "ucs_carga_rotura": 45.2,
        "ucs_resistencia": 142.8,
        "ucs_rotura": "DIAGONAL",
        "elasticas_modulo_young": 45.0,
        "elasticas_poisson": 0.22,
        "traccion_carga_promedio": 12.5,
        "traccion_resistencia_kgcm2": 65.4,
        "traccion_vacia_28": None,
        "traccion_resistencia_mpa": 6.41,
        "corte_tipo_fractura": "RUGOSA",
        "corte_area": 35.0,
        "corte_esf_normal_kpa": 500.0,
        "corte_esf_corte_kpa": 350.0,
        "corte_cohesion_mpa": 0.25,
        "corte_angulo_friccion": 34.5,
        "triaxial_carga_confinamiento": 5.0,
        "triaxial_esfuerzo_maximo": 120.0,
        "triaxial_resistencia_mpa": 115.0,
        "triaxial_mi": 18.5,
        "triaxial_cohesion_mpa": 12.0,
        "triaxial_angulo_friccion": 38.0,
        "triaxial_rotura": "CIZALLE",
        "prop_peso_unitario_geometrico": 2.65,
        "observacion": "Muestra en buen estado para ensayo",
        "campana": "2026"
    }
