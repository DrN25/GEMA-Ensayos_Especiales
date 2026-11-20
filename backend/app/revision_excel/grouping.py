"""Compact group boundaries for Excel; no measurements are cached as results."""
import re


FALLBACK_CELL = "'Reglas de revisión'!$D$1"
TYPE_CODES = {
    'ucs': 'UCS', 'determinación de constantes elásticas': 'CE',
    'tracción indirecta': 'TI', 'corte directo': 'CD',
    'compresión triaxial': 'TX', 'propiedades físicas': 'PF', 'pf': 'PF',
}


def excel_text(value):
    if value is None:
        return ''
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float)):
        return format(value, '.15g')
    return str(value)


def excel_trim(value):
    return re.sub(' +', ' ', excel_text(value).strip(' '))


def normalize_code(value):
    text = excel_text(value).upper().replace(' ', '').replace('\u00a0', '')
    for old in ('–', '—', '−', '‑'):
        text = text.replace(old, '-')
    return text.replace('(', '').replace(')', '')


def group_key(values):
    return '|'.join((excel_trim(values[5]), excel_trim(values[3]).upper(),
                     normalize_code(values[1]), TYPE_CODES.get(excel_text(values[17]).casefold(), 'OTRO'),
                     normalize_code(values[2])))


class GroupIndex:
    def __init__(self):
        self.groups = {}
        self.legacy = {}
        self.last_row = 2

    def observe(self, row, cells):
        self.last_row = row
        values = [cell.value for cell in cells]
        for index, key in ((self.groups, group_key(values)), (self.legacy, excel_text(values[2]).casefold())):
            if key not in index:
                index[key] = [row, row, 1]
            else:
                index[key][1] = row
                index[key][2] += 1

    def constants(self, cells):
        values = [cell.value for cell in cells]
        key = group_key(values)
        # Legacy COUNTIFS interprets wildcards and coerces non-text codes.
        # Those anomalous codes retain a full search rather than changing the
        # original criteria's semantics through the exact-code index.
        legacy_bounds = self.legacy[excel_text(values[2]).casefold()]
        if not isinstance(values[2], str) or any(char in values[2] for char in '*?~'):
            legacy_bounds = (3, self.last_row)
        return {
            'group_start': self.groups[key][0], 'group_end': self.groups[key][1],
            'legacy_start': legacy_bounds[0], 'legacy_end': legacy_bounds[1],
            'original_group': key,
        }


def bounded_range(col, start, end, *, last='302', current=None):
    """INDEX returns a nonvolatile reference, not a scan of its source array.

    Identity edits enable one workbook-wide fallback so regrouping stays correct,
    including a changed row moving into a previously unrelated group. Re-upload
    after identity edits to rebuild short bounds and restore the fast path.
    """
    base = f'${col}$3:${col}${last}'
    lower = f'IF({FALLBACK_CELL},1,{start}-2)'
    upper = f'{current}-2' if current else f'IF({FALLBACK_CELL},ROWS({base}),{end}-2)'
    return f'INDEX({base},{lower}):INDEX({base},{upper})'


def optimize_legacy_pattern(pattern, start_col, end_col):
    """Preserve template algebra and criteria, only narrow aggregation ranges."""
    return re.sub(r'\$([A-Z]+)\$3:\$\1\$\{last\}',
                  lambda m: bounded_range(m[1], f'${start_col}'+'{row}', f'${end_col}'+'{row}', last='{last}'), pattern)
