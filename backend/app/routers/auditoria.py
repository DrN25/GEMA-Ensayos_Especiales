# -*- coding: utf-8 -*-
"""
app/routers/auditoria.py — Motor de Auditoría QA/QC Masiva para Ensayos Especiales (GEMA).
Permite evaluar libros Excel completos (ej. ENSAYOS_ESPECIALES.xlsx con 9,820 filas),
detectar desviaciones geotécnicas y generar reportes ejecutivos.
"""
import os
import io
import json
import uuid
import openpyxl
from datetime import datetime
from collections import defaultdict, Counter
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.core.rules import COLUMNS_CONFIG, DB_NAME_MAP, EXCEL_NAME_MAP, calculate_derived_fields, clamp_value, validate_record_qaqc
from app.services.excel_exporter import export_ensayos_to_excel

router = APIRouter(prefix="/api/auditoria", tags=["Auditoría QA/QC Ensayos Especiales"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AUDIT_UPLOADS = os.path.join(BASE_DIR, "uploads", "auditoria_history")
os.makedirs(AUDIT_UPLOADS, exist_ok=True)

# Cache en memoria de la última auditoría
_LATEST_AUDIT_DATA: Dict[str, Any] = {}

def _save_audit_snapshot(audit_id: str, diag: Dict[str, Any]):
    path = os.path.join(AUDIT_UPLOADS, f"{audit_id}_diag.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(diag, f, ensure_ascii=False)
    latest_path = os.path.join(AUDIT_UPLOADS, "latest_diag.json")
    try:
        with open(latest_path, "w", encoding="utf-8") as f:
            json.dump(diag, f, ensure_ascii=False)
    except Exception:
        pass

def _get_audit_diag(audit_id: Optional[str] = None) -> Dict[str, Any]:
    key = audit_id or "latest"
    diag = _LATEST_AUDIT_DATA.get(key)
    if diag:
        return diag

    if audit_id and audit_id != "latest":
        path = os.path.join(AUDIT_UPLOADS, f"{audit_id}_diag.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                _LATEST_AUDIT_DATA[audit_id] = loaded
                return loaded
    else:
        latest_path = os.path.join(AUDIT_UPLOADS, "latest_diag.json")
        if os.path.exists(latest_path):
            with open(latest_path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                _LATEST_AUDIT_DATA["latest"] = loaded
                return loaded
        files = sorted([f for f in os.listdir(AUDIT_UPLOADS) if f.endswith("_diag.json")], reverse=True)
        if files:
            with open(os.path.join(AUDIT_UPLOADS, files[0]), "r", encoding="utf-8") as f:
                loaded = json.load(f)
                _LATEST_AUDIT_DATA["latest"] = loaded
                return loaded

    raise HTTPException(status_code=404, detail="No hay auditorías registradas.")

@router.post("/importar-excel-bulk")
async def audit_excel_bulk(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """Procesa e inspecciona un libro de Ensayos Especiales completo generando diagnóstico QA/QC."""
    contents = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo Excel: {e}")

    sheet_name = "Base_Datos (2)" if "Base_Datos (2)" in wb.sheetnames else wb.sheetnames[0]
    ws = wb[sheet_name]

    # Identificar fila de encabezados (buscar fila con IDD o Sondaje)
    header_row = 2
    headers = {}
    for r in range(1, min(10, ws.max_row + 1)):
        row_vals = [str(ws.cell(row=r, column=c).value or "").strip() for c in range(1, ws.max_column + 1)]
        if any("sondaje" in v.lower() or "idd" in v.lower() for v in row_vals):
            header_row = r
            for col_idx in range(1, ws.max_column + 1):
                v = str(ws.cell(row=header_row, column=col_idx).value or "").strip()
                if v:
                    headers[v.lower().replace("\n", " ")] = col_idx
            break

    # Mapear columnas a db_name
    col_mapping = {}
    for col in COLUMNS_CONFIG:
        db_name = col["db_name"]
        excel_name = col["excel_name"].lower().replace("\n", " ").strip()
        matched = headers.get(excel_name)
        if matched is None:
            # Búsqueda difusa por palabras clave
            for h_text, idx in headers.items():
                if excel_name in h_text or h_text in excel_name:
                    matched = idx
                    break
        col_mapping[db_name] = matched

    parsed_rows = []
    anomalies = []
    campaign_counter = Counter()
    tipo_counter = Counter()
    dh_counter = Counter()
    dh_error_counter = Counter()

    row_index = 0
    for r_idx in range(header_row + 1, ws.max_row + 1):
        # Leer valor IDD o primera columna para saber si está vacía
        idd_col = col_mapping.get("idd") or 1
        raw_idd = ws.cell(row=r_idx, column=idd_col).value
        sondaje_col = col_mapping.get("sondaje") or 2
        raw_sondaje = ws.cell(row=r_idx, column=sondaje_col).value

        if raw_idd is None and raw_sondaje is None:
            continue

        row_index += 1
        row_dict = {}
        for db_name, c_idx in col_mapping.items():
            if c_idx is not None:
                val = ws.cell(row=r_idx, column=c_idx).value
                row_dict[db_name] = clamp_value(db_name, val)
            else:
                row_dict[db_name] = None

        if row_dict.get("idd") is None:
            row_dict["idd"] = row_index

        row_dict = calculate_derived_fields(row_dict)
        row_alerts = validate_record_qaqc(row_dict)

        camp = str(row_dict.get("campana") or "SIN CAMPAÑA").strip().upper()
        sond = str(row_dict.get("sondaje") or "SIN SONDAJE").strip().upper()
        tipo = str(row_dict.get("tipo_ensayo") or "SIN TIPO").strip().upper()

        campaign_counter[camp] += 1
        tipo_counter[tipo] += 1
        dh_counter[sond] += 1

        if row_alerts:
            dh_error_counter[sond] += len(row_alerts)
            for a in row_alerts:
                a["campana"] = camp
                a["row_index"] = row_index
                anomalies.append(a)

        parsed_rows.append(row_dict)

    audit_id = datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:6]
    total_rows = len(parsed_rows)
    invalid_rows = len(set(a["row_index"] for a in anomalies if a["severity"] == "CRÍTICO"))
    valid_rows = max(0, total_rows - invalid_rows)
    qi = round((valid_rows / max(1, total_rows)) * 100.0, 2)

    # Distribución por campaña
    dist_camp = []
    for camp, cnt in sorted(campaign_counter.items(), key=lambda x: x[0]):
        errs = sum(1 for a in anomalies if a.get("campana") == camp and a.get("severity") == "CRÍTICO")
        c_qi = round(max(0.0, (cnt - errs) / max(1, cnt) * 100.0), 2)
        dist_camp.append({
            "campania": camp,
            "total": cnt,
            "valid": cnt - errs,
            "invalid": errs,
            "calidad_pct": c_qi
        })

    # Top sondajes con incidencias
    worst_dh = []
    for dh, err_cnt in dh_error_counter.most_common(10):
        tot = dh_counter.get(dh, err_cnt)
        worst_dh.append({
            "sondaje": dh,
            "total_muestras": tot,
            "incidencias": err_cnt,
            "salud_pct": round(max(0.0, (tot - err_cnt) / max(1, tot) * 100.0), 2)
        })

    diag = {
        "audit_id": audit_id,
        "filename": file.filename,
        "timestamp": datetime.now().isoformat(),
        "total_rows": total_rows,
        "valid_rows": valid_rows,
        "invalid_rows": invalid_rows,
        "quality_index": qi,
        "total_anomalies": len(anomalies),
        "total_sondajes": len(dh_counter),
        "dist_camp": dist_camp,
        "dist_ensayo": [{"tipo": k, "total": v} for k, v in tipo_counter.most_common()],
        "worst_drillholes": worst_dh,
        "incidencias": anomalies,
        "rows": parsed_rows
    }

    _LATEST_AUDIT_DATA[audit_id] = diag
    _LATEST_AUDIT_DATA["latest"] = diag

    background_tasks.add_task(_save_audit_snapshot, audit_id, diag)

    return {
        "status": "success",
        "audit_id": audit_id,
        "total_rows": total_rows,
        "valid_rows": valid_rows,
        "invalid_rows": invalid_rows,
        "quality_index": qi,
        "total_anomalies": len(anomalies),
        "dist_camp": dist_camp,
        "worst_drillholes": worst_dh
    }

@router.get("/resumen-ligero")
def get_audit_summary(
    audit_id: Optional[str] = None,
    campania: Optional[str] = None
):
    diag = _get_audit_diag(audit_id)

    # Filtro de campaña si aplica
    if campania and campania.upper() != "TODAS":
        camps = [c.strip().upper() for c in campania.split(",") if c.strip()]
        filtered_rows = [r for r in diag["rows"] if str(r.get("campana", "")).strip().upper() in camps]
        filtered_anomalies = [a for a in diag["incidencias"] if str(a.get("campana", "")).strip().upper() in camps]
        tot = len(filtered_rows)
        inv = len(set(a["row_index"] for a in filtered_anomalies if a["severity"] == "CRÍTICO"))
        val = max(0, tot - inv)
        return {
            "audit_id": diag["audit_id"],
            "filename": diag.get("filename", "Planilla"),
            "total_rows": tot,
            "valid_rows": val,
            "invalid_rows": inv,
            "quality_index": round((val / max(1, tot)) * 100.0, 2) if tot > 0 else 100.0,
            "total_anomalies": len(filtered_anomalies),
            "dist_camp": [d for d in diag["dist_camp"] if d["campania"] in camps],
            "worst_drillholes": diag["worst_drillholes"]
        }

    return {
        "audit_id": diag["audit_id"],
        "filename": diag.get("filename", "Planilla"),
        "total_rows": diag["total_rows"],
        "valid_rows": diag["valid_rows"],
        "invalid_rows": diag["invalid_rows"],
        "quality_index": diag["quality_index"],
        "total_anomalies": diag["total_anomalies"],
        "dist_camp": diag["dist_camp"],
        "worst_drillholes": diag["worst_drillholes"]
    }

@router.get("/incidencias-paginadas")
def get_incidencias_paginated(
    audit_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    severity: Optional[str] = None,
    campania: Optional[str] = None,
    sondaje: Optional[str] = None
):
    diag = _get_audit_diag(audit_id)
    anoms = diag.get("incidencias", [])

    if severity:
        anoms = [a for a in anoms if a.get("severity") == severity]
    if campania and campania.upper() != "TODAS":
        camps = [c.strip().upper() for c in campania.split(",")]
        anoms = [a for a in anoms if str(a.get("campana", "")).strip().upper() in camps]
    if sondaje:
        term = sondaje.strip().upper()
        anoms = [a for a in anoms if term in str(a.get("sondaje", "")).upper()]

    total = len(anoms)
    start = (page - 1) * limit
    slice_items = anoms[start:start + limit]

    return {
        "total_items": total,
        "page": page,
        "limit": limit,
        "total_pages": max(1, (total + limit - 1) // limit),
        "items": slice_items
    }

@router.get("/kpis")
def get_audit_kpis(audit_id: Optional[str] = None):
    diag = _get_audit_diag(audit_id)
    if not diag:
        raise HTTPException(status_code=404, detail="Auditoría no encontrada")
    
    # Counter de campos afectados
    field_counter = Counter(a.get("field", a.get("campo", "general")) for a in diag.get("incidencias", []))
    top_fields = field_counter.most_common(10)

    return {
        "audit_id": diag["audit_id"],
        "filename": diag.get("filename", "Planilla"),
        "timestamp": diag.get("timestamp", datetime.now().isoformat()),
        "total_filas": diag.get("total_rows", 0),
        "total_observaciones": diag.get("total_anomalies", 0),
        "filas_con_observacion": diag.get("invalid_rows", 0),
        "filas_conformes": diag.get("valid_rows", 0),
        "tasa_calidad_pct": diag.get("quality_index", 100.0),
        "distribucion_severidad": {
            "CRITICO": sum(1 for a in diag.get("incidencias", []) if a.get("severity") == "CRÍTICO"),
            "ALERTA": sum(1 for a in diag.get("incidencias", []) if a.get("severity") != "CRÍTICO"),
        },
        "top_campos_afectados": top_fields,
        "dist_camp": diag.get("dist_camp", []),
        "worst_drillholes": diag.get("worst_drillholes", [])
    }

@router.get("/status/{audit_id}")
def get_audit_status(audit_id: str):
    diag = _get_audit_diag(audit_id)
    if not diag:
        return {"status": "processing", "audit_id": audit_id}
    return {
        "status": "completed",
        "audit_id": audit_id,
        "filename": diag.get("filename", "Planilla"),
        "total_rows": diag.get("total_rows", 0)
    }

@router.get("/history")
def get_audit_history():
    history = []
    if os.path.exists(AUDIT_UPLOADS):
        files = [f for f in os.listdir(AUDIT_UPLOADS) if f.endswith("_diag.json") and f != "latest_diag.json"]
        for f in sorted(files, reverse=True)[:20]:
            fp = os.path.join(AUDIT_UPLOADS, f)
            try:
                with open(fp, "r", encoding="utf-8") as jf:
                    d = json.load(jf)
                    history.append({
                        "audit_id": d.get("audit_id"),
                        "filename": d.get("filename", f),
                        "timestamp": d.get("timestamp", datetime.fromtimestamp(os.path.getmtime(fp)).isoformat()),
                        "total_filas": d.get("total_rows", 0),
                        "total_observaciones": d.get("total_anomalies", 0),
                    })
            except Exception:
                continue
    return {"history": history}

# Aliases de compatibilidad
@router.get("/incidencias")
def get_incidencias_alias(
    audit_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    severity: Optional[str] = None,
    campania: Optional[str] = None,
    sondaje: Optional[str] = None,
    q: Optional[str] = None,
    tipo: Optional[str] = None,
    campo: Optional[str] = None
):
    sev = severity or tipo
    sond = sondaje or q
    diag = _get_audit_diag(audit_id)
    anoms = diag.get("incidencias", [])

    if sev:
        anoms = [a for a in anoms if str(a.get("severity", "")).upper() == str(sev).upper() or str(a.get("tipo_error", "")).upper() == str(sev).upper()]
    if campania and campania.upper() != "TODAS":
        camps = [c.strip().upper() for c in campania.split(",")]
        anoms = [a for a in anoms if str(a.get("campana", "")).strip().upper() in camps]
    if sond:
        term = str(sond).strip().upper()
        anoms = [a for a in anoms if term in str(a.get("sondaje", "")).upper() or term in str(a.get("codigo_muestra", "")).upper()]
    if campo:
        anoms = [a for a in anoms if a.get("field") == campo or a.get("campo") == campo]

    # Mapear a claves esperadas por frontend si es necesario
    formatted = []
    for a in anoms:
        formatted.append({
            "fila_excel": a.get("row_index", 0),
            "sondaje": a.get("sondaje", ""),
            "codigo_muestra": a.get("codigo_muestra", ""),
            "campo": a.get("field", a.get("campo", "")),
            "columna_letra": a.get("colLetter", a.get("columna_letra", "")),
            "valor_actual": a.get("val", a.get("valor_actual", "")),
            "tipo_error": a.get("severity", a.get("tipo_error", "ALERTA")),
            "mensaje": a.get("msg", a.get("mensaje", "")),
            "sugerencia": a.get("suggestion", a.get("sugerencia", ""))
        })

    total = len(formatted)
    start = (page - 1) * limit
    slice_items = formatted[start:start + limit]

    return {
        "total": total,
        "total_items": total,
        "page": page,
        "limit": limit,
        "total_pages": max(1, (total + limit - 1) // limit),
        "items": slice_items
    }

@router.get("/export-excel")
def export_excel_alias(audit_id: Optional[str] = None):
    return download_audit_excel(audit_id)

@router.post("/apply-sync")
def apply_sync_alias(payload: Dict[str, Any] = None, db: Session = Depends(get_db)):
    audit_id = payload.get("audit_id") if payload else None
    return apply_audit_to_db(audit_id, db)

