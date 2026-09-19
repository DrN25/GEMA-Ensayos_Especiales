# -*- coding: utf-8 -*-
import os
import io
import math
import openpyxl
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from typing import List, Dict, Any, Optional
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from app.database import get_db, Base, engine, auto_heal_schema
from app import models, schemas
from app.config.columns_config import COLUMNS_CONFIG, DB_NAME_MAP

app = FastAPI(title="Ensayos Especiales (SIGEG) API", version="2.0")

# 1. CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Middleware de Acceso a Red Privada (LNA/PNA) para evitar advertencias de Cloudflare
@app.middleware("http")
async def add_private_network_cors_headers(request: Request, call_next):
    if request.method == "OPTIONS":
        response = await call_next(request)
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Access-Control-Allow-Private-Network"
        return response
    
    response = await call_next(request)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response

# 3. Inicializador del Servidor
@app.on_event("startup")
def startup_db():
    try:
        Base.metadata.create_all(bind=engine)
        auto_heal_schema(engine)
        print("Tablas de base de datos creadas/verificadas con éxito.")
    except Exception as e:
        print(f"Error al inicializar la base de datos: {e}")

# Helper: Única columna autocalculada es Longitud de Muestra
def calculate_derived_fields(row: Dict[str, Any]) -> Dict[str, Any]:
    try:
        desde = float(row.get("desde")) if row.get("desde") is not None else None
        hasta = float(row.get("hasta")) if row.get("hasta") is not None else None
        if desde is not None and hasta is not None:
            row["longitud_muestra"] = round(hasta - desde, 4)
        else:
            row["longitud_muestra"] = None
    except (ValueError, TypeError):
        row["longitud_muestra"] = None
    return row

# Ayudante de Clamping en Backend: Corrige de forma activa valores que excedan límites en el Excel
def clamp_imported_value(db_name: str, val: Any) -> Any:
    if val is None or val == "":
        return None
    
    col_conf = next((c for c in COLUMNS_CONFIG if c["db_name"] == db_name), None)
    if not col_conf:
        return val
        
    val_type = col_conf["type"]
    validation = col_conf.get("validation")
    
    if val_type in ["int", "float"]:
        try:
            num_val = float(str(val).replace(",", ".").replace(" ", ""))
            if validation:
                if "min" in validation and num_val < validation["min"]:
                    num_val = validation["min"]
                if "max" in validation and num_val > validation["max"]:
                    num_val = validation["max"]
            
            if val_type == "int":
                return int(round(num_val))
            return round(num_val, 4)
        except (ValueError, TypeError):
            return None
            
    return str(val).strip()

# --- ENDPOINTS MAESTROS DE PROYECTOS ---

@app.get("/api/proyectos", response_model=List[schemas.ProyectoResponse])
def get_proyectos(db: Session = Depends(get_db)):
    return db.query(models.Proyecto).all()

@app.post("/api/proyectos")
def save_proyectos(data: List[schemas.ProyectoBase], db: Session = Depends(get_db)):
    try:
        existing_projs = {p.id: p for p in db.query(models.Proyecto).all() if p.id is not None}
        incoming_ids = set()
        
        for p in data:
            if p.id is not None and p.id in existing_projs:
                row = existing_projs[p.id]
                old_name = row.nombre
                new_name = p.nombre
                
                # CASCADE UPDATE: Renombrado interactivo de registros
                if old_name != new_name:
                    print(f"Cascade: Actualizando proyecto '{old_name}' a '{new_name}' en registros geotécnicos...")
                    db.query(models.RegistroMaestro).filter(models.RegistroMaestro.proyecto == old_name).update(
                        {models.RegistroMaestro.proyecto: new_name}, synchronize_session=False
                    )
                
                row.nombre = new_name
                row.sinonimos = p.sinonimos
                incoming_ids.add(p.id)
            else:
                db.add(models.Proyecto(nombre=p.nombre, sinonimos=p.sinonimos))
                
        # CASCADE DELETE: Limpieza de eliminados
        for pid, p_obj in existing_projs.items():
            if pid not in incoming_ids:
                deleted_name = p_obj.nombre
                print(f"Cascade: Eliminando proyecto '{deleted_name}' y limpiando registros huérfanos...")
                db.query(models.RegistroMaestro).filter(models.RegistroMaestro.proyecto == deleted_name).update(
                    {models.RegistroMaestro.proyecto: None}, synchronize_session=False
                )
                db.delete(p_obj)
                
        db.commit()
        return {"status": "success", "message": "Proyectos guardados y sincronizados en cascada con éxito."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar proyectos: {e}")

# --- ENDPOINT DE ESTADO DE CONEXIÓN DE BASE DE DATOS ---

@app.get("/api/db-status")
def get_db_status(db: Session = Depends(get_db)):
    bind_engine = db.get_bind()
    url_str = str(bind_engine.url)
    
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

# --- ENDPOINTS GENERALES DE REGISTROS ---

@app.get("/api/registros")
def get_registros(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1),
    tipo_ensayo: Optional[str] = None,
    sondaje: Optional[str] = None,
    codigo_muestra: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.RegistroMaestro)
    
    # Aplicar filtros
    if tipo_ensayo:
        if tipo_ensayo.lower() == "prop_fisicas":
            query = query.filter(models.RegistroMaestro.prop_peso_unitario_geometrico.isnot(None))
        else:
            query = query.filter(models.RegistroMaestro.tipo_ensayo.ilike(tipo_ensayo))
            
    if sondaje:
        query = query.filter(models.RegistroMaestro.sondaje.ilike(f"%{sondaje}%"))
        
    if codigo_muestra:
        query = query.filter(models.RegistroMaestro.codigo_muestra.ilike(f"%{codigo_muestra}%"))
        
    total = query.count()
    items = query.order_by(models.RegistroMaestro.idd).offset((page - 1) * limit).limit(limit).all()
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": items
    }

