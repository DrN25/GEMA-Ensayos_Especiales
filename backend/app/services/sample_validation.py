from sqlalchemy import text
from decimal import Decimal


EDGE_TOLERANCE = Decimal('0.05')


def resolve_borehole(db, sondaje_id=None, sondaje_codigo=None):
    """Resolve existing metadata without creating a Sondajes record."""
    from fastapi import HTTPException
    if sondaje_id is not None:
        row = db.execute(text('SELECT SondajeID AS id, CodigoSondaje AS code FROM dbo.Sondajes WHERE SondajeID = :id'), {'id': sondaje_id}).mappings().first()
        if row is None:
            raise HTTPException(404, 'El sondaje seleccionado no existe.')
        if sondaje_codigo and row['code'].strip().casefold() != sondaje_codigo.strip().casefold():
            raise HTTPException(422, 'El código y el identificador del sondaje no coinciden.')
        return row['id'], row['code']
    code = (sondaje_codigo or '').strip()
    if not code:
        raise HTTPException(422, 'Selecciona o escribe un sondaje.')
    row = db.execute(text('SELECT SondajeID AS id, CodigoSondaje AS code FROM dbo.Sondajes WHERE CodigoSondaje = :code'), {'code': code}).mappings().first()
    return (row['id'], row['code']) if row else (None, code)


def _affects_core(row, desde, hasta):
    start, end = Decimal(str(desde)), Decimal(str(hasta))
    overlap_start = max(start, Decimal(str(row['desde'])))
    overlap_end = min(end, Decimal(str(row['hasta'])))
    # Only fractures wholly confined to an edge strip are tolerated. For
    # samples <= 10 cm the strips overlap, so all overlapping fractures fit.
    return (overlap_start < overlap_end and end-start > EDGE_TOLERANCE*2
            and overlap_start < end-EDGE_TOLERANCE and overlap_end > start+EDGE_TOLERANCE)


_STRUCTURES = text("""
    SELECT e.IntervaloDe AS desde, e.IntervaloA AS hasta,
           t.CodigoEstructura AS tipo,
           l1.CodigoLitologia AS lito1, l2.CodigoLitologia AS lito2,
           l3.CodigoLitologia AS lito3
    FROM dbo.LogueoEstructural AS e
    LEFT JOIN dbo.TiposEstructura AS t ON t.TipoEstructuraID = e.TipoEstructuraID
    LEFT JOIN dbo.Litologias AS l1 ON l1.LitologiaID = e.Litologia1ID
    LEFT JOIN dbo.Litologias AS l2 ON l2.LitologiaID = e.Litologia2ID
    LEFT JOIN dbo.Litologias AS l3 ON l3.LitologiaID = e.Litologia3ID
    WHERE e.SondajeID = :sondaje_id
      AND e.IntervaloDe < :hasta AND e.IntervaloA > :desde
    ORDER BY e.IntervaloDe, e.IntervaloA, e.LogueoEstructuralID
""")

_GENERAL_LOG = text("""
    SELECT g.IntervaloDe AS desde, g.IntervaloA AS hasta,
           l1.CodigoLitologia AS lito1, l2.CodigoLitologia AS lito2,
           l3.CodigoLitologia AS lito3
    FROM dbo.LogueoGeotecnicoGeneral AS g
    LEFT JOIN dbo.Litologias AS l1 ON l1.LitologiaID = g.Litologia1ID
    LEFT JOIN dbo.Litologias AS l2 ON l2.LitologiaID = g.Litologia2ID
    LEFT JOIN dbo.Litologias AS l3 ON l3.LitologiaID = g.Litologia3ID
    WHERE g.SondajeID = :sondaje_id
      AND g.IntervaloDe < :hasta AND g.IntervaloA > :desde
    ORDER BY g.IntervaloDe, g.IntervaloA, g.LogueoGeneralID
""")


def _lithology_for_interval(rows, desde, hasta):
    candidates = [
        row for row in rows
        if row["lito1"] or row["lito2"] or row["lito3"]
    ]
    if not candidates:
        return None

    # In a tie, retain the first interval in the ordered query.
    row = max(candidates, key=lambda row: min(hasta, row["hasta"]) - max(desde, row["desde"]))
    return "_".join(code for code in (row["lito1"], row["lito2"], row["lito3"]) if code)


def validate_sample_interval(db, sondaje_id, desde, hasta, ensayo):
    params = {"sondaje_id": sondaje_id, "desde": desde, "hasta": hasta}
    structures = db.execute(_STRUCTURES, params).mappings().all()
    lithology = _lithology_for_interval(structures, desde, hasta)
    source = "estructural" if lithology else None
    if lithology is None:
        general_log = db.execute(_GENERAL_LOG, params).mappings().all()
        lithology = _lithology_for_interval(general_log, desde, hasta)
        source = "geotecnico_general" if lithology else None

    codes = [(row["tipo"] or "").strip().upper() for row in structures]
    fractures = sum(bool(code) and code != "SE" and _affects_core(row, desde, hasta)
                    for row, code in zip(structures, codes))
    total_fractures = sum(bool(code) and code != 'SE' for code in codes)
    unknown = codes.count("")
    reason = None
    if ensayo != "CD":
        if fractures:
            reason = "fracturas"
        elif unknown:
            reason = "tipo_desconocido"
        elif not structures:
            reason = "sin_registros"

    return {
        "valida": reason is None,
        "motivo": reason,
        "fracturas": fractures,
        "fracturas_totales": total_fractures,
        "fracturas_toleradas": total_fractures - fractures,
        "tolerancia_extremos_m": float(EDGE_TOLERANCE),
        "tipos_sin_dato": unknown,
        "registros_estructurales": len(structures),
        "litologia": lithology,
        "fuente_litologia": source,
    }
