import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import { ExcelJoinStore, ExcelJoinStoredState } from './excel-join-store';

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

  it('should initialize with hasState() returning false on a fresh application session', () => {
    expect(store.hasState()).toBe(false);
    expect(store.getState()).toBeNull();
    expect(store.getWorkbook()).toBeNull();
    expect(store.getFile()).toBeNull();
  });

  it('should save state to memory and return hasState() true', () => {
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
  });

  it('should generate a valid non-empty File when getFile() is called with an in-memory workbook', () => {
    const mockState = createMockState();
    const mockWb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['Kabupaten/Kota', 'Stunting %'], ['CILACAP', 15.2]]);
    XLSX.utils.book_append_sheet(mockWb, ws, 'Sheet1');

    store.saveState(mockState, mockWb, null);

    const generatedFile = store.getFile();
    expect(generatedFile).not.toBeNull();
    expect(generatedFile!.name).toBe('Test_Workbook.xlsx');
    expect(generatedFile!.size).toBeGreaterThan(0);
  });

  it('should clear in-memory state when clearState() is called', () => {
    const mockState = createMockState();
    store.saveState(mockState);
    expect(store.hasState()).toBe(true);

    store.clearState();

    expect(store.hasState()).toBe(false);
    expect(store.getState()).toBeNull();
    expect(store.getWorkbook()).toBeNull();
  });

  it('should ignore stale sessionStorage remnants so a fresh app session starts clean', () => {
    // Simulasi sisa state dari versi aplikasi lama yang masih memakai sessionStorage
    sessionStorage.setItem(ExcelJoinStore.LEGACY_STORAGE_KEY, JSON.stringify(createMockState()));

    // Store baru (simulasi muat ulang aplikasi) harus membersihkan dan mengabaikannya
    const freshStore = new ExcelJoinStore();

    expect(freshStore.hasState()).toBe(false);
    expect(freshStore.getState()).toBeNull();
    expect(sessionStorage.getItem(ExcelJoinStore.LEGACY_STORAGE_KEY)).toBeNull();
  });
});
