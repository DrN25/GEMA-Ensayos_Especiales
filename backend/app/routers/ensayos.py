# -*- coding: utf-8 -*-
"""
app/routers/ensayos.py — Endpoints paginados de alta velocidad para Registro y Consulta de Ensayos Especiales.
Soporta filtros multidimensionales en servidor, batch upsert seguro (cero borrado destructivo) y exportación.
"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.database import get_db
from app import models, schemas
from app.core.rules import calculate_derived_fields, clamp_value, validate_record_qaqc
from app.services.excel_exporter import export_ensayos_to_excel

router = APIRouter(prefix="/api/ensayos", tags=["Ensayos Especiales"])

@router.get("", response_model=schemas.EnsayosPaginatedResponse)
def get_ensayos_paginated(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=50000),
    q: Optional[str] = Query(None, description="Búsqueda por sondaje o código de muestra"),
    tipo_ensayo: Optional[str] = Query(None, description="Módulo o tipo de ensayo"),
    proyecto: Optional[str] = Query(None),
    campana: Optional[str] = Query(None),
    sort_by: str = Query("idd"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db)
):
    query = db.query(models.RegistroMaestro)

    # 1. Búsqueda textual
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.RegistroMaestro.sondaje.ilike(term),
                models.RegistroMaestro.codigo_muestra.ilike(term)
            )
        )

    # 2. Filtro por tipo de ensayo o familia
    if tipo_ensayo and tipo_ensayo.strip():
        t = tipo_ensayo.strip().lower()
        if t == "ucs":
            query = query.filter(
                or_(
                    models.RegistroMaestro.tipo_ensayo.ilike("%ucs%"),
                    models.RegistroMaestro.tipo_ensayo.ilike("%uniaxial%"),
                    models.RegistroMaestro.ucs_resistencia.isnot(None)
                )
            )
        elif t == "elasticas":
            query = query.filter(
                or_(
                    models.RegistroMaestro.tipo_ensayo.ilike("%elastic%"),
                    models.RegistroMaestro.tipo_ensayo.ilike("%constantes%"),
                    models.RegistroMaestro.elasticas_modulo_young.isnot(None)
                )
            )
        elif t == "traccion":
            query = query.filter(
                or_(
                    models.RegistroMaestro.tipo_ensayo.ilike("%tracci%"),
                    models.RegistroMaestro.tipo_ensayo.ilike("%brasile%"),
                    models.RegistroMaestro.traccion_resistencia_mpa.isnot(None)
                )
            )
        elif t == "corte":
            query = query.filter(
                or_(
                    models.RegistroMaestro.tipo_ensayo.ilike("%corte%"),
                    models.RegistroMaestro.corte_cohesion_mpa.isnot(None)
                )
            )
        elif t == "triaxial":
            query = query.filter(
                or_(
                    models.RegistroMaestro.tipo_ensayo.ilike("%triaxial%"),
                    models.RegistroMaestro.triaxial_resistencia_mpa.isnot(None)
                )
            )
        elif t == "propiedades":
            query = query.filter(models.RegistroMaestro.prop_peso_unitario_geometrico.isnot(None))
        elif t != "registro_maestro":
            query = query.filter(models.RegistroMaestro.tipo_ensayo.ilike(f"%{tipo_ensayo.strip()}%"))

    # 3. Filtros por metadatos
    if proyecto and proyecto.strip():
        query = query.filter(models.RegistroMaestro.proyecto.ilike(f"%{proyecto.strip()}%"))
    if campana and campana.strip():
        query = query.filter(models.RegistroMaestro.campana.ilike(f"%{campana.strip()}%"))

    # 4. Total antes de paginar
    total_filtered = query.count()

    # 5. Ordenamiento seguro
    order_col = getattr(models.RegistroMaestro, sort_by, models.RegistroMaestro.idd)
    order_fn = getattr(order_col, sort_dir, order_col.asc)
    query = query.order_by(order_fn())

    # 6. Paginación
    total_pages = max(1, (total_filtered + page_size - 1) // page_size)
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    # 7. Serializar y validar anomalías en caliente sobre el subconjunto devuelto
    serialized_items = []
    total_anomalies_page = 0
    for item in items:
        d = {col.name: getattr(item, col.name) for col in item.__table__.columns}
        row_alerts = validate_record_qaqc(d)
        d["_alerts"] = row_alerts
        d["_has_errors"] = any(a["severity"] == "CRÍTICO" for a in row_alerts)
        if row_alerts:
            total_anomalies_page += len(row_alerts)
        serialized_items.append(d)

    total_global = db.query(func.count(models.RegistroMaestro.idd)).scalar() or 0

    return {
        "items": serialized_items,
        "page": page,
        "page_size": page_size,
        "total_filtered": total_filtered,
        "total_pages": total_pages,
        "total_global": total_global,
        "kpis": {
            "total_page_records": len(serialized_items),
            "total_anomalies_page": total_anomalies_page
        }
    }

@router.get("/stats")
def get_ensayos_stats(db: Session = Depends(get_db)):
    tot = db.query(func.count(models.RegistroMaestro.idd)).scalar() or 0
    ucs = db.query(func.count(models.RegistroMaestro.idd)).filter(
        or_(models.RegistroMaestro.tipo_ensayo.ilike("%ucs%"), models.RegistroMaestro.ucs_resistencia.isnot(None), models.RegistroMaestro.ucs_diametro.isnot(None))
    ).scalar() or 0
    elas = db.query(func.count(models.RegistroMaestro.idd)).filter(
        or_(models.RegistroMaestro.tipo_ensayo.ilike("%elastic%"), models.RegistroMaestro.elasticas_modulo_young.isnot(None))
    ).scalar() or 0
    trac = db.query(func.count(models.RegistroMaestro.idd)).filter(
        or_(models.RegistroMaestro.tipo_ensayo.ilike("%traccion%"), models.RegistroMaestro.tipo_ensayo.ilike("%brasil%"), models.RegistroMaestro.traccion_resistencia_mpa.isnot(None))
    ).scalar() or 0
    corte = db.query(func.count(models.RegistroMaestro.idd)).filter(
        or_(models.RegistroMaestro.tipo_ensayo.ilike("%corte%"), models.RegistroMaestro.corte_cohesion_mpa.isnot(None), models.RegistroMaestro.corte_area.isnot(None))
    ).scalar() or 0
    triax = db.query(func.count(models.RegistroMaestro.idd)).filter(
        or_(models.RegistroMaestro.tipo_ensayo.ilike("%triaxial%"), models.RegistroMaestro.triaxial_esfuerzo_maximo.isnot(None))
    ).scalar() or 0
    prop = db.query(func.count(models.RegistroMaestro.idd)).filter(
        models.RegistroMaestro.prop_peso_unitario_geometrico.isnot(None)
    ).scalar() or 0

    recent_rows = db.query(models.RegistroMaestro).order_by(models.RegistroMaestro.idd.desc()).limit(5).all()
    recent = [{col.name: getattr(r, col.name) for col in r.__table__.columns} for r in recent_rows]

    return {
        "total": tot,
        "counts": {
            "ucs": ucs,
            "elasticas": elas,
            "traccion": trac,
            "corte": corte,
            "triaxial": triax,
            "propiedades": prop
        },
        "recent": recent
    }

@router.get("/sondajes", response_model=List[str])
def get_sondajes_list(db: Session = Depends(get_db)):
    results = db.query(models.RegistroMaestro.sondaje).distinct().all()
    return sorted([r[0] for r in results if r[0]])

@router.get("/campanias", response_model=List[str])
def get_campanias_list(db: Session = Depends(get_db)):
    results = db.query(models.RegistroMaestro.campana).distinct().all()
    return sorted([str(r[0]).strip() for r in results if r[0]])

@router.get("/export-excel")
def export_excel_filtered(
    q: Optional[str] = None,
    tipo_ensayo: Optional[str] = None,
    proyecto: Optional[str] = None,
    campana: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.RegistroMaestro)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(or_(models.RegistroMaestro.sondaje.ilike(term), models.RegistroMaestro.codigo_muestra.ilike(term)))
    if proyecto and proyecto.strip():
        query = query.filter(models.RegistroMaestro.proyecto.ilike(f"%{proyecto.strip()}%"))
    if campana and campana.strip():
        query = query.filter(models.RegistroMaestro.campana.ilike(f"%{campana.strip()}%"))

    items = query.order_by(models.RegistroMaestro.idd.asc()).all()
    records_list = [{col.name: getattr(it, col.name) for col in it.__table__.columns} for it in items]
    
    excel_stream = export_ensayos_to_excel(records_list, title_desc="Exportación Filtrada")
    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Ensayos_Especiales_Exportacion.xlsx"}
    )

@router.get("/{idd}", response_model=schemas.RegistroMaestroResponse)
def get_ensayo_by_idd(idd: int, db: Session = Depends(get_db)):
    item = db.query(models.RegistroMaestro).filter_by(idd=idd).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"Ensayo con IDD {idd} no encontrado.")
    return item

@router.post("/batch-upsert")
def batch_upsert_ensayos(
    payload: List[Dict[str, Any]],
    db: Session = Depends(get_db)
):
    """
    UPSERT Transaccional Seguro:
    Inserta o actualiza únicamente los registros enviados en la carga sin tocar ni borrar
    el resto de filas de la base de datos (eliminación total de DELETE FROM registro_maestro).
    """
    if not payload:
        return {"status": "success", "upserted_count": 0}

    valid_cols = {col.name for col in models.RegistroMaestro.__table__.columns}
    upserted_count = 0

    try:
        # Procesar en lotes de 500 para respetar el límite de 2100 parámetros de SQL Server
        chunk_size = 500
        for i in range(0, len(payload), chunk_size):
            chunk = payload[i:i + chunk_size]
            chunk_idds = [int(r["idd"]) for r in chunk if r.get("idd") is not None]
            
            existing_map = {}
            if chunk_idds:
                existing_rows = db.query(models.RegistroMaestro).filter(models.RegistroMaestro.idd.in_(chunk_idds)).all()
                existing_map = {row.idd: row for row in existing_rows}

            for row_dict in chunk:
                idd = row_dict.get("idd")
                if idd is None:
                    continue
                try:
                    idd = int(idd)
                except (ValueError, TypeError):
                    continue

                cleaned = {}
                for col in valid_cols:
                    if col in row_dict:
                        val = row_dict[col]
                        val = clamp_value(col, val)
                        cleaned[col] = val

                cleaned["idd"] = idd
                cleaned = calculate_derived_fields(cleaned)

                if idd in existing_map:
                    existing_item = existing_map[idd]
                    for k, v in cleaned.items():
                        setattr(existing_item, k, v)
                else:
                    new_item = models.RegistroMaestro(**cleaned)
                    db.add(new_item)
                    existing_map[idd] = new_item

                upserted_count += 1

            db.flush()

        db.commit()
        return {"status": "success", "upserted_count": upserted_count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Fallo en batch upsert de ensayos: {e}")

@router.post("/batch-delete")
def batch_delete_ensayos(
    idds: List[int],
    db: Session = Depends(get_db)
):
    """
    Eliminación masiva por lote de registros específicos por su IDD.
    Maneja partición en lotes de 500 para SQL Server.
    """
    if not idds:
        return {"status": "success", "deleted_count": 0}

    try:
        deleted_count = 0
        chunk_size = 500
        for i in range(0, len(idds), chunk_size):
            chunk = idds[i:i + chunk_size]
            count = db.query(models.RegistroMaestro).filter(
                models.RegistroMaestro.idd.in_(chunk)
            ).delete(synchronize_session=False)
            deleted_count += count
        db.commit()
        return {"status": "success", "deleted_count": deleted_count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Fallo al eliminar registros por lote: {e}")

@router.post("/clear-all")
def clear_all_ensayos(
    db: Session = Depends(get_db)
):
    """
    Eliminación total de todos los registros de Ensayos Especiales (registro_maestro).
    Diseñado para pruebas y restablecimiento limpio de importaciones.
    """
    try:
        deleted_count = db.query(models.RegistroMaestro).delete(synchronize_session=False)
        db.commit()
        return {"status": "success", "deleted_count": deleted_count, "message": f"Se eliminaron {deleted_count} registros."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Fallo al vaciar la tabla de ensayos: {e}")

@router.put("/{idd}", response_model=schemas.RegistroMaestroResponse)
def update_single_ensayo(idd: int, data: Dict[str, Any], db: Session = Depends(get_db)):
    item = db.query(models.RegistroMaestro).filter_by(idd=idd).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"Ensayo con IDD {idd} no encontrado.")

    valid_cols = {col.name for col in models.RegistroMaestro.__table__.columns}

    # 1. Aplicar cambios a los campos enviados con clamping
    for k, v in data.items():
        if k in valid_cols and k != "idd":
            setattr(item, k, clamp_value(k, v))

    # 2. Recalcular campos derivados sobre el registro combinado (evita borrar campos no enviados)
    current_state = {col.name: getattr(item, col.name) for col in models.RegistroMaestro.__table__.columns}
    recalculated = calculate_derived_fields(current_state)
    for derived_col in ["longitud_muestra", "corte_esf_normal_mpa", "corte_esf_corte_mpa", "ucs_resistencia_calculada"]:
        if derived_col in recalculated:
            setattr(item, derived_col, recalculated[derived_col])

    db.commit()
    db.refresh(item)
    return item

@router.delete("/{idd}")
def delete_single_ensayo(idd: int, db: Session = Depends(get_db)):
    item = db.query(models.RegistroMaestro).filter_by(idd=idd).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"Ensayo con IDD {idd} no encontrado.")
    db.delete(item)
    db.commit()
    return {"status": "success", "message": f"Ensayo {idd} eliminado correctamente."}