@app.get("/api/registros/search-sondajes")
def get_sondajes_list(db: Session = Depends(get_db)):
    results = db.query(models.RegistroMaestro.sondaje).distinct().all()
    sondajes = [r[0] for r in results if r[0]]
    return sorted(sondajes)

@app.get("/api/registros/{idd}", response_model=schemas.RegistroMaestroResponse)
def get_registro(idd: int, db: Session = Depends(get_db)):
    item = db.query(models.RegistroMaestro).filter_by(idd=idd).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"Registro con IDD {idd} no encontrado.")
    return item

@app.post("/api/registros", response_model=schemas.RegistroMaestroResponse)
def create_registro(data: schemas.RegistroMaestroCreate, db: Session = Depends(get_db)):
    existing = db.query(models.RegistroMaestro).filter_by(idd=data.idd).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"El IDD {data.idd} ya está en uso.")
        
    data_dict = data.model_dump()
    data_dict = calculate_derived_fields(data_dict)
    
    item = models.RegistroMaestro(**data_dict)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@app.put("/api/registros/{idd}", response_model=schemas.RegistroMaestroResponse)
def update_registro(idd: int, data: schemas.RegistroMaestroUpdate, db: Session = Depends(get_db)):
    item = db.query(models.RegistroMaestro).filter_by(idd=idd).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"Registro con IDD {idd} no encontrado.")
        
    data_dict = data.model_dump(exclude_unset=True)
    current_dict = {col.name: getattr(item, col.name) for col in item.__table__.columns}
    current_dict.update(data_dict)
    
    current_dict = calculate_derived_fields(current_dict)
    
    for key, value in current_dict.items():
        setattr(item, key, value)
        
    db.commit()
    db.refresh(item)
    return item

@app.delete("/api/registros/{idd}")
def delete_registro(idd: int, db: Session = Depends(get_db)):
    item = db.query(models.RegistroMaestro).filter_by(idd=idd).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"Registro con IDD {idd} no encontrado.")
    db.delete(item)
    db.commit()
    return {"status": "success", "message": f"Registro con IDD {idd} eliminado correctamente."}

