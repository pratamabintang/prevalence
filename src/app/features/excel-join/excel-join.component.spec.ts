import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ExcelJoinComponent, SheetInfo } from './excel-join.component';
import { ExcelJoinStore, ExcelJoinStoredState } from './excel-join-store';
import { PresetStore } from './preset-store';
import * as XLSX from 'xlsx-js-style';
import { environment } from '../../../environments/environment';

describe('ExcelJoinComponent', () => {
  let component: ExcelJoinComponent;
  let fixture: ComponentFixture<ExcelJoinComponent>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
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

  describe('Fitur Rata-rata dan Transfer ke Pemantauan Stunting', () => {
    it('harus mengontrol fitur rata-rata dan pemilihan kolom dengan benar', () => {
      expect(component.enableAverage()).toBe(false);
      component.toggleAverageFeature();
      expect(component.enableAverage()).toBe(true);

      component.resultColumns.set(['Kabupaten/Kota', 'Balita Stunting', 'Cakupan %']);
      component.columnConfigs.set({
        'Kabupaten/Kota': { dataType: 'string', anomalyEnabled: false, minAnomaly: 0, maxAnomaly: 100 },
        'Balita Stunting': { dataType: 'number', anomalyEnabled: false, minAnomaly: 0, maxAnomaly: 100 },
        'Cakupan %': { dataType: 'percentage', anomalyEnabled: false, minAnomaly: 0, maxAnomaly: 100 },
      });
      component.resultRows.set([
        { 'Kabupaten/Kota': 'Semarang', 'Balita Stunting': 10, 'Cakupan %': 50 },
        { 'Kabupaten/Kota': 'Surakarta', 'Balita Stunting': 30, 'Cakupan %': 70 },
      ]);

      // Toggle column avg
      component.toggleColumnAvg('Balita Stunting');
      expect(component.avgColumns()['Balita Stunting']).toBe(true);
      expect(component.getColumnAverage('Balita Stunting')).toBe(20);
      expect(component.formatAverageValue(20)).toBe('20');

      // Select all numeric columns for avg
      component.selectAllNumericColumnsForAvg();
      expect(component.avgColumns()['Balita Stunting']).toBe(true);
      expect(component.avgColumns()['Cakupan %']).toBe(true);
      expect(component.activeAvgColumnCount()).toBe(2);

      // Clear all
      component.clearAllAvgColumns();
      expect(component.activeAvgColumnCount()).toBe(0);
    });

    it('transferToStuntingMonitoring harus mengirim dataset ke StuntingDataBridge dan navigasi', () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate');

      component.resultColumns.set(['Wilayah', 'Indikator A']);
      component.resultRows.set([{ Wilayah: 'Kudus', 'Indikator A': 85 }]);
      component.enableJumlah.set(true);
      component.sumColumns.set({ 'Indikator A': true });

      component.transferToStuntingMonitoring();

      expect(navigateSpy).toHaveBeenCalledWith(['/stunting-monitoring']);
    });

    it('harus mendukung pemilihan kolom target tertentu saja (toggle, select percentage, clear)', () => {
      component.enableTarget.set(true);
      component.resultColumns.set(['Kabupaten/Kota', 'Jumlah Sasaran', 'Cakupan TTD %']);
      component.columnConfigs.set({
        'Kabupaten/Kota': { dataType: 'string', anomalyEnabled: false, minAnomaly: 0, maxAnomaly: 100 },
        'Jumlah Sasaran': { dataType: 'number', anomalyEnabled: false, minAnomaly: 0, maxAnomaly: 100 },
        'Cakupan TTD %': { dataType: 'percentage', anomalyEnabled: false, minAnomaly: 0, maxAnomaly: 100 },
      });

      // Awalnya tidak ada target aktif
      expect(component.activeTargetCount()).toBe(0);

      // Toggle target untuk kolom persentase
      component.toggleColumnTarget('Cakupan TTD %');
      expect(component.columnTargets()['Cakupan TTD %']?.enabled).toBe(true);
      expect(component.columnTargets()['Cakupan TTD %']?.value).toBe(80);
      expect(component.activeTargetCount()).toBe(1);

      // Ubah nilai target
      component.updateTargetConfig('Cakupan TTD %', { value: 75, operator: '>=' });
      expect(component.columnTargets()['Cakupan TTD %']?.value).toBe(75);

      // Toggle off target
      component.toggleColumnTarget('Cakupan TTD %');
      expect(component.columnTargets()['Cakupan TTD %']?.enabled).toBe(false);
      expect(component.activeTargetCount()).toBe(0);

      // Select all percentage columns
      component.selectAllPercentageColumnsForTarget();
      expect(component.columnTargets()['Cakupan TTD %']?.enabled).toBe(true);
      expect(component.columnTargets()['Jumlah Sasaran']?.enabled).toBeFalsy();
      expect(component.activeTargetCount()).toBe(1);

      // Clear all target columns
      component.clearAllTargetColumns();
      expect(component.columnTargets()['Cakupan TTD %']?.enabled).toBe(false);
      expect(component.activeTargetCount()).toBe(0);
    });

    it('harus mendukung format penamaan output concat dengan "-"', () => {
      component.setOutputHeaderFormat('concat');
      expect(component.outputHeaderFormat()).toBe('concat');

      // Test htmlHeaderGrid in concat mode
      component.resultColumnsMeta.set([
        { key: 'Wilayah', layers: ['Wilayah'] },
        { key: 'Indikator A', layers: ['Kesehatan', 'Gizi', 'Indikator A'] },
      ]);
      const grid = component.htmlHeaderGrid();
      expect(grid.length).toBe(1); // 1 baris header saja (flat)
    });

    it('harus mendukung kustomisasi nama kolom (rename/alias)', () => {
      component.resultColumns.set(['Kabupaten/Kota', 'Gizi - ASI - %']);
      expect(component.getColumnDisplayName('Gizi - ASI - %')).toBe('Gizi - ASI - %');
      expect(component.hasCustomColumnName('Gizi - ASI - %')).toBe(false);

      // Set custom name
      component.setColumnCustomName('Gizi - ASI - %', 'Cakupan ASI Eksklusif (%)');
      expect(component.getColumnDisplayName('Gizi - ASI - %')).toBe('Cakupan ASI Eksklusif (%)');
      expect(component.hasCustomColumnName('Gizi - ASI - %')).toBe(true);
      expect(component.hasAnyCustomColumnNames()).toBe(true);

      // Reset single custom name
      component.resetColumnCustomName('Gizi - ASI - %');
      expect(component.getColumnDisplayName('Gizi - ASI - %')).toBe('Gizi - ASI - %');
      expect(component.hasCustomColumnName('Gizi - ASI - %')).toBe(false);

      // Reset all custom names
      component.setColumnCustomName('Gizi - ASI - %', 'Custom 1');
      component.resetAllCustomColumnNames();
      expect(component.hasAnyCustomColumnNames()).toBe(false);
    });

    it('harus mendukung pergeseran urutan kolom (move left, move right, reset order)', () => {
      component.resultColumns.set(['Wilayah', 'Col 1', 'Col 2', 'Col 3']);
      component.resultColumnsMeta.set([
        { key: 'Wilayah', layers: ['Wilayah'] },
        { key: 'Col 1', layers: ['Col 1'] },
        { key: 'Col 2', layers: ['Col 2'] },
        { key: 'Col 3', layers: ['Col 3'] },
      ]);
      component.defaultResultColumns.set(['Wilayah', 'Col 1', 'Col 2', 'Col 3']);
      component.defaultResultColumnsMeta.set([
        { key: 'Wilayah', layers: ['Wilayah'] },
        { key: 'Col 1', layers: ['Col 1'] },
        { key: 'Col 2', layers: ['Col 2'] },
        { key: 'Col 3', layers: ['Col 3'] },
      ]);

      // Index 0 (Wilayah) tidak boleh digeser
      expect(component.canMoveColumnLeft(0)).toBe(false);
      expect(component.canMoveColumnLeft(1)).toBe(false); // Col 1 tidak bisa digeser ke posisi Wilayah (index 0)
      expect(component.canMoveColumnLeft(2)).toBe(true);  // Col 2 bisa digeser ke kiri (menukar Col 1)

      // Geser Col 2 ke kiri (posisi index 1)
      component.moveColumnLeft(2);
      expect(component.resultColumns()).toEqual(['Wilayah', 'Col 2', 'Col 1', 'Col 3']);
      expect(component.resultColumnsMeta().map((m) => m.key)).toEqual(['Wilayah', 'Col 2', 'Col 1', 'Col 3']);

      // Geser Col 2 ke kanan (kembali ke index 2)
      component.moveColumnRight(1);
      expect(component.resultColumns()).toEqual(['Wilayah', 'Col 1', 'Col 2', 'Col 3']);

      // Geser Col 1 ke kanan
      component.moveColumnRight(1);
      expect(component.resultColumns()).toEqual(['Wilayah', 'Col 2', 'Col 1', 'Col 3']);

      // Reset ke urutan awal
      component.resetColumnOrder();
      expect(component.resultColumns()).toEqual(['Wilayah', 'Col 1', 'Col 2', 'Col 3']);
    });
  });

  describe('preserving configuration when changing file', () => {
    it('should retain active configuration and auto-join when user loads a newer file with matching sheets and columns', async () => {
      // 1. Set up active configuration
      const sheet1: SheetInfo = {
        name: 'Sheet1',
        columns: [
          { colIndex: 0, colLetter: 'A', header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
          { colIndex: 1, colLetter: 'B', header: 'Indikator A', leafHeader: 'Indikator A', layers: ['Indikator A'] },
        ],
        headers: ['Kabupaten/Kota', 'Indikator A'],
        selected: true,
        variables: ['Indikator A'],
        joinColumn: 'Kabupaten/Kota',
        headerStartRow: 1,
        headerEndRow: 1,
        dataStartRow: 2,
      };

      const sheet2: SheetInfo = {
        name: 'Sheet2',
        columns: [
          { colIndex: 0, colLetter: 'A', header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
          { colIndex: 1, colLetter: 'B', header: 'Indikator B', leafHeader: 'Indikator B', layers: ['Indikator B'] },
        ],
        headers: ['Kabupaten/Kota', 'Indikator B'],
        selected: true,
        variables: ['Indikator B'],
        joinColumn: 'Kabupaten/Kota',
        headerStartRow: 1,
        headerEndRow: 1,
        dataStartRow: 2,
      };

      component.sheets.set([sheet1, sheet2]);
      component.joinBy.set('Kabupaten/Kota');
      component.enableAverage.set(true);
      component.avgColumns.set({ 'Indikator A': true });
      component.customColumnNames.set({ 'Indikator A': 'Alias Indikator A' });

      // 2. Create a new workbook with same structure but newer data
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.aoa_to_sheet([
        ['Kabupaten/Kota', 'Indikator A'],
        ['3301 - KAB. CILACAP', 99],
        ['3371 - KOTA MAGELANG', 88],
      ]);
      const ws2 = XLSX.utils.aoa_to_sheet([
        ['Kabupaten/Kota', 'Indikator B'],
        ['3301 - KAB. CILACAP', 77],
        ['3371 - KOTA MAGELANG', 66],
      ]);
      XLSX.utils.book_append_sheet(wb, ws1, 'Sheet1');
      XLSX.utils.book_append_sheet(wb, ws2, 'Sheet2');
      const u8 = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array;
      const newFile = new File([u8 as BlobPart], 'Data_Baru_TW4.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const mockEvent = {
        target: {
          files: [newFile],
          value: '',
        },
      } as unknown as Event;

      await component.onFileSelected(mockEvent);

      // 3. Verify that configuration was preserved
      expect(component.selectedSheets().map((s) => s.name)).toEqual(['Sheet1', 'Sheet2']);
      expect(component.customColumnNames()['Indikator A']).toBe('Alias Indikator A');
      expect(component.enableAverage()).toBe(true);
      expect(component.avgColumns()['Indikator A']).toBe(true);
      expect(component.resultRows().length).toBe(2);
      expect(component.resultRows()[0]['Indikator A']).toBe(99);
      expect(component.resultRows()[0]['Indikator B']).toBe(77);
    });

    it('should retain configuration even if clearFile was called before choosing the new file', async () => {
      // 1. Set up active configuration
      const sheet1: SheetInfo = {
        name: 'Sheet1',
        columns: [
          { colIndex: 0, colLetter: 'A', header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
          { colIndex: 1, colLetter: 'B', header: 'Indikator A', leafHeader: 'Indikator A', layers: ['Indikator A'] },
        ],
        headers: ['Kabupaten/Kota', 'Indikator A'],
        selected: true,
        variables: ['Indikator A'],
        joinColumn: 'Kabupaten/Kota',
        headerStartRow: 1,
        headerEndRow: 1,
        dataStartRow: 2,
      };

      const sheet2: SheetInfo = {
        name: 'Sheet2',
        columns: [
          { colIndex: 0, colLetter: 'A', header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
          { colIndex: 1, colLetter: 'B', header: 'Indikator B', leafHeader: 'Indikator B', layers: ['Indikator B'] },
        ],
        headers: ['Kabupaten/Kota', 'Indikator B'],
        selected: true,
        variables: ['Indikator B'],
        joinColumn: 'Kabupaten/Kota',
        headerStartRow: 1,
        headerEndRow: 1,
        dataStartRow: 2,
      };

      component.sheets.set([sheet1, sheet2]);
      component.joinBy.set('Kabupaten/Kota');
      component.enableJumlah.set(true);
      component.sumColumns.set({ 'Indikator A': true });

      // User triggers clearFile()
      component.clearFile();
      expect(component.file()).toBeNull();
      expect(component.sheets()).toEqual([]);

      // 2. User selects new file with matching sheets
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.aoa_to_sheet([
        ['Kabupaten/Kota', 'Indikator A'],
        ['3301 - KAB. CILACAP', 55],
      ]);
      const ws2 = XLSX.utils.aoa_to_sheet([
        ['Kabupaten/Kota', 'Indikator B'],
        ['3301 - KAB. CILACAP', 44],
      ]);
      XLSX.utils.book_append_sheet(wb, ws1, 'Sheet1');
      XLSX.utils.book_append_sheet(wb, ws2, 'Sheet2');
      const u8 = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array;
      const newFile = new File([u8 as BlobPart], 'Data_Baru.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const mockEvent = {
        target: {
          files: [newFile],
          value: '',
        },
      } as unknown as Event;

      await component.onFileSelected(mockEvent);

      expect(component.selectedSheets().map((s) => s.name)).toEqual(['Sheet1', 'Sheet2']);
      expect(component.enableJumlah()).toBe(true);
      expect(component.sumColumns()['Indikator A']).toBe(true);
      expect(component.resultRows().length).toBe(1);
      expect(component.resultRows()[0]['Indikator A']).toBe(55);
      expect(component.resultRows()[0]['Indikator B']).toBe(44);
    });

    it('should not force previous configuration if the new file has completely different sheets', async () => {
      // 1. Set up active configuration for Sheet1
      const sheet1: SheetInfo = {
        name: 'Sheet1',
        columns: [
          { colIndex: 0, colLetter: 'A', header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
          { colIndex: 1, colLetter: 'B', header: 'Indikator A', leafHeader: 'Indikator A', layers: ['Indikator A'] },
        ],
        headers: ['Kabupaten/Kota', 'Indikator A'],
        selected: true,
        variables: ['Indikator A'],
        joinColumn: 'Kabupaten/Kota',
        headerStartRow: 1,
        headerEndRow: 1,
        dataStartRow: 2,
      };

      component.sheets.set([sheet1]);

      // 2. Load file with completely different sheet names: UnrelatedSheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['Nama Barang', 'Harga'],
        ['Barang 1', 1000],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'UnrelatedSheet');
      const u8 = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array;
      const newFile = new File([u8 as BlobPart], 'Stok_Barang.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const mockEvent = {
        target: {
          files: [newFile],
          value: '',
        },
      } as unknown as Event;

      await component.onFileSelected(mockEvent);

      // New file sheets are loaded, but none are auto-selected since they don't match
      expect(component.sheets().map((s) => s.name)).toEqual(['UnrelatedSheet']);
      expect(component.selectedSheets()).toEqual([]);
      expect(component.showSettings()).toBe(true);
    });
  });

  describe('state persistence across menu navigation (local storage & in-memory store)', () => {
    it('should restore previous state from ExcelJoinStore on ngOnInit when returning from another menu', async () => {
      const store = TestBed.inject(ExcelJoinStore);
      const mockWb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([['Kabupaten/Kota', 'Var A'], ['CILACAP', 88]]);
      XLSX.utils.book_append_sheet(mockWb, ws, 'Sheet1');

      const savedState: ExcelJoinStoredState = {
        version: '1.0',
        savedAt: new Date().toISOString(),
        fileInfo: { name: 'MySavedData.xlsx' },
        isDefaultData: false,
        isCloudDefault: false,
        showSettings: false,
        activePresetName: 'Saved Preset',
        sheets: [
          {
            name: 'Sheet1',
            columns: [
              { colIndex: 0, colLetter: 'A', header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
              { colIndex: 1, colLetter: 'B', header: 'Var A', leafHeader: 'Var A', layers: ['Var A'] },
            ],
            headers: ['Kabupaten/Kota', 'Var A'],
            selected: true,
            variables: ['Var A'],
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
        enableTarget: false,
        enableCapaian: false,
        enableJumlah: true,
        enableAverage: true,
        columnTargets: {},
        columnConfigs: {},
        sumColumns: { 'Var A': true },
        avgColumns: { 'Var A': true },
        customColumnNames: { 'Var A': 'Nama Kustom A' },
        resultColumns: ['Kabupaten/Kota', 'Var A'],
        resultColumnsMeta: [{ key: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] }, { key: 'Var A', layers: ['Var A'] }],
        defaultResultColumns: ['Kabupaten/Kota', 'Var A'],
        defaultResultColumnsMeta: [{ key: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] }, { key: 'Var A', layers: ['Var A'] }],
        resultRows: [{ 'Kabupaten/Kota': 'CILACAP', 'Var A': 88 }],
        originalResultRows: [{ 'Kabupaten/Kota': 'CILACAP', 'Var A': 88 }],
      };

      store.saveState(savedState, mockWb);

      // Create new component instance as if navigating back to /excel-join
      const newFixture = TestBed.createComponent(ExcelJoinComponent);
      const newComp = newFixture.componentInstance;
      await newComp.ngOnInit();

      expect(newComp.file()?.name).toBe('MySavedData.xlsx');
      expect(newComp.selectedSheets().map((s) => s.name)).toEqual(['Sheet1']);
      expect(newComp.customColumnNames()['Var A']).toBe('Nama Kustom A');
      expect(newComp.resultRows().length).toBe(1);
      expect(newComp.resultRows()[0]['Var A']).toBe(88);
      expect(newComp.enableAverage()).toBe(true);
      expect(newComp.avgColumns()['Var A']).toBe(true);
    });

    it('should save current state to ExcelJoinStore upon ngOnDestroy or editing', () => {
      const store = TestBed.inject(ExcelJoinStore);
      component.resultColumns.set(['Kabupaten/Kota', 'Var B']);
      component.resultRows.set([{ 'Kabupaten/Kota': 'KUDUS', 'Var B': 90 }]);
      component.customColumnNames.set({ 'Var B': 'Alias B' });

      component.ngOnDestroy();

      expect(store.hasState()).toBe(true);
      const stored = store.getState();
      expect(stored?.customColumnNames['Var B']).toBe('Alias B');
      expect(stored?.resultRows.length).toBe(1);
    });
  });
});

