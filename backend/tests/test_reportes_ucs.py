import json
import re
from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

from app.database import Base
from app.models import RegistroMaestro
from app.reportes.router import (
    FORMATS, SOURCE_FIELDS, Emission, Report, ReportBase, SaveEmission, get_report, history, preview, sample, save,
    search, search_filters,
)


@pytest.fixture
def report_db():
    engine = create_engine("sqlite://")

    @event.listens_for(engine, "connect")
    def attach_schema(connection, _):
        connection.execute("ATTACH DATABASE ':memory:' AS dbo")

    Base.metadata.create_all(engine)
    ReportBase.metadata.create_all(engine)
    try:
        with Session(engine) as db:
            yield db
    finally:
        engine.dispose()


def test_ucs_report_retains_repetitions_and_issued_data(report_db):
    db = report_db
    code = "FEGT20-001-UCS-M01"
    for row_id, resistance in [(90801, 0.0), (90802, 29.5)]:
        db.add(RegistroMaestro(idd=row_id, codigo_muestra=code, tipo_ensayo="UCS", sondaje="FEGT20-001",
                               proyecto="FRBB", este=100, norte=200, elevacion=300,
                               lito1="TBX", lito2="TBX", lito3="MZH", ucs_resistencia=resistance))
    db.flush()
    data = {"codigo_muestra": code, "numero_informe": "GE-001", "fecha_emision": date(2026, 11, 17),
            "texto_titulo": "<ASTM>", "profundidad": "120.5 m"}
    assert search(q="FEGT20-001", db=db) == [{
        "codigo_muestra": code, "sondaje": "FEGT20-001",
        "tipos_ensayo": ["Compresión uniaxial (UCS)"], "estado_plantilla": "disponible",
    }]
    html = preview(Emission(**data), db)["html"]
    assert "TBX_TBX_MZH" in html and "&lt;ASTM&gt;" in html
    assert "E 100.0\nN 200.0\nElev. 300.0" in html
    assert "<td>0.0</td>" in html and "<td>29.5</td>" in html
    assert "<td>None</td>" not in html

    payload = SaveEmission(**data, solicitud_id=uuid4())
    actor = SimpleNamespace(id=10, usuario="TEST_UCS")
    issued = save(payload, db, actor)
    assert save(payload, db, actor)["id_reporte"] == issued["id_reporte"]
    assert history(q=code, page=1, db=db)["items"][0]["usuario_emisor"] == "TEST_UCS"
    db.get(RegistroMaestro, 90802).ucs_resistencia = 50
    db.flush()
    assert get_report(issued["id_reporte"], db)["html"] == issued["html"]

    for idd in (90801, 90802):
        db.get(RegistroMaestro, idd).sondaje = "SONDAJE-EDITADO"
    db.flush()
    historical_item = history(q=code, page=1, db=db)["items"][0]
    assert historical_item["sondaje"] == "FEGT20-001"
    assert historical_item["tipo_ensayo"] == "Compresión uniaxial"
    assert historical_item["version_plantilla"] == "ucs-v2"
    assert get_report(issued["id_reporte"], db)["sigla_ensayo"] == "UCS"
    assert "datos_emitidos" not in historical_item

    db.add(RegistroMaestro(idd=90803, codigo_muestra=code, tipo_ensayo="Determinación de constantes elásticas"))
    db.flush()
    with pytest.raises(HTTPException, match="exclusivamente") as error:
        preview(Emission(**data), db)
    assert error.value.status_code == 422


def test_search_includes_other_types_and_checks_all_rows_per_code(report_db):
    db = report_db
    db.add_all(
        RegistroMaestro(idd=idd, codigo_muestra=code, tipo_ensayo=kind, sondaje=hole)
        for idd, code, kind, hole in [
            (1, "DH-UCS-M01", "UCS", "DH-01"),
            (2, "DH-TI-M01", "Propiedades físicas", "DH-01"),
            (3, "DH-UCS-M02", "UCS", "DH-01"),
            (4, "DH-UCS-M02", "Determinación de constantes elásticas", "DH-02"),
            (5, "DH-X-M01", None, "DH-01"),
            (6, "DH-UCS-M01", "Compresión uniaxial", "DH-01"),
        ]
    )
    db.flush()

    matches = {row["codigo_muestra"]: row for row in search(q="DH-01", db=db)}
    assert {code: row["estado_plantilla"] for code, row in matches.items()} == {
        "DH-UCS-M01": "disponible", "DH-TI-M01": "pendiente",
        "DH-UCS-M02": "revisar", "DH-X-M01": "revisar",
    }
    assert matches["DH-UCS-M01"]["tipos_ensayo"] == ["Compresión uniaxial (UCS)"]
    assert matches["DH-TI-M01"]["tipos_ensayo"] == ["Propiedades físicas"]
    assert len(matches["DH-UCS-M02"]["tipos_ensayo"]) == 2
    assert search(q="DH-TI", db=db)[0]["codigo_muestra"] == "DH-TI-M01"



