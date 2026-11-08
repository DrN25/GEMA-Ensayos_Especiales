# -*- coding: utf-8 -*-
"""
app/routers/config.py — Single Source of Truth (SSOT) API para columnas, límites y estado de BD.
"""
import os
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.rules import COLUMNS_CONFIG, MODULES_CATALOG

router = APIRouter(prefix="/api/config", tags=["Configuración y Metadatos SSOT"])

@router.get("/columnas")
def get_columns_config():
    """Retorna la especificación canónica de columnas, tipos, límites y módulos."""
    return {
        "columns": COLUMNS_CONFIG,
        "modules": MODULES_CATALOG
    }

@router.get("/db-status")
def get_db_status(db: Session = Depends(get_db)):
    """Verifica el estado del motor de persistencia activo."""
    bind_engine = db.get_bind()
    engine_obj = getattr(bind_engine, "engine", bind_engine)
    url_str = str(getattr(engine_obj, "url", ""))

    is_sqlite = "sqlite" in url_str
    is_mssql = "mssql" in url_str

    db_type = "SQL Server" if is_mssql else "SQLite (Local)" if is_sqlite else "Desconocido"
    server_name = "Archivo Local" if is_sqlite else os.environ.get("DB_SERVER", "localhost\\SQLEXPRESS")
    database_name = os.path.basename(url_str) if is_sqlite else os.environ.get("DB_NAME", "ensayos_especiales")

    return {
        "status": "connected",
        "db_type": db_type,
        "is_local_fallback": is_sqlite,
        "server": server_name,
        "database": database_name
    }
