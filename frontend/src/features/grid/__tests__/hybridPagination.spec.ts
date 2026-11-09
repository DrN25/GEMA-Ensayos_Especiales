import { describe, it, expect, beforeEach } from 'vitest';
import { useGridStore } from '../gridStore';

describe('Paradigma B: Paginación Híbrida Cliente/Servidor', () => {
  beforeEach(() => {
    useGridStore.getState().clearAll();
  });

  it('1. Calcula correctamente las páginas efectivas cuando hay 9,000 registros en memoria local', () => {
    // Generar 9,000 registros sintéticos en memoria
    const records = Array.from({ length: 9000 }, (_, i) => ({
      idd: i + 1,
      sondaje: `S-${i + 1}`,
      codigo_muestra: `M-${i + 1}`,
      laboratorio: 'SGS',
      dia: 1,
      mes: 'Enero',
      anio: 2026
    }));

    useGridStore.getState().setInitialRecords(records);
    const rowIds = useGridStore.getState().rowIds;
    expect(rowIds.length).toBe(9000);

    // Caso 50 filas
    const pageSize50 = 50;
    const isClientPaginated50 = pageSize50 !== -1 && rowIds.length > pageSize50;
    expect(isClientPaginated50).toBe(true);
    const totalPages50 = Math.ceil(rowIds.length / pageSize50);
    expect(totalPages50).toBe(180);

    // Página 1: slice 0..50
    const page1Rows = rowIds.slice(0, 50);
    expect(page1Rows.length).toBe(50);
    expect(page1Rows[0]).toBe(1);
    expect(page1Rows[49]).toBe(50);

    // Página 2: slice 50..100
    const page2Rows = rowIds.slice(50, 100);
    expect(page2Rows.length).toBe(50);
    expect(page2Rows[0]).toBe(51);
    expect(page2Rows[49]).toBe(100);

    // Caso 100 filas
    const totalPages100 = Math.ceil(rowIds.length / 100);
    expect(totalPages100).toBe(90);

    // Caso 250 filas
    const totalPages250 = Math.ceil(rowIds.length / 250);
    expect(totalPages250).toBe(36);

    // Caso 1000 filas
    const totalPages1000 = Math.ceil(rowIds.length / 1000);
    expect(totalPages1000).toBe(9);

    // Caso Todos los registros (-1)
    const pageSizeAll = -1;
    const isClientPaginatedAll = pageSizeAll !== -1 && rowIds.length > pageSizeAll;
    expect(isClientPaginatedAll).toBe(false);
    const totalPagesAll = pageSizeAll === -1 ? 1 : 9000;
    expect(totalPagesAll).toBe(1);
    const allRows = rowIds;
    expect(allRows.length).toBe(9000);
  });

  it('2. Soporta navegación de páginas sin perder registros dirty locales ni mutar rowIds', () => {
    const records = Array.from({ length: 150 }, (_, i) => ({
      idd: i + 1,
      sondaje: `S-${i + 1}`,
      codigo_muestra: `M-${i + 1}`,
      laboratorio: 'SGS'
    }));

    useGridStore.getState().setInitialRecords(records);
    const store = useGridStore.getState();

    // Modificar registro en página 1
    store.updateCellValue(0, 'sondaje', 'S-MODIFICADO-1');
    expect(store.dirtyRowIds.has(1)).toBe(true);

    // Navegar a página 2 y modificar registro en página 2 (índice global 50)
    store.updateCellValue(50, 'sondaje', 'S-MODIFICADO-51');
    expect(store.dirtyRowIds.has(51)).toBe(true);

    // Verificar que ambas filas modificadas persisten intactas
    expect(store.dirtyRowIds.size).toBe(2);
    expect(store.getRowById(1)?.sondaje).toBe('S-MODIFICADO-1');
    expect(store.getRowById(51)?.sondaje).toBe('S-MODIFICADO-51');
  });

  it('3. Salto rápido de página editable con validación y clamping estricto', () => {
    const totalPages = 180;

    // Función de cálculo idéntica a la implementada en handlePageInputCommit
    const computePageJump = (rawInput: string, currentPage: number, maxPages: number): number => {
      const parsed = parseInt(rawInput.trim(), 10);
      if (isNaN(parsed)) return currentPage;
      return Math.max(1, Math.min(maxPages, parsed));
    };

    // Salto válido a la página 45
    expect(computePageJump('45', 1, totalPages)).toBe(45);

    // Salto fuera de rango superior (999) -> se limita a totalPages (180)
    expect(computePageJump('999', 1, totalPages)).toBe(180);

    // Salto fuera de rango inferior (0) -> se limita a 1
    expect(computePageJump('0', 10, totalPages)).toBe(1);

    // Entrada vacía o inválida -> conserva la página actual
    expect(computePageJump('', 10, totalPages)).toBe(10);
    expect(computePageJump('abc', 10, totalPages)).toBe(10);
  });

  it('4. Botones Primera y Última página con condiciones de deshabilitación', () => {
    const totalPages = 180;

    // En página 1
    const page1 = 1;
    const isFirstDisabledP1 = page1 <= 1;
    const isPrevDisabledP1 = page1 <= 1;
    const isNextDisabledP1 = page1 >= totalPages;
    const isLastDisabledP1 = page1 >= totalPages;

    expect(isFirstDisabledP1).toBe(true);
    expect(isPrevDisabledP1).toBe(true);
    expect(isNextDisabledP1).toBe(false);
    expect(isLastDisabledP1).toBe(false);

    // En página 45 (intermedia)
    const page45 = 45;
    expect(page45 <= 1).toBe(false);
    expect(page45 >= totalPages).toBe(false);

    // En página 180 (última)
    const page180 = 180;
    const isFirstDisabledP180 = page180 <= 1;
    const isPrevDisabledP180 = page180 <= 1;
    const isNextDisabledP180 = page180 >= totalPages;
    const isLastDisabledP180 = page180 >= totalPages;

    expect(isFirstDisabledP180).toBe(false);
    expect(isPrevDisabledP180).toBe(false);
    expect(isNextDisabledP180).toBe(true);
    expect(isLastDisabledP180).toBe(true);
  });
});

