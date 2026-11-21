import logging
from calendar import monthrange
from decimal import Decimal
from math import isfinite
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.rules import COLUMNS_CONFIG, calculate_derived_fields
from app.models import RegistroMaestro
from app.services.sample_validation import validate_sample_interval, resolve_borehole


logger = logging.getLogger(__name__)

ASSAY_TYPES = {
    "TX": "Compresión triaxial",
    "CD": "Corte directo",
    "CE": "Determinación de constantes elásticas",
    "UCS": "UCS",
    "TI": "Tracción indirecta",
}
LAB_NAMES = {
    "Geomec": "Geomec",
    "Ingeotest": "Ingeotest",
    "LaboRock (GeoBlast)": "GeoBlast",
    "UNI (LGM)": "UNI",
}
MONTHS = (
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
)
ASSAY_GROUPS = {
    "TX": {"triaxial"}, "CD": {"corte"}, "CE": {"ucs", "elasticas"},
    "UCS": {"ucs"}, "TI": {"traccion"},
}


class AssayRegistration(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    sondaje_id: int | None = Field(default=None, gt=0)
    sondaje_codigo: str | None = Field(default=None, min_length=1, max_length=100)
    numero_muestra: str = Field(min_length=1, max_length=95)
    proyecto: str = Field(min_length=1, max_length=100)
    ensayo: Literal["TX", "CD", "CE", "UCS", "TI"]
    laboratorio: Literal["Geomec", "Ingeotest", "LaboRock (GeoBlast)", "UNI (LGM)"]
    desde: Decimal = Field(ge=0, le=999)
    hasta: Decimal = Field(ge=0, le=999)
    dia: int | None = Field(default=None, ge=1, le=31)
    mes: str
    anio: int = Field(ge=1980, le=2050)
    este: str = Field(pattern=r"^-?[0-9]{6}\.[0-9]{2}$")
    norte: str = Field(pattern=r"^-?[0-9]{7}\.[0-9]{2}$")
    elevacion: str = Field(pattern=r"^-?[0-9]{4}\.[0-9]{2}$")
    sectores: str | None = Field(default=None, max_length=100)
    observacion: str | None = Field(default=None, max_length=500)
    campana: str | None = Field(default=None, max_length=100)
    mediciones: list[dict[str, str | None]] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_interval_and_date(self):
        if self.sondaje_id is None and not self.sondaje_codigo:
            raise ValueError('Selecciona o escribe un sondaje.')
        if self.hasta <= self.desde:
            raise ValueError("Hasta debe ser mayor que Desde.")
        if self.mes not in MONTHS:
            raise ValueError("Selecciona un mes válido.")
        if self.dia is not None:
            _, days = monthrange(self.anio, MONTHS.index(self.mes) + 1)
            if self.dia > days:
                raise ValueError("El día no existe en el mes y año seleccionados.")
        return self


def registration_measurements(payload: AssayRegistration):
    groups = ASSAY_GROUPS[payload.ensayo]
    if payload.laboratorio == "LaboRock (GeoBlast)" and payload.ensayo in {"CE", "TX"}:
        groups = groups | {"propiedades"}
    columns = {
        column["db_name"]: column for column in COLUMNS_CONFIG
        if column["module"] in groups and column["db_name"] != "traccion_observaciones"
    }

    rows = []
    for index, values in enumerate(payload.mediciones, start=1):
        row = {}
        for name, raw in values.items():
            if name not in columns:
                raise HTTPException(422, f"Fila {index}: {name} no corresponde al formato seleccionado.")
            value = (raw or "").strip()
            if not value:
                row[name] = None
            elif columns[name]["type"] == "str":
                if len(value) > 100:
                    raise HTTPException(422, f"Fila {index}: el texto supera los 100 caracteres.")
                row[name] = value
            else:
                try:
                    number = float(value.replace(",", "."))
                except ValueError:
                    number = float("nan")
                if not isfinite(number):
                    raise HTTPException(422, f"Fila {index}: {columns[name]['excel_name']} debe ser numérico.")
                row[name] = number
        rows.append(row)
    return rows


def register_assay(payload: AssayRegistration, db: Session):
    if db.get_bind().dialect.name != "mssql":
        raise HTTPException(503, "El registro de ensayos requiere una conexión a SQL Server.")

    measurements = registration_measurements(payload)
    try:
        resolved_id, hole = resolve_borehole(db, payload.sondaje_id, payload.sondaje_codigo)
        validation = validate_sample_interval(db, resolved_id, payload.desde, payload.hasta, payload.ensayo)
        if not validation["valida"]:
            raise HTTPException(422, "La muestra no cumple la validación de Logueo. Revisa el sondaje y el tramo.")

        abbreviation = "UCS" if payload.ensayo == "CE" else payload.ensayo
        code = f"{hole}-{abbreviation}-{payload.numero_muestra.upper()}"
        if len(code) > 150:
            raise HTTPException(422, "El código de muestra supera los 150 caracteres.")
        lithology = (validation["litologia"] or "").split("_", 2)
        lito1, lito2, lito3 = (lithology + ["", "", ""])[:3]
        start, end = float(payload.desde), float(payload.hasta)
        length = calculate_derived_fields({"desde": start, "hasta": end})["longitud_muestra"]
        common = {
            "sondaje": hole,
            "codigo_muestra": code,
            "tipo_ensayo": ASSAY_TYPES[payload.ensayo],
            "laboratorio": LAB_NAMES[payload.laboratorio],
            "proyecto": payload.proyecto,
            "dia": payload.dia,
            "mes": payload.mes,
            "anio": payload.anio,
            "desde": start,
            "hasta": end,
            "longitud_muestra": length,
            "este": float(payload.este),
            "norte": float(payload.norte),
            "elevacion": float(payload.elevacion),
            "sectores": payload.sectores or None,
            "observacion": payload.observacion or None,
            "campana": payload.campana or None,
            "lito1": lito1.strip() or None,
            "lito2": lito2.strip() or None,
            "lito3": lito3.strip() or None,
            "traccion_observaciones": None,
        }

        # Keep ID allocation and insertion under the same lock and transaction.
        last_id = db.execute(text(
            "SELECT COALESCE(MAX(idd), 0) FROM dbo.registro_maestro WITH (TABLOCKX, HOLDLOCK)"
        )).scalar_one()
        ids = list(range(last_id + 1, last_id + len(measurements) + 1))
        db.add_all([
            RegistroMaestro(idd=idd, **common, **row)
            for idd, row in zip(ids, measurements)
        ])
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Error al insertar registros de ensayos")
        raise HTTPException(503, "No se pudo guardar en SQL Server. Revisa el Registro Maestro antes de volver a intentar.") from error

    return {"codigo_muestra": code, "idds": ids, "cantidad": len(ids)}
