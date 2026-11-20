import re
from collections import Counter
from datetime import date, datetime, time, timedelta
from functools import lru_cache
from pathlib import Path
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, BadZipFile, ZipFile

from openpyxl import load_workbook
from openpyxl.formula.tokenizer import Tokenizer
from openpyxl.utils.cell import get_column_letter
from openpyxl.utils.datetime import to_excel

from app.revision_excel.layout import extend_sheet, extra_parts, text_cell, theme_colors
from app.revision_excel.rules import definitions, red_components
from app.revision_excel.grouping import GroupIndex, optimize_legacy_pattern


TEMPLATE = Path(__file__).with_name("plantilla_auditoria_v1.xlsx")
SHEET = "xl/worksheets/sheet1.xml"
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
INPUT_WIDTH = 45
SEED_ROW = 3
ORIGINAL_LAST_ROW = 302
MAX_RECORDS = 25_000
MAX_FILE_BYTES = 25 * 1024**2
MAX_EXPANDED_BYTES = 160 * 1024**2
MAX_STRINGS_BYTES = 8 * 1024**2
REFERENCE = re.compile(r"(\$?[A-Z]{1,3})(\$?)(\d+)")
KNOWN_TYPES = {
    name.casefold(): name for name in (
        "UCS", "Determinación de constantes elásticas", "Tracción indirecta", "Corte directo", "Compresión triaxial"
    )
}


class ReviewError(ValueError):
    pass


def normalize_header(value):
    return " ".join(str(value or "").split()).casefold()


def formula_pattern(formula: str) -> str:
    """Compile row references and the original fixed group range once per column."""
    def reference(value):
        match = REFERENCE.fullmatch(value)
        if not match:
            return value
        col, fixed, row = match.groups()
        if not fixed and int(row) == SEED_ROW:
            return col + "{row}"
        if fixed and int(row) == ORIGINAL_LAST_ROW:
            return col + fixed + "{last}"
        return value

    parts = []
    for token in Tokenizer("=" + formula).items:
        value = token.value.replace("{", "{{").replace("}", "}}")
        if token.type == "OPERAND" and token.subtype == "RANGE":
            value = ":".join(reference(part) for part in value.split(":"))
        parts.append(value)
    return "".join(parts)


@lru_cache(maxsize=1)
def template_parts():
    with ZipFile(TEMPLATE) as book:
        xml = book.read(SHEET)
    head, body = xml.split(b"<sheetData>", 1)
    raw_rows, tail = body.split(b"</sheetData>", 1)
    headers = b"".join(row + b"</row>" for row in raw_rows.split(b"</row>", 2)[:2])
    _, second, seed = ET.fromstring(xml).find(NS + "sheetData")
    expected = tuple(normalize_header(cell.findtext(f"{NS}is/{NS}t")) for cell in list(second)[:INPUT_WIDTH])
    styles = {cell.get("r").rstrip("0123456789"): cell.get("s", "0") for cell in seed}
    formulas = [
        (cell.get("r").rstrip("0123456789"), formula_pattern(cell.findtext(NS + "f")))
        for cell in seed if cell.find(NS + "f") is not None
    ]
    return head, headers, tail, expected, styles, formulas


def check_archive(file):
    try:
        with ZipFile(file) as zipped:
            members = zipped.infolist()
            if len(members) > 1000 or sum(x.file_size for x in members) > MAX_EXPANDED_BYTES:
                raise ReviewError("El contenido descomprimido del Excel supera el límite de esta revisión.")
            if any(x.filename == "xl/sharedStrings.xml" and x.file_size > MAX_STRINGS_BYTES for x in members):
                raise ReviewError("El Excel tiene una tabla de textos demasiado grande para la revisión.")
    except BadZipFile as error:
        raise ReviewError("El archivo no es un libro .xlsx válido.") from error
    finally:
        file.seek(0)


