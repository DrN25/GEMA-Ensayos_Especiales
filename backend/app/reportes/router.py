import json
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from tempfile import SpooledTemporaryFile
from threading import BoundedSemaphore
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool
from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import case, Date, DateTime, Integer, String, Unicode, UnicodeText, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from app.auth.models import User
from app.auth.router import TEST_ACCESS, TEST_USER, TestUser, work_user
from app.database import get_db
from app.models import RegistroMaestro
from app.reportes.plantillas.comunes.preparar_campos import NOMBRES_PROYECTO, preparar_campos
from app.reportes import images
from app.reportes.image_storage import BLOCK_SIZE, MAX_IMAGE_BYTES, MAX_IMAGE_SIDE


router = APIRouter(prefix="/api/reportes", tags=["Reportes de ensayos"])
maestro = RegistroMaestro


@dataclass(frozen=True)
class ReportFormat:
    version: str
    template: str
    abbreviation: str
    search_label: str
    result_fields: tuple[str, ...]
    photo_folder: str | None = None


FORMATS = {
    "ucs": ReportFormat(
        "ucs-v1", "ensayos/ucs.html", "UCS", "Compresión uniaxial (UCS)",
        ("ucs_diametro", "ucs_carga_rotura", "ucs_resistencia", "ucs_resistencia_calculada", "ucs_rotura"),
    ),
    "corte directo": ReportFormat(
        "corte-directo-v1", "ensayos/corte-directo.html", "CD", "Corte directo",
        (
            "corte_tipo_fractura", "corte_area", "corte_esf_normal_kpa", "corte_esf_corte_kpa",
            "corte_esf_normal_mpa", "corte_esf_corte_mpa", "corte_cohesion_mpa", "corte_angulo_friccion",
        ),
        photo_folder="corte-directo",
    ),
    "compresión triaxial": ReportFormat(
        "compresion-triaxial-v1", "ensayos/compresion-triaxial.html", "TX", "Compresión triaxial",
        (
            "triaxial_carga_confinamiento", "triaxial_esfuerzo_maximo", "triaxial_resistencia_mpa", "triaxial_mi",
            "triaxial_cohesion_mpa", "triaxial_angulo_friccion", "triaxial_rotura",
        ),
        photo_folder="compresion-triaxial",
    ),
    "tracción indirecta": ReportFormat(
        "traccion-indirecta-v1", "ensayos/traccion-indirecta.html", "TI", "Tracción indirecta",
        ("traccion_carga_promedio", "traccion_resistencia_kgcm2", "traccion_vacia_28", "traccion_resistencia_mpa"),
        photo_folder="traccion-indirecta",
    ),
    "determinación de constantes elásticas": ReportFormat(
        "constantes-elasticas-v1", "ensayos/constantes-elasticas.html", "CE", "Determinación de constantes elásticas",
        (
            "ucs_diametro", "ucs_carga_rotura", "ucs_resistencia", "ucs_resistencia_calculada", "ucs_rotura",
            "elasticas_modulo_young", "elasticas_poisson",
        ),
        photo_folder="constantes-elasticas",
    ),
}
# Keep entries for issued template versions when introducing a new version.
FORMATS_BY_VERSION = {item.version: item for item in FORMATS.values()}
UCS_CURRENT = ReportFormat('ucs-v2', 'ensayos/ucs-v2.html', 'UCS', 'Compresión uniaxial (UCS)', FORMATS['ucs'].result_fields, photo_folder='ucs')
FORMATS_BY_VERSION[UCS_CURRENT.version] = UCS_CURRENT
FORMATS['ucs'] = UCS_CURRENT
TYPE_ALIASES = {"compresión uniaxial": "ucs", "compresion uniaxial": "ucs"}
SOURCE_FIELDS = (
    "idd", "codigo_muestra", "tipo_ensayo", "proyecto", "sectores", "este", "norte", "elevacion",
    "sondaje", "observacion", "lito1", "lito2", "lito3", "laboratorio", "desde", "hasta",
    *dict.fromkeys(field for item in FORMATS.values() for field in item.result_fields),
)
jinja = Environment(
    loader=FileSystemLoader(Path(__file__).resolve().parent / "plantillas"),
    autoescape=select_autoescape(), undefined=StrictUndefined,
    finalize=lambda value: "" if value is None else value,
)


