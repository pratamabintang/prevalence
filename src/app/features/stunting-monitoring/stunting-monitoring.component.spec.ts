import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, beforeEach } from 'vitest';
import { StuntingMonitoringComponent } from './stunting-monitoring.component';
import { ChartDataBridge } from '../../core/chart/chart-data-bridge';
import {
  StuntingPipelinePreset,
  StuntingPresetStore,
} from './stunting-preset-store';

describe('StuntingMonitoringComponent', () => {
  let component: StuntingMonitoringComponent;
  let fixture: ComponentFixture<StuntingMonitoringComponent>;
  let chartDataBridge: ChartDataBridge;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StuntingMonitoringComponent],
      providers: [
        provideRouter([
          { path: 'chart', component: StuntingMonitoringComponent },
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StuntingMonitoringComponent);
    component = fixture.componentInstance;
    chartDataBridge = TestBed.inject(ChartDataBridge);
    fixture.detectChanges();
  });

  function setupMockMultiSheetWorkbook() {
    // Sheet 1: data_remaja
    const wsRemaja: any = {
      '!ref': 'A1:C4',
      A1: { v: 'Puskesmas' },
      B1: { v: 'Sasaran Remaja' },
      C1: { v: 'Remaja Dapat TTD' },

      A2: { v: 'Puskesmas Banjarsari' },
      B2: { v: 1000 },
      C2: { v: 820 },

      A3: { v: 'Puskesmas Cilacap' },
      B3: { v: 2000 },
      C3: { v: 1700 },

      // Summary row (should be excluded)
      A4: { v: 'TOTAL / JUMLAH KABUPATEN' },
      B4: { v: 3000 },
      C4: { v: 2520 },
    };

    // Sheet 2: data_balita
    const wsBalita: any = {
      '!ref': 'A1:C4',
      A1: { v: 'Puskesmas' },
      B1: { v: 'Sasaran Balita' },
      C1: { v: 'Balita Gizi Kurang MT' },

      A2: { v: 'Puskesmas Banjarsari' },
      B2: { v: 500 },
      C2: { v: 80 },

      A3: { v: 'Puskesmas Cilacap' },
      B3: { v: 500 },
      C3: { v: 80 },

      // Summary row (should be excluded)
      A4: { v: 'TOTAL KABUPATEN' },
      B4: { v: 1000 },
      C4: { v: 160 },
    };

    const mockWb: any = {
      SheetNames: ['data_remaja', 'data_balita'],
      Sheets: {
        data_remaja: wsRemaja,
        data_balita: wsBalita,
      },
    };

    component.workbook = mockWb;
    component.file.set(new File([], 'laporan-stunting-multi-sheet.xlsx'));
    component.selectPrimarySheet('data_remaja');

    // Select secondary sheet to join
    const sec = component.secondarySheets().find((s) => s.sheetName === 'data_balita');
    if (sec) {
      component.toggleSecondarySheet(sec);
    }
  }

  it('should initialize with default stepper state and empty data', () => {
    expect(component).toBeTruthy();
    expect(component.activeStep()).toBe(1);
    expect(component.file()).toBeNull();
    expect(component.evaluationResult()).toBeNull();
    expect(component.categories().length).toBeGreaterThan(0);
  });

  it('should join multi-sheet workbook on key column and exclude summary rows (TOTAL/JUMLAH)', () => {
    setupMockMultiSheetWorkbook();

    expect(component.primarySheet()).toBe('data_remaja');
    expect(component.primaryKeyCol()).toBe('Puskesmas');
    expect(component.joinedRows().length).toBe(3); // 2 Puskesmas + 1 Total row

    // validJoinedRows excludes the TOTAL/JUMLAH row!
    expect(component.validJoinedRows().length).toBe(2);

    // Joined columns catalog contains columns from both sheets
    expect(component.joinedColumns()).toContain('Sasaran Remaja');
    expect(component.joinedColumns()).toContain('Remaja Dapat TTD');
    expect(component.joinedColumns()).toContain('Sasaran Balita');
    expect(component.joinedColumns()).toContain('Balita Gizi Kurang MT');
  });

  it('should allow building categories and sub-categories with live aggregate sum calculations', () => {
    setupMockMultiSheetWorkbook();
    component.goToStep(2);
    expect(component.activeStep()).toBe(2);

    // Create custom category directly
    component.addCategory('Intervensi Khusus');
    const cat = component.categories().find((c) => c.name === 'Intervensi Khusus')!;
    expect(cat).toBeDefined();

    // Add subcategory
    component.addSubCategory(cat.id);
    const catWithSub = component.categories().find((c) => c.id === cat.id)!;
    const sub = catWithSub.subCategories[0];
    expect(sub).toBeDefined();

    // Configure sub-category columns
    component.updateSubCategory(cat.id, sub.id, {
      denominatorCol: 'Sasaran Remaja',
    });
    component.onNumeratorColChange(cat.id, sub.id, 'Remaja Dapat TTD');

    // Verify sub-category name automatically matches numerator column header
    const updatedSub = component.categories().find((c) => c.id === cat.id)!.subCategories[0];
    expect(updatedSub.name).toBe('Remaja Dapat TTD');

    // Live Stats check: Sasaran = 1000 + 2000 = 3000; Realisasi = 820 + 1700 = 2520; Capaian = 84%
    const stats = component.getSubCategoryLiveStats(updatedSub);
    expect(stats.sumDen).toBe(3000);
    expect(stats.sumNum).toBe(2520);
    expect(stats.actualPercentage).toBe(84);
  });

  it('should evaluate stunting monitoring table for active quarter with directional gap and status', () => {
    setupMockMultiSheetWorkbook();

    // Set up standard indicators in categories
    component.categories.set([
      {
        id: 'cat-1',
        name: 'Intervensi untuk remaja putri dan ibu hamil (sebelum kelahiran)',
        subCategories: [
          {
            id: 'sub-1',
            name: 'Remaja Dapat TTD',
            numeratorCol: 'Remaja Dapat TTD',
            denominatorCol: 'Sasaran Remaja',
            calculationMode: 'percentage',
            targetCurrentYear: 85,
            targetPrevYear: 80,
            actualPrevYear: 80,
            polarity: 'positive',
          },
        ],
      },
      {
        id: 'cat-2',
        name: 'Intervensi untuk balita (setelah kelahiran)',
        subCategories: [
          {
            id: 'sub-2',
            name: 'Balita Gizi Kurang MT',
            numeratorCol: 'Balita Gizi Kurang MT',
            denominatorCol: 'Sasaran Balita',
            calculationMode: 'percentage',
            targetCurrentYear: 90,
            targetPrevYear: 85,
            actualPrevYear: 20,
            polarity: 'positive',
          },
        ],
      },
    ]);

    component.goToStep(3);
    expect(component.activeStep()).toBe(3);

    const res = component.evaluationResult();
    expect(res).not.toBeNull();
    expect(res?.rows.length).toBe(2);

    // Indikator 1: Remaja TTD
    // Capaian = 84%, Target 2026 = 85%, Expected TW1 = 21.25%, Gap = +62.75% -> On Track
    const row1 = res!.rows[0];
    expect(row1.activeActual).toBe(84);
    expect(row1.activeExpected).toBe(21.25);
    expect(row1.activeGap).toBe(62.75);
    expect(row1.status).toBe('on_track');

    // Indikator 2: Balita Gizi Kurang
    // Capaian = 160 / 1000 = 16%, Target 2026 = 90%, Expected TW1 = 22.5%, Gap = -6.5% -> Perlu Percepatan
    const row2 = res!.rows[1];
    expect(row2.activeActual).toBe(16);
    expect(row2.activeExpected).toBe(22.5);
    expect(row2.activeGap).toBe(-6.5);
    expect(row2.status).toBe('perlu_percepatan');

    // Priority acceleration list should contain row 2
    expect(res?.accelerationList.length).toBe(1);
    expect(res?.accelerationList[0].name).toBe('Balita Gizi Kurang MT');
  });

  it('should reactively re-evaluate when active quarter is changed', () => {
    setupMockMultiSheetWorkbook();

    component.categories.set([
      {
        id: 'cat-1',
        name: 'Intervensi untuk balita (setelah kelahiran)',
        subCategories: [
          {
            id: 'sub-2',
            name: 'Balita Gizi Kurang MT',
            numeratorCol: 'Balita Gizi Kurang MT',
            denominatorCol: 'Sasaran Balita',
            calculationMode: 'percentage',
            targetCurrentYear: 90,
            targetPrevYear: 85,
            actualPrevYear: 20,
            polarity: 'positive',
          },
        ],
      },
    ]);

    component.setActiveQuarter(2); // TW 2: Expected = 50% * 90 = 45%
    const res = component.evaluationResult();
    expect(res?.activeQuarter).toBe(2);
    expect(res?.rows[0].activeExpected).toBe(45);
    expect(res?.rows[0].activeActual).toBe(16);
    expect(res?.rows[0].activeGap).toBe(-29);
    expect(res?.rows[0].status).toBe('perlu_percepatan');
  });

  it('should filter rows by search query and status pills', () => {
    setupMockMultiSheetWorkbook();

    component.categories.set([
      {
        id: 'cat-1',
        name: 'Kategori 1',
        subCategories: [
          {
            id: 'sub-1',
            name: 'Remaja TTD',
            numeratorCol: 'Remaja Dapat TTD',
            denominatorCol: 'Sasaran Remaja',
            targetCurrentYear: 85,
            targetPrevYear: 80,
            actualPrevYear: 80,
          },
          {
            id: 'sub-2',
            name: 'Balita Gizi Kurang',
            numeratorCol: 'Balita Gizi Kurang MT',
            denominatorCol: 'Sasaran Balita',
            targetCurrentYear: 90,
            targetPrevYear: 85,
            actualPrevYear: 20,
          },
        ],
      },
    ]);

    // Search query filter
    component.searchQuery.set('balita');
    let filtered = component.filteredGroupedRows();
    expect(filtered.length).toBe(1);
    expect(filtered[0].rows[0].name).toContain('Balita');

    component.searchQuery.set('');

    // Status filter: on_track
    component.setFilter('on_track');
    filtered = component.filteredGroupedRows();
    expect(filtered.length).toBe(1);
    expect(filtered[0].rows[0].name).toBe('Remaja TTD');
  });

  it('should toggle format guide visibility', () => {
    expect(component.showFormatGuide()).toBe(true);
    component.toggleFormatGuide();
    expect(component.showFormatGuide()).toBe(false);
    component.toggleFormatGuide();
    expect(component.showFormatGuide()).toBe(true);
  });

  it('should export joined data in Step 1 via exportJoinedData', () => {
    setupMockMultiSheetWorkbook();
    expect(component.validJoinedRows().length).toBe(2);

    expect(() => component.exportJoinedData()).not.toThrow();
    expect(component.notificationMessage()).toContain('Data gabungan');
    expect(component.notificationMessage()).toContain('berhasil diunduh');
  });

  it('should export styled Excel report without error', () => {
    setupMockMultiSheetWorkbook();
    component.categories.set([
      {
        id: 'cat-1',
        name: 'Kategori 1',
        subCategories: [
          {
            id: 'sub-1',
            name: 'Remaja TTD',
            numeratorCol: 'Remaja Dapat TTD',
            denominatorCol: 'Sasaran Remaja',
            targetCurrentYear: 85,
            targetPrevYear: 80,
            actualPrevYear: 80,
          },
        ],
      },
    ]);

    expect(() => component.exportExcel()).not.toThrow();
    expect(component.notificationMessage()).toContain('berhasil diunduh');
  });

  it('should transfer stunting data to ChartDataBridge and route to chart', () => {
    setupMockMultiSheetWorkbook();
    component.categories.set([
      {
        id: 'cat-1',
        name: 'Kategori 1',
        subCategories: [
          {
            id: 'sub-1',
            name: 'Remaja TTD',
            numeratorCol: 'Remaja Dapat TTD',
            denominatorCol: 'Sasaran Remaja',
            targetCurrentYear: 85,
            targetPrevYear: 80,
            actualPrevYear: 80,
          },
        ],
      },
    ]);

    component.visualizeInChart();
    const bridgeData = chartDataBridge.data();
    expect(bridgeData).not.toBeNull();
    expect(bridgeData?.categoryColumn).toBe('Indikator');
    expect(bridgeData?.rows.length).toBe(1);
  });

  it('should save and load v2.0 pipeline presets correctly', () => {
    setupMockMultiSheetWorkbook();
    component.exportConfiguration();

    expect(component.configNotification()?.type).toBe('success');
    expect(component.hasSavedConfig()).toBe(true);

    const saved = StuntingPresetStore.loadLastPreset();
    expect(saved).not.toBeNull();
    expect(saved?.version).toBe('2.0');
    expect((saved as StuntingPipelinePreset).primarySheet).toBe('data_remaja');

    // Test load from storage
    component.loadSavedConfigurationFromStorage();
    expect(component.configNotification()?.type).toBe('success');
  });

  it('should support 2-way preload workflow (loading preset before Excel upload)', () => {
    const preset: StuntingPipelinePreset = {
      version: '2.0',
      savedAt: new Date().toISOString(),
      primarySheet: 'data_remaja',
      primaryKeyColumn: 'Puskesmas',
      secondarySheets: [
        {
          sheetName: 'data_balita',
          keyColumn: 'Puskesmas',
        },
      ],
      categories: [
        {
          id: 'cat-pre',
          name: 'Intervensi Preload',
          subCategories: [
            {
              id: 'sub-pre',
              name: 'Indikator Preload',
              numeratorCol: 'Remaja Dapat TTD',
              denominatorCol: 'Sasaran Remaja',
              targetCurrentYear: 85,
              targetPrevYear: 80,
              actualPrevYear: 80,
            },
          ],
        },
      ],
      activeQuarter: 2,
      toleranceThreshold: -4.0,
    };

    // 1. Preload preset before file is available
    component.applyConfiguration(preset, 'Preset Stunting v2.json');
    expect(component.pendingPreset).toEqual(preset);
    expect(component.configNotification()?.type).toBe('info');

    // 2. Upload file
    setupMockMultiSheetWorkbook();
    if (component.pendingPreset) {
      const p = component.pendingPreset;
      component.pendingPreset = null;
      component.applyConfiguration(p, 'Preset Stunting v2.json');
    }

    expect(component.pendingPreset).toBeNull();
    expect(component.activeQuarter()).toBe(2);
    expect(component.toleranceThreshold()).toBe(-4.0);
    expect(component.categories().length).toBe(1);
    expect(component.categories()[0].name).toBe('Intervensi Preload');
  });

  it('should update primary and secondary header/data rows and reload joined dataset', () => {
    setupMockMultiSheetWorkbook();

    expect(component.primaryHeaderStartRow()).toBe(1);
    expect(component.primaryHeaderEndRow()).toBe(1);
    expect(component.primaryDataStartRow()).toBe(2);

    // Simulate changing primary header start row
    const mockInput = { target: { value: '1' } } as unknown as Event;
    component.onPrimaryHeaderStartRowChange(mockInput);
    expect(component.primaryHeaderStartRow()).toBe(1);

    // Simulate changing primary data start row to row 3 (skip row 2)
    const mockDataInput = { target: { value: '3' } } as unknown as Event;
    component.onPrimaryDataStartRowChange(mockDataInput);
    expect(component.primaryDataStartRow()).toBe(3);
    // joinedRows should now only read from row 3 downwards (1 data row + 1 total row)
    expect(component.joinedRows().length).toBe(2);

    // Secondary sheet row adjustments
    const sec = component.secondarySheets().find((s) => s.sheetName === 'data_balita')!;
    expect(sec).toBeDefined();
    component.onSecondaryDataStartRowChange('data_balita', { target: { value: '3' } } as unknown as Event);
    const updatedSec = component.secondarySheets().find((s) => s.sheetName === 'data_balita')!;
    expect(updatedSec.dataStartRow).toBe(3);
  });

  it('should preserve and restore custom header and data start rows in preset v2.0', () => {
    setupMockMultiSheetWorkbook();

    // Set custom rows
    component.primaryHeaderStartRow.set(1);
    component.primaryHeaderEndRow.set(2);
    component.primaryDataStartRow.set(3);

    component.exportConfiguration();
    const saved = StuntingPresetStore.loadLastPreset() as StuntingPipelinePreset;
    expect(saved).not.toBeNull();
    expect(saved.primaryHeaderStartRow).toBe(1);
    expect(saved.primaryHeaderEndRow).toBe(2);
    expect(saved.primaryDataStartRow).toBe(3);

    // Reset rows to defaults
    component.primaryHeaderStartRow.set(1);
    component.primaryHeaderEndRow.set(1);
    component.primaryDataStartRow.set(2);

    // Re-apply preset
    component.applyConfiguration(saved, 'Test Preset');
    expect(component.primaryHeaderStartRow()).toBe(1);
    expect(component.primaryHeaderEndRow()).toBe(2);
    expect(component.primaryDataStartRow()).toBe(3);
  });

  it('should immediately exclude deactivated row from Step 2 calculations and allow reactivation', () => {
    setupMockMultiSheetWorkbook();
    component.goToStep(2);

    const sub = {
      id: 'sub-test',
      name: 'Remaja TTD',
      numeratorCol: 'Remaja Dapat TTD',
      denominatorCol: 'Sasaran Remaja',
      targetCurrentYear: 85,
    };

    // Initially with 2 valid puskesmas (Banjarsari: 820/1000, Cilacap: 1700/2000)
    let stats = component.getSubCategoryLiveStats(sub);
    expect(stats.sumDen).toBe(3000);
    expect(stats.sumNum).toBe(2520);
    expect(component.validJoinedRows().length).toBe(2);

    // Deactivate "Puskesmas Banjarsari"
    const banjarsariRow = component.previewRows().find((r) => r.key === 'Puskesmas Banjarsari')!;
    expect(banjarsariRow).toBeDefined();
    component.toggleRowExclusion(banjarsariRow.id);

    // validJoinedRows must now ONLY have 1 Puskesmas (Cilacap: 1700 / 2000)
    expect(component.validJoinedRows().length).toBe(1);
    stats = component.getSubCategoryLiveStats(sub);
    expect(stats.sumDen).toBe(2000);
    expect(stats.sumNum).toBe(1700);

    // Re-activate "Puskesmas Banjarsari"
    component.toggleRowExclusion(banjarsariRow.id);
    expect(component.validJoinedRows().length).toBe(2);
    stats = component.getSubCategoryLiveStats(sub);
    expect(stats.sumDen).toBe(3000);
    expect(stats.sumNum).toBe(2520);
  });

  it('should permanently delete individual row and bulk delete all inactive rows', () => {
    setupMockMultiSheetWorkbook();
    expect(component.joinedRows().length).toBe(3); // 2 data + 1 total
    expect(component.validJoinedRows().length).toBe(2);

    // Bulk delete excluded rows (should remove the TOTAL row completely)
    expect(component.excludedRowIds().size).toBe(1);
    component.deleteExcludedRows();
    expect(component.joinedRows().length).toBe(2);
    expect(component.excludedRowIds().size).toBe(0);

    // Permanently delete 1 row
    const firstRowId = String(component.joinedRows()[0]['__id']);
    component.deleteRow(firstRowId);
    expect(component.joinedRows().length).toBe(1);
    expect(component.validJoinedRows().length).toBe(1);
  });

  it('should auto-exclude blank wilayah rows by default', () => {
    // Add a blank row to joinedRows
    component.joinedRows.set([
      { __id: 'row-0', Puskesmas: 'Puskesmas A', Sasaran: 100 },
      { __id: 'row-1', Puskesmas: '', Sasaran: 50 }, // Blank row
      { __id: 'row-2', Puskesmas: '   ', Sasaran: 30 }, // Whitespace row
    ]);
    component.primaryKeyCol.set('Puskesmas');
    component.applyKeywordAndPatternExclusions();

    expect(component.validJoinedRows().length).toBe(1);
    expect(component.validJoinedRows()[0]['Puskesmas']).toBe('Puskesmas A');
  });

  it('should support multi-quarter columns (TW1-TW4) with Jumlah and no YoY column in Step 3 table', () => {
    setupMockMultiSheetWorkbook();

    // Setup category with multi-quarter subcategory: TW1 and TW2
    component.categories.set([
      {
        id: 'cat-1',
        name: 'Intervensi Gizi',
        subCategories: [
          {
            id: 'sub-1',
            name: 'Pemberian TTD Remaja',
            numeratorCol: 'Remaja Dapat TTD',
            denominatorCol: 'Sasaran Remaja',
            quarterColumns: {
              1: { numeratorCol: 'Remaja Dapat TTD' },
              2: { numeratorCol: 'Remaja Dapat TTD' },
            },
            calculationMode: 'percentage',
            targetCurrentYear: 90,
            targetPrevYear: 80,
            actualPrevYear: 75,
            polarity: 'positive',
          },
        ],
      },
    ]);

    component.goToStep(3);
    fixture.detectChanges();

    // availableQuarters should detect TW1 and TW2
    expect(component.availableQuarters()).toEqual([1, 2]);

    const res = component.evaluationResult();
    expect(res).not.toBeNull();
    const row = res!.rows[0];

    // TW 1: Sasaran = 3000, Realisasi = 2520, Capaian = 84%
    expect(row.quarters[1].sumNumerator).toBe(2520);
    expect(row.quarters[1].actualAchievement).toBe(84);

    // TW 2: Sasaran = 3000, Realisasi = 2520, Capaian = 84%
    expect(row.quarters[2].sumNumerator).toBe(2520);
    expect(row.quarters[2].actualAchievement).toBe(84);

    // Verify DOM: Step 3 table contains "Triwulan 1", "Triwulan 2", and "Jumlah" subheaders
    const tableEl: HTMLElement = fixture.nativeElement.querySelector('table');
    expect(tableEl).toBeTruthy();
    const textContent = tableEl.textContent || '';
    expect(textContent).toContain('Triwulan 1');
    expect(textContent).toContain('Triwulan 2');
    expect(textContent).toContain('Jumlah');
    expect(textContent).toContain('Capaian (%)');

    // YoY Change header must NOT be present
    expect(textContent).not.toContain('Perubahan YoY');

    // Triwulan Aktif selector buttons must NOT be present in Step 3 header
    const step3HeaderEl: HTMLElement = fixture.nativeElement;
    expect(step3HeaderEl.textContent).not.toContain('Triwulan Aktif:');
    expect(step3HeaderEl.textContent).not.toContain('TW 1 (25%)');

    // activeQuarter is automatically evaluated to 2 (latest available quarter)
    expect(component.activeQuarter()).toBe(2);
    expect(row.activeQuarter).toBe(2);
  });

  describe('autoDetectKeyColumn', () => {
    it('should prioritize Kabupaten/Kota over columns mentioning puskesmas in metrics', () => {
      const mockCols = [
        { colIndex: 0, colLetter: 'A', header: 'No', leafHeader: 'No', layers: ['No'] },
        { colIndex: 1, colLetter: 'B', header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'] },
        { colIndex: 2, colLetter: 'C', header: 'Sasaran', leafHeader: 'Sasaran', layers: ['Sasaran'] },
        { colIndex: 103, colLetter: 'CZ', header: 'Jumlah balita stunting dirujuk Puskesmas ke RS', leafHeader: 'RS', layers: ['Jumlah balita stunting dirujuk Puskesmas ke RS'] },
      ];

      const detected = component.autoDetectKeyColumn(mockCols);
      expect(detected).toBe('Kabupaten/Kota');
    });

    it('should detect puskesmas or faskes when no kabupaten column exists', () => {
      const mockCols = [
        { colIndex: 0, colLetter: 'A', header: 'No', leafHeader: 'No', layers: ['No'] },
        { colIndex: 1, colLetter: 'B', header: 'Nama Puskesmas', leafHeader: 'Nama Puskesmas', layers: ['Nama Puskesmas'] },
        { colIndex: 2, colLetter: 'C', header: 'Sasaran', leafHeader: 'Sasaran', layers: ['Sasaran'] },
      ];

      const detected = component.autoDetectKeyColumn(mockCols);
      expect(detected).toBe('Nama Puskesmas');
    });

    it('should skip column No and pick column 1 when col 0 is numbering', () => {
      const mockCols = [
        { colIndex: 0, colLetter: 'A', header: 'No.', leafHeader: 'No.', layers: ['No.'] },
        { colIndex: 1, colLetter: 'B', header: 'Entitas Wilayah', leafHeader: 'Entitas Wilayah', layers: ['Entitas Wilayah'] },
      ];

      const detected = component.autoDetectKeyColumn(mockCols);
      expect(detected).toBe('Entitas Wilayah');
    });

    it('should keep settings hidden by default and after file upload until toggled', () => {
      expect(component.showSettings()).toBe(false);
      component.toggleSettings();
      expect(component.showSettings()).toBe(true);
      component.toggleSettings();
      expect(component.showSettings()).toBe(false);

      setupMockMultiSheetWorkbook();
      expect(component.showSettings()).toBe(false);

      component.clearFile();
      expect(component.showSettings()).toBe(false);
    });
  });
});



