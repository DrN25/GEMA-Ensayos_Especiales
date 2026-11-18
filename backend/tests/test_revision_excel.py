from io import BytesIO
from tempfile import TemporaryFile
from xml.etree import ElementTree as ET
from zipfile import ZipFile

import pytest
from openpyxl import Workbook, load_workbook
from openpyxl.formula.translate import Translator

from app.revision_excel.service import NS, SHEET, TEMPLATE, ReviewError, write_review


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
            formulas = {
                cell.get("r").rstrip("0123456789"): cell.findtext(NS + "f")
                for cell in last if cell.find(NS + "f") is not None
            }
            assert len(formulas) == len(expected) == 35
            for col, original in expected.items():
                translated = Translator("=" + original, origin=f"{col}3").translate_formula(f"{col}303")[1:]
                assert formulas[col] == translated.replace("$302", "$303")
            formats = [node.get("sqref") for node in generated.findall(NS + "conditionalFormatting")]
            assert len(formats) == 15
            assert "AT3:BV303" in formats
            assert len(generated.findall(f"{NS}dataValidations/{NS}dataValidation")) == 2
            assert generated.find(f"{NS}dataValidations/{NS}dataValidation").get("sqref") == "F3:F303 AS3:AS303"
            assert book.read("xl/comments1.xml") == template.read("xl/comments1.xml")
            assert book.read("xl/styles.xml") == template.read("xl/styles.xml")


def test_review_flags_formulas_in_the_original_data():
    with TemporaryFile() as output, pytest.raises(ReviewError, match="fórmulas"):
        write_review(input_file(1, formula=True), output)


def test_review_flags_an_empty_template():
    with TemporaryFile() as output, pytest.raises(ReviewError, match="no contiene registros"):
        write_review(input_file(0), output)