class ReportBase(DeclarativeBase):
    """Apply the report schema only through the SQL migration."""


class Report(ReportBase):
    __tablename__ = "reporte_ensayo"
    __table_args__ = {"schema": "dbo"}

    id_reporte: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    codigo_muestra: Mapped[str] = mapped_column(String(150))
    numero_informe: Mapped[str] = mapped_column(Unicode(100))
    fecha_emision: Mapped[date] = mapped_column(Date)
    texto_titulo: Mapped[str] = mapped_column(Unicode(150))
    ubicacion: Mapped[str] = mapped_column(Unicode(200))
    ejecutor: Mapped[str] = mapped_column(Unicode(150), default="")
    supervisor: Mapped[str] = mapped_column(Unicode(150), default="")
    material: Mapped[str] = mapped_column(Unicode(150))
    presentacion: Mapped[str] = mapped_column(Unicode(150))
    muestreado: Mapped[str] = mapped_column(Unicode(150))
    profundidad: Mapped[str] = mapped_column(Unicode(100))
    usuario_id: Mapped[int] = mapped_column(Integer)
    usuario_emisor: Mapped[str] = mapped_column(Unicode(50))
    fecha_registro: Mapped[datetime] = mapped_column(DateTime)
    version_plantilla: Mapped[str] = mapped_column(String(30))
    solicitud_id: Mapped[str] = mapped_column(String(36), unique=True)
    datos_emitidos: Mapped[str] = mapped_column(UnicodeText)