def test_direct_shear_uses_its_own_version_and_eight_fields_per_run(report_db):
    db = report_db
    code = "DH-CD-M01"
    measurements = dict(
        corte_tipo_fractura="Natural", corte_area=12.0,
        corte_esf_normal_kpa=100.0, corte_esf_corte_kpa=40.0,
        corte_esf_normal_mpa=0.1, corte_esf_corte_mpa=0.04,
        corte_cohesion_mpa=0.0, corte_angulo_friccion=None,
    )
    db.add_all([
        RegistroMaestro(idd=22, codigo_muestra=code, tipo_ensayo="Corte directo", sondaje="DH-01",
                        **{**measurements, "corte_tipo_fractura": "Artificial", "corte_angulo_friccion": 32.5}),
        RegistroMaestro(idd=21, codigo_muestra=code, tipo_ensayo=" CORTE DIRECTO ", sondaje="DH-01",
                        **measurements),
    ])
    db.flush()

    assert search(q="DH-CD", db=db) == [{
        "codigo_muestra": code, "sondaje": "DH-01",
        "tipos_ensayo": ["Corte directo"], "estado_plantilla": "disponible",
    }]

    emission = SaveEmission(codigo_muestra=code, numero_informe="CD-1", fecha_emision=date(2026, 11, 17),
                            solicitud_id=uuid4())
    html = preview(Emission(**emission.model_dump(exclude={"solicitud_id"})), db)["html"]
    results = html.split("<tbody>", 1)[1].split("</tbody>", 1)[0]
    rows = re.findall(r"<tr>(.*?)</tr>", results, flags=re.S)
    assert [re.findall(r"<td>(.*?)</td>", row) for row in rows] == [
        ["Natural", "12.0", "100.0", "40.0", "0.1", "0.04", "0.0", ""],
        ["Artificial", "12.0", "100.0", "40.0", "0.1", "0.04", "0.0", "32.5"],
    ]
    issued = save(emission, db, SimpleNamespace(id=10, usuario="TEST_CD"))
    stored = db.get(Report, issued["id_reporte"])
    assert stored.version_plantilla == "corte-directo-v1"
    assert issued["sigla_ensayo"] == "CD"
    data = json.loads(stored.datos_emitidos)
    assert [row["idd"] for row in data["corridas"]] == [21, 22]
    assert set(data["corridas"][0]) == {"idd", *measurements.keys()}
    assert get_report(issued["id_reporte"], db) == issued



@pytest.mark.parametrize("kind,code,version,abbreviation,columns", [
    ("Compresión triaxial", "DH-TX-M01", "compresion-triaxial-v1", "TX", 7),
    ("Tracción indirecta", "DH-TI-M01", "traccion-indirecta-v1", "TI", 4),
    ("Determinación de constantes elásticas", "DH-UCS-M02", "constantes-elasticas-v1", "CE", 7),
])
def test_new_report_formats(report_db, kind, code, version, abbreviation, columns):
    db = report_db
    assert len(SOURCE_FIELDS) == len(set(SOURCE_FIELDS))
    fields = FORMATS[kind.casefold()].result_fields
    assert len(fields) == columns
    values = {name: str(i) if name in {"ucs_rotura", "triaxial_rotura", "traccion_vacia_28"} else float(i) for i, name in enumerate(fields, 1)}
    db.add_all([
        RegistroMaestro(idd=idd, codigo_muestra=code, tipo_ensayo=kind, sondaje="DH-01", **values)
        for idd in (12, 11)
    ])
    db.flush()
    assert search(q=code, db=db)[0]["estado_plantilla"] == "disponible"
    assert sample(codigo_muestra=code, db=db)["tipo_ensayo"] == kind
    emission = Emission(codigo_muestra=code, numero_informe="TEST-1", fecha_emision=date(2026, 11, 17))
    preview_html = preview(emission, db)["html"]
    body = preview_html.split("<tbody>", 1)[1].split("</tbody>", 1)[0]
    rows = re.findall(r"<tr>(.*?)</tr>", body, flags=re.S)
    assert [re.findall(r"<td>(.*?)</td>", row) for row in rows] == [[str(v) for v in values.values()]] * 2
    issued = save(SaveEmission(**emission.model_dump(), solicitud_id=uuid4()), db, SimpleNamespace(id=1, usuario="TEST"))
    assert issued["html"] == preview_html
    assert issued["sigla_ensayo"] == abbreviation
    stored = db.get(Report, issued["id_reporte"])
    assert stored.version_plantilla == version
    assert json.loads(stored.datos_emitidos)["corridas"] == [{"idd": idd, **values} for idd in (11, 12)]
    assert get_report(stored.id_reporte, db) == issued


