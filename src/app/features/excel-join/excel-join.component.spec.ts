import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ExcelJoinComponent, SheetInfo } from './excel-join.component';
import { ExcelJoinStore, ExcelJoinStoredState } from './excel-join-store';
import { PresetStore } from './preset-store';
import * as XLSX from 'xlsx-js-style';
import { environment } from '../../../environments/environment';
import { GasStorageService } from '../../core/storage/gas-storage.service';
import { HealthDataExchange } from '../../core/domain/health-data-exchange';

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

    it('should toggle showColumnSettings correctly via toggleColumnSettings()', () => {
      expect(component.showColumnSettings()).toBe(false);
      component.toggleColumnSettings();
      expect(component.showColumnSettings()).toBe(true);
      component.toggleColumnSettings();
      expect(component.showColumnSettings()).toBe(false);
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
      expect(targets.some((t) => typeof t.value === 'number' && t.value > 0)).toBe(true);
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

    it('harus mendukung pemilihan kolom target tertentu saja (toggle dan update)', () => {
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

  describe('Google Drive reload and save default', () => {
    it('should reload data and config from Google Drive via reloadFromDrive()', async () => {
      const gasService = TestBed.inject(GasStorageService);
      const store = TestBed.inject(ExcelJoinStore);
      const clearStateSpy = vi.spyOn(store, 'clearState');

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([['Kabupaten/Kota', 'Var A'], ['CILACAP', 99]]);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const u8 = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array;
      const buf = new Uint8Array(u8).buffer;

      vi.spyOn(gasService, 'isConfigured').mockReturnValue(true);
      vi.spyOn(gasService, 'loadDefault').mockResolvedValue({
        success: true,
        hasData: true,
        fileName: 'drive-data.xlsx',
        excelBuffer: buf,
        config: {
          version: '1.0',
          name: 'Preset Dari Drive',
          outputHeaderFormat: 'concat',
          sheets: [
            {
              sheetName: 'Sheet1',
              variables: ['Var A'],
              joinColumn: 'Kabupaten/Kota',
            },
          ],
        },
      });

      await component.reloadFromDrive();

      expect(clearStateSpy).toHaveBeenCalled();
      expect(component.file()?.name).toBe('drive-data.xlsx');
      expect(component.isCloudDefault()).toBe(true);
      expect(component.configNotification()?.type).toBe('success');
      expect(component.configNotification()?.message).toContain('Google Drive');
    });

    it('should serialize workbook to non-empty buffer when file is 0 bytes on confirmSaveDefaultToCloud()', async () => {
      const gasService = TestBed.inject(GasStorageService);
      vi.spyOn(gasService, 'isConfigured').mockReturnValue(true);

      let savedBuffer: ArrayBuffer | null = null;
      vi.spyOn(gasService, 'saveDefault').mockImplementation(async (buf) => {
        savedBuffer = buf;
        return { success: true, message: 'Berhasil' };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([['Kabupaten/Kota', 'Var A'], ['BANYUMAS', 85]]);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

      // Emulate restored file with 0 size
      component.file.set(new File([], 'restored-zero-byte.xlsx'));
      component.workbook = wb;

      await component.confirmSaveDefaultToCloud();

      expect(savedBuffer).not.toBeNull();
      expect((savedBuffer as unknown as ArrayBuffer).byteLength).toBeGreaterThan(0);
      expect(component.configNotification()?.type).toBe('success');
    });

    it('should allow canPreview() when at least one selected sheet has variables, even if another has 0', () => {
      const sheet1: SheetInfo = {
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
      };

      const sheet2: SheetInfo = {
        name: 'Sheet2',
        columns: [
          { colIndex: 0, colLetter: 'A', header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
          { colIndex: 1, colLetter: 'B', header: 'Var B', leafHeader: 'Var B', layers: ['Var B'] },
        ],
        headers: ['Kabupaten/Kota', 'Var B'],
        selected: true,
        variables: [], // 0 variables selected
        joinColumn: 'Kabupaten/Kota',
        headerStartRow: 1,
        headerEndRow: 1,
        dataStartRow: 2,
      };

      component.sheets.set([sheet1, sheet2]);
      expect(component.canPreview()).toBe(true);
      expect(component.validationMessage()).toBe('');

      // If both sheets have 0 variables, canPreview should be false
      sheet1.variables = [];
      component.sheets.set([{ ...sheet1 }, { ...sheet2 }]);
      expect(component.canPreview()).toBe(false);
      expect(component.validationMessage()).toBe('Pilih minimal 1 variabel untuk ditampilkan.');
    });

    it('should automatically trigger preview() when toggleVariable is called without wiping table results', () => {
      const sheet1: SheetInfo = {
        name: 'Sheet1',
        columns: [
          { colIndex: 0, colLetter: 'A', header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
          { colIndex: 1, colLetter: 'B', header: 'Var A', leafHeader: 'Var A', layers: ['Var A'] },
          { colIndex: 2, colLetter: 'C', header: 'Var Added', leafHeader: 'Var Added', layers: ['Var Added'] },
        ],
        headers: ['Kabupaten/Kota', 'Var A', 'Var Added'],
        selected: true,
        variables: ['Var A'],
        joinColumn: 'Kabupaten/Kota',
        headerStartRow: 1,
        headerEndRow: 1,
        dataStartRow: 2,
      };

      const sheet2: SheetInfo = {
        name: 'Sheet2',
        columns: [
          { colIndex: 0, colLetter: 'A', header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
          { colIndex: 1, colLetter: 'B', header: 'Var B', leafHeader: 'Var B', layers: ['Var B'] },
        ],
        headers: ['Kabupaten/Kota', 'Var B'],
        selected: true,
        variables: ['Var B'],
        joinColumn: 'Kabupaten/Kota',
        headerStartRow: 1,
        headerEndRow: 1,
        dataStartRow: 2,
      };

      component.workbook = {
        SheetNames: ['Sheet1', 'Sheet2'],
        Sheets: {
          Sheet1: {
            '!ref': 'A1:C3',
            A1: { v: 'Kabupaten/Kota' },
            B1: { v: 'Var A' },
            C1: { v: 'Var Added' },
            A2: { v: '3301 - KAB. CILACAP' },
            B2: { v: 10 },
            C2: { v: 99 },
            A3: { v: '3302 - KAB. BANYUMAS' },
            B3: { v: 20 },
            C3: { v: 88 },
          },
          Sheet2: {
            '!ref': 'A1:B3',
            A1: { v: 'Kabupaten/Kota' },
            B1: { v: 'Var B' },
            A2: { v: 'CILACAP' },
            B2: { v: 100 },
            A3: { v: 'BANYUMAS' },
            B3: { v: 200 },
          },
        },
      } as any;

      component.sheets.set([sheet1, sheet2]);
      component.preview();

      expect(component.resultRows()).toHaveLength(2);
      expect(component.resultColumns()).toContain('Var A');
      expect(component.resultColumns()).not.toContain('Var Added');

      // User adds a column to display
      component.toggleVariable(sheet1, 'Var Added');

      // Result rows must NOT be wiped out; preview must automatically include Var Added
      expect(component.resultRows()).toHaveLength(2);
      expect(component.resultColumns()).toContain('Var Added');
      expect(component.resultRows()[0]['Var Added']).toBe(99);
      expect(component.resultRows()[1]['Var Added']).toBe(88);
    });

    it('should include all columns in resultColumns even when row 0 has no matching record in left-joined sheet', () => {
      const sheet1: SheetInfo = {
        name: 'MasterSheet',
        columns: [
          { colIndex: 0, colLetter: 'A', header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
          { colIndex: 1, colLetter: 'B', header: 'Master Var', leafHeader: 'Master Var', layers: ['Master Var'] },
        ],
        headers: ['Kabupaten/Kota', 'Master Var'],
        selected: true,
        variables: ['Master Var'],
        joinColumn: 'Kabupaten/Kota',
        headerStartRow: 1,
        headerEndRow: 1,
        dataStartRow: 2,
      };

      const sheet2: SheetInfo = {
        name: 'LeftSheet',
        columns: [
          { colIndex: 0, colLetter: 'A', header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
          { colIndex: 1, colLetter: 'B', header: 'Left Var', leafHeader: 'Left Var', layers: ['Left Var'] },
        ],
        headers: ['Kabupaten/Kota', 'Left Var'],
        selected: true,
        variables: ['Left Var'],
        joinColumn: 'Kabupaten/Kota',
        headerStartRow: 1,
        headerEndRow: 1,
        dataStartRow: 2,
      };

      // In this workbook, Row 0 in master is CILACAP. Sheet2 does NOT have Cilacap at all!
      component.workbook = {
        SheetNames: ['MasterSheet', 'LeftSheet'],
        Sheets: {
          MasterSheet: {
            '!ref': 'A1:B3',
            A1: { v: 'Kabupaten/Kota' },
            B1: { v: 'Master Var' },
            A2: { v: 'CILACAP' },
            B2: { v: 10 },
            A3: { v: 'BANYUMAS' },
            B3: { v: 20 },
          },
          LeftSheet: {
            '!ref': 'A1:B2',
            A1: { v: 'Kabupaten/Kota' },
            B1: { v: 'Left Var' },
            A2: { v: 'BANYUMAS' },
            B2: { v: 555 },
          },
        },
      } as any;

      component.includeSheetPrefix.set(false);
      component.sheets.set([sheet1, sheet2]);
      component.preview();

      // resultColumns must contain Left Var even though row 0 (Cilacap) had no entry in Sheet2!
      expect(component.resultColumns()).toEqual(['Kabupaten/Kota', 'Master Var', 'Left Var']);
      expect(component.resultRows()[0]['Kabupaten/Kota']).toBe('CILACAP');
      expect(component.resultRows()[0]['Master Var']).toBe(10);
      expect(component.resultRows()[0]['Left Var']).toBeNull();

      expect(component.resultRows()[1]['Kabupaten/Kota']).toBe('BANYUMAS');
      expect(component.resultRows()[1]['Master Var']).toBe(20);
      expect(component.resultRows()[1]['Left Var']).toBe(555);
    });

    it('should preserve customized column ordering when adding a new variable', () => {
      const sheet1: SheetInfo = {
        name: 'Sheet1',
        columns: [
          { colIndex: 0, colLetter: 'A', header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
          { colIndex: 1, colLetter: 'B', header: 'Col1', leafHeader: 'Col1', layers: ['Col1'] },
          { colIndex: 2, colLetter: 'C', header: 'Col2', leafHeader: 'Col2', layers: ['Col2'] },
          { colIndex: 3, colLetter: 'D', header: 'ColNew', leafHeader: 'ColNew', layers: ['ColNew'] },
        ],
        headers: ['Kabupaten/Kota', 'Col1', 'Col2', 'ColNew'],
        selected: true,
        variables: ['Col1', 'Col2'],
        joinColumn: 'Kabupaten/Kota',
        headerStartRow: 1,
        headerEndRow: 1,
        dataStartRow: 2,
      };

      const sheet2: SheetInfo = {
        name: 'Sheet2',
        columns: [
          { colIndex: 0, colLetter: 'A', header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
          { colIndex: 1, colLetter: 'B', header: 'Col3', leafHeader: 'Col3', layers: ['Col3'] },
        ],
        headers: ['Kabupaten/Kota', 'Col3'],
        selected: true,
        variables: ['Col3'],
        joinColumn: 'Kabupaten/Kota',
        headerStartRow: 1,
        headerEndRow: 1,
        dataStartRow: 2,
      };

      component.workbook = {
        SheetNames: ['Sheet1', 'Sheet2'],
        Sheets: {
          Sheet1: {
            '!ref': 'A1:D2',
            A1: { v: 'Kabupaten/Kota' },
            B1: { v: 'Col1' },
            C1: { v: 'Col2' },
            D1: { v: 'ColNew' },
            A2: { v: 'CILACAP' },
            B2: { v: 1 },
            C2: { v: 2 },
            D2: { v: 999 },
          },
          Sheet2: {
            '!ref': 'A1:B2',
            A1: { v: 'Kabupaten/Kota' },
            B1: { v: 'Col3' },
            A2: { v: 'CILACAP' },
            B2: { v: 3 },
          },
        },
      } as any;

      component.includeSheetPrefix.set(false);
      component.sheets.set([sheet1, sheet2]);
      component.preview();

      // Initial natural order: ['Kabupaten/Kota', 'Col1', 'Col2', 'Col3']
      expect(component.resultColumns()).toEqual(['Kabupaten/Kota', 'Col1', 'Col2', 'Col3']);

      // Move Col2 left (swap Col1 and Col2)
      component.moveColumnLeft(2);
      expect(component.resultColumns()).toEqual(['Kabupaten/Kota', 'Col2', 'Col1', 'Col3']);

      // Now toggle/add ColNew
      component.toggleVariable(sheet1, 'ColNew');

      // Swapped order of Col2 and Col1 must be preserved, and ColNew must be appended at the end
      expect(component.resultColumns()).toEqual(['Kabupaten/Kota', 'Col2', 'Col1', 'Col3', 'ColNew']);
    });

    it('should select column for move, toggle off on re-click, and reject selecting locked key column', () => {
      component.resultColumns.set(['Kabupaten/Kota', 'Col A', 'Col B', 'Col C']);

      // Attempting to select key column (index 0) must do nothing
      component.selectColumnForMove('Kabupaten/Kota');
      expect(component.selectedColumnForMove()).toBeNull();
      expect(component.selectedColumnIndex()).toBe(-1);

      // Select Col B
      component.selectColumnForMove('Col B');
      expect(component.selectedColumnForMove()).toBe('Col B');
      expect(component.selectedColumnIndex()).toBe(2);

      // Clicking Col B again should deselect it
      component.selectColumnForMove('Col B');
      expect(component.selectedColumnForMove()).toBeNull();
      expect(component.selectedColumnIndex()).toBe(-1);

      // Select Col A (index 1) - can move right, but cannot move left (index 0 is locked)
      component.selectColumnForMove('Col A');
      expect(component.canMoveSelectedColumnLeft()).toBe(false);
      expect(component.canMoveSelectedColumnRight()).toBe(true);

      // Select Col C (index 3, last) - can move left, but cannot move right
      component.selectColumnForMove('Col C');
      expect(component.canMoveSelectedColumnLeft()).toBe(true);
      expect(component.canMoveSelectedColumnRight()).toBe(false);
    });

    it('should move selected column left and right via shared buttons and update its position', () => {
      component.resultColumns.set(['Kabupaten/Kota', 'Col A', 'Col B', 'Col C']);
      component.resultColumnsMeta.set([
        { key: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
        { key: 'Col A', layers: ['Col A'] },
        { key: 'Col B', layers: ['Col B'] },
        { key: 'Col C', layers: ['Col C'] },
      ]);

      component.selectColumnForMove('Col B');
      expect(component.selectedColumnIndex()).toBe(2);

      // Move left
      component.moveSelectedColumnLeft();
      expect(component.resultColumns()).toEqual(['Kabupaten/Kota', 'Col B', 'Col A', 'Col C']);
      expect(component.selectedColumnIndex()).toBe(1);

      // At index 1, cannot move left anymore
      expect(component.canMoveSelectedColumnLeft()).toBe(false);

      // Move right twice
      component.moveSelectedColumnRight();
      expect(component.resultColumns()).toEqual(['Kabupaten/Kota', 'Col A', 'Col B', 'Col C']);
      expect(component.selectedColumnIndex()).toBe(2);

      component.moveSelectedColumnRight();
      expect(component.resultColumns()).toEqual(['Kabupaten/Kota', 'Col A', 'Col C', 'Col B']);
      expect(component.selectedColumnIndex()).toBe(3);
      expect(component.canMoveSelectedColumnRight()).toBe(false);
    });

    it('should support keyboard navigation (ArrowLeft, ArrowRight, Escape) for shifting active column', () => {
      component.resultColumns.set(['Kabupaten/Kota', 'Col A', 'Col B', 'Col C']);
      component.resultColumnsMeta.set([
        { key: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
        { key: 'Col A', layers: ['Col A'] },
        { key: 'Col B', layers: ['Col B'] },
        { key: 'Col C', layers: ['Col C'] },
      ]);

      component.selectColumnForMove('Col B');

      // ArrowLeft keydown
      const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      component.handleKeyboardMove(leftEvent);
      expect(component.resultColumns()).toEqual(['Kabupaten/Kota', 'Col B', 'Col A', 'Col C']);

      // ArrowRight keydown
      const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      component.handleKeyboardMove(rightEvent);
      expect(component.resultColumns()).toEqual(['Kabupaten/Kota', 'Col A', 'Col B', 'Col C']);

      // Escape keydown clears selection
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      component.handleKeyboardMove(escEvent);
      expect(component.selectedColumnForMove()).toBeNull();
    });
  });

  describe('Inline Column Renaming (Double-Click)', () => {
    beforeEach(() => {
      component.resultColumns.set(['Kabupaten/Kota', 'Col A', 'Col B']);
      component.resultColumnsMeta.set([
        { key: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
        { key: 'Col A', layers: ['Col A'] },
        { key: 'Col B', layers: ['Col B'] },
      ]);
    });

    it('should start editing a column and prefill with current display name', () => {
      expect(component.editingColumnKey()).toBeNull();

      component.startEditingColumn('Col A');
      expect(component.editingColumnKey()).toBe('Col A');
      expect(component.editingColumnValue()).toBe('Col A');

      // If an alias already exists, it should prefill with the alias
      component.setColumnCustomName('Col B', 'Balita Stunting');
      component.startEditingColumn('Col B');
      expect(component.editingColumnKey()).toBe('Col B');
      expect(component.editingColumnValue()).toBe('Balita Stunting');
    });

    it('should ignore invalid keys such as null or internal action columns', () => {
      component.startEditingColumn(null);
      expect(component.editingColumnKey()).toBeNull();

      component.startEditingColumn('__aksi__');
      expect(component.editingColumnKey()).toBeNull();

      component.startEditingColumn('__no__');
      expect(component.editingColumnKey()).toBeNull();

      component.startEditingColumn('__capaian__');
      expect(component.editingColumnKey()).toBeNull();
    });

    it('should save inline column rename and update customColumnNames and grid', () => {
      component.startEditingColumn('Col A');
      component.saveInlineColumnRename('Col A', 'Jumlah Balita Diukur');

      expect(component.editingColumnKey()).toBeNull();
      expect(component.customColumnNames()['Col A']).toBe('Jumlah Balita Diukur');
      expect(component.getColumnDisplayName('Col A')).toBe('Jumlah Balita Diukur');

      // Verify htmlHeaderGrid reflects the updated name
      const grid = component.htmlHeaderGrid();
      const colACell = grid[0].find((c) => c.colKey === 'Col A');
      expect(colACell?.text).toBe('Jumlah Balita Diukur');
    });

    it('should cancel inline rename without altering existing column name', () => {
      component.startEditingColumn('Col A');
      component.cancelInlineColumnRename();

      expect(component.editingColumnKey()).toBeNull();
      expect(component.customColumnNames()['Col A']).toBeUndefined();
      expect(component.getColumnDisplayName('Col A')).toBe('Col A');
    });

    it('should revert to original name if user enters empty string or the exact original name', () => {
      // First set a custom alias
      component.setColumnCustomName('Col A', 'Alias Lama');
      expect(component.customColumnNames()['Col A']).toBe('Alias Lama');

      // User clears input and saves
      component.startEditingColumn('Col A');
      component.saveInlineColumnRename('Col A', '   ');
      expect(component.customColumnNames()['Col A']).toBeUndefined();
      expect(component.getColumnDisplayName('Col A')).toBe('Col A');

      // User sets it to the original column key
      component.setColumnCustomName('Col A', 'Alias Baru');
      component.startEditingColumn('Col A');
      component.saveInlineColumnRename('Col A', 'Col A');
      expect(component.customColumnNames()['Col A']).toBeUndefined();
      expect(component.getColumnDisplayName('Col A')).toBe('Col A');
    });

    it('should guard saveInlineColumnRename against mismatched colKey', () => {
      component.startEditingColumn('Col A');
      // Attempting to save for Col B while editing Col A should be ignored
      component.saveInlineColumnRename('Col B', 'Nama Salah');
      expect(component.customColumnNames()['Col B']).toBeUndefined();
      expect(component.editingColumnKey()).toBe('Col A');
    });

    it('should stop propagation when event is provided to startEditingColumn', () => {
      const mockEvent = {
        stopPropagation: vi.fn(),
      } as unknown as Event;

      component.startEditingColumn('Col A', mockEvent);
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(component.editingColumnKey()).toBe('Col A');
    });
  });

  describe('table row delete and capaian formatting', () => {
    it('should render cross icon in delete button and delete row upon click', () => {
      component.resultRows.set([
        { Wilayah: 'Semarang', Jumlah: 100 },
        { Wilayah: 'Solo', Jumlah: 80 },
      ]);
      component.originalResultRows.set([
        { Wilayah: 'Semarang', Jumlah: 100 },
        { Wilayah: 'Solo', Jumlah: 80 },
      ]);
      component.resultColumns.set(['Wilayah', 'Jumlah']);
      fixture.detectChanges();

      const deleteButtons = fixture.nativeElement.querySelectorAll('tbody tr td:first-child button');
      expect(deleteButtons.length).toBe(2);
      expect(deleteButtons[0].textContent.trim()).toBe('');
      const svg = deleteButtons[0].querySelector('svg');
      expect(svg).toBeTruthy();

      deleteButtons[0].click();
      fixture.detectChanges();

      expect(component.resultRows().length).toBe(1);
      expect(component.resultRows()[0]['Wilayah']).toBe('Solo');
    });

    it('should format capaian cell directly without circular badge', () => {
      component.resultRows.set([
        { Wilayah: 'Semarang', Indikator: 10 },
        { Wilayah: 'Solo', Indikator: 5 },
      ]);
      component.resultColumns.set(['Wilayah', 'Indikator']);
      component.columnConfigs.set({
        Wilayah: { dataType: 'string', anomalyEnabled: false, minAnomaly: null, maxAnomaly: null },
        Indikator: { dataType: 'number', anomalyEnabled: false, minAnomaly: null, maxAnomaly: null },
      });
      component.columnTargets.set({
        Indikator: { enabled: true, operator: '>=', value: 8 },
      });
      component.enableTarget.set(true);
      component.enableCapaian.set(true);
      fixture.detectChanges();

      const capaianCells = fixture.nativeElement.querySelectorAll('tbody tr td:last-child');
      expect(capaianCells.length).toBe(2);

      // Verify no circular badge (span.rounded-full) inside the cell
      expect(capaianCells[0].querySelector('span.rounded-full')).toBeNull();
      expect(capaianCells[1].querySelector('span.rounded-full')).toBeNull();

      // Highest should have blue highlight on td
      expect(capaianCells[0].classList.contains('bg-blue-100')).toBe(true);
      // Lowest should have red highlight on td
      expect(capaianCells[1].classList.contains('bg-red-100')).toBe(true);
    });

    it('visualizeInChart should pass first available target when enabled, or 50 when disabled/unavailable', () => {
      const exchange = TestBed.inject(HealthDataExchange);
      const publishSpy = vi.spyOn(exchange, 'publishJoinedToChart');
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      component.resultRows.set([
        { Wilayah: 'Cilacap', 'Cakupan ASI %': 78 },
      ]);
      component.resultColumns.set(['Wilayah', 'Cakupan ASI %']);
      component.columnTargets.set({
        'Cakupan ASI %': { enabled: true, operator: '>=', value: 76 },
      });
      component.enableTarget.set(true);

      component.visualizeInChart();

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          targetValue: 76,
          columnTargets: expect.objectContaining({
            'Cakupan ASI %': { enabled: true, operator: '>=', value: 76 },
          }),
        }),
      );
      expect(navSpy).toHaveBeenCalledWith(['/chart']);

      // Case 2: Targets disabled -> fallback to 50
      component.enableTarget.set(false);
      component.visualizeInChart();
      expect(publishSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          targetValue: 50,
          columnTargets: undefined,
        }),
      );
    });
  });
});