@app.post("/api/clear-db")
def clear_database(db: Session = Depends(get_db)):
    try:
        db.query(models.RegistroMaestro).delete()
        db.commit()
        return {"status": "success", "message": "Base de datos reiniciada correctamente."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al limpiar la base de datos: {e}")

# --- DASHBOARD SUMMARY ENDPOINT ---

@app.get("/api/dashboard-summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    counts = db.query(
        models.RegistroMaestro.tipo_ensayo, 
        func.count(models.RegistroMaestro.idd)
    ).group_by(models.RegistroMaestro.tipo_ensayo).all()
    
    summary_dict = {
        "corte_directo": 0,
        "triaxial": 0,
        "elasticas": 0,
        "traccion": 0,
        "ucs": 0,
        "prop_fisicas": 0,
        "total": 0
    }
    
    for tipo, count in counts:
        if not tipo:
            continue
        tipo_lower = tipo.lower()
        if "corte directo" in tipo_lower:
            summary_dict["corte_directo"] += count
        elif "triaxial" in tipo_lower:
            summary_dict["triaxial"] += count
        elif "constantes" in tipo_lower:
            summary_dict["elasticas"] += count
        elif "tracci" in tipo_lower:
            summary_dict["traccion"] += count
        elif "ucs" in tipo_lower:
            summary_dict["ucs"] += count
        summary_dict["total"] += count
            
    summary_dict["prop_fisicas"] = db.query(models.RegistroMaestro).filter(
        models.RegistroMaestro.prop_peso_unitario_geometrico.isnot(None)
    ).count()
    
    total_alertas = 0
    total_validados = 0
    
    all_items = db.query(models.RegistroMaestro).all()
    for item in all_items:
        has_alert = False
        if item.desde is not None and item.hasta is not None and item.desde >= item.hasta:
            has_alert = True
        if item.prop_peso_unitario_geometrico is not None and (item.prop_peso_unitario_geometrico < 1.0 or item.prop_peso_unitario_geometrico > 4.0):
            has_alert = True
        if item.elasticas_poisson is not None and (item.elasticas_poisson < 0.05 or item.elasticas_poisson > 0.45):
            has_alert = True
            
        if has_alert:
            total_alertas += 1
        else:
            total_validados += 1
            
    summary_dict["alertas_count"] = total_alertas
    summary_dict["validados_count"] = total_validados
    
    return summary_dict

# --- IMPORTACIÓN MASIVA DE REGISTROS CON MAPEO SEGURO ---

@app.post("/api/import-excel")
async def import_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        contents = await file.read()
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
        
        if "Base_Datos (2)" not in wb.sheetnames:
            raise HTTPException(
                status_code=400, 
                detail="El archivo no contiene la pestaña obligatoria 'Base_Datos (2)'."
            )
            
        ws = wb["Base_Datos (2)"]
        headers_row = 2
        headers = {}
        for col_idx in range(1, ws.max_column + 1):
            val = ws.cell(row=headers_row, column=col_idx).value
            if val:
                headers[str(val).strip()] = col_idx

        col_mappings = {}
        for col in COLUMNS_CONFIG:
            excel_name = col["excel_name"]
            
            # MAPEO SEGURO: Si no coincide por texto, lo dejamos como None (Sin selección para evitar datos erróneos)
            matched_idx = None
            for h_name, idx in headers.items():
                if h_name.lower().replace("\n", " ").replace(" ", "") == excel_name.lower().replace("\n", " ").replace(" ", ""):
                    matched_idx = idx
                    break
                
            col_mappings[col["db_name"]] = matched_idx

        records_to_insert = []
        imported_count = 0
        skipped_count = 0
        
        for r_idx in range(3, ws.max_row + 1):
            idd_val = ws.cell(row=r_idx, column=col_mappings.get("idd") if col_mappings.get("idd") else 1).value
            if idd_val is None:
                continue
                
            try:
                idd = int(idd_val)
            except (ValueError, TypeError):
                skipped_count += 1
                continue
                
            row_dict = {}
            for col in COLUMNS_CONFIG:
                db_name = col["db_name"]
                c_idx = col_mappings.get(db_name)
                
                # Si no se mapeó la columna, asignamos None directamente sin cometer errores
                if c_idx is None:
                    row_dict[db_name] = None
                    continue
                    
                val = ws.cell(row=r_idx, column=c_idx).value
                
                # CLAMPING EN INGESTA: Aplicar límites en caliente desde el backend
                row_dict[db_name] = clamp_imported_value(db_name, val)
            
            row_dict["idd"] = idd
            row_dict = calculate_derived_fields(row_dict)
            records_to_insert.append(row_dict)
            imported_count += 1

        for data_dict in records_to_insert:
            existing = db.query(models.RegistroMaestro).filter_by(idd=data_dict["idd"]).first()
            if existing:
                for k, v in data_dict.items():
                    setattr(existing, k, v)
            else:
                db.add(models.RegistroMaestro(**data_dict))
                
        db.commit()
        return {
            "status": "success", 
            "message": f"Importación completada. {imported_count} registros importados, {skipped_count} omitidos."
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error durante la importación: {e}")

# --- EXPORTACIÓN DE REGISTROS A EXCEL ---

@app.post("/api/export-excel")
def export_excel(
    tipo_ensayo: Optional[str] = None,
    sondaje: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.RegistroMaestro)
        if tipo_ensayo:
            if tipo_ensayo.lower() == "prop_fisicas":
                query = query.filter(models.RegistroMaestro.prop_peso_unitario_geometrico.isnot(None))
            else:
                query = query.filter(models.RegistroMaestro.tipo_ensayo.ilike(tipo_ensayo))
        if sondaje:
            query = query.filter(models.RegistroMaestro.sondaje.ilike(f"%{sondaje}%"))
            
        items = query.order_by(models.RegistroMaestro.idd).all()
        
        wb = openpyxl.Workbook()
        default_sheet = wb.active
        wb.remove(default_sheet)
        ws = wb.create_sheet(title="Base_Datos (2)")
        
        font_header_1 = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        font_header_2 = Font(name="Calibri", size=10, bold=True, color="000000")
        fill_header_1 = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
        fill_header_2 = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")
        align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
        border_thin = Border(
            left=Side(style='thin', color='BFBFBF'),
            right=Side(style='thin', color='BFBFBF'),
            top=Side(style='thin', color='BFBFBF'),
            bottom=Side(style='thin', color='BFBFBF')
        )
        
        ws.row_dimensions[1].height = 25
        ws.row_dimensions[2].height = 30
        
        group_definitions = [
            ("Fecha de ensayo", "F", "H"),
            ("Profundidad (m)", "J", "K"),
            ("Coordenadas", "M", "O"),
            ("Litologia", "Q", "S"),
            ("Compresión Uniaxial", "U", "Y"),
            ("Constantes Elásticas", "Z", "AA"),
            ("Tracción Indirecta", "AB", "AE"),
            ("Corte Directo", "AF", "AM"),
            ("Compresión Triaxial", "AN", "AT"),
            ("Prop físicas", "AU", "AU")
        ]
        
        for col in COLUMNS_CONFIG:
            cell = ws.cell(row=1, column=col["index"])
            cell.fill = fill_header_1
            cell.font = font_header_1
            cell.alignment = align_center
            
        for label, start_letter, end_letter in group_definitions:
            start_idx = openpyxl.utils.column_index_from_string(start_letter)
            end_idx = openpyxl.utils.column_index_from_string(end_letter)
            ws.cell(row=1, column=start_idx, value=label)
            if start_idx != end_idx:
                ws.merge_cells(start_row=1, start_column=start_idx, end_row=1, end_column=end_idx)
                
        for col in COLUMNS_CONFIG:
            cell = ws.cell(row=2, column=col["index"], value=col["excel_name"])
            cell.fill = fill_header_2
            cell.font = font_header_2
            cell.alignment = align_center
            cell.border = border_thin
            
        for r_idx, item in enumerate(items, start=3):
            ws.row_dimensions[r_idx].height = 20
            for col in COLUMNS_CONFIG:
                db_name = col["db_name"]
                val = getattr(item, db_name)
                
                if db_name == "longitud_muestra":
                    cell = ws.cell(row=r_idx, column=col["index"], value=f"=K{r_idx}-J{r_idx}")
                else:
                    cell = ws.cell(row=r_idx, column=col["index"], value=val)
                    
                cell.border = border_thin
                
        for col in ws.columns:
            max_len = 0
            for cell in col:
                val_str = str(cell.value or '')
                if len(val_str) > max_len:
                    max_len = len(val_str)
            col_letter = openpyxl.utils.get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 12)
            
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        return StreamingResponse(
            output, 
            headers={'Content-Disposition': 'attachment; filename="Exportacion_Ensayos_Especiales.xlsx"'}, 
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error durante la exportación a Excel: {e}")

# --- GUARDA DE REGISTROS MASIVOS (Sincronización) ---

@app.post("/api/records/bulk")
def bulk_save_records(data: List[Dict[str, Any]], db: Session = Depends(get_db)):
    try:
        db.query(models.RegistroMaestro).delete()
        db.flush()
        
        valid_cols = {col.name for col in models.RegistroMaestro.__table__.columns}
        
        for r in data:
            idd_val = r.get("idd")
            if idd_val is None or idd_val == "":
                continue
                
            try:
                idd = int(idd_val)
            except (ValueError, TypeError):
                continue
                
            cleaned_row = {}
            for col_name in valid_cols:
                val = r.get(col_name)
                cleaned_row[col_name] = None if (val == "" or val is None) else val
            
            cleaned_row["idd"] = idd
            cleaned_row = calculate_derived_fields(cleaned_row)
            db_row = models.RegistroMaestro(**cleaned_row)
            db.add(db_row)
            
        db.commit()
        return {"status": "success", "message": f"Sincronizados {len(data)} registros con SQL Server."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al sincronizar con SQL Server: {e}")