def test_report_filters_use_master_values_and_preserve_mixed_type_diagnostics(report_db):
    db = report_db
    db.add_all([
        RegistroMaestro(idd=23, codigo_muestra="DH-UCS-M01", tipo_ensayo="Compresión uniaxial",
                        sondaje="DH-01", proyecto="FRBB", laboratorio="UNI", campana="2025"),
        RegistroMaestro(idd=24, codigo_muestra="DH-UCS-M02", tipo_ensayo="Determinación de constantes elásticas",
                        sondaje="DH-01", proyecto="FRBB", laboratorio="UNI", campana="2025"),
        RegistroMaestro(idd=25, codigo_muestra="DH-UCS-M02", tipo_ensayo="UCS",
                        sondaje="DH-02", proyecto="CHABB", laboratorio="Geomec", campana="2024"),
    ])
    db.flush()
    options = search_filters(db)
    assert {"valor": "ucs", "etiqueta": "Compresión uniaxial (UCS)"} in options["tipo_ensayo"]
    assert {"valor": "FRBB", "etiqueta": "Ferro (FRBB)"} in options["proyecto"]
    assert [item["valor"] for item in options["campana"]] == ["2025", "2024"]
    assert [item["codigo_muestra"] for item in search(tipo_ensayo="ucs", campana="2025", db=db)] == ["DH-UCS-M01"]
    result = search(q="DH-01", tipo_ensayo="determinación de constantes elásticas", proyecto="FRBB", laboratorio="UNI", campana="2025", db=db)
    assert [item["codigo_muestra"] for item in result] == ["DH-UCS-M02"]
    assert result[0]["estado_plantilla"] == "revisar"
    assert search(q="DH-01", laboratorio="Geomec", db=db) == []


@pytest.mark.parametrize('kind', ['UCS', 'Corte directo', 'Compresión triaxial', 'Tracción indirecta', 'Determinación de constantes elásticas'])
def test_executor_and_supervisor_are_shared_and_saved_in_every_report(report_db, kind):
    db = report_db
    code = 'DH-ENSAYO-M01'
    db.add(RegistroMaestro(idd=1, codigo_muestra=code, tipo_ensayo=kind, sondaje='DH'))
    db.flush()
    emission = SaveEmission(codigo_muestra=code, numero_informe='FIRMAS-1', fecha_emision=date(2026, 11, 22),
                            ejecutor='  Ana María Pérez  ', supervisor='Carlos & García', solicitud_id=uuid4())
    preview_html = preview(Emission(**emission.model_dump(exclude={'solicitud_id'})), db)['html']
    assert '<dt>Muestreo</dt>' not in preview_html
    assert '<dt>Ejecutor</dt><dd>Ana María Pérez</dd>' in preview_html
    assert '<dt>Supervisor</dt><dd>Carlos &amp; García</dd>' in preview_html
    assert preview_html.count('class="firmas firmas-comunes"') == 1
    assert preview_html.count('class="firma-trazo"') == 2
    assert '<span class="firma-nombre">Ana María Pérez</span>' in preview_html
    assert '<span class="firma-nombre">Carlos &amp; García</span>' in preview_html
    assert preview_html.count('Ejecutor del Ensayo') == 1
    assert preview_html.count('Supervisor de Laboratorio') == 1
    assert preview_html.index('class="firmas firmas-comunes"') > preview_html.index('</table>')
    assert 'Adolfo Jesus' not in preview_html and 'ELVIS WILLIAM' not in preview_html
    issued = save(emission, db, SimpleNamespace(id=10, usuario='TEST_FIRMAS'))
    report = db.get(Report, issued['id_reporte'])
    assert report.ejecutor == 'Ana María Pérez' and report.supervisor == 'Carlos & García'
    assert json.loads(report.datos_emitidos)['contexto']['datos']['ejecutor'] == report.ejecutor
    assert json.loads(report.datos_emitidos)['contexto']['datos']['supervisor'] == report.supervisor
    assert issued['html'] == preview_html
    assert get_report(report.id_reporte, db)['html'] == preview_html
    assert save(emission, db, SimpleNamespace(id=10, usuario='TEST_FIRMAS'))['id_reporte'] == report.id_reporte
    with pytest.raises(HTTPException) as conflict:
        save(emission.model_copy(update={'supervisor': 'Otra persona'}), db, SimpleNamespace(id=10, usuario='TEST_FIRMAS'))
    assert conflict.value.status_code == 409


def test_old_report_snapshot_without_new_names_still_renders(report_db):
    db = report_db
    db.add(RegistroMaestro(idd=1, codigo_muestra='DH-UCS-M01', tipo_ensayo='UCS'))
    db.flush()
    issued = save(SaveEmission(codigo_muestra='DH-UCS-M01', numero_informe='ANTERIOR', fecha_emision=date.today(),
                              solicitud_id=uuid4()), db, SimpleNamespace(id=1, usuario='TEST'))
    report = db.get(Report, issued['id_reporte'])
    snapshot = json.loads(report.datos_emitidos)
    snapshot['contexto']['datos'].pop('ejecutor')
    snapshot['contexto']['datos'].pop('supervisor')
    snapshot['contexto']['datos']['muestreo'] = 'Valor anterior de muestreo'
    report.datos_emitidos = json.dumps(snapshot)
    db.flush()
    html = get_report(report.id_reporte, db)['html']
    assert '<dt>Muestreo</dt>' not in html
    assert 'Valor anterior de muestreo' not in html
    assert html.count('class="firma-trazo"') == 2
    assert '<span class="firma-nombre"></span>' in html
