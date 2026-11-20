"""Integration checks for the streamed additional audit, without SQL or Excel COM."""
from io import BytesIO
from tempfile import TemporaryFile
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from openpyxl import load_workbook
from openpyxl.styles import Color, Font, PatternFill
from openpyxl.utils.cell import get_column_letter

from app.revision_excel.rules import definitions, red_components
from app.revision_excel.service import NS, SHEET, write_review
from tests.test_revision_excel import input_file
from app.revision_excel.layout import GUIDANCE


def assert_compatibility_prefixes(xml):
    """Validate prefix lists which a normal XML parser treats as plain text."""
    scopes, pending = [], {}
    compatibility = '{http://schemas.openxmlformats.org/markup-compatibility/2006}'
    for event, item in ET.iterparse(BytesIO(xml), events=('start-ns', 'start', 'end')):
        if event == 'start-ns':
            pending[item[0]] = item[1]
        elif event == 'start':
            scope = {**(scopes[-1] if scopes else {}), **pending}
            pending = {}
            scopes.append(scope)
            for name in ('Ignorable', 'MustUnderstand', 'PreserveAttributes', 'PreserveElements', 'ProcessContent'):
                for value in item.get(compatibility + name, '').split():
                    assert value.split(':')[0] in scope, f'Undeclared compatibility prefix {value}'
            if item.tag == compatibility + 'Choice':
                for prefix in item.get('Requires', '').split():
                    assert prefix in scope, f'Undeclared Choice prefix {prefix}'
        else:
            scopes.pop()


def test_appended_rules_have_only_active_controls_and_separate_pending_sheet():
    with TemporaryFile() as output:
        write_review(input_file(1), output)
        output.seek(0)
        result = load_workbook(output)
        sheet = result['Plantilla']
        assert sheet.max_column == 80 + len(definitions())
        assert sheet.freeze_panes == 'D3'
        assert result.calculation.fullCalcOnLoad
        for i, rule in enumerate(definitions(), 81):
            col = get_column_letter(i)
            assert sheet[f'{col}2'].value == rule.label
            if rule.formula:
                assert sheet[f'{col}3'].data_type == 'f'
                assert '$302' not in sheet[f'{col}3'].value
                assert len(sheet[f'{col}3'].value) <= 8192
            elif rule.group == 'Auxiliares de cálculo':
                assert sheet[f'{col}3'].value is not None
        assert sheet['CD3'].value == 'No'
        assert sheet['DJ3'].value.startswith('=IF(CD3=')
        assert 'BV3' not in sheet['DJ3'].value
        assert len(sheet.data_validations.dataValidation) == 3
        assert not result.calculation.forceFullCalc
        assert result.calculation.calcMode == 'auto'
        assert not {'pdf_depth','report','page','finding','pending','cross','pf'}.intersection(c.key for c in definitions())
        guide = result['Reglas de revisión']
        assert guide.freeze_panes == 'A3'
        assert guide.max_row == 3 + len(GUIDANCE) + len(definitions())
        text = '\n'.join(str(cell.value or '') for row in result['Pendientes de integración'] for cell in row)
        assert 'Error de registro' in text
        assert '050' in text and '027' in text
        assert 'No Central' in text
        result.close()


def test_red_marks_are_preserved_and_exclusion_is_per_source_cell():
    original = load_workbook(input_file(3))
    sheet = original.active
    sheet['AC2'].font = Font(color='FFFF0000')
    sheet['AE2'].fill = PatternFill('solid', fgColor='FFFF0000')
    sheet['AC3'].font = Font(color=Color(indexed=10))
    sheet['AE3'].fill = PatternFill('solid', fgColor='FF0000FF')
    sheet['AC4'].font = Font(color='FF000000')
    source = BytesIO()
    original.save(source)
    original.close()
    source.seek(0)
    with TemporaryFile() as output:
        write_review(source, output)
        output.seek(0)
        result = load_workbook(output)
        audited = result['Plantilla']
        assert audited['CC3'].value == '|AC|AE|'
        assert audited['CC4'].value == '|AC|'
        assert audited['CC5'].value == '' or audited['CC5'].value is None
        assert audited['AC3'].value == 0  # red zero is still retained, not erased
        assert audited['AE3'].value == '170..99'
        assert audited['AC3'].font.color.rgb == 'FFFF0000'
        assert audited['AE3'].fill.fgColor.rgb == 'FFFF0000'
        # Helpers decide eligibility from editable exclusion metadata, not a
        # static server-side boolean, so they recalculate after user edits.
        refs = {c.key:get_column_letter(81+i) for i,c in enumerate(definitions())}
        assert 'CC3' in audited[refs['cd_n_aux']+'3'].value
        assert 'CD3' in audited[refs['cd_n_aux']+'3'].value
        result.close()


