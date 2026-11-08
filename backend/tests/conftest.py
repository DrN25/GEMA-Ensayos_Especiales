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

@pytest.fixture
def real_production_samples():
    """
    Arquetipos reales de producción extraídos directamente de los 174 registros
    de la base de datos SQL Server ('db_ad0a4f_gema').
    Reflejan los 4 tipos de ensayos reales con sus nulos legítimos, códigos litológicos
    y coordenadas UTM de alta magnitud.
    """
    return [
        {
            "_label": "Corte Directo Real (IDD 8553)",
            "idd": 8553,
            "sondaje": "CHGT25-002",
            "codigo_muestra": "CHGT25-002-CD-M01",
            "laboratorio": "UNI",
            "dia": None,
            "mes": "Enero",
            "anio": 2025,
            "proyecto": "CHABB",
            "desde": 47.44,
            "hasta": 47.74,
            "este": 785964.67,
            "norte": 8443361.89,
            "elevacion": 4467.15,
            "sectores": None,
            "lito1": "LMT",
            "lito2": "GSK",
            "lito3": "LMT_M",
            "tipo_ensayo": "Corte directo",
            "corte_area": 33.15,
            "corte_esf_normal_mpa": 0.75,
            "corte_esf_corte_mpa": 0.59,
            "corte_cohesion_mpa": 0.1,
            "corte_angulo_friccion": 32.98,
            "campana": "2025"
        },
        {
            "_label": "Compresión Triaxial Real (IDD 9303)",
            "idd": 9303,
            "sondaje": "CHGT25-002",
            "codigo_muestra": "CHGT25-002-TX-M01",
            "laboratorio": "UNI",
            "dia": None,
            "mes": "Enero",
            "anio": 2025,
            "proyecto": "CHABB",
            "desde": 63.1,
            "hasta": 63.64,
            "este": 785971.88,
            "norte": 8443369.29,
            "elevacion": 4455.39,
            "sectores": None,
            "lito1": "LMT",
            "lito2": "GSK",
            "lito3": "LMT_M",
            "tipo_ensayo": "Compresión triaxial",
            "triaxial_carga_confinamiento": 1.0,
            "triaxial_esfuerzo_maximo": 41.9,
            "triaxial_resistencia_mpa": 35.57,
            "triaxial_mi": 11.32,
            "triaxial_cohesion_mpa": 6.97,
            "triaxial_angulo_friccion": 44.28,
            "triaxial_rotura": "1",
            "campana": "2025"
        },
        {
            "_label": "Constantes Elásticas / UCS Real (IDD 8191)",
            "idd": 8191,
            "sondaje": "CHGT25-002",
            "codigo_muestra": "CHGT25-002-UCS-M01",
            "laboratorio": "UNI",
            "dia": None,
            "mes": "Febrero",
            "anio": 2025,
            "proyecto": "CHABB",
            "desde": 12.05,
            "hasta": 12.3,
            "este": 785948.6,
            "norte": 8443345.13,
            "elevacion": 4493.86,
            "sectores": None,
            "lito1": "LMT",
            "lito2": "MSK",
            "lito3": "LMT_M",
            "tipo_ensayo": "Determinación de constantes elásticas",
            "ucs_diametro": 6.08,
            "ucs_carga_rotura": 225.63,
            "ucs_resistencia": 78.61,
            "ucs_resistencia_calculada": 77.71,
            "ucs_rotura": "1",
            "elasticas_modulo_young": 18.26,
            "elasticas_poisson": 0.26,
            "campana": "2025"
        },
        {
            "_label": "Tracción Indirecta Brasileño Real (IDD 9672)",
            "idd": 9672,
            "sondaje": "CHGT25-002",
            "codigo_muestra": "CHGT25-002-TI-M01",
            "laboratorio": "UNI",
            "dia": None,
            "mes": "Enero",
            "anio": 2025,
            "proyecto": "CHABB",
            "desde": 17.43,
            "hasta": 17.82,
            "este": 785951.02,
            "norte": 8443347.66,
            "elevacion": 4489.78,
            "sectores": None,
            "lito1": "LMT",
            "lito2": "GSK",
            "lito3": "LMT_M",
            "tipo_ensayo": "Tracción indirecta",
            "traccion_carga_promedio": 25.5,
            "traccion_resistencia_kgcm2": 75.3,
            "traccion_resistencia_mpa": 7.38,
            "campana": "2025"
        }
    ]

