# -*- coding: utf-8 -*-
"""
app/routers/proyectos.py — Gestión de Proyectos Geotécnicos con cascada interactiva.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/proyectos", tags=["Proyectos Geotécnicos"])

@router.get("", response_model=List[schemas.ProyectoResponse])
def get_proyectos(db: Session = Depends(get_db)):
    return db.query(models.Proyecto).all()

@router.post("")
def save_proyectos(data: List[schemas.ProyectoBase], db: Session = Depends(get_db)):
    try:
        existing_projs = {p.id: p for p in db.query(models.Proyecto).all() if p.id is not None}
        incoming_ids = set()

        for p in data:
            if p.id is not None and p.id in existing_projs:
                row = existing_projs[p.id]
                old_name = row.nombre
                new_name = p.nombre

                # Cascade update: Renombrar en registros geotécnicos si cambió de nombre
                if old_name != new_name:
                    db.query(models.RegistroMaestro).filter(
                        models.RegistroMaestro.proyecto == old_name
                    ).update({models.RegistroMaestro.proyecto: new_name}, synchronize_session=False)

                row.nombre = new_name
                row.sinonimos = p.sinonimos
                incoming_ids.add(p.id)
            else:
                db.add(models.Proyecto(nombre=p.nombre, sinonimos=p.sinonimos))

        # Cascade delete: Limpieza de proyectos eliminados
        for pid, p_obj in existing_projs.items():
            if pid not in incoming_ids:
                deleted_name = p_obj.nombre
                db.query(models.RegistroMaestro).filter(
                    models.RegistroMaestro.proyecto == deleted_name
                ).update({models.RegistroMaestro.proyecto: None}, synchronize_session=False)
                db.delete(p_obj)

        db.commit()
        return {"status": "success", "message": "Proyectos guardados y sincronizados en cascada con éxito."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar proyectos: {e}")
