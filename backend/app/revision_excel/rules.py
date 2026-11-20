"""Additional, recalculable Excel controls. No PDF facts are inferred from the base.

Formulas use the template seed (row 3, range ending at 302). The service expands
them with the same tokenizer as the original template, without loading data rows.
"""
from dataclasses import dataclass
from functools import lru_cache

from openpyxl.styles.colors import COLOR_INDEX
from openpyxl.utils.cell import get_column_letter

from app.revision_excel.grouping import bounded_range


@dataclass(frozen=True)
class Column:
    key: str
    label: str
    description: str
    formula: str | None = None
    group: str = "Reglas de revisión adicionales"


def normalize_expression(cell):
    result = f'UPPER(SUBSTITUTE(SUBSTITUTE(TRIM({cell}&"")," ",""),CHAR(160),""))'
    for char, replacement in (("–", "-"), ("—", "-"), ("−", "-"), ("‑", "-"), ("(", ""), (")", "")):
        result = f'SUBSTITUTE({result},"{char}","{replacement}")'
    return result


@lru_cache(maxsize=1)
def definitions():
    columns = []

    def add(key, label, description, formula=None, group="Reglas de revisión adicionales"):
        columns.append(Column(key, label, description, formula, group))

    # Declare order first so formula construction can refer to later columns.
    fields = [
        ("red", "Celdas rojas de origen", "Celdas excluidas, por letra roja o relleno rojo. Lista editable con formato |S|T|. Los colores no se pueden consultar con fórmulas. Si cambia un color después de descargar, actualice esta lista."),
        ("exclude", "Excluir fila de los ajustes", "Escriba Sí para excluir toda esta fila. No borra los datos originales. Las celdas rojas se excluyen por campo, incluso si aquí dice No."),
        ("code", "Código normalizado", "Sin espacios ni paréntesis, con guiones unificados. M01(A) equivale a M01A. No modifica el código original."),
        ("hole", "Sondaje normalizado", "Normalización para contrastar el inicio del código."),
        ("kind", "Tipo normalizado", "CE conserva la abreviatura UCS en el código. Se admite TI y TR para tracción."),
        ("group", "Grupo año / laboratorio / ensayo", "Año F, laboratorio D, sondaje, tipo y código normalizados. No se mezclan años, laboratorios ni tipos. Una repetición de código no es un duplicado confirmado."),
        ("codes", "Control de código y sondaje", "Prefijo del código igual al sondaje y abreviatura acorde al tipo."),
        ("interval", "Control de intervalo (±0.01 m)", "Hasta mayor que Desde. Longitud igual a Hasta menos Desde, con tolerancia de 0.01 m."),
        ("ucs_calc", "UCS calculada (MPa)", "Carga kN × 10 / (π × diámetro cm² / 4). No usa valores rojos."),
        ("ucs_check", "Control UCS (2.5 %, 4–8 cm, 1–350 MPa)", "Aplica a UCS y CE. Diferencia relativa respecto de la resistencia calculada."),
        ("elastic", "Control E y ν (1–120 GPa, 0.05–0.45)", "ν > 0.5 es imposible. Rangos inclusivos. Datos vacíos o excluidos quedan pendientes."),
        ("deere", "Control E/UCS (100–1000)", "Convierte E de GPa a MPa antes de dividir por UCS."),
        ("classification", "Control clasificación UCS / CE", "Si UCS tiene E y ν numéricos, corresponde revisar su clasificación como constantes elásticas."),
        ("ti", "Control TI (0.5–30 MPa y kg/cm²)", "kg/cm² = MPa × 10.197. Margen absoluto 0.01 por redondeo. D, espesor y detalle de discos no están en la base."),
        ("cd_units", "Control CD kPa / MPa (±0.01)", "Comprueba por separado normal y corte cuando están ambas unidades. No inventa el valor ausente."),
        ("cd_range", "Control CD (10–80 cm², 15–60°, τ > 0)", "Rangos inclusivos. Usa esfuerzo en MPa o, si no existe, convierte kPa."),
        ("cd_c", "CD cohesión ajustada (MPa)", "Intercepto de regresión de τ contra σn. Solo puntos numéricos no rojos del grupo."),
        ("cd_phi", "CD fricción ajustada (°)", "atan(pendiente), en grados."),
        ("cd_r2", "CD R²", "Coeficiente de determinación de la regresión lineal. Requiere variación en σn y τ."),
        ("cd_fit", "Control ajuste CD (0.015 MPa, 0.5°, R² ≥ 0.95)", "Compara c y φ declarados con el ajuste. Un ajuste de dos puntos tiene R²=1 y no prueba por sí solo la calidad del informe."),
        ("cd_constant", "Control etapas CD (c, φ, área)", "Todos los valores presentes deben ser iguales dentro de ±0.01. Los faltantes se señalan por separado."),
        ("cd_sequence", "Control aumento σn por etapa CD", "En el orden original del archivo, cada esfuerzo normal debe superar al anterior del mismo grupo. No reordena filas."),
        ("tx_stress", "Control TX σ1 > σ3", "σ1 debe superar estrictamente a σ3. Confinamiento no negativo."),
        ("tx_points", "Control TX confinamientos distintos", "Al menos dos puntos no rojos con confinamientos diferentes."),
        ("hb_ci", "TX σci ajustada (MPa)", "Hoek-Brown intacto: regresión (σ1−σ3)² contra σ3. σci = raíz del intercepto."),
        ("hb_mi", "TX mi ajustado", "Pendiente de la regresión Hoek-Brown dividida por σci."),
        ("hb_check", "Control Hoek-Brown (σci 3 %, mi 10 %, mi 1–40)", "Comprueba valores declarados y parámetros físicos del ajuste. No usa σci/mi rojos."),
        ("mc_c", "TX cohesión MC lineal (MPa)", "Geomec e Ingeotest: σ1=a+kσ3. c=a/(2√k). UNI requiere equivalente Hoek-Brown con σ3max=σci/4, no este ajuste."),
        ("mc_phi", "TX fricción MC lineal (°)", "Geomec e Ingeotest: asin((k−1)/(k+1)), en grados. No se sustituye el método UNI."),
        ("tx_constant", "Control etapas TX (σci, mi, c, φ)", "Constancia por ensayo dentro de ±0.01. Cada etapa conserva su fila."),
        ("tx_sequence", "Control TX aumento σ1 con σ3", "Contrasta todos los puntos del grupo con menor confinamiento. No depende de que las filas estén ordenadas."),
        ("failure", "Control tipo de rotura", "Geomec I–V para TX/UCS; Ingeotest por matriz/estructura/ambas. Otros laboratorios no se evalúan aquí. La clasificación UNI por informe queda en Pendientes de integración."),
        ("context", "Control año y laboratorio", "Se requiere año numérico y laboratorio para validar los ajustes del grupo."),
        ("result", "Resultado de controles nuevos", "OBSERVACIÓN DE REVISIÓN no equivale a error de registro ni del PDF. PENDIENTE indica datos faltantes en la base. OK CONTROLES no certifica cotejo con PDF. No utiliza el resultado antiguo BV."),
    ]
    for key, label, detail in fields:
        add(key, label, detail)

    for family in ("cd", "hb", "mc"):
        for key, label in (("n", "Punto válido"), ("x", "X"), ("y", "Y"), ("xx", "X²"), ("yy", "Y²"), ("xy", "XY")):
            add(f"{family}_{key}_aux", f"Aux {family.upper()} {label}", "Auxiliar numérico para los ajustes del mismo año, laboratorio, tipo, sondaje y código.", group="Auxiliares de cálculo")
        for key in ("n", "x", "y", "xx", "yy", "xy", "slope", "intercept", "r2"):
            add(f"{family}_{key}_group", f"Aux {family.upper()} grupo {key}", "Estadística compartida del grupo. Evita expandir repetidamente la regresión en cada control.", group="Auxiliares de cálculo")

    for key, label in (("group_start", "Inicio de grupo"), ("group_end", "Fin de grupo"),
                       ("legacy_start", "Inicio de grupo original"), ("legacy_end", "Fin de grupo original"),
                       ("original_group", "Identidad de grupo al descargar"), ("original_code", "Código original al descargar"),
                       ("group_changed", "Identidad modificada")):
        add(key, label, "Índice para limitar el trabajo de cálculo. Si cambia una identidad, se activa la búsqueda completa para mantener resultados correctos.", group="Auxiliares de cálculo")

    refs = {column.key: f"{get_column_letter(81 + i)}3" for i, column in enumerate(columns)}
    formulas = {}
    r = refs.__getitem__

    def rg(key):
        col = r(key)[:-1]
        return bounded_range(col, r("group_start"), r("group_end"))

    def original_range(col):
        return bounded_range(col, r("group_start"), r("group_end"))

    # Escape wildcard characters in user codes before COUNTIFS / SUMIFS.
    key = f'SUBSTITUTE(SUBSTITUTE(SUBSTITUTE({r("group")},"~","~~"),"*","~*"),"?","~?")'
    group_args = f'{rg("group")},{key}'

    def usable(*cols):
        args = [f'{r("exclude")}<>"Sí"']
        for col in cols:
            args.extend((f'ISNUMBER({col}3)', f'ISERROR(SEARCH("|{col}|",{r("red")}))'))
        return f'AND({",".join(args)})'

    def status(condition):
        return f'IF({condition},"OK","OBSERVACIÓN DE REVISIÓN")'

    def check(kind, inputs, condition):
        return f'IF({kind},IF({inputs},{status(condition)},"PENDIENTE"),"NO APLICA")'

    ucs = f'OR({r("kind")}="UCS",{r("kind")}="CE")'
    ce = f'{r("kind")}="CE"'
    cd = f'{r("kind")}="CD"'
    tx = f'{r("kind")}="TX"'
    ti = f'{r("kind")}="TI"'
    formulas["group_changed"] = f'IF(OR({r("group")}<>{r("original_group")},C3<>{r("original_code")}),1,0)'
    formulas["code"] = normalize_expression("C3")
    formulas["hole"] = normalize_expression("B3")
    formulas["kind"] = 'IF(R3="UCS","UCS",IF(R3="Determinación de constantes elásticas","CE",IF(R3="Tracción indirecta","TI",IF(R3="Corte directo","CD",IF(R3="Compresión triaxial","TX",IF(OR(R3="Propiedades físicas",R3="PF"),"PF","OTRO"))))))'
    formulas["group"] = f'TRIM(F3&"")&"|"&UPPER(TRIM(D3))&"|"&{r("hole")}&"|"&{r("kind")}&"|"&{r("code")}'
    prefix = f'{r("hole")}&"-"&IF({ce},"UCS",{r("kind")})&"-"'
    prefix_tr = f'{r("hole")}&"-TR-"'
    code_condition = f'AND({r("kind")}<>"OTRO",OR(LEFT({r("code")},LEN({prefix}))={prefix},AND({ti},LEFT({r("code")},LEN({prefix_tr}))={prefix_tr})))'
    formulas["codes"] = f'IF(OR({r("code")}="",{r("hole")}=""),"PENDIENTE",{status(code_condition)})'
    formulas["interval"] = check("TRUE", usable("H", "I", "J"), 'AND(H3>=0,I3>H3,ABS(J3-(I3-H3))<=0.010000001)')
    formulas["ucs_calc"] = f'IF(AND({ucs},{usable("S","T")},S3>0),T3*10/(PI()*S3^2/4),"")'
    formulas["ucs_check"] = check(ucs, f'AND({usable("S","T","U")},{r("ucs_calc")}>0)', f'AND(S3>=4,S3<=8,U3>=1,U3<=350,ABS(U3/{r("ucs_calc")}-1)<=0.025000001)')
    formulas["elastic"] = check(ce, usable("W", "X"), 'AND(W3>=1,W3<=120,X3>=0.05,X3<=0.45)')
    formulas["deere"] = check(ce, f'AND({usable("W","U")},U3>0)', 'AND(W3*1000/U3>=100,W3*1000/U3<=1000)')
    formulas["classification"] = f'IF(AND({r("kind")}="UCS",{usable("W","X")}),"OBSERVACIÓN DE REVISIÓN","NO APLICA")'
    formulas["ti"] = check(ti, usable("Z", "AA"), 'AND(AA3>=0.5,AA3<=30,ABS(Z3-AA3*10.197)<=0.010000001)')
    formulas["cd_units"] = check(cd, usable("AD", "AE", "AF", "AG"), 'AND(ABS(AD3-AF3*1000)<=0.010000001,ABS(AE3-AG3*1000)<=0.010000001)')
    # Either MPa or kPa is enough for regression, but a red MPa cell must never
    # silently re-enter through conversion from a different red cell.
    normal = f'IF({usable("AF")},AF3,IF({usable("AD")},AD3/1000,""))'
    shear = f'IF({usable("AG")},AG3,IF({usable("AE")},AE3/1000,""))'
    formulas["cd_range"] = check(cd, f'AND({usable("AC","AI")},ISNUMBER({shear}))', f'AND(AC3>=10,AC3<=80,AI3>=15,AI3<=60,{shear}>0)')

    # Build the same sufficient statistics for all three straight-line fits.
    for family, condition, x, y in (
        ("cd", f'AND({cd},ISNUMBER(F3),TRIM(D3)<>"",ISNUMBER({normal}),ISNUMBER({shear}))', normal, shear),
        ("hb", f'AND({tx},ISNUMBER(F3),TRIM(D3)<>"",{usable("AJ","AK")},AK3>AJ3,AJ3>=0)', "AJ3", "(AK3-AJ3)^2"),
        ("mc", f'AND({tx},ISNUMBER(F3),TRIM(D3)<>"",{usable("AJ","AK")},AK3>AJ3,AJ3>=0)', "AJ3", "AK3"),
    ):
        n = r(f"{family}_n_aux")
        for suffix, expr in (("n", f'IF({condition},1,0)'), ("x", f'IF({n}=1,{x},0)'), ("y", f'IF({n}=1,{y},0)'),
                             ("xx", f'{r(f"{family}_x_aux")}^2'), ("yy", f'{r(f"{family}_y_aux")}^2'),
                             ("xy", f'{r(f"{family}_x_aux")}*{r(f"{family}_y_aux")}')):
            formulas[f"{family}_{suffix}_aux"] = expr

    def stats(family):
        sums = {}
        for s in ("n", "x", "y", "xx", "yy", "xy"):
            applies = cd if family == "cd" else tx
            formulas[f"{family}_{s}_group"] = f'IF({applies},SUMIFS({rg(f"{family}_{s}_aux")},{group_args}),0)'
            sums[s] = r(f"{family}_{s}_group")
        n, x, y, xx, yy, xy = (sums[s] for s in ("n", "x", "y", "xx", "yy", "xy"))
        den = f'({n}*{xx}-{x}^2)'
        cov = f'({n}*{xy}-{x}*{y})'
        valid = f'AND({n}>=2,{den}>0)'
        slope = r(f"{family}_slope_group")
        intercept = r(f"{family}_intercept_group")
        r2 = r(f"{family}_r2_group")
        formulas[f"{family}_slope_group"] = f'IF({valid},{cov}/{den},"")'
        formulas[f"{family}_intercept_group"] = f'IF({valid},({y}-{slope}*{x})/{n},"")'
        formulas[f"{family}_r2_group"] = f'IF(AND({valid},{n}*{yy}-{y}^2>0),{cov}^2/({den}*({n}*{yy}-{y}^2)),"")'
        return valid, slope, intercept, r2

    valid, slope, intercept, r2 = stats("cd")
    formulas["cd_c"] = f'IF(AND({cd},{valid}),{intercept},"")'
    formulas["cd_phi"] = f'IF(AND({cd},{valid}),DEGREES(ATAN({slope})),"")'
    formulas["cd_r2"] = f'IF({cd},{r2},"")'
    formulas["cd_fit"] = check(cd, f'AND({usable("AH","AI")},ISNUMBER({r("cd_c")}),ISNUMBER({r("cd_phi")}),ISNUMBER({r("cd_r2")}))', f'AND(ABS(AH3-{r("cd_c")})<=0.015000001,ABS(AI3-{r("cd_phi")})<=0.500000001,{r("cd_r2")}>=0.949999999)')

    def consistency(kind, cols):
        comparisons = []
        for col in cols:
            # Compare to current row, then every row supplies the reverse bound.
            comparisons.append(f'COUNTIFS({group_args},{original_range(col)},">"&({col}3+0.010000001),{rg("exclude")},"<>Sí",{rg("red")},"<>*|{col}|*")=0')
        return check(kind, usable(*cols), f'AND({",".join(comparisons)})')

    formulas["cd_constant"] = consistency(cd, ("AH", "AI", "AC"))
    # Compare against all preceding valid stages without sorting source rows.
    # Use normalized MPa auxiliary, including rows supplied only in kPa.
    group_before = bounded_range(r("group")[:-1], r("group_start"), r("group_end"), current="ROW()")
    x_before = bounded_range(r("cd_x_aux")[:-1], r("group_start"), r("group_end"), current="ROW()")
    n_before = bounded_range(r("cd_n_aux")[:-1], r("group_start"), r("group_end"), current="ROW()")
    previous = f'COUNTIFS({group_before},{key},{x_before},">="&{r("cd_x_aux")},{n_before},1)'
    formulas["cd_sequence"] = check(cd, f'{r("cd_n_aux")}=1', f'{previous}=1')
    formulas["tx_stress"] = check(tx, usable("AJ", "AK"), 'AND(AJ3>=0,AK3>AJ3)')
    valid, slope, intercept, _ = stats("hb")
    formulas["tx_points"] = f'IF({tx},{status(valid)},"NO APLICA")'
    formulas["hb_ci"] = f'IF(AND({tx},{valid}),IF({intercept}>0,SQRT({intercept}),""),"")'
    formulas["hb_mi"] = f'IF(AND({tx},ISNUMBER({r("hb_ci")}),{r("hb_ci")}>0),{slope}/{r("hb_ci")},"")'
    formulas["hb_check"] = check(tx, f'AND({usable("AL","AM")},ISNUMBER({r("hb_ci")}),ISNUMBER({r("hb_mi")}),{r("hb_ci")}>0,{r("hb_mi")}>0)', f'AND(AM3>=1,AM3<=40,ABS(AL3/{r("hb_ci")}-1)<=0.030000001,ABS(AM3/{r("hb_mi")}-1)<=0.100000001)')
    valid_mc, slope_mc, intercept_mc, _ = stats("mc")
    linear_lab = 'OR(ISNUMBER(SEARCH("GEOMEC",D3)),ISNUMBER(SEARCH("INGEOTEST",D3)))'
    formulas["mc_c"] = f'IF(AND({tx},{linear_lab},{valid_mc}),IF({slope_mc}>0,{intercept_mc}/(2*SQRT({slope_mc})),""),"")'
    formulas["mc_phi"] = f'IF(AND({tx},{linear_lab},{valid_mc}),IF({slope_mc}>0,DEGREES(ASIN(({slope_mc}-1)/({slope_mc}+1))),""),"")'
    formulas["tx_constant"] = consistency(tx, ("AL", "AM", "AN", "AO"))
    formulas["tx_sequence"] = check(tx, f'{r("hb_n_aux")}=1', f'COUNTIFS({group_args},{rg("hb_n_aux")},1,{rg("hb_x_aux")},"<"&AJ3,{rg("mc_y_aux")},">="&AK3)=0')
    failure_value = f'IF({tx},UPPER(TRIM(AP3&"")),UPPER(TRIM(V3&"")))'
    roman_options = ','.join(f'{failure_value}="{v}"' for v in ("I", "II", "III", "IV", "V"))
    text_options = ','.join(f'{failure_value}="{v}"' for v in ("POR MATRIZ", "POR ESTRUCTURA", "POR MATRIZ Y ESTRUCTURA", "MATRIZ", "ESTRUCTURA", "MATRIZ Y ESTRUCTURA"))
    roman = f'OR({roman_options})'
    text_failure = f'OR({text_options})'
    formulas["failure"] = f'IF(AND(OR({ucs},{tx}),{linear_lab}),IF({failure_value}="","PENDIENTE",IF(ISNUMBER(SEARCH("GEOMEC",D3)),{status(roman)},{status(text_failure)})),"NO APLICA")'
    formulas["context"] = f'IF(AND(ISNUMBER(F3),TRIM(D3)<>""),"OK","PENDIENTE")'
    controls = [k for k, _, _ in fields if k not in ("red", "exclude", "code", "hole", "kind", "group", "ucs_calc", "cd_c", "cd_phi", "cd_r2", "hb_ci", "hb_mi", "mc_c", "mc_phi", "result")]
    has_observation = 'OR(' + ','.join(f'{r(k)}="OBSERVACIÓN DE REVISIÓN"' for k in controls) + ')'
    has_pending = 'OR(' + ','.join(f'{r(k)}="PENDIENTE"' for k in controls) + ')'
    formulas["result"] = f'IF({r("exclude")}="Sí","EXCLUIDA",IF({has_observation},"OBSERVACIÓN DE REVISIÓN",IF({has_pending},"PENDIENTE","OK CONTROLES")))'
    return tuple(Column(c.key, c.label, c.description, formulas.get(c.key), c.group) for c in columns)


def red_components(cell, theme_colors=()):
    """Return red-font/red-fill flags, including indexed and theme colors."""
    def is_red(color):
        if color is None:
            return False
        if color.type == "rgb":
            value = color.rgb
        elif color.type == "indexed" and 0 <= color.indexed < len(COLOR_INDEX):
            value = COLOR_INDEX[color.indexed]
        elif color.type == "theme" and color.theme < len(theme_colors):
            value = theme_colors[color.theme]
        else:
            return False
        try:
            rgb = [int(value[-6:][i:i + 2], 16) for i in (0, 2, 4)]
        except (ValueError, TypeError):
            return False
        tint = color.tint or 0
        rgb = [v * (1 + tint) if tint < 0 else v * (1 - tint) + 255 * tint for v in rgb]
        return rgb[0] >= 150 and rgb[0] > rgb[1] * 1.4 and rgb[0] > rgb[2] * 1.4

    font = getattr(cell, "font", None)
    fill = getattr(cell, "fill", None)
    return bool(font and is_red(font.color)), bool(fill and fill.patternType == "solid" and is_red(fill.fgColor))