def identify_input(workbook, expected):
    matches = []
    for sheet in workbook.worksheets:
        sheet.reset_dimensions()
        for row_number, cells in enumerate(sheet.iter_rows(max_row=5, max_col=INPUT_WIDTH, values_only=True), 1):
            headers = tuple(map(normalize_header, cells))
            if len(set(headers)) == INPUT_WIDTH and set(headers) == set(expected):
                positions = {label: idx for idx, label in enumerate(headers)}
                matches.append((sheet, row_number + 1, tuple(positions[label] for label in expected)))
                break
    if len(matches) != 1:
        raise ReviewError(
            "Se encontró más de una hoja con los encabezados de Ensayos Especiales."
            if matches else "No se encontraron los 45 encabezados de Ensayos Especiales de la plantilla (A:AS)."
        )
    return matches[0]


def input_rows(sheet, first, positions):
    for source_number, cells in enumerate(sheet.iter_rows(min_row=first, max_col=INPUT_WIDTH), first):
        if all(cell.value is None or isinstance(cell.value, str) and not cell.value.strip() for cell in cells):
            continue
        if any(cell.data_type == "f" for cell in cells):
            raise ReviewError(
                f"La fila {source_number} contiene fórmulas en las columnas de entrada. "
                "Pega esas celdas como valores antes de subir el archivo."
            )
        yield [cells[idx] for idx in positions]


def summarize(sheet, first, positions, group_index=None):
    codes = Counter()
    types = Counter()
    total = 0
    for row in input_rows(sheet, first, positions):
        total += 1
        if total > MAX_RECORDS:
            raise ReviewError(f"El archivo supera el límite de {MAX_RECORDS:,} registros por revisión.")
        if group_index is not None:
            group_index.observe(total + SEED_ROW - 1, row)
        code = row[2].value
        if code is not None and str(code).strip():
            codes[str(code).strip().casefold()] += 1
        kind = str(row[17].value or "").strip()
        types[KNOWN_TYPES.get(kind.casefold(), "Otros tipos" if kind else "Sin tipo")] += 1
    if not total:
        raise ReviewError("El archivo tiene los encabezados de la plantilla, pero no contiene registros.")
    return {
        "registros": total,
        "codigos_unicos": len(codes),
        "codigos_repetidos": sum(count > 1 for count in codes.values()),
        "por_tipo": [{"tipo": name, "registros": count} for name, count in types.most_common()],
    }


def value_xml(address, style, cell, date_epoch):
    value = cell.value
    if value is None:
        return ""
    ref = f'<c r="{address}" s="{style}"'
    if cell.data_type == "e":
        return f'{ref} t="e"><v>{escape(value)}</v></c>'
    if isinstance(value, bool):
        return f'{ref} t="b"><v>{int(value)}</v></c>'
    if isinstance(value, (date, datetime, time)):
        return f'{ref} t="d"><v>{value.isoformat()}</v></c>'
    if isinstance(value, timedelta):
        value = to_excel(value, date_epoch)
    if isinstance(value, (int, float)):
        return f'{ref}><v>{value}</v></c>'
    text = escape(str(value), {"\r": "&#13;"})
    return f'{ref} t="inlineStr"><is><t xml:space="preserve">{text}</t></is></c>'


def shared_formula_xml(col, row, last, style, index, pattern):
    """Excel-native shared formulas keep large reviews small and recalculable.

    Only the anchor contains formula text. All other rows refer to its shared
    index; Excel translates relative references and preserves absolute ranges.
    """
    # Excel's shared-formula reader can discard dynamic reference expressions
    # (INDEX(...):INDEX(...)). Emit those as ordinary formulas; keep compact
    # sharing for the remaining scalar formulas. Calculation bounds stay intact.
    if 'INDEX(' in pattern.upper():
        formula = escape(pattern.format(row=row, last=last))
        return f'<c r="{col}{row}" s="{style}"><f>{formula}</f></c>'
    if row == SEED_ROW:
        formula = escape(pattern.format(row=row, last=last))
        body = f'<f t="shared" ref="{col}{row}:{col}{last}" si="{index}">{formula}</f>'
    else:
        body = f'<f t="shared" si="{index}"/>'
    return f'<c r="{col}{row}" s="{style}">{body}</c>'


