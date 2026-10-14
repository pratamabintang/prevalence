import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import { ChartVisualizerComponent } from './chart-visualizer.component';
import { ChartDataBridge } from '../../core/chart/chart-data-bridge';
import { ChartBarItem } from '../../core/chart/chart-layout-engine';
import {
  ChartConfigurationPreset,
  ChartPresetStore,
} from './chart-preset-store';

describe('ChartVisualizerComponent', () => {
  let component: ChartVisualizerComponent;
  let fixture: ComponentFixture<ChartVisualizerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChartVisualizerComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ChartVisualizerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function populateTestData() {
    component.allColumns.set(['Wilayah', 'tw1', 'tw2', 'tw3', 'tw4']);
    component.categoryColumn.set('Wilayah');
    component.availableCategories.set([
      'Kab. Magelang',
      'Kota Magelang',
      'Kab. Temanggung',
      'Kab. Purworejo',
      'Kab. Wonosobo',
    ]);
    component.selectedCategories.set([
      'Kab. Magelang',
      'Kota Magelang',
      'Kab. Temanggung',
      'Kab. Purworejo',
      'Kab. Wonosobo',
    ]);
    component.seriesList.set([
      { key: 'tw1', label: 'Triwulan 1', color: '#60a5fa' },
      { key: 'tw2', label: 'Triwulan 2', color: '#3b82f6' },
      { key: 'tw3', label: 'Triwulan 3', color: '#1d4ed8' },
      { key: 'tw4', label: 'Triwulan 4', color: '#10b981' },
    ]);
    component.selectedSeriesKeys.set(['tw1', 'tw2', 'tw3', 'tw4']);
    const rows = [
      { Wilayah: 'Kab. Magelang', tw1: '72,4', tw2: '78,2', tw3: '84,5', tw4: '91,0' },
      { Wilayah: 'Kota Magelang', tw1: '81,0', tw2: '85,4', tw3: '88,0', tw4: '95,2' },
      { Wilayah: 'Kab. Temanggung', tw1: '68,5', tw2: '74,0', tw3: '80,2', tw4: '88,5' },
      { Wilayah: 'Kab. Purworejo', tw1: '70,0', tw2: '76,5', tw3: '82,0', tw4: '89,4' },
      { Wilayah: 'Kab. Wonosobo', tw1: '65,0', tw2: '71,2', tw3: 0, tw4: '-' },
    ];
    component.dataRows.set(rows);
    component.originalDataRows.set(rows);
  }

  it('should initialize with empty state without sample data', () => {
    expect(component).toBeTruthy();
    expect(component.hasData()).toBe(false);
    expect(component.dataRows().length).toBe(0);
    expect(component.seriesList().length).toBe(0);
    expect(component.availableCategories().length).toBe(0);
    expect(component.selectedCategories().length).toBe(0);
    expect(component.dataSource()).toBe('empty');
  });

  it('should filter available categories by search query when data is loaded', () => {
    populateTestData();

    component.categorySearchQuery.set('magelang');
    const filtered = component.filteredAvailableCategories();
    expect(filtered.length).toBe(2);
    expect(filtered).toContain('Kab. Magelang');
    expect(filtered).toContain('Kota Magelang');
  });

  it('should toggle and manage category selection', () => {
    populateTestData();

    component.toggleCategory('Kab. Magelang');
    expect(component.isCategorySelected('Kab. Magelang')).toBe(false);

    component.toggleCategory('Kab. Magelang');
    expect(component.isCategorySelected('Kab. Magelang')).toBe(true);

    component.clearAllCategories();
    expect(component.selectedCategories().length).toBe(0);

    component.selectAllCategories();
    expect(component.selectedCategories().length).toBe(component.availableCategories().length);
  });

  it('should toggle series and prevent removing all series', () => {
    populateTestData();

    expect(component.isSeriesActive('tw4')).toBe(true);

    component.toggleSeries('tw4');
    expect(component.isSeriesActive('tw4')).toBe(false);

    // Turn off tw2 and tw3 as well
    component.toggleSeries('tw2');
    component.toggleSeries('tw3');
    expect(component.seriesList().length).toBe(1);

    // Trying to remove the last one (tw1) should be prevented
    component.toggleSeries('tw1');
    expect(component.seriesList().length).toBe(1);
    expect(component.seriesList()[0].key).toBe('tw1');
  });

  it('should support hiding and deleting rows, and restoring original rows', () => {
    populateTestData();

    // 1. Initial state has 5 categories in original order
    expect(component.visibleCategories().length).toBe(5);
    expect(component.visibleCategories()[0]).toBe('Kab. Magelang');
    expect(component.hasHiddenOrDeletedRows()).toBe(false);

    // 2. Hide row by unchecking
    component.toggleCategory('Kota Magelang');
    expect(component.visibleCategories().length).toBe(4);
    expect(component.visibleCategories()).not.toContain('Kota Magelang');
    expect(component.hasHiddenOrDeletedRows()).toBe(true);

    // 3. Delete row
    component.deleteRow('Kab. Wonosobo');
    expect(component.availableCategories()).not.toContain('Kab. Wonosobo');
    expect(component.visibleCategories()).not.toContain('Kab. Wonosobo');

    // 4. Restore all rows
    component.restoreAllRows();
    expect(component.visibleCategories().length).toBe(5);
    expect(component.visibleCategories()).toContain('Kota Magelang');
    expect(component.visibleCategories()).toContain('Kab. Wonosobo');
  });

  it('should export clean data to Excel workbook', () => {
    populateTestData();

    expect(() => component.exportExcel()).not.toThrow();
  });

  it('should correctly calculate hover tooltip state and target status', () => {
    component.targetValue.set(80);

    const dummyBar: ChartBarItem = {
      seriesKey: 'tw2',
      seriesLabel: 'Triwulan 2',
      color: '#3b82f6',
      rawVal: '85,4',
      numericVal: 85.4,
      displayLabel: '85,4',
      isZero: false,
      isMissing: false,
      x: 200,
      y: 100,
      width: 150,
      height: 18,
    };

    const mouseEvent = new MouseEvent('mouseenter', { clientX: 300, clientY: 250 });
    component.onBarHover(mouseEvent, dummyBar, 'Kota Magelang');

    const hovered = component.hoveredBar();
    expect(hovered).not.toBeNull();
    expect(hovered?.categoryName).toBe('Kota Magelang');
    expect(hovered?.status).toBe('achieved');
    expect(hovered?.diff).toBe(5.4);

    component.onBarLeave();
    expect(component.hoveredBar()).toBeNull();
  });

  it('should reactively recompute layout when targetValue changes', () => {
    populateTestData();

    component.targetValue.set(120);
    const layout = component.layout();
    expect(layout.maxValue).toBeGreaterThanOrEqual(120);
    expect(layout.targetLineX).toBeGreaterThan(layout.plotX);
  });

  it('should handle inline step flow: sheet switching, header row updates, and selective columns', () => {
    // Mock worksheet data
    const mockSheet1: any = {
      '!ref': 'A1:C5',
      A1: { v: 'LAPORAN KESEHATAN' },
      A2: { v: 'Kabupaten/Kota' },
      B2: { v: 'Triwulan 1' },
      C2: { v: 'Triwulan 2' },
      A3: { v: 'Banyumas' },
      B3: { v: 75.5 },
      C3: { v: 82.0 },
      A4: { v: 'Cilacap' },
      B4: { v: 70.0 },
      C4: { v: 78.5 },
    };

    const mockSheet2: any = {
      '!ref': 'A1:D6',
      A3: { v: 'Nama Puskesmas' },
      B3: { v: 'Cakupan HB-0' },
      C3: { v: 'Cakupan BCG' },
      D3: { v: 'Cakupan Polio' },
      A5: { v: 'Puskesmas A' },
      B5: { v: 90 },
      C5: { v: 95 },
      D5: { v: 88 },
    };

    const mockWb: any = {
      SheetNames: ['Sheet1', 'Sheet2'],
      Sheets: {
        Sheet1: mockSheet1,
        Sheet2: mockSheet2,
      },
    };

    component.workbook = mockWb;
    component.sheetNames.set(['Sheet1', 'Sheet2']);
    component.file.set(new File([], 'data-dinkes.xlsx'));
    component.dataSource.set('upload');

    // Inisialisasi sheet pertama
    component.selectSheet('Sheet1');
    expect(component.selectedSheet()).toBe('Sheet1');
    expect(component.sheetColumns().length).toBeGreaterThan(0);

    // Ganti ke Sheet2
    component.selectSheet('Sheet2');
    expect(component.selectedSheet()).toBe('Sheet2');

    // Sesuaikan header baris manual: header di baris 3, data mulai di baris 5
    component.headerStartRow.set(3);
    component.headerEndRow.set(3);
    component.dataStartRow.set(5);
    component.refreshSheetColumnsAndData(mockSheet2, 3, 3, 5);

    expect(component.categoryColumn()).toBe('Nama Puskesmas');

    // Hanya pilih 1 kolom (Cakupan HB-0), jangan semua kolom!
    component.clearAllSeriesColumns();
    expect(component.canRenderChart()).toBe(false);

    component.toggleSeriesColumn('Cakupan HB-0');
    expect(component.canRenderChart()).toBe(true);
    expect(component.selectedSeriesKeys().length).toBe(1);

    // Verifikasi bahwa HANYA kolom yang dipilih yang masuk ke grafik!
    expect(component.dataSource()).toBe('upload');
    expect(component.categoryColumn()).toBe('Nama Puskesmas');
    expect(component.seriesList().length).toBe(1);
    expect(component.seriesList()[0].key).toBe('Cakupan HB-0');
    expect(component.availableCategories()).toContain('Puskesmas A');
    expect(component.dataRows().length).toBe(1);
  });

  describe('Configuration Preset Management (Reproducibility)', () => {
    it('should warn when exporting configuration without sheet or series selected', () => {
      component.exportConfiguration();
      expect(component.configNotification()?.type).toBe('warning');
      expect(component.configNotification()?.message).toContain('minimal 1 kolom indikator');
    });

    it('should export active configuration including hidden and deleted rows to preset store', () => {
      populateTestData();
      component.selectedSheet.set('Rekap Triwulan');
      component.targetValue.set(85);

      // Sembunyikan 'Kota Magelang' dan hapus 'Kab. Wonosobo'
      component.toggleCategory('Kota Magelang');
      component.deleteRow('Kab. Wonosobo');

      component.exportConfiguration();

      expect(component.configNotification()?.type).toBe('success');
      expect(component.hasSavedConfig()).toBe(true);

      const saved = ChartPresetStore.loadLastPreset();
      expect(saved).not.toBeNull();
      expect(saved?.sheetName).toBe('Rekap Triwulan');
      expect(saved?.categoryColumn).toBe('Wilayah');
      expect(saved?.seriesKeys).toEqual(['tw1', 'tw2', 'tw3', 'tw4']);
      expect(saved?.targetValue).toBe(85);
      expect(saved?.hiddenRows).toContain('Kota Magelang');
      expect(saved?.deletedRows).toContain('Kab. Wonosobo');
    });

    it('should apply configuration to active workbook with matching sheet and headers', () => {
      const mockSheet: any = {
        '!ref': 'A1:C4',
        A2: { v: 'Kabupaten/Kota' },
        B2: { v: 'Triwulan 1' },
        C2: { v: 'Triwulan 2' },
        A3: { v: 'Banyumas' },
        B3: { v: 75.5 },
        C3: { v: 82.0 },
        A4: { v: 'Cilacap' },
        B4: { v: 70.0 },
        C4: { v: 78.5 },
      };

      const mockWb: any = {
        SheetNames: ['rekap_indikator_tw3'],
        Sheets: {
          rekap_indikator_tw3: mockSheet,
        },
      };

      component.workbook = mockWb;
      component.sheetNames.set(['rekap_indikator_tw3']);
      component.dataSource.set('upload');

      const preset: ChartConfigurationPreset = {
        version: '1.0',
        savedAt: new Date().toISOString(),
        sheetName: 'rekap indikator tw3', // Spasi vs underscore: fuzzy match
        headerStartRow: 2,
        headerEndRow: 2,
        dataStartRow: 3,
        categoryColumn: 'Kabupaten/Kota',
        seriesKeys: ['Triwulan 1', 'Triwulan 2'],
        targetValue: 80,
        chartTitle: 'Grafik Capaian TW3',
        chartSubtitle: 'Dinas Kesehatan',
        deletedRows: ['Cilacap'],
      };

      component.applyConfiguration(preset, 'Preset TW3.json');

      expect(component.configNotification()?.type).toBe('success');
      expect(component.selectedSheet()).toBe('rekap_indikator_tw3');
      expect(component.categoryColumn()).toBe('Kabupaten/Kota');
      expect(component.selectedSeriesKeys()).toEqual(['Triwulan 1', 'Triwulan 2']);
      expect(component.targetValue()).toBe(80);
      expect(component.chartTitle()).toBe('Grafik Capaian TW3');
      // 'Cilacap' sudah dihapus sesuai deletedRows
      expect(component.availableCategories()).not.toContain('Cilacap');
      expect(component.availableCategories()).toContain('Banyumas');
    });

    it('should support 2-way workflow: preload preset before uploading Excel file', () => {
      const preset: ChartConfigurationPreset = {
        version: '1.0',
        savedAt: new Date().toISOString(),
        sheetName: 'rekap',
        headerStartRow: 1,
        headerEndRow: 1,
        dataStartRow: 2,
        categoryColumn: 'Wilayah',
        seriesKeys: ['Indikator 1'],
        targetValue: 90,
      };

      // 1. Muat preset terlebih dahulu saat belum ada file
      component.applyConfiguration(preset, 'Preset Awal.json');
      expect(component.pendingPreset).toEqual(preset);
      expect(component.configNotification()?.type).toBe('info');

      // 2. Upload file Excel - workbook masuk
      const mockWs: any = {
        '!ref': 'A1:B3',
        A1: { v: 'Wilayah' },
        B1: { v: 'Indikator 1' },
        A2: { v: 'Semarang' },
        B2: { v: 92 },
      };
      const mockWb: any = {
        SheetNames: ['rekap'],
        Sheets: { rekap: mockWs },
      };

      component.workbook = mockWb;
      component.sheetNames.set(['rekap']);

      // Simulasikan trigger auto-apply pendingPreset seperti pada onFileSelected
      if (component.pendingPreset) {
        const p = component.pendingPreset;
        component.pendingPreset = null;
        component.applyConfiguration(p, 'Preset Awal.json');
      }

      expect(component.pendingPreset).toBeNull();
      expect(component.selectedSheet()).toBe('rekap');
      expect(component.selectedSeriesKeys()).toEqual(['Indikator 1']);
      expect(component.targetValue()).toBe(90);
      expect(component.configNotification()?.type).toBe('success');
    });

    it('should test resilient matching in ChartPresetStore', () => {
      // 1. Sheet matching
      const sheets = ['Rekap Data Bulanan 2026', 'Data Kasus', 'Grafik Utama'];
      expect(ChartPresetStore.findMatchingSheet('rekap data bulanan 2026', sheets)).toBe('Rekap Data Bulanan 2026');
      expect(ChartPresetStore.findMatchingSheet('rekap_data_bulanan_2026', sheets)).toBe('Rekap Data Bulanan 2026');
      expect(ChartPresetStore.findMatchingSheet('Kasus', sheets)).toBe('Data Kasus');

      // 2. Header matching (exact, normalized, leaf, clean)
      const cols = [
        { colIndex: 0, colLetter: 'A', header: 'Imunisasi Dasar - HB-0 - Target', leafHeader: 'Target', layers: ['Imunisasi Dasar', 'HB-0', 'Target'] },
        { colIndex: 1, colLetter: 'B', header: 'Nama Kabupaten / Kota', leafHeader: 'Nama Kabupaten / Kota', layers: ['Nama Kabupaten / Kota'] },
      ];

      expect(ChartPresetStore.findMatchingHeader('Target', cols)).toBe('Imunisasi Dasar - HB-0 - Target');
      expect(ChartPresetStore.findMatchingHeader('nama kabupaten kota', cols)).toBe('Nama Kabupaten / Kota');
    });
  });

  describe('Settings Panel Toggle', () => {
    it('should toggle showSettings signal correctly', () => {
      expect(component.showSettings()).toBe(false);
      component.toggleSettings();
      expect(component.showSettings()).toBe(true);
      component.toggleSettings();
      expect(component.showSettings()).toBe(false);
    });

    it('should open showSettings when clearFile() is called', () => {
      component.showSettings.set(false);
      component.clearFile();
      expect(component.showSettings()).toBe(true);
      expect(component.file()).toBeNull();
      expect(component.dataSource()).toBe('empty');
    });
  });

  describe('Data from Join Module (Bridge)', () => {
    it('should properly load join data, populate candidate series columns, and support selection controls', () => {
      const bridge = TestBed.inject(ChartDataBridge);
      bridge.setData({
        source: 'join',
        title: 'Hasil Join Imunisasi',
        categoryColumn: 'Wilayah',
        columns: ['Wilayah', 'Indikator A', 'Indikator B', 'Indikator C'],
        rows: [
          { Wilayah: 'Kecamatan X', 'Indikator A': '80', 'Indikator B': '90', 'Indikator C': '70' },
          { Wilayah: 'Kecamatan Y', 'Indikator A': '85', 'Indikator B': '95', 'Indikator C': '75' },
        ],
      });

      const joinFixture = TestBed.createComponent(ChartVisualizerComponent);
      const joinComponent = joinFixture.componentInstance;
      joinFixture.detectChanges();

      expect(joinComponent.dataSource()).toBe('join');
      expect(joinComponent.candidateSeriesColumns().length).toBe(3);
      expect(joinComponent.candidateSeriesColumns().map((c) => c.header)).toEqual([
        'Indikator A',
        'Indikator B',
        'Indikator C',
      ]);
      expect(joinComponent.selectedSeriesKeys()).toEqual([
        'Indikator A',
        'Indikator B',
        'Indikator C',
      ]);
      expect(joinComponent.seriesList().length).toBe(3);
      expect(joinComponent.canRenderChart()).toBe(true);

      // Deselect Indikator A
      joinComponent.toggleSeriesColumn('Indikator A');
      expect(joinComponent.selectedSeriesKeys()).toEqual(['Indikator B', 'Indikator C']);
      expect(joinComponent.seriesList().map((s) => s.key)).toEqual(['Indikator B', 'Indikator C']);

      // Select Indikator A back
      joinComponent.toggleSeriesColumn('Indikator A');
      expect(joinComponent.selectedSeriesKeys()).toEqual(['Indikator B', 'Indikator C', 'Indikator A']);

      // Clear all
      joinComponent.clearAllSeriesColumns();
      expect(joinComponent.selectedSeriesKeys().length).toBe(0);
      expect(joinComponent.seriesList().length).toBe(0);
      expect(joinComponent.canRenderChart()).toBe(false);

      // Select all
      joinComponent.selectAllSeriesColumns();
      expect(joinComponent.selectedSeriesKeys().length).toBe(3);
      expect(joinComponent.seriesList().length).toBe(3);
      expect(joinComponent.canRenderChart()).toBe(true);

      // Select numeric columns
      joinComponent.selectNumericSeriesColumns();
      expect(joinComponent.selectedSeriesKeys().length).toBe(3);

      bridge.clearData();
    });
  });

  describe('Per-Indicator (Per-Kolom) Comparison Mode', () => {
    beforeEach(() => {
      populateTestData();
    });

    it('should default to "by-region" viewMode and allow switching to "by-indicator"', () => {
      expect(component.viewMode()).toBe('by-region');

      component.setViewMode('by-indicator');
      expect(component.viewMode()).toBe('by-indicator');

      component.setViewMode('by-region');
      expect(component.viewMode()).toBe('by-region');
    });

    it('should compute distinct comparison layouts and stats for each selected indicator series', () => {
      component.setViewMode('by-indicator');
      component.targetValue.set(80);

      const layouts = component.indicatorLayouts();
      expect(layouts.length).toBe(4); // 4 series: tw1, tw2, tw3, tw4

      // Inspect tw1
      const tw1 = layouts[0];
      expect(tw1.series.key).toBe('tw1');
      expect(tw1.series.label).toBe('Triwulan 1');
      expect(tw1.layout.categoryGroups.length).toBe(5); // 5 regions
      expect(tw1.stats.total).toBe(5);
      expect(tw1.stats.validCount).toBe(5);
      expect(tw1.stats.highest?.name).toBe('Kota Magelang');
      expect(tw1.stats.highest?.value).toBe(81.0);
      expect(tw1.stats.lowest?.name).toBe('Kab. Wonosobo');
      expect(tw1.stats.lowest?.value).toBe(65.0);
      expect(tw1.stats.achievedCount).toBe(1); // Kota Magelang (81.0) >= 80

      // Inspect tw4 (has missing data '-')
      const tw4 = layouts[3];
      expect(tw4.series.key).toBe('tw4');
      expect(tw4.stats.missingCount).toBe(1); // Kab. Wonosobo has '-'
      expect(tw4.stats.validCount).toBe(4);
      expect(tw4.stats.achievedCount).toBe(4); // 91.0, 95.2, 88.5, 89.4 all >= 80
    });

    it('should support sorting categories per indicator by value descending and ascending', () => {
      component.setViewMode('by-indicator');

      // 1. Default order matches visibleCategories
      expect(component.indicatorSortMode()).toBe('default');
      let layouts = component.indicatorLayouts();
      expect(layouts[0].layout.categoryGroups.map((g) => g.categoryName)).toEqual([
        'Kab. Magelang',
        'Kota Magelang',
        'Kab. Temanggung',
        'Kab. Purworejo',
        'Kab. Wonosobo',
      ]);

      // 2. Sort descending: highest first
      component.setIndicatorSortMode('desc');
      layouts = component.indicatorLayouts();
      const descCategories = layouts[0].layout.categoryGroups.map((g) => g.categoryName);
      expect(descCategories[0]).toBe('Kota Magelang'); // 81.0
      expect(descCategories[descCategories.length - 1]).toBe('Kab. Wonosobo'); // 65.0

      // 3. Sort ascending: lowest first
      component.setIndicatorSortMode('asc');
      layouts = component.indicatorLayouts();
      const ascCategories = layouts[0].layout.categoryGroups.map((g) => g.categoryName);
      expect(ascCategories[0]).toBe('Kab. Wonosobo'); // 65.0
      expect(ascCategories[ascCategories.length - 1]).toBe('Kota Magelang'); // 81.0
    });

    it('should filter indicator layouts using selectedIndicatorFilter tab', () => {
      component.setViewMode('by-indicator');
      expect(component.selectedIndicatorFilter()).toBe('all');
      expect(component.filteredIndicatorLayouts().length).toBe(4);

      // Select tw2
      component.setSelectedIndicatorFilter('tw2');
      expect(component.filteredIndicatorLayouts().length).toBe(1);
      expect(component.filteredIndicatorLayouts()[0].series.key).toBe('tw2');

      // Reset to all
      component.setSelectedIndicatorFilter('all');
      expect(component.filteredIndicatorLayouts().length).toBe(4);
    });

    it('should save and load viewMode in configuration preset', () => {
      component.selectedSheet.set('Rekap Data');
      component.setViewMode('by-indicator');

      component.exportConfiguration();
      const saved = ChartPresetStore.loadLastPreset();
      expect(saved?.viewMode).toBe('by-indicator');

      // Change viewMode back to by-region, then load preset
      component.setViewMode('by-region');
      expect(component.viewMode()).toBe('by-region');

      component.loadSavedConfigurationFromStorage();
      expect(component.viewMode()).toBe('by-indicator');
    });

    it('should allow setting targets separately for each indicator and compute layouts accordingly', () => {
      component.setViewMode('by-indicator');
      component.targetValue.set(80); // global target

      // Initially fallback to global target
      expect(component.getIndicatorTarget('tw1')).toBe(80);
      expect(component.getIndicatorTarget('tw2')).toBe(80);

      // Set custom target for tw1 = 70 and tw2 = 85
      component.setIndicatorTarget('tw1', 70);
      component.setIndicatorTarget('tw2', 85);

      expect(component.getIndicatorTarget('tw1')).toBe(70);
      expect(component.getIndicatorTarget('tw2')).toBe(85);
      expect(component.getIndicatorTarget('tw3')).toBe(80); // still uses fallback

      const layouts = component.indicatorLayouts();
      const tw1 = layouts.find((l) => l.series.key === 'tw1')!;
      const tw2 = layouts.find((l) => l.series.key === 'tw2')!;
      const tw3 = layouts.find((l) => l.series.key === 'tw3')!;

      // tw1 layout has targetLine at 70
      expect(tw1.stats.targetValue).toBe(70);
      // tw1 values: 72.4, 81.0, 68.5, 70.0, 65.0 -> >= 70: 72.4, 81.0, 70.0 (3 regions)
      expect(tw1.stats.achievedCount).toBe(3);

      // tw2 layout has targetLine at 85
      expect(tw2.stats.targetValue).toBe(85);
      // tw2 values: 78.2, 85.4, 74.0, 76.5, 71.2 -> >= 85: 85.4 (1 region)
      expect(tw2.stats.achievedCount).toBe(1);

      // tw3 layout has fallback target 80
      expect(tw3.stats.targetValue).toBe(80);
    });

    it('should handle onIndicatorTargetChange properly for empty string, 0, and numeric inputs', () => {
      component.onIndicatorTargetChange('tw1', '75');
      expect(component.getIndicatorTarget('tw1')).toBe(75);

      component.onIndicatorTargetChange('tw1', '0');
      expect(component.getIndicatorTarget('tw1')).toBe(0);

      component.onIndicatorTargetChange('tw1', '  ');
      expect(component.getIndicatorTarget('tw1')).toBeNull();

      component.onIndicatorTargetChange('tw1', 'abc');
      expect(component.getIndicatorTarget('tw1')).toBeNull();
    });

    it('should persist and restore separate indicatorTargets in configuration presets', () => {
      component.selectedSheet.set('Rekap Data');
      component.setViewMode('by-indicator');
      component.setIndicatorTarget('tw1', 72);
      component.setIndicatorTarget('tw2', 88);

      component.exportConfiguration();
      const saved = ChartPresetStore.loadLastPreset();
      expect(saved?.indicatorTargets).toEqual({ tw1: 72, tw2: 88 });

      // Clear targets, then reload from preset
      component.indicatorTargets.set({});
      expect(component.getIndicatorTarget('tw1')).toBeNull();

      component.loadSavedConfigurationFromStorage();
      expect(component.getIndicatorTarget('tw1')).toBe(72);
      expect(component.getIndicatorTarget('tw2')).toBe(88);
    });

    it('should display the specific indicator target in hover tooltip when targetOverride is passed', () => {
      component.setIndicatorTarget('tw1', 70);

      const dummyBar: ChartBarItem = {
        seriesKey: 'tw1',
        seriesLabel: 'Triwulan 1',
        color: '#60a5fa',
        rawVal: '72,4',
        numericVal: 72.4,
        displayLabel: '72,4',
        isZero: false,
        isMissing: false,
        x: 200,
        y: 100,
        width: 150,
        height: 18,
      };

      const mouseEvent = new MouseEvent('mouseenter', { clientX: 300, clientY: 250 });
      component.onBarHover(mouseEvent, dummyBar, 'Kab. Magelang', 70);

      const hovered = component.hoveredBar();
      expect(hovered?.targetValue).toBe(70);
      expect(hovered?.status).toBe('achieved');
      expect(hovered?.diff).toBe(2.4);
    });

    it('should safely execute exportSvg and exportPng for per-indicator charts', () => {
      component.setViewMode('by-indicator');
      fixture.detectChanges();

      expect(() => component.exportSvg('indicatorChartSvg-0', 'Triwulan 1')).not.toThrow();
      expect(() => component.exportPng('indicatorChartSvg-0', 'Triwulan 1')).not.toThrow();
    });
  });

  describe('Header Toolbar & Excel Multi-Sheet Export', () => {
    it('should build multi-sheet workbook with 2 columns per sheet in by-indicator mode', () => {
      populateTestData();
      component.setViewMode('by-indicator');

      const wb = component.buildExcelWorkbook();

      expect(wb).not.toBeNull();
      // Should have 4 sheets, one for each series in seriesList
      expect(wb.SheetNames.length).toBe(4);
      expect(wb.SheetNames).toEqual(['Triwulan 1', 'Triwulan 2', 'Triwulan 3', 'Triwulan 4']);

      // Check first sheet ('Triwulan 1')
      const ws1 = wb.Sheets['Triwulan 1'];
      const data1: any[][] = XLSX.utils.sheet_to_json(ws1, { header: 1 });
      // Header row must have exactly 2 columns: ['Wilayah', 'Triwulan 1']
      expect(data1[0]).toEqual(['Wilayah', 'Triwulan 1']);
      // Data rows: each row must have 2 columns
      expect(data1.length).toBe(6); // 1 header + 5 rows
      expect(data1[1]).toEqual(['Kab. Magelang', 72.4]);
      expect(data1[2]).toEqual(['Kota Magelang', 81]);
      expect(data1[3]).toEqual(['Kab. Temanggung', 68.5]);
      expect(data1[4]).toEqual(['Kab. Purworejo', 70]);
      expect(data1[5]).toEqual(['Kab. Wonosobo', 65]);

      // Check fourth sheet ('Triwulan 4')
      const ws4 = wb.Sheets['Triwulan 4'];
      const data4: any[][] = XLSX.utils.sheet_to_json(ws4, { header: 1 });
      expect(data4[0]).toEqual(['Wilayah', 'Triwulan 4']);
      expect(data4[1]).toEqual(['Kab. Magelang', 91]);

      // Calling exportExcel should run without throwing and set notification
      expect(() => component.exportExcel()).not.toThrow();
      expect(component.notificationMessage()).toContain('4 sheet terpisah');
    });

    it('should build single sheet workbook with all columns in by-region mode', () => {
      populateTestData();
      component.setViewMode('by-region');

      const wb = component.buildExcelWorkbook();

      expect(wb).not.toBeNull();
      expect(wb.SheetNames.length).toBe(1);

      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      expect(data[0]).toEqual(['Wilayah', 'Triwulan 1', 'Triwulan 2', 'Triwulan 3', 'Triwulan 4']);
      expect(data[1]).toEqual(['Kab. Magelang', 72.4, 78.2, 84.5, 91]);

      // Calling exportExcel should run without throwing and set notification
      expect(() => component.exportExcel()).not.toThrow();
      expect(component.notificationMessage()).toContain('berhasil diunduh');
    });

    it('should sanitize sheet names and handle duplicates when exporting by-indicator', () => {
      populateTestData();
      component.setViewMode('by-indicator');
      component.seriesList.set([
        { key: 's1', label: 'Indikator: A / B [Test]*', color: '#111' },
        { key: 's2', label: 'Indikator: A / B [Test]*', color: '#222' },
      ]);

      const wb = component.buildExcelWorkbook();

      expect(wb).not.toBeNull();
      expect(wb.SheetNames.length).toBe(2);
      expect(wb.SheetNames[0]).not.toMatch(/[\\/?*[\]:]/);
      expect(wb.SheetNames[1]).toContain('(2)');
    });

    it('should render Garis Target input and export buttons at chart level in by-region mode', () => {
      populateTestData();
      component.dataSource.set('join');
      component.setViewMode('by-region');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      // In by-region mode:
      // Verify that Garis Target is present inside the chart legend/action bar
      const chartActions = compiled.querySelector('.border-t.border-slate-100');
      expect(chartActions).toBeTruthy();
      expect(chartActions?.textContent).toContain('Garis Target:');

      // Main header toolbar has Excel (.xlsx) button
      const excelBtn = compiled.querySelector('button[title*="Unduh data bersih"]');
      expect(excelBtn).toBeTruthy();
      expect(excelBtn?.textContent).toContain('Excel (.xlsx)');
    });
  });
});