def test_red_detection_supports_theme_tints_and_ignores_non_red_colors():
    from types import SimpleNamespace
    cell = SimpleNamespace(fill=None)
    cell.font = Font(color=Color(theme=2, tint=.2))
    assert red_components(cell, ('000000', 'FFFFFF', 'C00000')) == (True, False)
    cell.font = Font(color=Color(theme=2, tint=.9))
    assert red_components(cell, ('000000', 'FFFFFF', 'C00000')) == (False, False)


def test_zip_parts_and_original_rows_are_preserved_without_reordering():
    source = input_file(4)
    with TemporaryFile() as output:
        write_review(source, output)
        output.seek(0)
        with ZipFile(output) as zipped:
            assert zipped.testzip() is None
            root = ET.fromstring(zipped.read(SHEET))
            assert root.find(NS+'dimension').get('ref') == f'A1:{get_column_letter(80+len(definitions()))}6'
            rows = root.find(NS+'sheetData')
            assert [r.get('r') for r in rows] == ['1', '2', '3', '4', '5', '6']
            for name in ('xl/workbook.xml', 'xl/_rels/workbook.xml.rels', '[Content_Types].xml', 'xl/worksheets/sheet2.xml'):
                ET.fromstring(zipped.read(name))


def test_excel_workbook_has_unique_sheet_ids_and_declared_compatibility_prefixes():
    with TemporaryFile() as output:
        write_review(input_file(2), output)
        output.seek(0)
        with ZipFile(output) as zipped:
            workbook = ET.fromstring(zipped.read('xl/workbook.xml'))
            sheets = workbook.find(NS+'sheets')
            ids = [sheet.get('sheetId') for sheet in sheets]
            assert len(ids) == len(set(ids)) == 3
            assert ids == ['2', '3', '4']
            for name in ('xl/workbook.xml', 'xl/styles.xml', SHEET, 'xl/worksheets/sheet2.xml', 'xl/worksheets/sheet3.xml'):
                assert_compatibility_prefixes(zipped.read(name))


def test_excel_columns_are_ordered_non_overlapping_and_cover_the_new_headers():
    with TemporaryFile() as output:
        write_review(input_file(2), output)
        output.seek(0)
        with ZipFile(output) as zipped:
            sheet = ET.fromstring(zipped.read(SHEET))
            previous = 0
            for col in sheet.find(NS+'cols'):
                first, last = int(col.get('min')), int(col.get('max'))
                assert first > previous
                assert first <= last <= 16384
                previous = last
            assert previous == 16384
            for row in list(sheet.find(NS+'sheetData'))[:2]:
                assert row.get('spans') == f'1:{80+len(definitions())}'


def test_compatibility_validator_catches_the_previous_namespace_regression():
    import pytest
    broken = b'<workbook xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x15"/>'
    with pytest.raises(AssertionError, match='Undeclared compatibility prefix x15'):
        assert_compatibility_prefixes(broken)


def test_new_colors_have_explicit_light_backgrounds_and_dark_text():
    with TemporaryFile() as output:
        write_review(input_file(2), output)
        output.seek(0)
        result = load_workbook(output)
        sheet = result['Plantilla']
        assert sheet['CC2'].fill.fgColor.rgb == 'FFE8DFF5'
        assert sheet['CC2'].font.color.rgb == 'FF4C3267'
        assert sheet['CI3'].fill.fgColor.rgb == 'FFFFFFFF'
        result.close()
        output.seek(0)
        with ZipFile(output) as package:
            root = ET.fromstring(package.read(SHEET))
            cf = next(c for c in root.findall(NS+'conditionalFormatting') if c.get('sqref').startswith('CI3:'))
            ranges = cf.get('sqref')
            assert 'DJ3:DJ4' in ranges
            assert 'CK3:CK4' not in ranges  # numeric output, no conditional work
            assert 'DK3:DK4' not in ranges  # hidden auxiliary, no conditional work
            dxfs = ET.fromstring(package.read('xl/styles.xml')).find(NS+'dxfs')
            for rule in cf:
                dxf = dxfs[int(rule.get('dxfId'))]
                pattern = dxf.find(f'{NS}fill/{NS}patternFill')
                foreground = pattern.find(NS+'fgColor').get('rgb')
                background = pattern.find(NS+'bgColor').get('rgb')
                assert foreground == background
                assert background in ('FFFCE4D6', 'FFFFE5BF', 'FFE7E6E6')
                assert dxf.find(f'{NS}font/{NS}color').get('rgb') in ('FF9C2415', 'FF713B08', 'FF404040')


