import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import { ChartVisualizerComponent } from './chart-visualizer.component';
import { HealthDataExchange } from '../../core/domain/health-data-exchange';
import { ChartBarItem } from '../../core/chart/chart-layout-engine';
import { ColumnInfo, ExcelEngine } from '../../shared/excel';
import { ChartConfigurationPreset, ChartPresetStore } from './chart-preset-store';

describe('ChartVisualizerComponent', () => {
  let component: ChartVisualizerComponent;
  let fixture: ComponentFixture<ChartVisualizerComponent>;

  beforeEach(async () => {
    vi.spyOn(ExcelEngine, 'writeWorkbook').mockImplementation(() => {});

    await TestBed.configureTestingModule({
      imports: [ChartVisualizerComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ChartVisualizerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('should support hiding and restoring rows', () => {
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

    // 3. Hide another row
    component.toggleCategory('Kab. Wonosobo');
    expect(component.visibleCategories().length).toBe(3);
    expect(component.visibleCategories()).not.toContain('Kab. Wonosobo');

    // 4. Restore all rows
    component.restoreAllRows();
    expect(component.visibleCategories().length).toBe(5);
    expect(component.visibleCategories()).toContain('Kota Magelang');
    expect(component.visibleCategories()).toContain('Kab. Wonosobo');
    expect(component.hasHiddenOrDeletedRows()).toBe(false);
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
    it('should hide Konfigurasi Terakhir, Muat JSON, and Simpan JSON buttons when enableToolbarActions is false', () => {
      component.enableToolbarActions.set(false);
      component.hasSavedConfig.set(true);
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).not.toContain('Konfigurasi Terakhir');
      expect(el.textContent).not.toContain('Muat (.json)');
      expect(el.textContent).not.toContain('Simpan (.json)');
      expect(el.querySelector('input[type="file"][accept=".json"]')).toBeNull();
    });

    it('should show Konfigurasi Terakhir, Muat JSON, and Simpan JSON buttons when enableToolbarActions is true', () => {
      component.enableToolbarActions.set(true);
      component.hasSavedConfig.set(true);
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Konfigurasi Terakhir');
      expect(el.textContent).toContain('Muat (.json)');
      expect(el.textContent).toContain('Simpan (.json)');
      expect(el.querySelector('input[type="file"][accept=".json"]')).not.toBeNull();
    });

    it('should hide Pengaturan button when enableSettingsButton is false', () => {
      component.enableSettingsButton.set(false);
      component.enableToolbarActions.set(false);
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).not.toContain('Pengaturan');
      expect(el.querySelector('div[actions]')).toBeNull();
    });

    it('should show Pengaturan button when enableSettingsButton is true', () => {
      component.enableSettingsButton.set(true);
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Pengaturan');
      const settingsBtn = Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Pengaturan'),
      );
      expect(settingsBtn).toBeTruthy();
    });

    it('should warn when exporting configuration without sheet or series selected', () => {
      component.exportConfiguration();
      expect(component.configNotification()?.type).toBe('warning');
      expect(component.configNotification()?.message).toContain('minimal 1 kolom indikator');
    });

    it('should export active configuration including hidden and deleted rows to preset store', () => {
      populateTestData();
      component.selectedSheet.set('Rekap Triwulan');
      component.targetValue.set(85);

      // Sembunyikan 'Kota Magelang' dan 'Kab. Wonosobo'
      component.toggleCategory('Kota Magelang');
      component.toggleCategory('Kab. Wonosobo');

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
      expect(saved?.hiddenRows).toContain('Kab. Wonosobo');
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
      // 'Cilacap' disembunyikan sesuai deletedRows preset
      expect(component.visibleCategories()).not.toContain('Cilacap');
      expect(component.availableCategories()).toContain('Cilacap');
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
      expect(ChartPresetStore.findMatchingSheet('rekap data bulanan 2026', sheets)).toBe(
        'Rekap Data Bulanan 2026',
      );
      expect(ChartPresetStore.findMatchingSheet('rekap_data_bulanan_2026', sheets)).toBe(
        'Rekap Data Bulanan 2026',
      );
      expect(ChartPresetStore.findMatchingSheet('Kasus', sheets)).toBe('Data Kasus');

      // 2. Header matching (exact, normalized, leaf, clean)
      const cols = [
        {
          colIndex: 0,
          colLetter: 'A',
          header: 'Imunisasi Dasar - HB-0 - Target',
          leafHeader: 'Target',
          layers: ['Imunisasi Dasar', 'HB-0', 'Target'],
        },
        {
          colIndex: 1,
          colLetter: 'B',
          header: 'Nama Kabupaten / Kota',
          leafHeader: 'Nama Kabupaten / Kota',
          layers: ['Nama Kabupaten / Kota'],
        },
      ];

      expect(ChartPresetStore.findMatchingHeader('Target', cols)).toBe(
        'Imunisasi Dasar - HB-0 - Target',
      );
      expect(ChartPresetStore.findMatchingHeader('nama kabupaten kota', cols)).toBe(
        'Nama Kabupaten / Kota',
      );
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
      const exchange = TestBed.inject(HealthDataExchange);
      exchange.setChartData({
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
      expect(joinComponent.selectedSeriesKeys()).toEqual([
        'Indikator B',
        'Indikator C',
        'Indikator A',
      ]);

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

      exchange.clearChartData();
    });

    it('should display empty series fallback view when all series are cleared and restore them on click', () => {
      const exchange = TestBed.inject(HealthDataExchange);
      exchange.publishJoinedToChart({
        title: 'Empty Series Fallback Test',
        rows: [
          { Wilayah: 'Puskesmas A', 'Indikator A %': 80, 'Jumlah Sasaran': 100 },
          { Wilayah: 'Puskesmas B', 'Indikator A %': 90, 'Jumlah Sasaran': 120 },
        ],
        columns: ['Wilayah', 'Indikator A %', 'Jumlah Sasaran'],
        categoryColumn: 'Wilayah',
      });

      const joinFixture = TestBed.createComponent(ChartVisualizerComponent);
      const joinComponent = joinFixture.componentInstance;
      joinFixture.detectChanges();

      expect(joinComponent.hasLoadedData()).toBe(true);
      expect(joinComponent.seriesList().length).toBeGreaterThan(0);

      // Clear all series
      joinComponent.clearAllSeriesColumns();
      joinFixture.detectChanges();

      expect(joinComponent.selectedSeriesKeys().length).toBe(0);
      expect(joinComponent.canRenderChart()).toBe(false);

      const compiled = joinFixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Tidak Ada Indikator yang Dipilih');

      // Click "Pilih Persentase (Default)"
      joinComponent.selectPercentageSeriesColumns();
      joinFixture.detectChanges();

      expect(joinComponent.selectedSeriesKeys()).toContain('Indikator A %');
      expect(joinComponent.canRenderChart()).toBe(true);
      expect(compiled.textContent).not.toContain('Tidak Ada Indikator yang Dipilih');

      exchange.clearChartData();
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

    it('should support unified live filtering by wilayah and indicator for both view modes', () => {
      // 1. Initially all categories and series are visible
      expect(component.isChartFilterActive()).toBe(false);
      expect(component.filteredChartCategories().length).toBe(5);
      expect(component.filteredChartSeries().length).toBe(4);

      // 2. Filter by search text (Wilayah)
      component.chartRegionSearch.set('Wonosobo');
      expect(component.isChartFilterActive()).toBe(true);
      expect(component.filteredChartCategories()).toEqual(['Kab. Wonosobo']);
      expect(component.layout().categoryGroups.map((g) => g.categoryName)).toEqual([
        'Kab. Wonosobo',
      ]);
      expect(
        component.indicatorLayouts()[0].layout.categoryGroups.map((g) => g.categoryName),
      ).toEqual(['Kab. Wonosobo']);

      // 3. Clear search text
      component.chartRegionSearch.set('');
      expect(component.filteredChartCategories().length).toBe(5);

      // 4. Filter by dropdown region
      component.selectedRegionFilter.set('Kota Magelang');
      expect(component.isChartFilterActive()).toBe(true);
      expect(component.filteredChartCategories()).toEqual(['Kota Magelang']);

      // 5. Filter indicator using toggleIndicatorFilter
      component.toggleIndicatorFilter('tw1');
      expect(component.selectedIndicatorFilter()).toBe('tw1');
      expect(component.filteredChartSeries().map((s) => s.key)).toEqual(['tw1']);
      expect(component.filteredIndicatorLayouts().length).toBe(1);

      // Toggle again should reset indicator to 'all'
      component.toggleIndicatorFilter('tw1');
      expect(component.selectedIndicatorFilter()).toBe('all');
      expect(component.filteredChartSeries().length).toBe(4);
      expect(component.filteredIndicatorLayouts().length).toBe(4);

      // 6. resetChartFilters should restore everything
      component.chartRegionSearch.set('test');
      component.selectedRegionFilter.set('Kota Magelang');
      component.selectedIndicatorFilter.set('tw3');
      expect(component.isChartFilterActive()).toBe(true);

      component.resetChartFilters();
      expect(component.isChartFilterActive()).toBe(false);
      expect(component.chartRegionSearch()).toBe('');
      expect(component.selectedRegionFilter()).toBe('all');
      expect(component.selectedIndicatorFilter()).toBe('all');
      expect(component.filteredChartCategories().length).toBe(5);
      expect(component.filteredChartSeries().length).toBe(4);
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

    it('should handle onIndicatorTargetChange properly for empty string, 0, and numeric inputs, and reject negative values', () => {
      component.onIndicatorTargetChange('tw1', '75');
      expect(component.getIndicatorTarget('tw1')).toBe(75);

      component.onIndicatorTargetChange('tw1', '0');
      expect(component.getIndicatorTarget('tw1')).toBe(0);

      component.onIndicatorTargetChange('tw1', '  ');
      expect(component.getIndicatorTarget('tw1')).toBeNull();

      component.onIndicatorTargetChange('tw1', 'abc');
      expect(component.getIndicatorTarget('tw1')).toBeNull();

      // Negative values rejected
      component.onIndicatorTargetChange('tw1', '-10');
      expect(component.getIndicatorTarget('tw1')).toBeNull();

      component.setIndicatorTarget('tw1', -5);
      expect(component.getIndicatorTarget('tw1')).toBeNull();
    });

    it('should handle onRegionTargetChange and reject negative values', () => {
      component.onRegionTargetChange('80');
      expect(component.targetValue()).toBe(80);

      component.onRegionTargetChange('0');
      expect(component.targetValue()).toBe(0);

      component.onRegionTargetChange('  ');
      expect(component.targetValue()).toBeNull();

      component.onRegionTargetChange('-25');
      expect(component.targetValue()).toBeNull();

      // preventNegativeKey prevents minus key
      const event = new KeyboardEvent('keydown', { key: '-' });
      let prevented = false;
      event.preventDefault = () => {
        prevented = true;
      };
      component.preventNegativeKey(event);
      expect(prevented).toBe(true);
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

  describe('Peta Heatmap Mode (Spatial Map Visualization)', () => {
    beforeEach(() => {
      populateTestData();
    });

    it('should allow switching viewMode to "by-map" and back', () => {
      expect(component.viewMode()).toBe('by-region');

      component.setViewMode('by-map');
      expect(component.viewMode()).toBe('by-map');

      component.setViewMode('by-region');
      expect(component.viewMode()).toBe('by-region');
    });

    it('should default activeMapSeries to first series and compute mapHeatmapResult with 35 districts', () => {
      component.setViewMode('by-map');
      component.targetValue.set(75);

      // Active indicator defaults to tw1
      const activeSeries = component.activeMapSeries();
      expect(activeSeries?.key).toBe('tw1');
      expect(activeSeries?.label).toBe('Triwulan 1');

      const result = component.mapHeatmapResult();
      expect(result).not.toBeNull();
      expect(result!.items.length).toBe(35); // 35 Central Java districts
      expect(result!.stats.totalDistricts).toBe(35);
      expect(result!.stats.validCount).toBe(5); // 5 populated districts in test data
      expect(result!.stats.missingCount).toBe(30);

      // Highest should be Kota Magelang (81.0)
      expect(result!.stats.highest?.name).toBe('Kota Magelang');
      expect(result!.stats.highest?.value).toBe(81.0);

      // Lowest should be Kab. Wonosobo (65.0)
      expect(result!.stats.lowest?.name).toBe('Wonosobo');
      expect(result!.stats.lowest?.value).toBe(65.0);
    });

    it('should dynamically switch indicator via setActiveMapIndicator and recompute heatmap', () => {
      component.setViewMode('by-map');

      // Switch to tw4
      component.setActiveMapIndicator('tw4');
      expect(component.activeMapIndicator()).toBe('tw4');
      expect(component.activeMapSeries()?.key).toBe('tw4');

      const result = component.mapHeatmapResult();
      expect(result).not.toBeNull();
      expect(result!.series.key).toBe('tw4');
      // For tw4: Kota Magelang is 95.2, Kab. Magelang is 91.0, Purworejo is 89.4, Temanggung is 88.5, Wonosobo is missing ('-')
      expect(result!.stats.validCount).toBe(4);
      expect(result!.stats.highest?.name).toBe('Kota Magelang');
      expect(result!.stats.highest?.value).toBe(95.2);
    });

    it('should track and update hoveredMapDistrict for inspector panel', () => {
      component.setViewMode('by-map');
      const result = component.mapHeatmapResult()!;
      const magelangItem = result.items.find((i) => i.district.id === '33-71'); // Kota Magelang
      expect(magelangItem).toBeDefined();

      expect(component.hoveredMapDistrict()).toBeNull();

      component.hoveredMapDistrict.set(magelangItem!);
      expect(component.hoveredMapDistrict()?.district.kabupatenKota).toBe('KOTA MAGELANG');
      expect(component.hoveredMapDistrict()?.value).toBe(81.0);

      component.hoveredMapDistrict.set(null);
      expect(component.hoveredMapDistrict()).toBeNull();
    });

    it('should provide continuous gradient CSS and indicator explanation for stunting relevance', () => {
      component.setViewMode('by-map');
      component.setActiveMapIndicator('tw1');

      const result = component.mapHeatmapResult()!;
      expect(result.gradientCss).toContain('linear-gradient(to right,');
      expect(result.rankedItems.length).toBe(5);

      // Check indicator explanation (Ini apa, hubungan stunting)
      const explanation = component.indicatorExplanation();
      expect(explanation).not.toBeNull();
      expect(explanation!.definition).toBeDefined();
      expect(explanation!.stuntingRelation).toBeDefined();
      expect(explanation!.stuntingRelation.length).toBeGreaterThan(10);
    });

    it('should save and load "by-map" viewMode and activeMapIndicator in preset store', () => {
      component.selectedSheet.set('Rekap Data');
      component.setViewMode('by-map');
      component.setActiveMapIndicator('tw3');

      component.exportConfiguration();
      const saved = ChartPresetStore.loadLastPreset();
      expect(saved?.viewMode).toBe('by-map');
      expect(saved?.activeMapIndicator).toBe('tw3');

      // Reset to by-region and empty indicator
      component.setViewMode('by-region');
      component.setActiveMapIndicator('tw1');
      expect(component.viewMode()).toBe('by-region');

      component.loadSavedConfigurationFromStorage();
      expect(component.viewMode()).toBe('by-map');
      expect(component.activeMapIndicator()).toBe('tw3');
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
      expect(data1.length).toBe(7); // 1 header + 5 rows + 1 target row
      expect(data1[1]).toEqual(['Kab. Magelang', 72.4]);
      expect(data1[2]).toEqual(['Kota Magelang', 81]);
      expect(data1[3]).toEqual(['Kab. Temanggung', 68.5]);
      expect(data1[4]).toEqual(['Kab. Purworejo', 70]);
      expect(data1[5]).toEqual(['Kab. Wonosobo', 65]);
      expect(data1[6]).toEqual(['Target', '-']);

      // Check fourth sheet ('Triwulan 4')
      const ws4 = wb.Sheets['Triwulan 4'];
      const data4: any[][] = XLSX.utils.sheet_to_json(ws4, { header: 1 });
      expect(data4[0]).toEqual(['Wilayah', 'Triwulan 4']);
      expect(data4[1]).toEqual(['Kab. Magelang', 91]);
      expect(data4[6]).toEqual(['Target', '-']);

      // Calling exportExcel should run without throwing and set notification
      expect(() => component.exportExcel()).not.toThrow();
      expect(component.notificationMessage()).toContain('4 sheet terpisah');
    });

    it('should build multi-sheet workbook with separate sheet per indicator in by-region mode', () => {
      populateTestData();
      component.setViewMode('by-region');

      const wb = component.buildExcelWorkbook();

      expect(wb).not.toBeNull();
      expect(wb.SheetNames.length).toBe(4);
      expect(wb.SheetNames).toEqual(['Triwulan 1', 'Triwulan 2', 'Triwulan 3', 'Triwulan 4']);

      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      expect(data.length).toBe(7); // 1 header + 5 rows + 1 target row
      expect(data[0]).toEqual(['Wilayah', 'Triwulan 1']);
      expect(data[1]).toEqual(['Kab. Magelang', 72.4]);
      expect(data[6]).toEqual(['Target', '-']);

      // Calling exportExcel should run without throwing and set notification
      expect(() => component.exportExcel()).not.toThrow();
      expect(component.notificationMessage()).toContain('4 sheet terpisah');
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

    it('should render Target Indikator button and export buttons at chart level in by-region mode', () => {
      populateTestData();
      component.dataSource.set('join');
      component.setViewMode('by-region');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      // In by-region mode:
      // Verify that Target Indikator button is present inside the chart legend/action bar
      const chartActions = compiled.querySelector('.border-t.border-slate-100');
      expect(chartActions).toBeTruthy();
      expect(chartActions?.textContent).toContain('Target Indikator');

      // Main header toolbar has Excel (.xlsx) button
      const excelBtn = compiled.querySelector('button[title*="Unduh data bersih"]');
      expect(excelBtn).toBeTruthy();
      expect(excelBtn?.textContent).toContain('Excel (.xlsx)');
    });

    it('should correctly configure standard target 50 for per-wilayah and specific targets for per-indikator from HealthDataExchange', () => {
      const exchange = TestBed.inject(HealthDataExchange);
      exchange.setChartData({
        title: 'Grafik Hasil Join Dinkes',
        source: 'join',
        categoryColumn: 'Kabupaten/Kota',
        columns: ['Kabupaten/Kota', 'Konsumsi TTD %', 'Skrining Anemia %', 'Jumlah Kasus'],
        rows: [
          {
            'Kabupaten/Kota': 'Cilacap',
            'Konsumsi TTD %': 65,
            'Skrining Anemia %': 80,
            'Jumlah Kasus': 120,
          },
          {
            'Kabupaten/Kota': 'Banyumas',
            'Konsumsi TTD %': 70,
            'Skrining Anemia %': 75,
            'Jumlah Kasus': 95,
          },
        ],
        targetValue: 50,
        indicatorTargets: {
          'Konsumsi TTD %': 67,
          'Skrining Anemia %': 77,
        },
      });

      // Instantiate a new component or call loadTransferredData
      (component as any).loadTransferredData();

      // Per-Wilayah benchmark defaults to standard 50
      expect(component.targetValue()).toBe(50);
      expect(component.layout().targetLineX).toBeGreaterThan(0);

      // Indicator targets configured correctly
      expect(component.indicatorTargets()['Konsumsi TTD %']).toBe(67);
      expect(component.indicatorTargets()['Skrining Anemia %']).toBe(77);
      expect(component.getIndicatorTarget('Konsumsi TTD %')).toBe(67);
      expect(component.getIndicatorTarget('Skrining Anemia %')).toBe(77);

      // Automatically switches to Per-Indikator mode ('by-indicator')
      expect(component.viewMode()).toBe('by-indicator');

      // Only numeric percentage columns ('Konsumsi TTD %', 'Skrining Anemia %') are auto-selected;
      // non-percentage column ('Jumlah Kasus') is not auto-selected but remains available for manual selection
      expect(component.selectedSeriesKeys()).toEqual(['Konsumsi TTD %', 'Skrining Anemia %']);
      expect(component.seriesList().map((s) => s.key)).toEqual([
        'Konsumsi TTD %',
        'Skrining Anemia %',
      ]);
      expect(component.candidateSeriesColumns().map((c) => c.header)).toContain('Jumlah Kasus');

      // Per-Indikator mode layouts use indicator specific targets
      const layouts = component.indicatorLayouts();
      expect(layouts.length).toBe(2);
      const ttd = layouts.find((l) => l.series.key === 'Konsumsi TTD %');
      expect(ttd).toBeDefined();
      expect(ttd!.stats.targetValue).toBe(67);

      const anemia = layouts.find((l) => l.series.key === 'Skrining Anemia %');
      expect(anemia).toBeDefined();
      expect(anemia!.stats.targetValue).toBe(77);

      // User can still manually select non-percentage column ('Jumlah Kasus') later
      component.toggleSeriesColumn('Jumlah Kasus');
      expect(component.selectedSeriesKeys()).toContain('Jumlah Kasus');
      expect(component.indicatorLayouts().length).toBe(3);

      exchange.clearChartData();
    });

    it('should auto-select all numeric percentage columns (even > 6 columns) and exclude non-numeric columns when transferred from Excel Join', () => {
      const exchange = TestBed.inject(HealthDataExchange);
      const pctCols = Array.from({ length: 10 }, (_, i) => `Indikator Persentase ${i + 1} - %`);
      const allCols = [
        'Kabupaten/Kota',
        ...pctCols,
        'Jumlah Sasaran',
        'Keterangan Teks',
        'Persentase Kosong %',
      ];

      const row1: Record<string, unknown> = {
        'Kabupaten/Kota': 'Cilacap',
        'Jumlah Sasaran': 1500,
        'Keterangan Teks': 'Lengkap',
        'Persentase Kosong %': '-',
      };
      for (const c of pctCols) {
        row1[c] = 80;
      }

      exchange.publishJoinedToChart({
        title: 'Grafik 10 Indikator Persentase',
        columns: allCols,
        rows: [row1],
        categoryColumn: 'Kabupaten/Kota',
      });

      (component as any).loadTransferredData();

      expect(component.viewMode()).toBe('by-indicator');
      // All 10 numeric percentage columns must be selected (not capped at 6, and excluding 'Persentase Kosong %', 'Jumlah Sasaran', 'Keterangan Teks')
      expect(component.selectedSeriesKeys().length).toBe(10);
      expect(component.selectedSeriesKeys()).toEqual(pctCols);
      expect(component.indicatorLayouts().length).toBe(10);

      exchange.clearChartData();
    });

    it('should detect Target row in Excel sheet, populate indicatorTargets, and filter Target row from data rows', () => {
      // Build a worksheet with district rows, summary rows, and a Target row
      const wsData = [
        ['Kabupaten/Kota', '% Konsumsi TTD', '% Skrining Anemia'],
        ['Cilacap', 65, 80],
        ['Banyumas', 70, 75],
        ['Jumlah', 135, 155],
        ['Rata-rata', 67.5, 77.5],
        ['Target', '>= 67', '>= 77'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const cols: ColumnInfo[] = [
        {
          colIndex: 0,
          colLetter: 'A',
          header: 'Kabupaten/Kota',
          leafHeader: 'Kabupaten/Kota',
          layers: ['Kabupaten/Kota'],
        },
        {
          colIndex: 1,
          colLetter: 'B',
          header: '% Konsumsi TTD',
          leafHeader: '% Konsumsi TTD',
          layers: ['% Konsumsi TTD'],
        },
        {
          colIndex: 2,
          colLetter: 'C',
          header: '% Skrining Anemia',
          leafHeader: '% Skrining Anemia',
          layers: ['% Skrining Anemia'],
        },
      ];

      component.rebuildChartData(
        ws,
        cols,
        'Kabupaten/Kota',
        ['% Konsumsi TTD', '% Skrining Anemia'],
        2,
      );

      // Target row excluded from data rows
      expect(component.dataRows().length).toBe(2);
      expect(component.availableCategories()).toEqual(['Cilacap', 'Banyumas']);

      // Indicator targets extracted from Target row
      expect(component.indicatorTargets()['% Konsumsi TTD']).toBe(67);
      expect(component.indicatorTargets()['% Skrining Anemia']).toBe(77);

      // targetValue set to standard 50
      expect(component.targetValue()).toBe(50);
    });

    it('should toggle indicator panel and close settings panel, and vice versa', () => {
      expect(component.showIndicatorPanel()).toBe(false);
      expect(component.showSettingsPanel()).toBe(false);

      component.toggleIndicatorPanel();
      expect(component.showIndicatorPanel()).toBe(true);
      expect(component.showSettingsPanel()).toBe(false);

      component.toggleSettingsPanel();
      expect(component.showIndicatorPanel()).toBe(false);
      expect(component.showSettingsPanel()).toBe(true);

      component.toggleIndicatorPanel();
      expect(component.showIndicatorPanel()).toBe(true);
      expect(component.showSettingsPanel()).toBe(false);
    });

    it('should allow user to select non-percentage numeric columns and return to percentage defaults', () => {
      const exchange = TestBed.inject(HealthDataExchange);
      const cols = [
        'Kabupaten/Kota',
        'Sasaran Riil Balita',
        '% Cakupan Imunisasi',
        '% Pemberian ASI',
      ];
      const rows = [
        {
          'Kabupaten/Kota': 'Cilacap',
          'Sasaran Riil Balita': 5000,
          '% Cakupan Imunisasi': 85,
          '% Pemberian ASI': 70,
        },
        {
          'Kabupaten/Kota': 'Banyumas',
          'Sasaran Riil Balita': 6500,
          '% Cakupan Imunisasi': 90,
          '% Pemberian ASI': 75,
        },
      ];

      exchange.publishJoinedToChart({
        title: 'Data Balita & Imunisasi',
        columns: cols,
        rows,
        categoryColumn: 'Kabupaten/Kota',
        columnTargets: {
          '% Cakupan Imunisasi': { enabled: true, value: 80 },
          '% Pemberian ASI': { enabled: true, value: 76 },
        },
      });

      (component as any).loadTransferredData();

      // Default: only percentage columns are initially selected
      expect(component.selectedSeriesKeys()).toEqual(['% Cakupan Imunisasi', '% Pemberian ASI']);
      expect(component.indicatorTargets()['% Cakupan Imunisasi']).toBe(80);
      expect(component.indicatorTargets()['% Pemberian ASI']).toBe(76);

      // Target for column without configured target in Excel Join falls back to default 50
      expect(component.getIndicatorTarget('Sasaran Riil Balita')).toBe(50);

      // User selects all numeric columns (including non-percentage Sasaran Riil Balita)
      component.selectNumericSeriesColumns();
      expect(component.selectedSeriesKeys()).toContain('Sasaran Riil Balita');
      expect(component.selectedSeriesKeys()).toContain('% Cakupan Imunisasi');
      expect(component.selectedSeriesKeys()).toContain('% Pemberian ASI');

      // User can switch back to percentage default anytime
      component.selectPercentageSeriesColumns();
      expect(component.selectedSeriesKeys()).toEqual(['% Cakupan Imunisasi', '% Pemberian ASI']);

      exchange.clearChartData();
    });

    it('should support switching indicator grid columns between 1, 2, and 3 columns', () => {
      // Default is 2 columns for side-by-side display
      expect(component.indicatorGridColumns()).toBe(2);
      expect(component.indicatorGridClass()).toContain('lg:grid-cols-2');

      // Switch to 1 column (full width with max-w-4xl constraint)
      component.setIndicatorGridColumns(1);
      expect(component.indicatorGridColumns()).toBe(1);
      expect(component.indicatorGridClass()).toContain('grid-cols-1');
      expect(component.indicatorGridClass()).toContain('max-w-4xl');

      // Switch to 3 columns
      component.setIndicatorGridColumns(3);
      expect(component.indicatorGridColumns()).toBe(3);
      expect(component.indicatorGridClass()).toContain('xl:grid-cols-3');
    });

    it('should default region chart width to full width', () => {
      // Default is full width for region chart visualization
      expect(component.regionChartWidth()).toBe('full');
      expect(component.regionChartContainerClass()).toBe('w-full');

      // Can switch to compact
      component.setRegionChartWidth('compact');
      expect(component.regionChartWidth()).toBe('compact');
      expect(component.regionChartContainerClass()).toBe('max-w-4xl mx-auto');

      // Can switch to medium
      component.setRegionChartWidth('medium');
      expect(component.regionChartWidth()).toBe('medium');
      expect(component.regionChartContainerClass()).toBe('max-w-6xl mx-auto');
    });

    it('should support switching region columns between 1 and 2 daerah per baris', () => {
      // Default is 2 daerah per baris as requested
      expect(component.regionColumns()).toBe(2);

      component.setRegionColumns(1);
      expect(component.regionColumns()).toBe(1);

      component.setRegionColumns(2);
      expect(component.regionColumns()).toBe(2);
    });

    it('should compute distinct comparison layouts and stats for each selected region in by-region mode', () => {
      populateTestData();
      component.dataSource.set('join');
      component.setViewMode('by-region');
      fixture.detectChanges();

      const layouts = component.regionLayouts();
      expect(layouts.length).toBe(5);

      const magelang = layouts.find((l) => l.regionName === 'Kab. Magelang');
      expect(magelang).toBeDefined();
      expect(magelang!.stats.total).toBe(4);
      expect(magelang!.stats.validCount).toBe(4);
      expect(magelang!.stats.avgValue).toBe(81.5);
      expect(magelang!.stats.highest?.label).toBe('Triwulan 4');
      expect(magelang!.stats.lowest?.label).toBe('Triwulan 1');
      expect(magelang!.layout.categoryGroups.length).toBe(4); // 4 indicators
    });

    it('should support sorting region cards by average value descending and ascending', () => {
      populateTestData();
      component.dataSource.set('join');
      component.setViewMode('by-region');
      fixture.detectChanges();

      // Kota Magelang avg: 87.4, Kab. Magelang avg: 81.5
      component.setRegionSortMode('desc');
      let layouts = component.regionLayouts();
      expect(layouts[0].regionName).toBe('Kota Magelang');

      component.setRegionSortMode('asc');
      layouts = component.regionLayouts();
      expect(layouts[layouts.length - 1].regionName).toBe('Kota Magelang');

      component.setRegionSortMode('default');
      layouts = component.regionLayouts();
      expect(layouts[0].regionName).toBe('Kab. Magelang');
    });

    it('should support switching region grid columns between 1, 2, and 3 columns', () => {
      expect(component.regionGridColumns()).toBe(2);
      expect(component.regionGridClass()).toContain('lg:grid-cols-2');

      component.setRegionGridColumns(1);
      expect(component.regionGridColumns()).toBe(1);
      expect(component.regionGridClass()).toContain('grid-cols-1');
      expect(component.regionGridClass()).toContain('max-w-4xl');

      component.setRegionGridColumns(3);
      expect(component.regionGridColumns()).toBe(3);
      expect(component.regionGridClass()).toContain('xl:grid-cols-3');
    });

    it('should export single region excel file properly', () => {
      populateTestData();
      component.dataSource.set('join');
      fixture.detectChanges();

      expect(() => component.exportRegionExcel('Kab. Magelang')).not.toThrow();
    });

    it('should compute individual indicator targets, pins, and achievement stats per region in by-region mode', () => {
      populateTestData();
      component.dataSource.set('join');
      component.setViewMode('by-region');

      // Set individual targets per indicator
      component.setIndicatorTarget('tw1', 70);
      component.setIndicatorTarget('tw2', 80);
      component.setIndicatorTarget('tw3', 85);
      component.setIndicatorTarget('tw4', 90);

      fixture.detectChanges();

      const layouts = component.regionLayouts();
      expect(layouts.length).toBe(5);

      // Kab. Magelang: tw1=72.4 (>=70: ✓), tw2=78.2 (<80: ✗), tw3=84.5 (<85: ✗), tw4=91.0 (>=90: ✓)
      const kabMagelang = layouts.find((l) => l.regionName === 'Kab. Magelang');
      expect(kabMagelang).toBeTruthy();
      expect(kabMagelang!.stats.totalTargeted).toBe(4);
      expect(kabMagelang!.stats.achievedCount).toBe(2);

      // Verify each row in Kab. Magelang layout has its specific targetVal and targetX
      const groups = kabMagelang!.layout.categoryGroups;
      expect(groups.length).toBe(4); // 4 indicators

      // Group 0: Triwulan 1
      const bar0 = groups[0].bars[0];
      expect(bar0.targetVal).toBe(70);
      expect(bar0.isAchieved).toBe(true);
      expect(bar0.targetX).toBeDefined();

      // Group 1: Triwulan 2
      const bar1 = groups[1].bars[0];
      expect(bar1.targetVal).toBe(80);
      expect(bar1.isAchieved).toBe(false);
      expect(bar1.targetX).toBeDefined();

      // Verify global targetLineX is null (no single misleading vertical line)
      expect(kabMagelang!.layout.targetLineX).toBeNull();
    });

    it('should toggle Target Indikator popover and allow batch target application and reset', () => {
      populateTestData();
      component.dataSource.set('join');
      component.setViewMode('by-region');

      expect(component.showTargetPopover()).toBe(false);
      component.toggleTargetPopover();
      expect(component.showTargetPopover()).toBe(true);

      component.applyGlobalTargetToAll('75');
      expect(component.getIndicatorTarget('tw1')).toBe(75);
      expect(component.getIndicatorTarget('tw2')).toBe(75);
      expect(component.getIndicatorTarget('tw3')).toBe(75);
      expect(component.getIndicatorTarget('tw4')).toBe(75);
      expect(component.configuredTargetCount()).toBe(4);

      component.clearAllIndicatorTargets();
      expect(component.indicatorTargets()['tw1']).toBeUndefined();
      expect(component.configuredTargetCount()).toBe(0);

      component.closeTargetPopover();
      expect(component.showTargetPopover()).toBe(false);
    });

    it('should support Urutan Wilayah and Grafik per Baris select options in by-region mode', () => {
      populateTestData();
      component.dataSource.set('join');
      component.setViewMode('by-region');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const sortSelect = compiled.querySelector('#regionSortModeSelect') as HTMLSelectElement;
      const gridSelect = compiled.querySelector(
        '#regionGridSelect, #regionGridColumnsSelect',
      ) as HTMLSelectElement;

      expect(sortSelect).toBeTruthy();
      expect(gridSelect).toBeTruthy();

      // Verify initial selected state displays correct text and value without interaction
      expect(gridSelect.value).toBe('2');
      expect(gridSelect.selectedOptions[0]?.text).toBe('2 Kolom / Baris');
      expect(sortSelect.value).toBe('default');
      expect(sortSelect.selectedOptions[0]?.text).toBe('Sesuai Urutan Data (Asli)');

      // Change sort mode via method & verify select reflects value
      component.setRegionSortMode('desc');
      fixture.detectChanges();
      expect(component.regionSortMode()).toBe('desc');
      expect(sortSelect.value).toBe('desc');

      component.setRegionSortMode('asc');
      fixture.detectChanges();
      expect(component.regionSortMode()).toBe('asc');
      expect(sortSelect.value).toBe('asc');

      // Change grid columns via method & verify select reflects value
      component.setRegionGridColumns(3);
      fixture.detectChanges();
      expect(component.regionGridColumns()).toBe(3);
      expect(gridSelect.value).toBe('3');

      // Verify grid container receives 3-column classes
      const gridContainer = compiled.querySelector(`.${component.regionGridClass().split(' ')[0]}`);
      expect(component.regionGridClass()).toContain('lg:grid-cols-3');
      expect(component.regionGridClass()).toContain('xl:grid-cols-3');

      component.setRegionGridColumns(1);
      fixture.detectChanges();
      expect(component.regionGridColumns()).toBe(1);
      expect(gridSelect.value).toBe('1');
    });

    it('should render region cards in DOM with individual indicator target pins and badges in by-region mode', () => {
      populateTestData();
      component.dataSource.set('join');
      component.setViewMode('by-region');

      // Set different targets for indicators
      component.setIndicatorTarget('tw1', 70);
      component.setIndicatorTarget('tw2', 80);

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      // 1. Verify region cards are rendered (one SVG per region)
      const regionSvgs = compiled.querySelectorAll('svg[id^="regionChartSvg-"]');
      expect(regionSvgs.length).toBe(5);

      // 2. Verify target pin markers exist on bars with targets
      const targetPins = compiled.querySelectorAll('.target-pin');
      expect(targetPins.length).toBeGreaterThan(0);

      // 3. Verify target value annotations appear in bar text (e.g. "(T: 70)")
      expect(compiled.textContent).toContain('(T: 70)');
      expect(compiled.textContent).toContain('(T: 80)');

      // 4. Verify target annotations are rendered in card content
      expect(compiled.textContent).toContain('T: 70');
      expect(compiled.textContent).toContain('T: 80');

      // 5. Verify 3-column layout applies to card container
      component.setRegionGridColumns(3);
      fixture.detectChanges();
      const cardGrid = compiled.querySelector(`div[class*="grid-cols"]`);
      expect(cardGrid).toBeTruthy();
      expect(cardGrid?.className).toContain('xl:grid-cols-3');
      expect(cardGrid?.className).toContain('lg:grid-cols-3');

      // 6. Verify Seri Indikator legend is removed from by-region toolbar
      expect(compiled.textContent).not.toContain('Seri Indikator:');
    });

    it('should not display Seri Indikator quick jump tabs in by-indicator mode', () => {
      populateTestData();
      component.dataSource.set('join');
      component.setViewMode('by-indicator');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('Seri Indikator:');
      // Should not contain the quick jump "Semua Indikator" pill button
      const allIndicatorsBtn = Array.from(compiled.querySelectorAll('button')).find((b) =>
        b.textContent?.trim().startsWith('Semua Indikator'),
      );
      expect(allIndicatorsBtn).toBeUndefined();
    });

    it('should support Urutan Wilayah and Grafik per Baris select options in by-indicator mode', () => {
      populateTestData();
      component.dataSource.set('join');
      component.setViewMode('by-indicator');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const sortSelect = compiled.querySelector('#indicatorSortModeSelect') as HTMLSelectElement;
      const gridSelect = compiled.querySelector(
        '#indicatorGridSelect, #indicatorGridColumnsSelect',
      ) as HTMLSelectElement;

      expect(sortSelect).toBeTruthy();
      expect(gridSelect).toBeTruthy();

      // Verify initial selected state displays correct text and value without interaction
      expect(gridSelect.value).toBe('2');
      expect(gridSelect.selectedOptions[0]?.text).toBe('2 Grafik / Baris');
      expect(sortSelect.value).toBe('default');
      expect(sortSelect.selectedOptions[0]?.text).toBe('Sesuai Urutan Data (Asli)');

      component.setIndicatorSortMode('desc');
      fixture.detectChanges();
      expect(component.indicatorSortMode()).toBe('desc');
      expect(sortSelect.value).toBe('desc');

      component.setIndicatorGridColumns(3);
      fixture.detectChanges();
      expect(component.indicatorGridColumns()).toBe(3);
      expect(gridSelect.value).toBe('3');
    });

    it('should open, search, manage checkboxes, and close Region Filter Modal', () => {
      populateTestData();
      component.dataSource.set('join');
      fixture.detectChanges();

      expect(component.showRegionFilterModal()).toBe(false);

      // Open Region modal
      component.openRegionFilterModal();
      fixture.detectChanges();
      expect(component.showRegionFilterModal()).toBe(true);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Filter Wilayah Visualisasi');

      // Test search filtering inside modal
      component.regionModalSearch.set('Wonosobo');
      expect(component.filteredModalCategories()).toContain('Kab. Wonosobo');
      expect(component.filteredModalCategories()).not.toContain('Kab. Magelang');

      component.regionModalSearch.set('');
      expect(component.filteredModalCategories().length).toBe(
        component.availableCategories().length,
      );

      // Test deselecting and re-selecting a region
      expect(component.isCategorySelected('Kab. Wonosobo')).toBe(true);
      component.toggleCategory('Kab. Wonosobo');
      expect(component.isCategorySelected('Kab. Wonosobo')).toBe(false);

      component.toggleCategory('Kab. Wonosobo');
      expect(component.isCategorySelected('Kab. Wonosobo')).toBe(true);

      // Close modal
      component.closeRegionFilterModal();
      fixture.detectChanges();
      expect(component.showRegionFilterModal()).toBe(false);
    });

    it('should open, search, manage checkboxes, and close Indicator Filter Modal', () => {
      populateTestData();
      component.dataSource.set('join');
      fixture.detectChanges();

      expect(component.showIndicatorFilterModal()).toBe(false);

      // Open Indicator modal
      component.openIndicatorFilterModal();
      fixture.detectChanges();
      expect(component.showIndicatorFilterModal()).toBe(true);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Filter Indikator Visualisasi');

      // Test search filtering
      component.indicatorModalSearch.set('tw1');
      expect(component.filteredModalIndicators().some((i) => i.header === 'tw1')).toBe(true);

      component.indicatorModalSearch.set('');
      expect(component.filteredModalIndicators().length).toBe(
        component.allCandidateSeriesColumns().length,
      );

      // Toggle series column
      expect(component.selectedSeriesKeys()).toContain('tw1');
      component.toggleSeriesColumn('tw1');
      expect(component.selectedSeriesKeys()).not.toContain('tw1');

      component.toggleSeriesColumn('tw1');
      expect(component.selectedSeriesKeys()).toContain('tw1');

      // Close modal
      component.closeIndicatorFilterModal();
      fixture.detectChanges();
      expect(component.showIndicatorFilterModal()).toBe(false);
    });

    it('should reset all filters including modal-selected indicators and regions when resetChartFilters is clicked', () => {
      populateTestData();
      component.dataSource.set('join');
      fixture.detectChanges();

      // Filter one region and one indicator
      component.toggleCategory('Kota Semarang');
      component.toggleSeriesColumn('tw1');
      component.chartRegionSearch.set('Cilacap');
      component.selectedIndicatorFilter.set('tw2');
      fixture.detectChanges();

      expect(component.isChartFilterActive()).toBe(true);

      // Reset filters
      component.resetChartFilters();
      fixture.detectChanges();

      expect(component.chartRegionSearch()).toBe('');
      expect(component.selectedRegionFilter()).toBe('all');
      expect(component.selectedIndicatorFilter()).toBe('all');
      expect(component.selectedCategories().length).toBe(component.availableCategories().length);
      expect(component.selectedSeriesKeys().length).toBe(
        component.allCandidateSeriesColumns().length,
      );
      expect(component.isChartFilterActive()).toBe(false);
    });
  });
});
