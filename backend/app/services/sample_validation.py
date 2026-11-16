from sqlalchemy import text


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
    fractures = sum(bool(code) and code != "SE" for code in codes)
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
        "tipos_sin_dato": unknown,
        "registros_estructurales": len(structures),
        "litologia": lithology,
        "fuente_litologia": source,
    }
