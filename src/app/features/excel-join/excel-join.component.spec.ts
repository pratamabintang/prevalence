import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, beforeEach } from 'vitest';
import { ExcelJoinComponent, SheetInfo } from './excel-join.component';
import { PresetStore } from './preset-store';
import { environment } from '../../../environments/environment';

describe('ExcelJoinComponent', () => {
  let component: ExcelJoinComponent;
  let fixture: ComponentFixture<ExcelJoinComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExcelJoinComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ExcelJoinComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize with empty state', () => {
    expect(component).toBeTruthy();
    expect(component.sheets()).toEqual([]);
    expect(component.selectedSheets()).toEqual([]);
  });

  describe('variable search and column letter display', () => {
    const mockSheet: SheetInfo = {
      name: 'gizi',
      columns: [
        { colIndex: 0, colLetter: 'A', header: 'No', leafHeader: 'No', layers: ['No'] },
        { colIndex: 1, colLetter: 'B', header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
        { colIndex: 56, colLetter: 'BE', header: 'Cakupan pemberian suplementasi vitamin A - %', leafHeader: '%', layers: ['Vitamin A', '%'] },
        { colIndex: 57, colLetter: 'BF', header: 'Data bulanan - Jumlah bayi', leafHeader: 'Jumlah bayi', layers: ['Data bulanan', 'Jumlah bayi'] },
      ],
      headers: [
        'No',
        'Kabupaten/Kota',
        'Cakupan pemberian suplementasi vitamin A - %',
        'Data bulanan - Jumlah bayi',
      ],
      selected: true,
      variables: [],
      headerStartRow: 3,
      headerEndRow: 5,
      dataStartRow: 7,
    };

    it('should retrieve the correct column letter via getColumnLetter', () => {
      const letterBE = component.getColumnLetter(mockSheet, 'Cakupan pemberian suplementasi vitamin A - %');
      expect(letterBE).toBe('BE');

      const letterB = component.getColumnLetter(mockSheet, 'Kabupaten/Kota');
      expect(letterB).toBe('B');
    });

    it('should filter variables by column letter', () => {
      component.updateVariableSearch('gizi', 'BE');
      const filtered = component.getFilteredVariables(mockSheet);
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe('Cakupan pemberian suplementasi vitamin A - %');
    });

    it('should filter variables by partial name or keyword', () => {
      component.updateVariableSearch('gizi', 'vitamin');
      const filtered = component.getFilteredVariables(mockSheet);
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe('Cakupan pemberian suplementasi vitamin A - %');
    });

    it('should support selecting all filtered variables and clearing them', () => {
      component.sheets.set([mockSheet]);
      component.joinBy.set('Kabupaten/Kota');

      component.updateVariableSearch('gizi', 'vitamin');
      component.selectAllVariables(mockSheet);

      const updatedSheet = component.sheets().find((s) => s.name === 'gizi');
      expect(updatedSheet?.variables).toContain('Cakupan pemberian suplementasi vitamin A - %');
      // Key column should NOT be included in selected variables
      expect(updatedSheet?.variables).not.toContain('Kabupaten/Kota');

      component.clearVariables(mockSheet);
      const clearedSheet = component.sheets().find((s) => s.name === 'gizi');
      expect(clearedSheet?.variables).toEqual([]);
    });
  });

  describe('header and data row range configuration', () => {
    it('should preserve dataStartRow when headerEndRow is modified and dataStartRow is greater', () => {
      const sheet: SheetInfo = {
        name: 'test',
        columns: [],
        headers: [],
        selected: true,
        variables: [],
        headerStartRow: 3,
        headerEndRow: 4,
        dataStartRow: 7,
      };
      component.workbook = {
        SheetNames: ['test'],
        Sheets: {
          test: { '!ref': 'A1:B10', A1: { v: 'Col1' }, B1: { v: 'Col2' } },
        },
      } as any;
      component.sheets.set([sheet]);

      // User changes headerEndRow to 5
      const mockEvent = {
        target: { value: '5' },
      } as unknown as Event;

      component.onHeaderEndRowChange(sheet, mockEvent);

      const updated = component.sheets().find((s) => s.name === 'test');
      expect(updated?.headerEndRow).toBe(5);
      // dataStartRow 7 should NOT be overwritten to 6 (5+1), but stay 7
      expect(updated?.dataStartRow).toBe(7);
    });
  });

  describe('per-sheet join key configuration', () => {
    it('should allow joining sheets with different key column names and formats', () => {
      const sheet1: SheetInfo = {
        name: 'Sheet1',
        columns: [
          { colIndex: 0, colLetter: 'A', header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
          { colIndex: 1, colLetter: 'B', header: 'Prevalensi Stunting', leafHeader: 'Prevalensi Stunting', layers: ['Prevalensi Stunting'] },
        ],
        headers: ['Kabupaten/Kota', 'Prevalensi Stunting'],
        selected: true,
        variables: ['Prevalensi Stunting'],
        joinColumn: 'Kabupaten/Kota',
        headerStartRow: 1,
        headerEndRow: 1,
        dataStartRow: 2,
      };

      const sheet2: SheetInfo = {
        name: 'Sheet2',
        columns: [
          { colIndex: 0, colLetter: 'A', header: 'Nama Wilayah', leafHeader: 'Nama Wilayah', layers: ['Nama Wilayah'] },
          { colIndex: 1, colLetter: 'B', header: 'ASI Eksklusif', leafHeader: 'ASI Eksklusif', layers: ['ASI Eksklusif'] },
        ],
        headers: ['Nama Wilayah', 'ASI Eksklusif'],
        selected: true,
        variables: ['ASI Eksklusif'],
        joinColumn: 'Nama Wilayah',
        headerStartRow: 1,
        headerEndRow: 1,
        dataStartRow: 2,
      };

      component.workbook = {
        SheetNames: ['Sheet1', 'Sheet2'],
        Sheets: {
          Sheet1: {
            '!ref': 'A1:B3',
            A1: { v: 'Kabupaten/Kota' },
            B1: { v: 'Prevalensi Stunting' },
            A2: { v: '3301 - KAB. CILACAP' },
            B2: { v: 18.5 },
            A3: { v: '3371 - KOTA MAGELANG' },
            B3: { v: 12.1 },
          },
          Sheet2: {
            '!ref': 'A1:B3',
            A1: { v: 'Nama Wilayah' },
            B1: { v: 'ASI Eksklusif' },
            A2: { v: 'KABUPATEN CILACAP' },
            B2: { v: 75.2 },
            A3: { v: 'KOTA MAGELANG' },
            B3: { v: 80.0 },
          },
        },
      } as any;

      component.sheets.set([sheet1, sheet2]);

      expect(component.hasValidJoinColumns()).toBe(true);
      expect(component.canPreview()).toBe(true);

      component.preview();

      const results = component.resultRows();
      expect(results).toHaveLength(2);

      // Check Cilacap match
      const cilacap = results[0];
      expect(cilacap['Kabupaten/Kota']).toBe('CILACAP');
      expect(cilacap['Prevalensi Stunting']).toBe(18.5);
      expect(cilacap['ASI Eksklusif']).toBe(75.2);

      // Check Kota Magelang match
      const magelang = results[1];
      expect(magelang['Kabupaten/Kota']).toBe('KOTA MAGELANG');
      expect(magelang['Prevalensi Stunting']).toBe(12.1);
      expect(magelang['ASI Eksklusif']).toBe(80.0);
    });

    it('should detect default join columns accurately', () => {
      const cols = [
        { colIndex: 0, colLetter: 'A', header: 'No', leafHeader: 'No', layers: ['No'] },
        { colIndex: 1, colLetter: 'B', header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
        { colIndex: 2, colLetter: 'C', header: 'Jumlah Kasus', leafHeader: 'Jumlah Kasus', layers: ['Jumlah Kasus'] },
      ];
      expect(component.detectDefaultJoinColumn(cols)).toBe('Kabupaten/Kota');

      const cols2 = [
        { colIndex: 0, colLetter: 'A', header: 'No', leafHeader: 'No', layers: ['No'] },
        { colIndex: 1, colLetter: 'B', header: 'Nama Puskesmas', leafHeader: 'Nama Puskesmas', layers: ['Nama Puskesmas'] },
      ];
      expect(component.detectDefaultJoinColumn(cols2)).toBe('Nama Puskesmas');
    });

    it('should match sheets 1-to-1 and prevent unrelated sheets like MASALAH GIZI or grafik bumil from hijacking presets', () => {
      const availableSheets = [
        'rekap indikator 01102026',
        'MASALAH GIZI',
        'capaian intervensi spesifik',
        'gizi',
        'remaja',
        'BUMIL',
        'anak',
        'idl',
        'grafik bumil',
      ];

      const presetSheets = [
        { sheetName: 'anak', variables: ['Var A'] },
        { sheetName: 'gizi', variables: ['Var G'] },
        { sheetName: 'BUMIL', variables: ['Var B'] },
      ];

      const matched = PresetStore.matchSheets(availableSheets, presetSheets);

      expect(matched.size).toBe(3);
      expect(matched.get('anak')?.sheetName).toBe('anak');
      expect(matched.get('gizi')?.sheetName).toBe('gizi');
      expect(matched.get('BUMIL')?.sheetName).toBe('BUMIL');
      expect(matched.has('MASALAH GIZI')).toBe(false);
      expect(matched.has('grafik bumil')).toBe(false);
    });

    it('should tolerate adjusted duplicate suffix count in PresetStore.findMatchingHeader', () => {
      const cols = [
        { colIndex: 0, colLetter: 'AY', header: 'ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - %', leafHeader: '%', layers: [] },
        { colIndex: 1, colLetter: 'BA', header: 'ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - % (2)', leafHeader: '%', layers: [] },
        { colIndex: 2, colLetter: 'BC', header: 'ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - % (3)', leafHeader: '%', layers: [] },
      ];

      const matched = PresetStore.findMatchingHeader(
        'ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - % (4)',
        cols,
      );

      expect(matched).toBe('ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - % (3)');
    });

    it('should preserve other sheets variables when toggleSheet is called', () => {
      const sheetA: SheetInfo = {
        name: 'A',
        columns: [{ colIndex: 0, colLetter: 'A', header: 'Kab', leafHeader: 'Kab', layers: ['Kab'] }],
        headers: ['Kab'],
        selected: true,
        variables: ['Kab'],
        headerStartRow: 1,
        headerEndRow: 1,
        dataStartRow: 2,
      };
      const sheetB: SheetInfo = {
        name: 'B',
        columns: [{ colIndex: 0, colLetter: 'A', header: 'Kab', leafHeader: 'Kab', layers: ['Kab'] }],
        headers: ['Kab'],
        selected: true,
        variables: ['Kab'],
        headerStartRow: 1,
        headerEndRow: 1,
        dataStartRow: 2,
      };
      const sheetC: SheetInfo = {
        name: 'C',
        columns: [{ colIndex: 0, colLetter: 'A', header: 'Kab', leafHeader: 'Kab', layers: ['Kab'] }],
        headers: ['Kab'],
        selected: false,
        variables: [],
        headerStartRow: 1,
        headerEndRow: 1,
        dataStartRow: 2,
      };

      component.sheets.set([sheetA, sheetB, sheetC]);

      // Toggle sheet C (select it)
      component.toggleSheet(sheetC);

      const sheets = component.sheets();
      const updatedA = sheets.find((s) => s.name === 'A');
      const updatedB = sheets.find((s) => s.name === 'B');

      expect(updatedA?.variables).toEqual(['Kab']);
      expect(updatedB?.variables).toEqual(['Kab']);
    });
  });

  describe('default configuration and settings toggle', () => {
    it('should toggle showSettings correctly via toggleSettings()', () => {
      const initial = component.showSettings();
      component.toggleSettings();
      expect(component.showSettings()).toBe(!initial);
      component.toggleSettings();
      expect(component.showSettings()).toBe(initial);
    });

    it('should toggle showFormatSettings correctly via toggleFormatSettings()', () => {
      expect(component.showFormatSettings()).toBe(false);
      component.toggleFormatSettings();
      expect(component.showFormatSettings()).toBe(true);
      component.toggleFormatSettings();
      expect(component.showFormatSettings()).toBe(false);
    });

    it('should have valid DEFAULT_JOIN_CONFIG with all 5 sheets and 50% target configs', async () => {
      const { DEFAULT_JOIN_CONFIG } = await import('./default-join-config');
      expect(DEFAULT_JOIN_CONFIG).toBeDefined();
      expect(DEFAULT_JOIN_CONFIG.sheets).toHaveLength(5);

      const sheetNames = DEFAULT_JOIN_CONFIG.sheets.map((s) => s.sheetName);
      expect(sheetNames).toContain('anak');
      expect(sheetNames).toContain('gizi');
      expect(sheetNames).toContain('BUMIL');
      expect(sheetNames).toContain('remaja');
      expect(sheetNames).toContain('idl');

      // Check each sheet has joinColumn
      for (const sheet of DEFAULT_JOIN_CONFIG.sheets) {
        expect(sheet.joinColumn).toBeTruthy();
        expect(sheet.headerStartRow).toBeDefined();
        expect(sheet.headerEndRow).toBeDefined();
        expect(sheet.dataStartRow).toBeDefined();
        expect(sheet.headerEndRow!).toBeGreaterThanOrEqual(sheet.headerStartRow!);
        expect(sheet.dataStartRow!).toBeGreaterThan(sheet.headerEndRow!);
      }

      // Check targets
      expect(DEFAULT_JOIN_CONFIG.enableTarget).toBe(true);
      expect(DEFAULT_JOIN_CONFIG.columnTargets).toBeDefined();
      const targets = Object.values(DEFAULT_JOIN_CONFIG.columnTargets!);
      expect(targets.length).toBeGreaterThan(0);
      expect(targets.some((t) => t.value === 50)).toBe(true);
    });

    it('should reset isDefaultData and show settings when clearFile is called', () => {
      component.isDefaultData.set(true);
      component.showSettings.set(false);

      component.clearFile();

      expect(component.isDefaultData()).toBe(false);
      expect(component.showSettings()).toBe(true);
      expect(component.file()).toBeNull();
      expect(component.sheets()).toEqual([]);
    });
  });

  describe('Google Apps Script External Storage Integration', () => {
    it('harus menghasilkan preset konfigurasi aktif melalui getCurrentPreset', () => {
      const mockSheet: SheetInfo = {
        name: 'gizi',
        columns: [{ colIndex: 0, colLetter: 'A', header: 'Kabupaten', leafHeader: 'Kabupaten', layers: ['Kabupaten'] }],
        headers: ['Kabupaten', 'Balita Stunting'],
        selected: true,
        variables: ['Balita Stunting'],
        joinColumn: 'Kabupaten',
        headerStartRow: 1,
        headerEndRow: 2,
        dataStartRow: 3,
      };
      component.sheets.set([mockSheet]);
      component.joinBy.set('Kabupaten');

      const preset = component.getCurrentPreset('Kustom TW3');
      expect(preset.name).toBe('Kustom TW3');
      expect(preset.joinBy).toBe('Kabupaten');
      expect(preset.sheets).toHaveLength(1);
      expect(preset.sheets[0].sheetName).toBe('gizi');
      expect(preset.sheets[0].variables).toContain('Balita Stunting');
    });

    it('openSaveDefaultConfirm membuka modal konfirmasi jika file dan URL GAS tersedia', () => {
      const dummyFile = new File(['dummy'], 'test.xlsx');
      component.file.set(dummyFile);
      environment.googleAppsScriptUrl = 'https://script.google.com/macros/s/TEST/exec';

      component.openSaveDefaultConfirm();
      expect(component.showSaveDefaultConfirm()).toBe(true);

      component.closeSaveDefaultConfirm();
      expect(component.showSaveDefaultConfirm()).toBe(false);
    });

    it('openSaveDefaultConfirm menampilkan peringatan jika URL GAS di environment belum dikonfigurasi', () => {
      const dummyFile = new File(['dummy'], 'test.xlsx');
      component.file.set(dummyFile);
      environment.googleAppsScriptUrl = '';

      component.openSaveDefaultConfirm();
      expect(component.showSaveDefaultConfirm()).toBe(false);
      expect(component.configNotification()?.type).toBe('warning');
    });

    it('confirmSaveDefaultToCloud mengunggah data dan memperbarui isCloudDefault', async () => {
      const dummyFile = new File(['content'], 'test.xlsx');
      component.file.set(dummyFile);
      environment.googleAppsScriptUrl = 'https://script.google.com/macros/s/TEST/exec';

      const mockSave = vi.spyOn(component.gasStorageService, 'saveDefault').mockResolvedValue({
        success: true,
        message: 'Disimpan di Google Drive',
      });

      await component.confirmSaveDefaultToCloud();

      expect(mockSave).toHaveBeenCalled();
      expect(component.isCloudDefault()).toBe(true);
      expect(component.isDefaultData()).toBe(true);
      expect(component.showSaveDefaultConfirm()).toBe(false);
      expect(component.configNotification()?.type).toBe('success');
    });
  });
});

