"""Small OOXML additions to the original template; data rows remain streamed."""
from copy import deepcopy
from io import BytesIO
import re
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape

from openpyxl.utils.cell import get_column_letter

from app.revision_excel.rules import definitions

URI = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS = "{" + URI + "}"


def text_cell(address, value, style):
    return f'<c r="{address}" s="{style}" t="inlineStr"><is><t xml:space="preserve">{escape(str(value))}</t></is></c>'


def serialize(root, namespace, source=None):
    # Markup-compatibility attributes contain namespace *prefixes* as text.
    # ElementTree otherwise drops unused xmlns declarations and renames those
    # still used by nodes, leaving mc:Ignorable / mc:Choice Requires invalid.
    # Ordinary XML parsing does not detect these dangling prefix references.
    namespaces = dict(item for _, item in ET.iterparse(BytesIO(source), events=("start-ns",))) if source else {}
    for prefix, uri in namespaces.items():
        ET.register_namespace(prefix, uri)
    ET.register_namespace("", namespace)
    xml = ET.tostring(root, encoding="utf-8")
    closing = xml.index(b'>')
    opening = xml[:closing]
    declarations = []
    for prefix, uri in namespaces.items():
        attribute = ('xmlns:' + prefix if prefix else 'xmlns').encode()
        if not re.search(rb'\s' + re.escape(attribute) + rb'=', opening):
            declarations.append(b' ' + attribute + b'="' + escape(uri).encode() + b'"')
    return opening + b''.join(declarations) + xml[closing:]


def extended_styles(xml):
    root = ET.fromstring(xml)
    fonts, fills, xfs, dxfs = (root.find(NS + key) for key in ("fonts", "fills", "cellXfs", "dxfs"))

    def push(parent, node):
        index = len(parent)
        parent.append(node)
        parent.set("count", str(len(parent)))
        return index

    dark_font = push(fonts, ET.fromstring(f'<font xmlns="{URI}"><sz val="10"/><color rgb="FF33283E"/><name val="Calibri"/></font>'))
    header_font = push(fonts, ET.fromstring(f'<font xmlns="{URI}"><b/><sz val="10"/><color rgb="FF4C3267"/><name val="Calibri"/></font>'))
    red_font = push(fonts, ET.fromstring(f'<font xmlns="{URI}"><sz val="10"/><color rgb="FFFF0000"/><name val="Calibri"/></font>'))
    lavender = push(fills, ET.fromstring(f'<fill xmlns="{URI}"><patternFill patternType="solid"><fgColor rgb="FFE8DFF5"/><bgColor rgb="FFE8DFF5"/></patternFill></fill>'))
    pale = push(fills, ET.fromstring(f'<fill xmlns="{URI}"><patternFill patternType="solid"><fgColor rgb="FFF5F1FA"/><bgColor rgb="FFF5F1FA"/></patternFill></fill>'))
    white = push(fills, ET.fromstring(f'<fill xmlns="{URI}"><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor rgb="FFFFFFFF"/></patternFill></fill>'))
    red_fill = push(fills, ET.fromstring(f'<fill xmlns="{URI}"><patternFill patternType="solid"><fgColor rgb="FFFF0000"/><bgColor indexed="64"/></patternFill></fill>'))

    def style(font, fill):
        return push(xfs, ET.fromstring(f'<xf xmlns="{URI}" numFmtId="0" fontId="{font}" fillId="{fill}" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'))

    styles = {"header": style(header_font, lavender), "value": style(dark_font, white), "input": style(dark_font, pale)}
    red_variants = {}
    for base_id, original in enumerate(list(xfs)[:len(xfs) - 3]):
        for font, fill in ((True, False), (False, True), (True, True)):
            node = deepcopy(original)
            if font:
                node.set("fontId", str(red_font))
                node.set("applyFont", "1")
            if fill:
                node.set("fillId", str(red_fill))
                node.set("applyFill", "1")
            red_variants[(str(base_id), font, fill)] = str(push(xfs, node))
    for key, color, text in (("observation", "FFFCE4D6", "FF9C2415"), ("pending", "FFFFE5BF", "FF713B08"), ("excluded", "FFE7E6E6", "FF404040")):
        styles[key] = push(dxfs, ET.fromstring(f'<dxf xmlns="{URI}"><font><color rgb="{text}"/></font><fill><patternFill patternType="solid"><fgColor rgb="{color}"/><bgColor rgb="{color}"/></patternFill></fill></dxf>'))
    return serialize(root, URI, xml), styles, red_variants


