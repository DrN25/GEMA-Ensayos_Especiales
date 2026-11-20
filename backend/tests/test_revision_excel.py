from io import BytesIO
from tempfile import TemporaryFile
from xml.etree import ElementTree as ET
from zipfile import ZipFile

import pytest
from openpyxl import Workbook, load_workbook

from app.revision_excel.service import NS, SHEET, TEMPLATE, ReviewError, write_review
from app.revision_excel.rules import definitions
from app.revision_excel.grouping import optimize_legacy_pattern
from app.revision_excel.service import formula_pattern
from openpyxl.utils.cell import get_column_letter


def input_file(records, *, reorder=False, formula=False):
    template = load_workbook(TEMPLATE, read_only=True)
    headers = list(next(template.active.iter_rows(min_row=2, max_row=2, max_col=45, values_only=True)))
    template.close()

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Hoja3"
    order = list(range(45))
    if reorder:
        order[0], order[2] = order[2], order[0]
    sheet.append([headers[index] for index in order])
    for i in range(records):
        row = [None] * 45
        row[0] = i + 1
        row[2] = "C-001" if i < 2 else "C-002"
        row[17] = "Corte directo"
        row[28] = "=1+1" if formula else 0
        row[30] = "170..99"
        sheet.append([row[index] for index in order])
    source = BytesIO()
    workbook.save(source)
    source.seek(0)
    return source


def test_review_extends_all_rules_and_preserves_input_types():
    source = input_file(301, reorder=True)
    with TemporaryFile() as output:
        summary = write_review(source, output)
        assert summary == {
            "registros": 301, "codigos_unicos": 2, "codigos_repetidos": 2,
            "por_tipo": [{"tipo": "Corte directo", "registros": 301}],
        }
        output.seek(0)
        result = load_workbook(output, read_only=True)
        sheet = result["Plantilla"]
        assert result.calculation.fullCalcOnLoad is True
        assert sheet["A3"].value == 1
        assert sheet["C3"].value == "C-001"
        assert sheet["AC3"].value == 0
        assert sheet["AE3"].value == "170..99"
        assert sheet["AA3"].value is None
        assert sheet.max_row == 303
        last_values = next(sheet.iter_rows(min_row=303, max_row=303))
        last_formulas = {cell.column_letter: cell.value[1:] for cell in last_values if cell.data_type == 'f'}
        result.close()

        output.seek(0)
        with ZipFile(output) as book, ZipFile(TEMPLATE) as template:
            generated = ET.fromstring(book.read(SHEET))
            seed = ET.fromstring(template.read(SHEET)).find(NS + "sheetData")[2]
            last = generated.find(NS + "sheetData")[-1]
            expected = {
                cell.get("r").rstrip("3"): cell.findtext(NS + "f")
                for cell in seed if cell.find(NS + "f") is not None
            }
            formulas = last_formulas
            assert len(expected) == 35
            assert len(formulas) == len(expected) + sum(c.formula is not None for c in definitions())
            for col, original in expected.items():
                refs = {c.key: get_column_letter(81+i) for i,c in enumerate(definitions())}
                optimized = optimize_legacy_pattern(formula_pattern(original), refs['legacy_start'], refs['legacy_end'])
                assert formulas[col] == optimized.format(row=303,last=303)
            formats = [node.get("sqref") for node in generated.findall(NS + "conditionalFormatting")]
            assert len(formats) == 16
            assert "AT3:BV303" in formats
            assert len(generated.findall(f"{NS}dataValidations/{NS}dataValidation")) == 3
            assert generated.find(f"{NS}dataValidations/{NS}dataValidation").get("sqref") == "F3:F303 AS3:AS303"
            assert book.read("xl/comments1.xml") == template.read("xl/comments1.xml")
            # Additional styles append to the existing collections; none of the
            # original cell-style indexes are moved or changed.
            old_styles = ET.fromstring(template.read("xl/styles.xml"))
            new_styles = ET.fromstring(book.read("xl/styles.xml"))
            for name in ("fonts", "fills", "cellXfs", "dxfs"):
                for old, new in zip(old_styles.find(NS+name), new_styles.find(NS+name)):
                    assert ET.tostring(old) == ET.tostring(new)


def test_review_flags_formulas_in_the_original_data():
    with TemporaryFile() as output, pytest.raises(ReviewError, match="fórmulas"):
        write_review(input_file(1, formula=True), output)


def test_review_flags_an_empty_template():
    with TemporaryFile() as output, pytest.raises(ReviewError, match="no contiene registros"):
        write_review(input_file(0), output)