class Emission(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    codigo_muestra: str = Field(min_length=1, max_length=150)
    numero_informe: str = Field(min_length=1, max_length=100)
    fecha_emision: date
    texto_titulo: str = Field(default="", max_length=150)
    ubicacion: str = Field(default="", max_length=200)
    ejecutor: str = Field(default="", max_length=150)
    supervisor: str = Field(default="", max_length=150)
    material: str = Field(default="", max_length=150)
    presentacion: str = Field(default="", max_length=150)
    muestreado: str = Field(default="", max_length=150)
    profundidad: str = Field(default="", max_length=100)
    imagenes: dict[Literal['antes', 'despues'], UUID] = Field(default_factory=dict)


class PhotoDimensions(BaseModel):
    model_config = ConfigDict(extra='forbid')
    ancho: int = Field(gt=0, le=MAX_IMAGE_SIDE)
    alto: int = Field(gt=0, le=MAX_IMAGE_SIDE)


class PreviewEmission(Emission):
    fotografias_locales: dict[Literal['antes', 'despues'], PhotoDimensions] = Field(default_factory=dict)


class SaveEmission(Emission):
    solicitud_id: UUID


def assay_type(value: str | None) -> str:
    key = (value or "").strip().casefold()
    return TYPE_ALIASES.get(key, key)


def source_rows(db: Session, code: str) -> tuple[list[dict], ReportFormat]:
    columns = [getattr(maestro, name) for name in SOURCE_FIELDS]
    rows = [
        dict(row) for row in db.execute(
            select(*columns).where(maestro.codigo_muestra == code).order_by(maestro.idd)
        ).mappings()
    ]
    if not rows:
        raise HTTPException(404, "El código de muestra no tiene corridas en el Registro Maestro.")

    types = {assay_type(row["tipo_ensayo"]) for row in rows}
    if "" in types or len(types) != 1:
        raise HTTPException(422, "Este código debe contener exclusivamente corridas de un mismo tipo de ensayo registrado.")
    kind = next(iter(types))
    report_format = FORMATS.get(kind)
    if report_format is None:
        raise HTTPException(422, "El tipo de ensayo de este código todavía no tiene plantilla de reporte.")

    for field, label in (("laboratorio", "laboratorio"), ("desde", "Desde"), ("hasta", "Hasta")):
        values = {str(row[field]).strip().casefold() for row in rows if row[field] is not None and str(row[field]).strip()}
        if len(values) > 1:
            raise HTTPException(422, f"Las corridas tienen distintos valores para {label}. Revisa el Registro Maestro.")

    for row in rows:
        row["tipo_ensayo"] = kind
    return rows, report_format


def snapshot(db: Session, emission: Emission) -> tuple[dict, ReportFormat]:
    rows, report_format = source_rows(db, emission.codigo_muestra)
    canonical_code = rows[0]["codigo_muestra"].strip()
    fields = {**emission.model_dump(mode="json", exclude={"solicitud_id", "imagenes", "fotografias_locales"}), "codigo_muestra": canonical_code}
    try:
        context = preparar_campos(rows, fields)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    context.pop("formato_ensayo")
    return {
        "contexto": context,
        "corridas": [{field: row[field] for field in ("idd", *report_format.result_fields)} for row in rows],
    }, report_format


def render_html(data: dict, version: str) -> str:
    report_format = FORMATS_BY_VERSION.get(version)
    if report_format is None:
        raise HTTPException(409, "La versión de la plantilla de este reporte no está disponible.")
    return jinja.get_template(report_format.template).render(**data["contexto"], corridas=data["corridas"],
                                                           fotos=images.photo_urls(data), foto_medidas=images.photo_layout(data),
                                                           mostrar_variables=False)


class ImageUpload(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    codigo_muestra: str = Field(min_length=1, max_length=150)
    posicion: Literal['antes', 'despues']
    solicitud_id: UUID


_photo_transfers = BoundedSemaphore(2)


def store_uploaded_image(payload, stream, db, user):
    rows, report_format = source_rows(db, payload.codigo_muestra)
    if not report_format.photo_folder:
        raise HTTPException(422, 'Este tipo de ensayo todavía no admite fotografías.')
    return images.issue_upload(db, user, rows[0]['codigo_muestra'].strip(), payload.posicion,
                               payload.solicitud_id, stream, assay_kind=report_format.photo_folder)


@router.post('/imagenes/cargas', status_code=201)
async def upload_image(request: Request, codigo_muestra: str = Query(min_length=1, max_length=150),
                       posicion: Literal['antes', 'despues'] = Query(), solicitud_id: UUID = Query(),
                       db: Session = Depends(get_db), user: User | TestUser = Depends(work_user)):
    if request.headers.get('content-type', '').split(';')[0].strip().lower() != 'image/jpeg':
        raise HTTPException(415, 'La fotografía optimizada debe enviarse como image/jpeg.')
    length = request.headers.get('content-length')
    if length is not None and (not length.isdigit() or int(length) > MAX_IMAGE_BYTES):
        raise HTTPException(413, 'La fotografía optimizada supera 1 MiB.')
    if not _photo_transfers.acquire(blocking=False):
        raise HTTPException(429, 'Hay otras fotografías procesándose. Reintenta en unos momentos.', headers={'Retry-After': '2'})
    try:
        # Bound even requests without Content-Length. Spill to ephemeral disk
        # after 64 KiB; never parse unbounded multipart files or decode pixels.
        with SpooledTemporaryFile(max_size=BLOCK_SIZE, mode='w+b') as stream:
            total = 0
            async for chunk in request.stream():
                total += len(chunk)
                if total > MAX_IMAGE_BYTES:
                    raise HTTPException(413, 'La fotografía optimizada supera 1 MiB.')
                stream.write(chunk)
            stream.seek(0)
            payload = ImageUpload(codigo_muestra=codigo_muestra, posicion=posicion, solicitud_id=solicitud_id)
            return await run_in_threadpool(store_uploaded_image, payload, stream, db, user)
    finally:
        _photo_transfers.release()


@router.get('/imagenes/{image_id}')
def get_image(image_id: UUID, db: Session = Depends(get_db), user: User | TestUser = Depends(work_user)):
    if not _photo_transfers.acquire(blocking=False):
        raise HTTPException(429, 'Hay otras fotografías procesándose. Reintenta en unos momentos.', headers={'Retry-After': '2'})
    try:
        if TEST_ACCESS:
            stream, size = images.download_image(db, image_id, owner_id=TEST_USER.id)
        else:
            stream, size = images.download_image(db, image_id)
    finally:
        # The Drive transfer is complete; slow/disconnected browser clients must
        # not keep the network semaphore acquired.
        _photo_transfers.release()

    def chunks():
        try:
            while block := stream.read(BLOCK_SIZE):
                yield block
        finally:
            stream.close()

    return StreamingResponse(chunks(), media_type='image/jpeg', background=BackgroundTask(stream.close),
                             headers={'Content-Length': str(size), 'Cache-Control': 'private, no-store',
                                      'X-Content-Type-Options': 'nosniff'})


def add_photos(db, user, emission, data, report_format, *, lock=False):
    if not emission.imagenes:
        return report_format, []
    if set(emission.imagenes) != {'antes', 'despues'}:
        raise HTTPException(422, 'Adjunta Antes y Después, o quita ambas fotografías.')
    if not report_format.photo_folder:
        raise HTTPException(422, 'Este tipo de ensayo todavía no admite fotografías.')
    refs, rows = images.references(db, user, data['contexto']['muestra']['codigo'], emission.imagenes, lock=lock)
    if (refs['antes']['ancho'] >= refs['antes']['alto']) != (refs['despues']['ancho'] >= refs['despues']['alto']):
        raise HTTPException(422, 'Ambas fotografías deben tener la misma orientación: verticales u horizontales.')
    data['imagenes'] = refs
    return report_format, rows


FILTER_COLUMNS = {
    "tipo_ensayo": maestro.tipo_ensayo,
    "proyecto": maestro.proyecto,
    "laboratorio": maestro.laboratorio,
    "campana": maestro.campana,
}


@router.get("/filtros")
def search_filters(db: Session = Depends(get_db)):
    options = {}
    for key, column in FILTER_COLUMNS.items():
        values = db.scalars(
            select(func.trim(column)).where(
                maestro.codigo_muestra.is_not(None), func.trim(maestro.codigo_muestra) != "",
                column.is_not(None), func.trim(column) != "",
            ).distinct()
        )
        labels = {}
        for value in values:
            if key == "tipo_ensayo" and (kind := FORMATS.get(assay_type(value))) is not None:
                labels[assay_type(value)] = kind.search_label
            elif key == "proyecto" and (project := NOMBRES_PROYECTO.get(value.upper())):
                labels[value] = f"{project} ({value})"
            else:
                labels[value] = value
        options[key] = [
            {"valor": value, "etiqueta": label}
            for value, label in sorted(labels.items(), key=lambda item: item[1].casefold(), reverse=key == "campana")
        ]
    return options


@router.get("/ensayos")
def search(
    q: Annotated[str, Query(max_length=150)] = "",
    db: Session = Depends(get_db),
    tipo_ensayo: Annotated[str, Query(max_length=100)] = "",
    proyecto: Annotated[str, Query(max_length=100)] = "",
    laboratorio: Annotated[str, Query(max_length=100)] = "",
    campana: Annotated[str, Query(max_length=100)] = "",
):
    term = q.strip()
    code = maestro.codigo_muestra
    predicates = []
    if term:
        predicates.append(or_(code.contains(term, autoescape=True), maestro.sondaje.contains(term, autoescape=True)))
    if kind := tipo_ensayo.strip():
        canonical = assay_type(kind)
        if canonical in FORMATS:
            variants = {canonical, *(alias for alias, key in TYPE_ALIASES.items() if key == canonical)}
            predicates.append(func.lower(func.trim(maestro.tipo_ensayo)).in_(sorted(variants)))
        else:
            predicates.append(func.trim(maestro.tipo_ensayo) == kind)
    for key, value in (("proyecto", proyecto), ("laboratorio", laboratorio), ("campana", campana)):
        if value.strip():
            predicates.append(func.trim(FILTER_COLUMNS[key]) == value.strip())

    if not predicates:
        return []

    # Filter candidate codes first, then inspect every run for each matching code.
    candidates = (
        select(code.label("codigo"))
        .where(code.is_not(None), func.trim(code) != "", *predicates)
        .group_by(code)
        .order_by(case((code == term, 0), else_=1), code)
        .limit(30)
        .cte("codigos_encontrados")
    )
    rows = db.execute(
        select(candidates.c.codigo, maestro.tipo_ensayo, func.min(maestro.sondaje).label("sondaje"))
        .join(maestro, maestro.codigo_muestra == candidates.c.codigo)
        .group_by(candidates.c.codigo, maestro.tipo_ensayo)
        .order_by(case((candidates.c.codigo == term, 0), else_=1), candidates.c.codigo, maestro.tipo_ensayo)
    ).mappings()

    results = {}
    for row in rows:
        entry = results.setdefault(row["codigo"], {"sondajes": [], "tipos": {}})
        if row["sondaje"]:
            entry["sondajes"].append(row["sondaje"])
        label = (row["tipo_ensayo"] or "").strip()
        key = assay_type(label)
        if key in FORMATS:
            label = FORMATS[key].search_label
        entry["tipos"][key] = label

    return [
        {
            "codigo_muestra": code,
            "sondaje": min(entry["sondajes"], default=None),
            "tipos_ensayo": [label for label in entry["tipos"].values() if label],
            "estado_plantilla": (
                "disponible" if len(entry["tipos"]) == 1 and entry["tipos"].keys() <= FORMATS.keys()
                else "revisar" if "" in entry["tipos"] or len(entry["tipos"]) > 1
                else "pendiente"
            ),
        }
        for code, entry in results.items()
    ]


@router.get("/muestra")
def sample(codigo_muestra: str = Query(min_length=1, max_length=150), db: Session = Depends(get_db)):
    data, report_format = snapshot(db, Emission(codigo_muestra=codigo_muestra, numero_informe="vista previa", fecha_emision=date.today()))
    return {
        "muestra": data["contexto"]["muestra"],
        "datos": data["contexto"]["datos"],
        "tipo_ensayo": data["contexto"]["tipo_ensayo"],
        "corridas": len(data["corridas"]),
        "fotografias_habilitadas": bool(report_format.photo_folder),
    }


@router.post("/vista-previa")
def preview(emission: PreviewEmission, db: Session = Depends(get_db), user: User | TestUser = Depends(work_user)):
    data, report_format = snapshot(db, emission)
    local = getattr(emission, 'fotografias_locales', {})
    if emission.imagenes:
        raise HTTPException(422, 'La vista previa usa fotografías locales, sin cargas a Drive.')
    if local:
        if not report_format.photo_folder:
            raise HTTPException(422, 'Este tipo de ensayo todavía no admite fotografías.')
        if set(local) != {'antes', 'despues'}:
            raise HTTPException(422, 'Adjunta Antes y Después, o quita ambas fotografías.')
        if (local['antes'].ancho >= local['antes'].alto) != (local['despues'].ancho >= local['despues'].alto):
            raise HTTPException(422, 'Ambas fotografías deben tener la misma orientación: verticales u horizontales.')
        data['imagenes'] = {position: {**photo.model_dump(), 'local': True} for position, photo in local.items()}
    return {"html": render_html(data, report_format.version)}


def document(report: Report) -> dict:
    data = json.loads(report.datos_emitidos)
    return {
        "id_reporte": report.id_reporte,
        "numero_informe": report.numero_informe,
        "codigo_muestra": report.codigo_muestra,
        "html": render_html(data, report.version_plantilla),
        "sigla_ensayo": FORMATS_BY_VERSION[report.version_plantilla].abbreviation,
    }


@router.post("", status_code=201)
def save(emission: SaveEmission, db: Session = Depends(get_db), user: User | TestUser = Depends(work_user)):
    key = str(emission.solicitud_id)

    def previous():
        return db.scalar(select(Report).where(Report.solicitud_id == key))

    def prior_document(report: Report):
        fields = emission.model_dump(exclude={"solicitud_id", "codigo_muestra", "imagenes"})
        stored = {position: value['id'] for position, value in json.loads(report.datos_emitidos).get('imagenes', {}).items()}
        if (
            report.usuario_id != user.id
            or report.codigo_muestra.casefold() != emission.codigo_muestra.casefold()
            or any(getattr(report, name) != value for name, value in fields.items())
            or stored != {position: str(value) for position, value in emission.imagenes.items()}
        ):
            raise HTTPException(409, "La solicitud pertenece a otra emisión.")
        return document(report)

    existing = previous()
    if existing is not None:
        return prior_document(existing)

    data, report_format = snapshot(db, emission)
    report_format, photo_rows = add_photos(db, user, emission, data, report_format, lock=True)
    html = render_html(data, report_format.version)
    fields = emission.model_dump(exclude={"solicitud_id", "imagenes"})
    fields["codigo_muestra"] = data["contexto"]["muestra"]["codigo"]
    report = Report(
        **fields,
        solicitud_id=key,
        usuario_id=user.id,
        usuario_emisor=user.usuario,
        fecha_registro=datetime.now(timezone.utc).replace(tzinfo=None),
        version_plantilla=report_format.version,
        datos_emitidos=json.dumps(data, ensure_ascii=False),
    )
    db.add(report)
    try:
        db.flush()
        for photo in photo_rows:
            photo.id_reporte = report.id_reporte
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = previous()
        if existing is None:
            raise
        return prior_document(existing)
    return {"id_reporte": report.id_reporte, "codigo_muestra": report.codigo_muestra,
            "numero_informe": report.numero_informe, "html": html,
            "sigla_ensayo": report_format.abbreviation}


@router.get("")
def history(q: str = Query(default="", max_length=150), page: int = Query(default=1, ge=1, le=100000),
            db: Session = Depends(get_db)):
    size = 20
    query = select(Report.id_reporte, Report.codigo_muestra, Report.numero_informe, Report.fecha_emision,
                   Report.usuario_emisor, Report.version_plantilla, Report.datos_emitidos)
    if TEST_ACCESS:
        query = query.where(Report.usuario_id == TEST_USER.id)
    if q.strip():
        query = query.where(or_(
            Report.codigo_muestra.contains(q.strip(), autoescape=True),
            Report.numero_informe.contains(q.strip(), autoescape=True),
        ))
    rows = db.execute(query.order_by(Report.id_reporte.desc()).offset((page - 1) * size).limit(size + 1)).mappings().all()
    items = []
    for row in rows[:size]:
        item = dict(row)
        context = json.loads(item.pop("datos_emitidos"))["contexto"]
        item["tipo_ensayo"] = context.get("tipo_ensayo") or None
        item["sondaje"] = context.get("muestra", {}).get("sondaje") or None
        items.append(item)
    return {"items": items, "hay_mas": len(rows) > size}


@router.get("/{report_id}")
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if report is None or (TEST_ACCESS and report.usuario_id != TEST_USER.id):
        raise HTTPException(404, "El reporte no existe.")
    return document(report)