def extend_sheet(head, headers, tail, last, styles):
    cols = definitions()
    end_col = get_column_letter(80 + len(cols))
    head = head.replace(b'ref="A1:CB3"', f'ref="A1:{end_col}{last}"'.encode())
    widths = ''.join(f'<col width="{42 if c.key in ("pending", "notes", "group", "report", "file") else 27}" customWidth="1" min="{81+i}" max="{81+i}"' + (' hidden="1"' if c.group == 'Auxiliares de cálculo' else '') + '/>' for i, c in enumerate(cols))
    # The template defines a default column range CC:XFD. Split it around
    # the new explicit columns instead of adding overlapping definitions.
    def extend_columns(match):
        original, remaining = [], []
        for tag in re.findall(rb'<col\b[^>]*/>', match[1]):
            first = int(re.search(rb'\bmin="(\d+)"', tag)[1])
            final = int(re.search(rb'\bmax="(\d+)"', tag)[1])
            if first <= 80:
                original.append(re.sub(rb'\bmax="\d+"', f'max="{min(final, 80)}"'.encode(), tag))
            if final > 80 + len(cols):
                remaining.append(re.sub(rb'\bmin="\d+"', f'min="{max(first, 81+len(cols))}"'.encode(), tag))
        return b'<cols>' + b''.join(original) + widths.encode() + b''.join(remaining) + b'</cols>'

    head = re.sub(rb'<cols>(.*?)</cols>', extend_columns, head, flags=re.DOTALL)
    rows = headers.split(b'</row>')
    group_cells, label_cells, merges = [], [], []
    start = 0
    while start < len(cols):
        stop = start
        while stop + 1 < len(cols) and cols[stop + 1].group == cols[start].group:
            stop += 1
        first, final = get_column_letter(81 + start), get_column_letter(81 + stop)
        group_cells.append(text_cell(first + "1", cols[start].group, styles["header"]))
        merges.append(f'<mergeCell ref="{first}1:{final}1"/>')
        start = stop + 1
    for i, c in enumerate(cols):
        label_cells.append(text_cell(f'{get_column_letter(81+i)}2', c.label, styles["header"]))
    rows[0] += ''.join(group_cells).encode()
    rows[1] = re.sub(rb'ht="[^"]+"', b'ht="82"', rows[1], count=1)
    rows[1] += ''.join(label_cells).encode()
    for index in (0, 1):
        rows[index] = re.sub(rb'\bspans="[^"]+"', f'spans="1:{80+len(cols)}"'.encode(), rows[index], count=1)
    headers = b'</row>'.join(rows)
    tail = re.sub(rb'<mergeCells count="(\d+)">', lambda m: f'<mergeCells count="{int(m[1])+len(merges)}">'.encode(), tail)
    tail = tail.replace(b'</mergeCells>', ''.join(merges).encode() + b'</mergeCells>')
    # Insert in schema order before existing conditional formats / validations.
    # Only status cells need conditional formats, not numeric/helper cells.
    ranges = ' '.join(f'{get_column_letter(81+i)}3:{get_column_letter(81+i)}{last}'
                      for i, rule in enumerate(cols)
                      if rule.key == 'result' or rule.label.startswith('Control '))
    conditional = f'<conditionalFormatting sqref="{ranges}">'
    for priority, (key, value) in enumerate((("observation", "OBSERVACIÓN DE REVISIÓN"), ("pending", "PENDIENTE"), ("excluded", "EXCLUIDA")), 100):
        conditional += f'<cfRule type="cellIs" dxfId="{styles[key]}" priority="{priority}" operator="equal"><formula>"{value}"</formula></cfRule>'
    conditional += '</conditionalFormatting>'
    marker = b'<conditionalFormatting'
    if marker in tail:
        tail = tail.replace(marker, conditional.encode() + marker, 1)
    else:
        tail = tail.replace(b'<dataValidations', conditional.encode() + b'<dataValidations', 1)
    references = {c.key: get_column_letter(81+i) for i, c in enumerate(cols)}
    extra = []
    for key, options in (("exclude", 'Sí,No'),):
        col = references[key]
        extra.append(f'<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Valor no válido" error="Seleccione una opción de la lista." sqref="{col}3:{col}{last}"><formula1>"{options}"</formula1></dataValidation>')
    tail = re.sub(rb'<dataValidations count="(\d+)">', lambda m: f'<dataValidations count="{int(m[1])+len(extra)}">'.encode(), tail)
    tail = tail.replace(b'</dataValidations>', ''.join(extra).encode() + b'</dataValidations>')
    return head, headers, tail