def test_group_index_handles_non_contiguous_rows_and_preserves_legacy_grouping():
    original = load_workbook(input_file(4))
    sheet = original.active
    for row in range(2, 6):
        sheet[f'B{row}'] = 'H-1'
        sheet[f'D{row}'] = 'Geomec'
        sheet[f'F{row}'] = 2025
        sheet[f'R{row}'] = 'Compresión triaxial'
    sheet['C2'] = 'H-1–TX–M01(A)'
    sheet['C3'] = 'H-1-TX-M02'
    sheet['C4'] = 'H-1-TX-M01A'
    sheet['C5'] = 'H-1-TX-M01A'
    sheet['F5'] = 2024
    source = BytesIO()
    original.save(source)
    original.close()
    source.seek(0)
    refs = {c.key:get_column_letter(81+i) for i,c in enumerate(definitions())}
    with TemporaryFile() as output:
        write_review(source, output)
        output.seek(0)
        result = load_workbook(output)
        generated = result['Plantilla']
        def value(key,row):
            return generated[f'{refs[key]}{row}'].value
        assert (value('group_start',3),value('group_end',3)) == (3,5)
        assert (value('group_start',5),value('group_end',5)) == (3,5)
        assert (value('group_start',6),value('group_end',6)) == (6,6)
        assert (value('legacy_start',5),value('legacy_end',5)) == (5,6)
        assert value('original_group',3) == value('original_group',5)
        assert value('original_group',3) != value('original_group',6)
        assert value('original_code',3) == 'H-1–TX–M01(A)'
        assert 'IF(' in value('group_changed',3)
        assert 'ROWS(' in value('cd_n_group',3)
        assert 'ROW()-2' in generated['CX5'].value
        assert '<>"Corte directo"' in generated['BK5'].value
        result.close()


def test_range_work_grows_with_group_size_instead_of_total_file_size():
    from types import SimpleNamespace
    from app.revision_excel.grouping import GroupIndex
    index = GroupIndex()
    for row in range(3,1503):
        values = [None]*45
        values[1],values[2],values[3],values[5],values[17] = 'H-1',f'H-1-TX-M{(row-3)//3}', 'Geomec',2025,'Compresión triaxial'
        index.observe(row,[SimpleNamespace(value=v) for v in values])
    candidate_rows = sum((last-first+1)*count for first,last,count in index.groups.values())
    assert candidate_rows == 4500
    assert candidate_rows < 1500**2 / 100


def test_legacy_anomalous_codes_keep_full_range_criteria_semantics():
    from types import SimpleNamespace
    from app.revision_excel.grouping import GroupIndex
    index = GroupIndex()
    samples = []
    for row, code in enumerate(('H-1-TX-M*', 'H-1-TX-M01', None),3):
        values = [None]*45
        values[2] = code
        cells = [SimpleNamespace(value=v) for v in values]
        samples.append(cells)
        index.observe(row,cells)
    for cells in (samples[0], samples[2]):
        bounds = index.constants(cells)
        assert (bounds['legacy_start'],bounds['legacy_end']) == (3,5)
    bounds = index.constants(samples[1])
    assert (bounds['legacy_start'],bounds['legacy_end']) == (4,4)


def test_dynamic_reference_formulas_are_not_written_as_shared_formulas():
    with TemporaryFile() as output:
        write_review(input_file(3), output)
        output.seek(0)
        with ZipFile(output) as package:
            rows = ET.fromstring(package.read(SHEET)).find(NS+'sheetData')
            dynamic = 0
            for row in list(rows)[2:]:
                for cell in row:
                    formula = cell.find(NS+'f')
                    if formula is not None and 'INDEX(' in (formula.text or ''):
                        assert formula.get('t') is None
                        assert formula.get('si') is None
                        dynamic += 1
            assert dynamic > 0
