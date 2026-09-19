# -*- coding: utf-8 -*-
"""
app/services/excel_exporter.py — Exportador de reportes Excel estilizados para Ensayos Especiales (GEMA).
"""
import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from typing import List, Dict, Any

from app.core.rules import COLUMNS_CONFIG

def export_ensayos_to_excel(records: List[Dict[str, Any]], title_desc: str = "Base de Datos Consolidada") -> io.BytesIO:
    wb = openpyxl.Workbook()
    
    # 1. Hoja Base de Datos
    ws = wb.active
    ws.title = "Base_Datos (2)"
    ws.views.sheetView[0].showGridLines = True

    # Estilos
    font_title = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    font_group = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    font_header = Font(name="Calibri", size=9, bold=True, color="1E293B")
    font_data = Font(name="Calibri", size=9, color="0F172A")
    
    fill_title = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    fill_group = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    fill_header = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")
    fill_zebra = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    # Fila 1: Banner de Título
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(COLUMNS_CONFIG))
    title_cell = ws.cell(row=1, column=1, value=f"GEMA — Ensayos Especiales Geotécnicos | {title_desc}")
    title_cell.font = font_title
    title_cell.fill = fill_title
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 32

    # Fila 2: Cabeceras
    ws.row_dimensions[2].height = 28
    for col_idx, col in enumerate(COLUMNS_CONFIG, 1):
        cell = ws.cell(row=2, column=col_idx, value=col["excel_name"])
        cell.font = font_header
        cell.fill = fill_header
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border

    # Datos
    row_idx = 3
    for rec in records:
        ws.row_dimensions[row_idx].height = 18
        is_zebra = (row_idx % 2 == 0)
        
        for col_idx, col in enumerate(COLUMNS_CONFIG, 1):
            val = rec.get(col["db_name"])
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = font_data
            cell.border = thin_border
            if is_zebra:
                cell.fill = fill_zebra
                
            # Alineación y formatos numéricos
            if col["type"] in ("int", "float"):
                cell.alignment = Alignment(horizontal="right", vertical="center")
                if col["type"] == "float" and val is not None:
                    cell.number_format = "#,##0.00"
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")
                
        row_idx += 1

    # Auto-ajustar anchos de columnas
    for col_idx in range(1, len(COLUMNS_CONFIG) + 1):
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = 16

    # Inmovilizar paneles en fila 3
    ws.freeze_panes = "D3"

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output