GUIDANCE = (
    ("Fuente y alcance", "PDF principal; Excel laboratorio solo contraste. El módulo recibe la base, no PDF ni archivos auxiliares. OK CONTROLES solo se refiere a los controles calculables, nunca certifica concordancia con el PDF."),
    ("Resultados antiguos", "AT:BV conserva las fórmulas de la plantilla v1 y BW:CB sus auxiliares. Algunos umbrales y grupos difieren del documento nuevo. Para estas reglas use Resultado de controles nuevos, no BV. Los controles antiguos no excluyen colores."),
    ("Hallazgos", "Los resultados automáticos son Observación de revisión o Pendiente. Error de registro y Observación del informe solo se clasifican manualmente tras cotejar el PDF. Complete informe, página, archivo y observación."),
    ("Colores rojos", "Se detectan fuente y relleno sólido rojos directos RGB, indexados y de tema. Se conserva su indicación roja. Colores producidos por formato condicional requieren revisar y completar Celdas rojas de origen. Cambiar solo el color en Excel no cambia la exclusión: actualice la lista |S|T| o Excluir fila."),
    ("Datos originales", "A:AS permanece en su orden y sin correcciones automáticas. No se inventan datos. Repeticiones de código son corridas y no se borran ni se declaran duplicados."),
    ("Correcciones manuales", "Si se corrige una celda original: amarillo para TX/CD, rosado para otros; letra roja en negrita y comentario con valor anterior. Anote fuente y evidencia. Para incorporar datos nuevos, agregarlos al final y comprobar antes si el registro ya existe."),
    ("Grupos y etapas", "Los ajustes usan año F, laboratorio D, sondaje, tipo y código normalizados. M01(A)=M01A; M01A y M01B son códigos diferentes. Si el informe relaciona etapas con códigos distintos, documentar esa relación antes de consolidar. No se agrupan quitando letras sin evidencia."),
    ("Intervalos y UNI", "Cotejar profundidad UNI con Desde muestra. Hasta y longitud solo del archivo de intervalos. Margen de profundidad 0.05 m, longitud 0.01 m. Revisar longitud histórica y cabida de probetas. Altura de probeta no es longitud de muestra. Lito UNI corresponde a Lito1. Fecha UNI es emisión, no ejecución."),
    ("Muestras A/B", "Documentar si se toma el tramo cuyo Desde coincide con el PDF o la unión A+B. No se decide automáticamente. TI A+B corresponde a un registro código A con promedio de todos los discos admitidos."),
    ("TI discos", "Comprobar σt=2P/(πDt), excluir discos No Central, y verificar que carga y resistencia promedian los mismos discos. La base no contiene D, t ni valores individuales. No reconstruirlos a partir del promedio."),
    ("CD área y cargas", "Comprobar área inclinada πDL/4 y kPa=kN×10000/A(cm²). Faltan D, L, inclinación y cargas independientes en la base. El control kPa/MPa no sustituye estas verificaciones."),
    ("TX Mohr-Coulomb", "Geomec/Ingeotest: ajuste lineal σ1=a+kσ3, φ=asin((k−1)/(k+1)), c=a/(2√k). UNI: equivalente de Hoek-Brown con σ3max=σci/4. Requiere validación del criterio del informe. No sustituirlo por regresión lineal. Conservar letra de cada etapa según PDF."),
    ("Propiedades físicas", "La base no tiene densidad seca/saturada, absorción y porosidad. AQ no sustituye densidad seca. Hay campos opcionales a la derecha para transcribir evidencia. Porosidad≈absorción×densidad no tiene tolerancia definida, se muestra diferencia para revisión."),
    ("Comprobaciones cruzadas", "Elegir referencias del mismo taladro, litología, año y laboratorio y documentarlas. No promediar corridas como si fueran ensayos distintos. UCS/TI 5–25, σci/UCS 0.6–1.8; fuera de rango puede ser variabilidad."),
    ("Conteos y duplicados", "Comparar conteo de ensayos únicos y corridas con el título del informe. Cotejar archivos en ambas direcciones (faltantes/sobrantes). No puede concluirse con un solo archivo. No agregar registros sin comprobar existencia y evidencia."),
    ("Rotura por laboratorio", "Geomec I–V de Szwedzicki: I extensión simple, II extensión múltiple, III fracturamiento múltiple, IV corte simple, V corte múltiple. Ingeotest: matriz, estructura o ambas. No mezclar sistemas."),
    ("Rotura UNI", "UNI 2024 informe 050: 1 corte plano diagonal, 2 fractura vertical, 3 por discontinuidad, 4 cónico, 5 desprendimiento, 6 otros. UNI 2025–2026 informes 007/021/022/027: 1 matriz, 2 discontinuidad, 3 mixto. Año solo no determina sistema. Registrar informe y revisar manualmente."),
)