def write_review(source, output):
    check_archive(source)
    head, headers, tail, expected, styles, formulas = template_parts()
    try:
        workbook = load_workbook(source, read_only=True, keep_links=False)
    except (ValueError, KeyError, OSError, ET.ParseError, BadZipFile) as error:
        raise ReviewError("No se pudo leer el contenido del Excel.") from error

    try:
        sheet, first, positions = identify_input(workbook, expected)
        group_index = GroupIndex()
        summary = summarize(sheet, first, positions, group_index)
        last_row = summary["registros"] + SEED_ROW - 1
        end = str(last_row).encode()
        tail = re.sub(rb'sqref="([^"]+)"',
                      lambda match: b'sqref="' + re.sub(rb'(?<=[A-Z])302\b', end, match[1]) + b'"', tail)
        columns = tuple(get_column_letter(i) for i in range(1, INPUT_WIDTH + 1))
        new_rules = tuple((get_column_letter(81+i), column, formula_pattern(column.formula) if column.formula else None)
                          for i, column in enumerate(definitions()))
        addresses = {rule.key: col for col, rule, _ in new_rules}
        formulas = [(col, optimize_legacy_pattern(pattern, addresses['legacy_start'], addresses['legacy_end']))
                    for col, pattern in formulas]
        theme = theme_colors(workbook)

        with ZipFile(TEMPLATE) as base, ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=3) as result:
            additions, added_styles, red_styles = extra_parts(base, last_row)
            head, headers, tail = extend_sheet(head, headers, tail, last_row, added_styles)
            for name in base.namelist():
                if name != SHEET:
                    result.writestr(name, additions.pop(name, None) or base.read(name))
            for name, content in additions.items():
                result.writestr(name, content)
            with result.open(SHEET, "w") as out:
                out.write(head + b"<sheetData>" + headers)
                for row_number, values in enumerate(input_rows(sheet, first, positions), SEED_ROW):
                    constants = group_index.constants(values)
                    cells = [f'<row r="{row_number}">']
                    red_columns = []
                    for col, cell in zip(columns, values):
                        font_red, fill_red = red_components(cell, theme)
                        style = styles.get(col, "0")
                        if (font_red or fill_red) and cell.value is not None:
                            red_columns.append(col)
                            style = red_styles[(style, font_red, fill_red)]
                        cells.append(value_xml(f"{col}{row_number}", style, cell, workbook.epoch))
                    for index, (col, pattern) in enumerate(formulas):
                        cells.append(shared_formula_xml(col, row_number, last_row, styles[col], index, pattern))
                    for index, (col, rule, pattern) in enumerate(new_rules, len(formulas)):
                        address = f"{col}{row_number}"
                        if pattern is not None:
                            cells.append(shared_formula_xml(col, row_number, last_row, added_styles["value"], index, pattern))
                        elif rule.key == "red":
                            cells.append(text_cell(address, "|" + "|".join(red_columns) + "|" if red_columns else "", added_styles["input"]))
                        elif rule.key == "exclude":
                            cells.append(text_cell(address, "No", added_styles["input"]))
                        elif rule.key == 'original_code':
                            cells.append(value_xml(address, added_styles['value'], values[2], workbook.epoch))
                        elif rule.key in constants:
                            value = constants[rule.key]
                            if isinstance(value, int):
                                cells.append(f'<c r="{address}" s="{added_styles["value"]}"><v>{value}</v></c>')
                            else:
                                cells.append(text_cell(address, value, added_styles['value']))
                        else:
                            cells.append(f'<c r="{address}" s="{added_styles["input"]}"/>')
                    cells.append("</row>")
                    out.write("".join(cells).encode())
                out.write(b"</sheetData>" + tail)
        return summary
    except (ValueError, KeyError, OSError, ET.ParseError, BadZipFile) as error:
        if isinstance(error, ReviewError):
            raise
        raise ReviewError("No se pudo procesar la hoja del Excel.") from error
    finally:
        workbook.close()
