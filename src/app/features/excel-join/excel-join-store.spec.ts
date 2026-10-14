import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import { ExcelJoinStore, ExcelJoinStoredState } from './excel-join-store';
import { SheetInfo } from './excel-join.component';

describe('ExcelJoinStore', () => {
  let store: ExcelJoinStore;

  const createMockState = (overrides?: Partial<ExcelJoinStoredState>): ExcelJoinStoredState => ({
    version: '1.0',
    savedAt: new Date().toISOString(),
    fileInfo: {
      name: 'Test_Workbook.xlsx',
      size: 1024,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    isDefaultData: false,
    isCloudDefault: false,
    showSettings: false,
    activePresetName: 'Konfigurasi Uji Coba',
    sheets: [
      {
        name: 'Sheet1',
        columns: [
          { colIndex: 0, colLetter: 'A', header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
          { colIndex: 1, colLetter: 'B', header: 'Stunting %', leafHeader: 'Stunting %', layers: ['Stunting %'] },
        ],
        headers: ['Kabupaten/Kota', 'Stunting %'],
        selected: true,
        variables: ['Stunting %'],
        joinColumn: 'Kabupaten/Kota',
        headerStartRow: 1,
        headerEndRow: 1,
        dataStartRow: 2,
      },
    ],
    joinBy: 'Kabupaten/Kota',
    stripKabupaten: true,
    outputHeaderFormat: 'concat',
    includeSheetPrefix: true,
    enableTarget: true,
    enableCapaian: true,
    enableJumlah: true,
    enableAverage: true,
    columnTargets: { 'Stunting %': { enabled: true, operator: '<=', value: 14 } },
    columnConfigs: {},
    sumColumns: { 'Stunting %': false },
    avgColumns: { 'Stunting %': true },
    customColumnNames: { 'Stunting %': 'Prevalensi Stunting' },
    resultColumns: ['Kabupaten/Kota', 'Stunting %'],
    resultColumnsMeta: [
      { key: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
      { key: 'Stunting %', layers: ['Stunting %'] },
    ],
    defaultResultColumns: ['Kabupaten/Kota', 'Stunting %'],
    defaultResultColumnsMeta: [
      { key: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
      { key: 'Stunting %', layers: ['Stunting %'] },
    ],
    resultRows: [
      { 'Kabupaten/Kota': 'CILACAP', 'Stunting %': 15.2 },
      { 'Kabupaten/Kota': 'BANYUMAS', 'Stunting %': 12.8 },
    ],
    originalResultRows: [
      { 'Kabupaten/Kota': 'CILACAP', 'Stunting %': 15.2 },
      { 'Kabupaten/Kota': 'BANYUMAS', 'Stunting %': 12.8 },
    ],
    ...overrides,
  });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [ExcelJoinStore],
    });
    store = TestBed.inject(ExcelJoinStore);
  });

  it('should initialize with hasState() returning false when storage is empty', () => {
    expect(store.hasState()).toBe(false);
    expect(store.getState()).toBeNull();
    expect(store.getWorkbook()).toBeNull();
  });

  it('should save state to memory and localStorage and return hasState() true', () => {
    const mockState = createMockState();
    const mockWb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['Kabupaten/Kota', 'Stunting %'], ['CILACAP', 15.2]]);
    XLSX.utils.book_append_sheet(mockWb, ws, 'Sheet1');

    store.saveState(mockState, mockWb);

    expect(store.hasState()).toBe(true);
    const retrieved = store.getState();
    expect(retrieved).not.toBeNull();
    expect(retrieved?.fileInfo?.name).toBe('Test_Workbook.xlsx');
    expect(retrieved?.customColumnNames['Stunting %']).toBe('Prevalensi Stunting');
    expect(retrieved?.resultRows.length).toBe(2);
    expect(store.getWorkbook()).toBe(mockWb);

    // Verify localStorage item exists
    const rawLocal = localStorage.getItem('dinkes_excel_join_state');
    expect(rawLocal).toBeTruthy();
    const parsedLocal = JSON.parse(rawLocal!);
    expect(parsedLocal.fileInfo.name).toBe('Test_Workbook.xlsx');
  });

  it('should clear in-memory state and localStorage when clearState() is called', () => {
    const mockState = createMockState();
    store.saveState(mockState);
    expect(store.hasState()).toBe(true);

    store.clearState();

    expect(store.hasState()).toBe(false);
    expect(store.getState()).toBeNull();
    expect(store.getWorkbook()).toBeNull();
    expect(localStorage.getItem('dinkes_excel_join_state')).toBeNull();
  });

  it('should restore state from localStorage if in-memory store was reset (simulating page reload)', () => {
    const mockState = createMockState();
    localStorage.setItem('dinkes_excel_join_state', JSON.stringify(mockState));

    // Create a new store instance simulating page reload
    const freshStore = new ExcelJoinStore();

    expect(freshStore.hasState()).toBe(true);
    const state = freshStore.getState();
    expect(state?.fileInfo?.name).toBe('Test_Workbook.xlsx');
    expect(state?.resultRows.length).toBe(2);
    expect(state?.customColumnNames['Stunting %']).toBe('Prevalensi Stunting');
  });

  it('should handle localStorage QuotaExceededError gracefully without crashing', () => {
    const mockState = createMockState();
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = () => {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    };

    expect(() => {
      store.saveState(mockState);
    }).not.toThrow();

    // In-memory state should still be available even if localStorage threw quota error
    expect(store.hasState()).toBe(true);
    expect(store.getState()?.fileInfo?.name).toBe('Test_Workbook.xlsx');

    localStorage.setItem = originalSetItem;
  });
});
