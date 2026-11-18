"""Prepara las variables compartidas a partir de las corridas y la emisión."""

from datetime import date


NOMBRES_PROYECTO = {
    "FRBB": "Ferro",
    "CHABB": "Chalco",
}
FORMATOS_ENSAYO = {
    "ucs": ("ucs", "Compresión uniaxial"),
    "corte directo": ("corte-directo", "Corte directo"),
    "compresión triaxial": ("compresion-triaxial", "Compresión triaxial"),
    "tracción indirecta": ("traccion-indirecta", "Tracción indirecta"),
    "determinación de constantes elásticas": ("constantes-elasticas", "Determinación de constantes elásticas"),
}


def _texto(valor):
    return "" if valor is None else str(valor).strip()


def _valor_maestro(corridas, campo):
    valores = {_texto(corrida.get(campo)) for corrida in corridas}
    valores.discard("")
    if len(valores) > 1:
        raise ValueError(f"Las corridas tienen distintos valores para {campo}.")
    return next(iter(valores), "")


def preparar_campos(corridas, emision):
    codigo = _texto(emision.get("codigo_muestra"))
    if not codigo or not corridas:
        raise ValueError("La emisión necesita un código de muestra con al menos una corrida.")
    if any(_texto(corrida.get("codigo_muestra")) != codigo for corrida in corridas):
        raise ValueError(f"Todas las corridas deben corresponder a la muestra {codigo}.")

    tipo = _valor_maestro(corridas, "tipo_ensayo")
    clave_tipo = tipo.casefold()
    if clave_tipo in ("compresión uniaxial", "compresion uniaxial"):
        clave_tipo = "ucs"
    if clave_tipo not in FORMATOS_ENSAYO:
        raise ValueError(f"No hay una plantilla definida para el tipo de ensayo {tipo!r}.")
    formato, nombre_tipo = FORMATOS_ENSAYO[clave_tipo]

    proyecto = _valor_maestro(corridas, "proyecto")
    nombre = NOMBRES_PROYECTO.get(proyecto.upper(), proyecto)
    ejes = (
        ("E", _valor_maestro(corridas, "este")),
        ("N", _valor_maestro(corridas, "norte")),
        ("Elev.", _valor_maestro(corridas, "elevacion")),
    )
    coordenadas = "\n".join(f"{eje} {valor}" for eje, valor in ejes if valor)
    litologias = [_valor_maestro(corridas, campo) for campo in ("lito1", "lito2", "lito3")]
    fecha = _texto(emision.get("fecha_emision"))

    return {
        "formato_ensayo": formato,
        "tipo_ensayo": nombre_tipo,
        "texto_titulo": _texto(emision.get("texto_titulo")),
        "nombre_proyecto": f"Proyecto {nombre}" if nombre else "",
        "datos": {
            "informe": _texto(emision.get("numero_informe")),
            "muestreo": _texto(emision.get("muestreo")),
            "proyecto": nombre,
            "fecha_emision": date.fromisoformat(fecha).strftime("%d/%m/%Y") if fecha else "",
            "coordenadas": coordenadas,
            "ubicacion": _texto(emision.get("ubicacion")),
            "sector": _valor_maestro(corridas, "sectores"),
        },
        "muestra": {
            "material": _texto(emision.get("material")),
            "presentacion": _texto(emision.get("presentacion")),
            "muestreado": _texto(emision.get("muestreado")),
            "codigo": codigo,
            "sondaje": _valor_maestro(corridas, "sondaje"),
            "observaciones": _valor_maestro(corridas, "observacion"),
            "litologia": "_".join(litologias) if any(litologias) else "",
            "profundidad": _texto(emision.get("profundidad")),
        },
    }
