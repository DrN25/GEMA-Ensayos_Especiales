# -*- coding: utf-8 -*-
"""
app/main.py — Servidor FastAPI modular para Ensayos Especiales (GEMA / SIGEG).
Alineado a la arquitectura y directrices de GEMA-Mapeo.
"""
import os
import sys
from fastapi import FastAPI, HTTPException, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import engine, Base, auto_heal_schema, get_db
from app.routers.ensayos import router as ensayos_router
from app.routers.proyectos import router as proyectos_router
from app.routers.auditoria import router as auditoria_router
from app.routers.config import router as config_router

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

app = FastAPI(
    title="Ensayos Especiales Geotécnicos API",
    description="Backend modular de alta velocidad alineado al estándar GEMA-Mapeo con persistencia en SQL Server y SQLite.",
    version="3.0"
)

# Directorio de uploads para reportes y auditorías
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
uploads_dir = os.path.join(BASE_DIR, "uploads")
os.makedirs(uploads_dir, exist_ok=True)
os.makedirs(os.path.join(uploads_dir, "auditoria_history"), exist_ok=True)

app.mount("/api/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# CORS Middleware universal
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicialización de Tablas y Esquema
@app.on_event("startup")
def startup_db():
    try:
        Base.metadata.create_all(bind=engine)
        auto_heal_schema(engine)
        print("Tablas de base de datos creadas y verificadas con éxito.")
    except Exception as e:
        print(f"Error al inicializar la base de datos: {e}")

# Registro de Routers Modulares
app.include_router(ensayos_router)
app.include_router(proyectos_router)
app.include_router(auditoria_router)
app.include_router(config_router)

# Alias de compatibilidad hacia atrás
@app.get("/api/db-status")
def db_status_alias(db: Session = Depends(get_db)):
    from app.routers.config import get_db_status
    return get_db_status(db)

@app.post("/api/records/bulk")
def records_bulk_alias(payload: list = Body(...), db: Session = Depends(get_db)):
    from app.routers.ensayos import batch_upsert_ensayos
    return batch_upsert_ensayos(payload, db)



@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "GEMA Ensayos Especiales Engine API",
        "version": "3.0"
    }

@app.get("/api/health")
def health_check():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "online", "bd": "ok"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Base de datos no disponible: {e}")