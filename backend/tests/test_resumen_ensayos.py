from app.models import RegistroMaestro
from app.routers.ensayos import get_ensayos_summary


def test_summary_separates_elastic_constants_from_ucs_by_recorded_type(db_session):
    db_session.add_all([
        RegistroMaestro(idd=701, codigo_muestra="S-UCS-M01", tipo_ensayo="UCS", campana="2025", laboratorio="UNI"),
        RegistroMaestro(idd=702, codigo_muestra="S-UCS-M01", tipo_ensayo="Compresión uniaxial", campana="2025", laboratorio="UNI"),
        RegistroMaestro(idd=703, codigo_muestra="S-UCS-M02", tipo_ensayo="Determinación de constantes elásticas", campana="2025", laboratorio="UNI"),
        RegistroMaestro(idd=704, codigo_muestra="S-UCS-M02", tipo_ensayo="Constantes elásticas", campana="2025", laboratorio="UNI"),
        RegistroMaestro(idd=705, codigo_muestra="S-TX-M01", tipo_ensayo="Compresión triaxial", campana="2025", laboratorio="UNI"),
    ])
    db_session.flush()

    data = get_ensayos_summary(db_session)
    assert data["total_ensayos"] == 3
    assert data["por_tipo"] == [
        {"etiqueta": "CE", "ensayos": 1},
        {"etiqueta": "TX", "ensayos": 1},
        {"etiqueta": "UCS", "ensayos": 1},
    ]
    for dimension, label in [("por_campana", "2025"), ("por_laboratorio", "UNI")]:
        [group] = data[dimension]
        assert group["etiqueta"] == label
        assert group["ensayos"] == 3
        assert {item["etiqueta"]: item["ensayos"] for item in group["series"]} == {"CE": 1, "UCS": 1, "TX": 1}