PENDING_GUIDANCE = tuple((name, detail) for name, detail in GUIDANCE if name in (
    'Fuente y alcance', 'Hallazgos', 'Correcciones manuales', 'Intervalos y UNI', 'Muestras A/B',
    'TI discos', 'CD área y cargas', 'TX Mohr-Coulomb', 'Propiedades físicas',
    'Comprobaciones cruzadas', 'Conteos y duplicados', 'Rotura UNI',
))
PENDING_GUIDANCE = tuple((name, detail.replace('Hay campos opcionales a la derecha para transcribir evidencia.',
                                             'Los campos de transcripción no se incluyen hasta definir su integración.'))
                         for name, detail in PENDING_GUIDANCE)
GUIDANCE = (
    ('Alcance activo', 'La hoja Plantilla contiene solo controles que se pueden calcular con las columnas de la base. Las verificaciones externas se enumeran en Pendientes de integración y no intervienen en el resultado.'),
    ('Resultado nuevo', 'DJ muestra el resultado de los controles nuevos. PENDIENTE en un control activo significa que falta un dato de la base. OK CONTROLES no acredita cotejo contra PDF.'),
    ('Revisión anterior', 'AT:BV conserva criterios y operaciones de la plantilla original. Sus búsquedas también se limitan al tramo del grupo para reducir cálculo. No usa la exclusión de rojos de los controles nuevos.'),
    ('Datos y corridas', 'A:AS conserva valores y orden. Las repeticiones de código son corridas y no se eliminan. No se hacen correcciones ni inserciones en SQL Server.'),
    ('Valores rojos', 'CC identifica celdas rojas directas, por ejemplo |S|T|. Cada cálculo omite sus entradas rojas. Si se cambia un color después de descargar, actualizar CC. CD permite excluir una fila completa. El color condicional de origen requiere revisión manual.'),
    ('Grupos de cálculo', 'Los controles nuevos separan año F, laboratorio D, sondaje, tipo y código normalizado. M01(A)=M01A, pero M01A y M01B siguen siendo distintos. La revisión antigua mantiene su agrupación original por código.'),
    ('Edición de mediciones', 'Las mediciones y exclusiones se recalculan automáticamente usando rangos cortos del grupo. No hace falta cambiar Excel a cálculo manual.'),
    ('Edición de identidades', 'Si se modifica año, laboratorio, sondaje, tipo o código, se activa una búsqueda completa para conservar una agrupación correcta. Para recuperar el cálculo rápido, subir de nuevo el archivo con las identidades actualizadas. Las filas nuevas también requieren una nueva revisión.'),
)


def guide_sheet(styles, last):
    rows = [('Reglas de revisión adicionales', 'Reglas_revision_ensayos_especiales.md', 'Modo de uso'), ('Columna / sección', 'Control', 'Alcance y evidencia necesaria')]
    rows.append(('Cálculo de grupos', 'Estado de las identidades', ''))
    rows.extend((name, 'Criterio de revisión', detail) for name, detail in GUIDANCE)
    rows.extend((get_column_letter(81+i), c.label, c.description) for i, c in enumerate(definitions()))
    body = []
    for i, values in enumerate(rows, 1):
        style = styles['header'] if i <= 2 else styles['value']
        cells = ''.join(text_cell(f'{get_column_letter(j)}{i}', v, style) for j, v in enumerate(values, 1))
        if i == 1:
            changed = next(get_column_letter(81+j) for j, c in enumerate(definitions()) if c.key == 'group_changed')
            cells += f'<c r="D1" s="{styles["value"]}"><f>SUM(Plantilla!${changed}$3:${changed}${last})&gt;0</f></c>'
        if i == 3:
            cells = text_cell('A3', values[0], style) + text_cell('B3', values[1], style)
            cells += f'<c r="C3" s="{style}"><f>IF($D$1,"Identidades modificadas: búsqueda completa. Volver a procesar para optimizar.","Cálculo agrupado optimizado")</f></c>'
        body.append(f'<row r="{i}" ht="{38 if i<=2 else 72}" customHeight="1">' + cells + '</row>')
    return (f'<worksheet xmlns="{URI}"><dimension ref="A1:D{len(rows)}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="29" customWidth="1"/><col min="2" max="2" width="48" customWidth="1"/><col min="3" max="3" width="115" customWidth="1"/><col min="4" max="4" hidden="1" width="12" customWidth="1"/></cols><sheetData>' + ''.join(body) + '</sheetData></worksheet>').encode()


def pending_sheet(styles):
    rows = [('Pendientes de integración', 'No se evalúan ni afectan el resultado de esta versión'),
            ('Verificación', 'Datos y funcionamiento que falta integrar')]
    rows.extend(PENDING_GUIDANCE)
    body = []
    for i, values in enumerate(rows, 1):
        style = styles['header'] if i <= 2 else styles['value']
        body.append(f'<row r="{i}" ht="{38 if i<=2 else 90}" customHeight="1">' + ''.join(text_cell(f'{get_column_letter(j)}{i}', v, style) for j, v in enumerate(values, 1)) + '</row>')
    return (f'<worksheet xmlns="{URI}"><dimension ref="A1:B{len(rows)}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="2" width="115" customWidth="1"/></cols><sheetData>' + ''.join(body) + '</sheetData></worksheet>').encode()


def extra_parts(base, last):
    styles_xml, styles, red_variants = extended_styles(base.read('xl/styles.xml'))
    workbook_xml = base.read('xl/workbook.xml')
    workbook = ET.fromstring(workbook_xml)
    rel_uri = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    sheets = workbook.find(NS+'sheets')
    new_sheet_id = max(int(sheet.get('sheetId')) for sheet in sheets) + 1
    ET.SubElement(sheets, NS+'sheet', {'name': 'Reglas de revisión', 'sheetId': str(new_sheet_id), '{'+rel_uri+'}id': 'rIdRevisionRules'})
    ET.SubElement(sheets, NS+'sheet', {'name': 'Pendientes de integración', 'sheetId': str(new_sheet_id+1), '{'+rel_uri+'}id': 'rIdRevisionPending'})
    workbook.find(NS+'calcPr').set('forceFullCalc', '0')
    relationships_xml = base.read('xl/_rels/workbook.xml.rels')
    relationships = ET.fromstring(relationships_xml)
    rel_ns = relationships.tag.partition('}')[0]+'}'
    ET.SubElement(relationships, rel_ns+'Relationship', {'Id': 'rIdRevisionRules', 'Type': rel_uri+'/worksheet', 'Target': '/xl/worksheets/sheet2.xml'})
    ET.SubElement(relationships, rel_ns+'Relationship', {'Id': 'rIdRevisionPending', 'Type': rel_uri+'/worksheet', 'Target': '/xl/worksheets/sheet3.xml'})
    content_xml = base.read('[Content_Types].xml')
    content = ET.fromstring(content_xml)
    content_ns = content.tag.partition('}')[0]+'}'
    ET.SubElement(content, content_ns+'Override', {'PartName': '/xl/worksheets/sheet2.xml', 'ContentType': 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'})
    ET.SubElement(content, content_ns+'Override', {'PartName': '/xl/worksheets/sheet3.xml', 'ContentType': 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'})
    return {
        'xl/styles.xml': styles_xml,
        'xl/workbook.xml': serialize(workbook, URI, workbook_xml),
        'xl/_rels/workbook.xml.rels': serialize(relationships, rel_ns[1:-1], relationships_xml),
        '[Content_Types].xml': serialize(content, content_ns[1:-1], content_xml),
        'xl/worksheets/sheet2.xml': guide_sheet(styles, last),
        'xl/worksheets/sheet3.xml': pending_sheet(styles),
    }, styles, red_variants


def theme_colors(workbook):
    if not workbook.loaded_theme:
        return ()
    ns = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
    scheme = ET.fromstring(workbook.loaded_theme).find('.//' + ns + 'clrScheme')
    return tuple(next(iter(node)).get('val') if next(iter(node)).tag == ns+'srgbClr' else next(iter(node)).get('lastClr') for node in scheme) if scheme is not None else ()
