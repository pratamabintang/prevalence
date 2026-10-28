import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { StuntingMonitoringComponent } from './stunting-monitoring.component';
import { HealthDataExchange } from '../../core/domain/health-data-exchange';
import { GasStorageService } from '../../core/storage/gas-storage.service';
import { BackendStorageService } from '../../core/storage/backend-storage.service';
import { StuntingExcelExporter } from '../../core/stunting/stunting-excel-exporter';
import {
  ConfigurationWorkspace,
  StuntingPipelinePreset,
} from '../../core/storage/configuration-workspace';

describe('StuntingMonitoringComponent', () => {
  let component: StuntingMonitoringComponent;
  let fixture: ComponentFixture<StuntingMonitoringComponent>;
  let healthDataExchange: HealthDataExchange;

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
    healthDataExchange = TestBed.inject(HealthDataExchange);
    const gas = TestBed.inject(GasStorageService);
    vi.spyOn(gas, 'listPeriods').mockResolvedValue({ success: false, periods: [] });
    vi.spyOn(gas, 'loadPeriod').mockResolvedValue({ success: false, hasData: false });
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
            targetCurrentYear: 80,
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
    // Capaian = 84%, Target 2026 = 80%, Expected TW1 = 80%, Gap = +4% -> On Track
    const row1 = res!.rows[0];
    expect(row1.activeActual).toBe(84);
    expect(row1.activeExpected).toBe(80);
    expect(row1.activeGap).toBe(4);
    expect(row1.status).toBe('on_track');

    // Indikator 2: Balita Gizi Kurang
    // Capaian = 160 / 1000 = 16%, Target 2026 = 90%, Expected TW1 = 90%, Gap = -74% -> Perlu Percepatan
    const row2 = res!.rows[1];
    expect(row2.activeActual).toBe(16);
    expect(row2.activeExpected).toBe(90);
    expect(row2.activeGap).toBe(-74);
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

    component.setActiveQuarter(2); // TW 2: Expected = 100% * 90 = 90
    const res = component.evaluationResult();
    expect(res?.activeQuarter).toBe(2);
    expect(res?.rows[0].activeExpected).toBe(90);
    expect(res?.rows[0].activeActual).toBe(16);
    expect(res?.rows[0].activeGap).toBe(-74);
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
            targetCurrentYear: 80,
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

  it('should export joined data in Step 1 via exportJoinedData', () => {
    setupMockMultiSheetWorkbook();
    expect(component.validJoinedRows().length).toBe(2);

    const exportSpy = vi
      .spyOn(StuntingExcelExporter, 'exportJoinedData')
      .mockReturnValue('Data_Gabungan_Stunting_Mock.xlsx');

    expect(() => component.exportJoinedData()).not.toThrow();
    expect(exportSpy).toHaveBeenCalledTimes(1);
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

    const exportSpy = vi
      .spyOn(StuntingExcelExporter, 'exportMonitoringReport')
      .mockReturnValue('Monitoring_Stunting_Mock.xlsx');

    expect(() => component.exportExcel()).not.toThrow();
    expect(exportSpy).toHaveBeenCalledTimes(1);
    expect(component.notificationMessage()).toContain('berhasil diunduh');
  });

  it('should transfer stunting data to HealthDataExchange and route to chart', () => {
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
    const bridgeData = healthDataExchange.chartData();
    expect(bridgeData).not.toBeNull();
    expect(bridgeData?.categoryColumn).toBe('Indikator');
    expect(bridgeData?.rows.length).toBe(1);
  });

  it('should save and load v2.0 pipeline presets correctly', () => {
    setupMockMultiSheetWorkbook();
    component.exportConfiguration();

    expect(component.configNotification()?.type).toBe('success');
    expect(component.hasSavedConfig()).toBe(true);

    const saved = ConfigurationWorkspace.stunting.loadLastPreset();
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
    const saved = ConfigurationWorkspace.stunting.loadLastPreset() as StuntingPipelinePreset;
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

    it('should auto-detect JAWA TENGAH as summary row and TARGET as target row, and auto-populate indicators without denominator', () => {
      const wsRekap: any = {
        '!ref': 'A1:H4',
        A1: { v: 'No' },
        B1: { v: 'Kabupaten/Kota' },
        C1: { v: 'Rematri Konsumsi TTD' },
        D1: { v: '% Konsumsi TTD' },
        E1: { v: 'Rematri anemia ' },
        F1: { v: '% Rematri anemia ' },
        G1: { v: 'Balita dipantau pertumbuhan (D/S)' },
        H1: { v: '% D/S' },

        A2: { v: 1 },
        B2: { v: 'CILACAP' },
        C2: { v: 77877 },
        D2: { v: 98.78 },
        E2: { v: 4658 },
        F2: { v: 16.37 },
        G2: { v: 100000 },
        H2: { v: 95.5 },

        // Row 3: JAWA TENGAH summary row
        A3: { v: null },
        B3: { v: 'JAWA TENGAH' },
        C3: { v: 1483925 },
        D3: { v: 93.64 },
        E3: { v: 88202 },
        F3: { v: 15.21 },
        G3: { v: 1462055 },
        H3: { v: 96.13 },

        // Row 4: TARGET row
        A4: { v: null },
        B4: { v: 'TARGET' },
        C4: { v: 67 },
        D4: { v: null },
        E4: { v: '≤23' },
        F4: { v: null },
        G4: { v: 90 },
        H4: { v: null },
      };

      const mockWb: any = {
        SheetNames: ['rekap indikator 01102026'],
        Sheets: {
          'rekap indikator 01102026': wsRekap,
        },
      };

      component.workbook = mockWb;
      component.file.set(new File([], 'Format Analisas Intervensi Spesifik TW3 01102026.xlsx'));
      component.selectPrimarySheet('rekap indikator 01102026');

      // Verifikasi auto-deteksi mode ringkasan dan baris
      expect(component.calculationDataSource()).toBe('summary_row');
      expect(component.summaryRowData()).toBeDefined();
      expect(component.summaryRowData()!['Kabupaten/Kota']).toBe('JAWA TENGAH');
      expect(component.targetRowData()).toBeDefined();
      expect(component.targetRowData()!['Kabupaten/Kota']).toBe('TARGET');

      // validJoinedRows hanya memuat 1 baris (JAWA TENGAH)
      expect(component.validJoinedRows().length).toBe(1);

      // Verifikasi indikator ter-populate otomatis ke dalam kategori
      const cat1 = component.categories().find((c) => c.id === 'cat-1')!;
      const cat2 = component.categories().find((c) => c.id === 'cat-2')!;

      // Cat 1 (Rematri & Bumil) harus memuat Konsumsi TTD dan Rematri Anemia
      expect(cat1.subCategories.length).toBe(2);
      const subTTD = cat1.subCategories.find((s) => s.numeratorCol === '% Konsumsi TTD')!;
      expect(subTTD).toBeDefined();
      expect(subTTD.targetCurrentYear).toBe(67);
      expect(subTTD.actualValue).toBe(93.64);
      expect(subTTD.countValue).toBe(1483925);
      expect(subTTD.polarity).toBe('positive');
      expect(subTTD.denominatorCol).toBeUndefined(); // Tidak ada kolom sasaran

      const subAnemia = cat1.subCategories.find((s) => s.numeratorCol.includes('anemia'))!;
      expect(subAnemia).toBeDefined();
      expect(subAnemia.targetCurrentYear).toBe(23); // '≤23' dibersihkan ke 23
      expect(subAnemia.actualValue).toBe(15.21);
      expect(subAnemia.countValue).toBe(88202);
      expect(subAnemia.polarity).toBe('negative'); // Terdeteksi polaritas negatif

      // Cat 2 (Balita) harus memuat D/S
      expect(cat2.subCategories.length).toBe(1);
      const subDS = cat2.subCategories[0];
      expect(subDS.numeratorCol).toBe('% D/S');
      expect(subDS.targetCurrentYear).toBe(90);
      expect(subDS.actualValue).toBe(96.13);

      // User dapat memindahkan indikator ke kategori lain
      component.moveSubCategoryToCategory('cat-1', subTTD.id, 'cat-2');
      expect(component.categories().find((c) => c.id === 'cat-1')!.subCategories.length).toBe(1);
      expect(component.categories().find((c) => c.id === 'cat-2')!.subCategories.length).toBe(2);

      // User dapat memasukkan capaian dan target tahun sebelumnya
      component.updateSubCategory('cat-2', subTTD.id, {
        actualPrevYear: 88,
        targetPrevYear: 65,
      });
      const updatedSubTTD = component.categories().find((c) => c.id === 'cat-2')!.subCategories.find((s) => s.id === subTTD.id)!;
      expect(updatedSubTTD.actualPrevYear).toBe(88);
      expect(updatedSubTTD.targetPrevYear).toBe(65);

      // Evaluasi Step 3 dapat berjalan langsung tanpa denominator
      component.goToStep(3);
      expect(component.activeStep()).toBe(3);
      const res = component.evaluationResult();
      expect(res).not.toBeNull();
      expect(res?.rows.length).toBe(3);
    });

    it('should have showDataSourceAndPreview false by default and toggle correctly', () => {
      expect(component.showDataSourceAndPreview()).toBe(false);
      component.toggleDataSourceAndPreview();
      expect(component.showDataSourceAndPreview()).toBe(true);
      component.toggleDataSourceAndPreview();
      expect(component.showDataSourceAndPreview()).toBe(false);
    });

    it('should toggle preview table expanded and wrap text modes', () => {
      expect(component.previewExpanded()).toBe(false);
      component.togglePreviewExpanded();
      expect(component.previewExpanded()).toBe(true);
      component.togglePreviewExpanded();
      expect(component.previewExpanded()).toBe(false);

      expect(component.previewWrapText()).toBe(true);
      component.togglePreviewWrapText();
      expect(component.previewWrapText()).toBe(false);
      component.togglePreviewWrapText();
      expect(component.previewWrapText()).toBe(true);
    });

    it('should load transferred data from HealthDataExchange upon init', () => {
      healthDataExchange.setStuntingData({
        title: 'Hasil Join Excel Terkini',
        source: 'join',
        keyColumn: 'Kabupaten/Kota',
        columns: ['Kabupaten/Kota', 'Persentase Remaja TTD %', 'Jumlah Remaja'],
        rows: [
          { 'Kabupaten/Kota': 'KABUPATEN CILACAP', 'Persentase Remaja TTD %': 80, 'Jumlah Remaja': 1200 },
          { 'Kabupaten/Kota': 'KABUPATEN BANYUMAS', 'Persentase Remaja TTD %': 85, 'Jumlah Remaja': 1400 },
        ],
        summaryRow: { 'Kabupaten/Kota': 'PROVINSI JAWA TENGAH', 'Persentase Remaja TTD %': 82.5, 'Jumlah Remaja': 2600 },
        targetRow: { 'Kabupaten/Kota': 'TARGET', 'Persentase Remaja TTD %': '>= 75', 'Jumlah Remaja': 2500 },
      });

      component.ngOnInit();

      expect(component.joinedRows().length).toBe(4);
      expect(component.calculationDataSource()).toBe('summary_row');
      expect(component.validJoinedRows().length).toBe(1); // Mode 'summary_row' mengevaluasi baris rekap
      component.onDataSourceModeChange('all_rows');
      expect(component.validJoinedRows().length).toBe(2); // Mode 'all_rows' mengevaluasi baris wilayah aktif
      expect(component.summaryRowData()).not.toBeNull();
      expect(component.targetRowData()).not.toBeNull();
      expect(component.notificationMessage()).toContain('Data hasil join berhasil dimuat');

      // Test clearFile resets all
      component.clearFile();
      expect(component.joinedRows().length).toBe(0);
      expect(component.summaryRowData()).toBeNull();
      expect(component.targetRowData()).toBeNull();
    });

    it('should support Hasil Join paired SUM and MEAN columns workflow with manual previous year inputs and single quarter format matching capaian intervensi spesifik', () => {
      healthDataExchange.setStuntingData({
        title: 'Hasil Join Excel Terkini',
        source: 'join',
        keyColumn: 'Kabupaten/Kota',
        columns: ['Kabupaten/Kota', 'Rematri  Konsumsi TTD', '% Konsumsi TTD', 'Rematri Skrining Anemia', '% Skrining Anemia'],
        rows: [
          { 'Kabupaten/Kota': 'KABUPATEN CILACAP', 'Rematri  Konsumsi TTD': 600000, '% Konsumsi TTD': 92, 'Rematri Skrining Anemia': 250000, '% Skrining Anemia': 91 },
          { 'Kabupaten/Kota': 'KABUPATEN BANYUMAS', 'Rematri  Konsumsi TTD': 883925, '% Konsumsi TTD': 95.28, 'Rematri Skrining Anemia': 329995, '% Skrining Anemia': 96.52 },
        ],
        summaryRow: { 'Kabupaten/Kota': 'Jumlah', 'Rematri  Konsumsi TTD': 1483925, '% Konsumsi TTD': 93.64, 'Rematri Skrining Anemia': 579995, '% Skrining Anemia': 93.76 },
        targetRow: { 'Kabupaten/Kota': 'Target', 'Rematri  Konsumsi TTD': '-', '% Konsumsi TTD': '>= 67', 'Rematri Skrining Anemia': '-', '% Skrining Anemia': '>= 77' },
      });

      component.ngOnInit();
      expect(component.canProceedToStep2()).toBe(true);

      // Navigate to Step 2
      component.goToStep(2);
      expect(component.activeStep()).toBe(2);

      // Configure subcategory with standard No, sumCol, meanCol, and manual previous year values
      const cat = component.categories()[0];
      component.addSubCategory(cat.id);
      const sub = component.categories().find((c) => c.id === cat.id)!.subCategories[0];

      component.updateSubCategory(cat.id, sub.id, {
        no: '2',
        name: 'Remaja putri mengonsumsi TTD (tablet tambah darah)',
        targetCurrentYear: 67,
        targetPrevYear: 65,
        actualPrevYear: 89.34,
      });
      component.onSumColChange(cat.id, sub.id, 'Rematri  Konsumsi TTD');
      component.onMeanColChange(cat.id, sub.id, '% Konsumsi TTD');

      const updatedSub = component.categories().find((c) => c.id === cat.id)!.subCategories[0];
      expect(updatedSub.no).toBe('2');
      expect(updatedSub.sumCol).toBe('Rematri  Konsumsi TTD');
      expect(updatedSub.meanCol).toBe('% Konsumsi TTD');
      expect(updatedSub.targetPrevYear).toBe(65);
      expect(updatedSub.actualPrevYear).toBe(89.34);
      expect(updatedSub.targetCurrentYear).toBe(67);

      // Verify live stats
      const liveStats = component.getSubCategoryLiveStats(updatedSub);
      expect(liveStats.sumNum).toBe(1483925);
      expect(liveStats.actualPercentage).toBe(93.64);

      // Verify live status badge is On Track (93.64% >= 67%)
      const badge = component.getInitialStatusBadge(updatedSub);
      expect(badge.label).toBe('On Track');

      // Navigate to Step 3
      component.goToStep(3);
      expect(component.activeStep()).toBe(3);
      fixture.detectChanges();

      const tableEl: HTMLElement = fixture.nativeElement.querySelector('table');
      expect(tableEl).toBeTruthy();
      const text = tableEl.textContent || '';

      // Standard headers matching Format Analisas Intervensi Spesifik (without redundant Pengkategorian column)
      expect(text).not.toContain('Pengkategorian');
      expect(text).toContain('No');
      expect(text).toContain('Intervensi Percepatan Penurunan Stunting');
      expect(text).toContain('Target Tahun Lalu');
      expect(text).toContain('Capaian Tahun Lalu');
      expect(text).toContain('Target Tahun Ini');
      expect(text).toContain('Jumlah');
      expect(text).toContain('Capaian (%)');
      expect(text).toContain('Status');

      // Check evaluated row values
      expect(text).toContain('65%');
      expect(text).toContain('89.34%');
      expect(text).toContain('67%');
      expect(text).toContain('1,483,925');
      expect(text).toContain('93.64%');
      expect(text).toContain('On Track');
    });

    it('should automatically detect Hasil Join Excel structure, separate Jumlah, Rata-rata, and Target rows, and auto-populate all standard indicators', () => {
      // Build mock worksheet matching Hasil_Join_Excel_2026-10-15.xlsx
      const ws: any = {
        '!ref': 'A1:D39',
        A1: { v: 'No' },
        B1: { v: 'Kabupaten/Kota' },
        C1: { v: 'Rematri  Konsumsi TTD' },
        D1: { v: '% Konsumsi TTD' },
      };

      // 35 districts (rows 2 to 36)
      for (let i = 1; i <= 35; i++) {
        const row = i + 1;
        ws[`A${row}`] = { v: i };
        ws[`B${row}`] = { v: `KABUPATEN WILAYAH ${i}` };
        ws[`C${row}`] = { v: 1000 * i };
        ws[`D${row}`] = { v: 70 + (i % 25) };
      }

      // Row 37: Jumlah
      ws['A37'] = { v: '-' };
      ws['B37'] = { v: 'Jumlah' };
      ws['C37'] = { v: 1483925 };
      ws['D37'] = { v: '-' };

      // Row 38: Rata-rata
      ws['A38'] = { v: '-' };
      ws['B38'] = { v: 'Rata-rata' };
      ws['C38'] = { v: '-' };
      ws['D38'] = { v: 94.57 };

      // Row 39: Target
      ws['A39'] = { v: '-' };
      ws['B39'] = { v: 'Target' };
      ws['C39'] = { v: '-' };
      ws['D39'] = { v: '>= 67' };

      const mockWb: any = {
        SheetNames: ['Hasil Join'],
        Sheets: {
          'Hasil Join': ws,
        },
      };

      component.workbook = mockWb;
      component.file.set(new File([], 'Hasil_Join_Excel_2026-10-15.xlsx'));
      component.selectPrimarySheet('Hasil Join');

      // Verify format detection
      expect(component.isHasilJoinFormat()).toBe(true);
      expect(component.primaryKeyCol()).toBe('Kabupaten/Kota');
      expect(component.joinedRows().length).toBe(38); // 35 districts + Jumlah + Rata-rata + Target

      // Verify separation of rows
      expect(component.totalRowData()).not.toBeNull();
      expect(component.totalRowData()!['Kabupaten/Kota']).toBe('Jumlah');
      expect(component.summaryRowData()).not.toBeNull();
      expect(component.summaryRowData()!['Kabupaten/Kota']).toBe('Rata-rata');
      expect(component.targetRowData()).not.toBeNull();
      expect(component.targetRowData()!['Kabupaten/Kota']).toBe('Target');

      // Active region rows must be exactly the 35 districts
      expect(component.activeRegionRows().length).toBe(35);
      expect(component.calculationDataSource()).toBe('summary_row');
      expect(component.validJoinedRows().length).toBe(1); // summary row mode evaluates summary row directly

      // Verify auto-populated indicator
      const cat1 = component.categories().find((c) => c.id === 'cat-1')!;
      const sub = cat1.subCategories[0];
      expect(sub).toBeDefined();
      expect(sub.name).toContain('TTD');
      expect(sub.actualValue).toBe(94.57); // from Rata-rata
      expect(sub.countValue).toBe(1483925); // from Jumlah
      expect(sub.targetCurrentYear).toBe(67); // cleaned from '>= 67'

      // Verify exports include all 35 active districts
      const exportSpy = vi.spyOn(StuntingExcelExporter, 'exportJoinedData').mockReturnValue('Hasil_Export.xlsx');
      exportSpy.mockClear();
      component.exportJoinedData();
      expect(exportSpy).toHaveBeenCalledTimes(1);
      expect(exportSpy.mock.calls[0][0].rows.length).toBe(35);

      const reportSpy = vi.spyOn(StuntingExcelExporter, 'exportMonitoringReport').mockReturnValue('Report_Export.xlsx');
      reportSpy.mockClear();
      component.exportExcel();
      expect(reportSpy).toHaveBeenCalledTimes(1);
      expect(reportSpy.mock.calls[0][0].validJoinedRows!.length).toBe(35);
    });

    it('should allow selecting columns per specific Triwulan (TW 1 - TW 4) and support copying/clearing configurations', () => {
      component.categories.set([
        {
          id: 'cat-test',
          name: 'Intervensi Rematri',
          subCategories: [
            {
              id: 'sub-test',
              name: 'Rematri Skrining',
              numeratorCol: '',
              dataCol: '',
              targetCurrentYear: 80,
              calculationMode: 'percentage',
            },
          ],
        },
      ]);

      const catId = 'cat-test';
      const subId = 'sub-test';
      const sub = () => component.categories()[0].subCategories[0];

      // Initially, no quarter config
      expect(component.hasQuarterConfig(sub(), 1)).toBe(false);
      expect(component.hasQuarterConfig(sub(), 2)).toBe(false);

      // 1. Map columns for TW 1
      component.onQuarterSumColChange(catId, subId, 1, 'TW1_Kasus');
      component.onQuarterMeanColChange(catId, subId, 1, 'TW1_Persen');

      expect(component.hasQuarterConfig(sub(), 1)).toBe(true);
      expect(component.getQuarterSumCol(sub(), 1)).toBe('TW1_Kasus');
      expect(component.getQuarterMeanCol(sub(), 1)).toBe('TW1_Persen');

      // TW 2, 3, 4 should still be unconfigured
      expect(component.hasQuarterConfig(sub(), 2)).toBe(false);
      expect(component.hasQuarterConfig(sub(), 3)).toBe(false);
      expect(component.hasQuarterConfig(sub(), 4)).toBe(false);

      // 2. Map columns for TW 2
      component.onQuarterSumColChange(catId, subId, 2, 'TW2_Kasus');
      component.onQuarterMeanColChange(catId, subId, 2, 'TW2_Persen');

      expect(component.hasQuarterConfig(sub(), 2)).toBe(true);
      expect(component.getQuarterSumCol(sub(), 2)).toBe('TW2_Kasus');
      expect(component.getQuarterMeanCol(sub(), 2)).toBe('TW2_Persen');

      // 3. Test copyQuarterToAll: copy TW 1 to all quarters
      component.copyQuarterToAll(catId, subId, 1);
      for (const q of [1, 2, 3, 4] as const) {
        expect(component.hasQuarterConfig(sub(), q)).toBe(true);
        expect(component.getQuarterSumCol(sub(), q)).toBe('TW1_Kasus');
        expect(component.getQuarterMeanCol(sub(), q)).toBe('TW1_Persen');
      }

      // 4. Test clearQuarterConfig: clear TW 4
      component.clearQuarterConfig(catId, subId, 4);
      expect(component.hasQuarterConfig(sub(), 4)).toBe(false);
      expect(component.getQuarterSumCol(sub(), 4)).toBe('');
      expect(component.getQuarterMeanCol(sub(), 4)).toBe('');
      expect(component.hasQuarterConfig(sub(), 1)).toBe(true);

      // 5. Test setAllSubActiveQuarter
      component.setAllSubActiveQuarter(3);
      expect(component.activeQuarter()).toBe(3);
      expect(component.getSubActiveQuarter(subId)).toBe(3);
    });
  });

  describe('Multi-Quarter Cloud and Incomplete Data Handling', () => {
    let gasStorageService: GasStorageService;

    beforeEach(() => {
      gasStorageService = TestBed.inject(GasStorageService);
    });

    it('should fetch period slots from GasStorageService on init if configured and update period slots', async () => {
      vi.spyOn(gasStorageService, 'isConfigured').mockReturnValue(true);
      vi.spyOn(gasStorageService, 'listPeriods').mockResolvedValue({
        success: true,
        periods: [
          { year: 2026, quarter: 'TW2', hasRaw: true, hasResult: true, hasConfig: true },
          { year: 2026, quarter: 'TW3', hasRaw: true, hasResult: true, hasConfig: true },
          { year: 2025, quarter: 'TW1', hasRaw: true, hasResult: true, hasConfig: true },
        ],
      });

      await component.fetchPeriodSlots();

      expect(component.periodSlots().length).toBe(3);
      expect(component.isQuarterAvailableInCloud(2026, 'TW2')).toBe(true);
      expect(component.isQuarterAvailableInCloud(2026, 'TW1')).toBe(false);
      expect(component.selectedQuarterSlots()['TW2']).toBe(true);
      expect(component.selectedQuarterSlots()['TW3']).toBe(true);
      expect(component.selectedQuarterSlots()['TW1']).toBe(false);
    });

    it('should initialize and load period slots from BackendStorageService when GAS is disabled', async () => {
      vi.spyOn(gasStorageService, 'isConfigured').mockReturnValue(false);
      const gasListSpy = vi.spyOn(gasStorageService, 'listPeriods');
      gasListSpy.mockClear();

      const backendStorage = TestBed.inject(BackendStorageService);
      vi.spyOn(backendStorage, 'isConfigured').mockReturnValue(true);
      vi.spyOn(backendStorage, 'listPeriods').mockResolvedValue({
        success: true,
        periods: [
          { year: 2026, quarter: 'TW1', hasRaw: true, hasResult: true, hasConfig: true },
        ],
      });

      expect(component.hasAnyGasConfigured()).toBe(true);

      await component.ngOnInit();

      expect(component.periodSlots()).toHaveLength(1);
      expect(component.isQuarterAvailableInCloud(2026, 'TW1')).toBe(true);
      expect(gasListSpy).not.toHaveBeenCalled();
    });

    it('should update quarter slots selection when selectedYear changes', () => {
      component.periodSlots.set([
        { year: 2026, quarter: 'TW2', hasRaw: true, hasResult: true, hasConfig: true },
        { year: 2025, quarter: 'TW1', hasRaw: true, hasResult: true, hasConfig: true },
      ]);

      component.onYearChange(2025);
      expect(component.selectedYear()).toBe(2025);
      expect(component.selectedQuarterSlots()['TW1']).toBe(true);
      expect(component.selectedQuarterSlots()['TW2']).toBe(false);

      component.onYearChange(2026);
      expect(component.selectedYear()).toBe(2026);
      expect(component.selectedQuarterSlots()['TW1']).toBe(false);
      expect(component.selectedQuarterSlots()['TW2']).toBe(true);
    });

    it('should allow toggling quarter selection and attaching/removing local file per quarter slot', () => {
      component.selectedQuarterSlots.set({ TW1: false, TW2: false, TW3: false, TW4: false });
      component.toggleQuarterSlot('TW1');
      expect(component.selectedQuarterSlots()['TW1']).toBe(true);

      const fakeFile = new File(['mock content'], 'tw1_substitute.xlsx');
      const fakeEvent = {
        target: {
          files: [fakeFile],
          value: '',
        },
      } as unknown as Event;

      component.onQuarterLocalFileSelected('TW1', fakeEvent);
      expect(component.quarterLocalFiles()['TW1']).toBe(fakeFile);
      expect(component.selectedQuarterSlots()['TW1']).toBe(true);

      component.removeQuarterLocalFile('TW1');
      expect(component.quarterLocalFiles()['TW1']).toBeUndefined();
    });

    it('should handle loading multi-quarter data from GAS when TW1 is missing (e.g. only TW2 and TW3 available)', async () => {
      const q2Data = [
        { 'Kabupaten/Kota': 'KABUPATEN BANYUMAS', '% Konsumsi TTD': 70, 'Rematri  Konsumsi TTD': 100 },
        { 'Kabupaten/Kota': 'KABUPATEN CILACAP', '% Konsumsi TTD': 75, 'Rematri  Konsumsi TTD': 120 },
        { 'Kabupaten/Kota': 'PROVINSI JAWA TENGAH', '% Konsumsi TTD': 72.5, 'Rematri  Konsumsi TTD': 220 },
        { 'Kabupaten/Kota': 'TARGET', '% Konsumsi TTD': 67 },
      ];
      const q3Data = [
        { 'Kabupaten/Kota': 'KABUPATEN BANYUMAS', '% Konsumsi TTD': 80, 'Rematri  Konsumsi TTD': 110 },
        { 'Kabupaten/Kota': 'KABUPATEN CILACAP', '% Konsumsi TTD': 85, 'Rematri  Konsumsi TTD': 130 },
        { 'Kabupaten/Kota': 'PROVINSI JAWA TENGAH', '% Konsumsi TTD': 82.5, 'Rematri  Konsumsi TTD': 240 },
        { 'Kabupaten/Kota': 'TARGET', '% Konsumsi TTD': 67 },
      ];

      const ws2 = XLSX.utils.json_to_sheet(q2Data);
      const wb2 = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb2, ws2, 'Hasil Join');
      const buffer2 = XLSX.write(wb2, { type: 'array', bookType: 'xlsx' });

      const ws3 = XLSX.utils.json_to_sheet(q3Data);
      const wb3 = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb3, ws3, 'Hasil Join');
      const buffer3 = XLSX.write(wb3, { type: 'array', bookType: 'xlsx' });

      component.periodSlots.set([
        { year: 2026, quarter: 'TW2', hasRaw: true, hasResult: true, hasConfig: true },
        { year: 2026, quarter: 'TW3', hasRaw: true, hasResult: true, hasConfig: true },
      ]);
      component.selectedYear.set(2026);
      component.selectedQuarterSlots.set({ TW1: false, TW2: true, TW3: true, TW4: false });

      vi.spyOn(gasStorageService, 'loadPeriod').mockImplementation(async (year: number, quarter: string) => {
        if (quarter === 'TW2') {
          return { success: true, hasData: true, rawExcelBuffer: buffer2, fileName: '2026_TW2.xlsx' };
        }
        if (quarter === 'TW3') {
          return { success: true, hasData: true, rawExcelBuffer: buffer3, fileName: '2026_TW3.xlsx' };
        }
        return { success: false, hasData: false };
      });

      await component.loadMultiQuarterFromCloud();

      expect(component.isMultiQuarterCloudMode()).toBe(true);
      expect(component.activeRegionRows().length).toBe(2);
      expect(component.cloudLoadNotice()).toContain('TW 1');
      expect(component.cloudLoadNotice()).toContain('belum disertakan');

      // Check availableQuarters
      const res = component.evaluationResult();
      expect(res).not.toBeNull();
      expect(res!.availableQuarters).toEqual([2, 3]);
      expect(component.activeQuarter()).toBe(3);

      // Verify row data for standard indicator Remaja putri mengonsumsi TTD
      const indRow = res!.rows.find((r) => r.name.includes('TTD'));
      expect(indRow).toBeDefined();
      expect(indRow!.no).toBe('2');
      expect(indRow!.category).toContain('Intervensi untuk remaja putri dan ibu hamil');
      expect(indRow!.targetPrevYear).toBe(65);
      expect(indRow!.actualPrevYear).toBe(89.34);
      expect(indRow!.quarters[1].hasData).toBe(false);
      expect(indRow!.quarters[1].actualAchievement).toBeNull();
      expect(indRow!.quarters[2].hasData).toBe(true);
      expect(indRow!.quarters[2].actualAchievement).toBe(72.5);
      expect(indRow!.quarters[3].hasData).toBe(true);
      expect(indRow!.quarters[3].actualAchievement).toBe(82.5);
    });

    it('should support merging local file for missing TW1 with cloud quarters for TW2', async () => {
      const q1Data = [
        { 'Kabupaten/Kota': 'KABUPATEN BANYUMAS', '% Konsumsi TTD': 65, 'Rematri  Konsumsi TTD': 90 },
        { 'Kabupaten/Kota': 'PROVINSI JAWA TENGAH', '% Konsumsi TTD': 65, 'Rematri  Konsumsi TTD': 90 },
        { 'Kabupaten/Kota': 'TARGET', '% Konsumsi TTD': 67 },
      ];
      const q2Data = [
        { 'Kabupaten/Kota': 'KABUPATEN BANYUMAS', '% Konsumsi TTD': 72, 'Rematri  Konsumsi TTD': 100 },
        { 'Kabupaten/Kota': 'PROVINSI JAWA TENGAH', '% Konsumsi TTD': 72, 'Rematri  Konsumsi TTD': 100 },
        { 'Kabupaten/Kota': 'TARGET', '% Konsumsi TTD': 67 },
      ];

      const ws1 = XLSX.utils.json_to_sheet(q1Data);
      const wb1 = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb1, ws1, 'Hasil Join');
      const buffer1 = XLSX.write(wb1, { type: 'array', bookType: 'xlsx' });

      const ws2 = XLSX.utils.json_to_sheet(q2Data);
      const wb2 = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb2, ws2, 'Hasil Join');
      const buffer2 = XLSX.write(wb2, { type: 'array', bookType: 'xlsx' });

      const localFileTW1 = new File([buffer1], 'manual_TW1.xlsx');
      component.quarterLocalFiles.set({ TW1: localFileTW1 });

      component.periodSlots.set([
        { year: 2026, quarter: 'TW2', hasRaw: true, hasResult: true, hasConfig: true },
      ]);
      component.selectedYear.set(2026);
      component.selectedQuarterSlots.set({ TW1: true, TW2: true, TW3: false, TW4: false });

      vi.spyOn(gasStorageService, 'loadPeriod').mockImplementation(async (year: number, quarter: string) => {
        if (quarter === 'TW2') {
          return { success: true, hasData: true, rawExcelBuffer: buffer2, fileName: '2026_TW2.xlsx' };
        }
        return { success: false, hasData: false };
      });

      await component.loadMultiQuarterFromCloud();

      expect(component.isMultiQuarterCloudMode()).toBe(true);
      const res = component.evaluationResult();
      expect(res).not.toBeNull();
      expect(res!.availableQuarters).toEqual([1, 2]);
      expect(component.activeQuarter()).toBe(2);

      const indRow = res!.rows.find((r) => r.name.includes('TTD'));
      expect(indRow).toBeDefined();
      expect(indRow!.no).toBe('2');
      expect(indRow!.targetPrevYear).toBe(65);
      expect(indRow!.actualPrevYear).toBe(89.34);
      expect(indRow!.quarters[1].hasData).toBe(true);
      expect(indRow!.quarters[1].actualAchievement).toBe(65);
      expect(indRow!.quarters[2].hasData).toBe(true);
      expect(indRow!.quarters[2].actualAchievement).toBe(72);
    });

    it('membawa konfigurasi preset dari Google Drive saat memuat data multi-triwulan dan mengaitkan kategori otomatis', async () => {
      const q1Data = [
        { 'Kabupaten/Kota': 'KABUPATEN BANYUMAS', '% Skrining Anemia': 80, 'Rematri Skrining Anemia': 200, '% ANC 6x': 75, 'Ibu Hamil ANC 6x': 150 },
        { 'Kabupaten/Kota': 'KABUPATEN CILACAP', '% Skrining Anemia': 85, 'Rematri Skrining Anemia': 220, '% ANC 6x': 78, 'Ibu Hamil ANC 6x': 160 },
        { 'Kabupaten/Kota': 'Rata-rata', '% Skrining Anemia': 82.5, 'Rematri Skrining Anemia': 420, '% ANC 6x': 76.5, 'Ibu Hamil ANC 6x': 310 },
      ];

      const ws1 = XLSX.utils.json_to_sheet(q1Data);
      const wb1 = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb1, ws1, 'Hasil Join');
      const buffer1 = XLSX.write(wb1, { type: 'array', bookType: 'xlsx' });

      component.periodSlots.set([
        { year: 2026, quarter: 'TW1', hasRaw: true, hasResult: true, hasConfig: true },
      ]);
      component.selectedYear.set(2026);
      component.selectedQuarterSlots.set({ TW1: true, TW2: false, TW3: false, TW4: false });

      const driveConfig = {
        columnTargets: {
          '% Skrining Anemia': { enabled: true, operator: '>=', value: 77 },
          '% ANC 6x': { enabled: true, operator: '>=', value: 60 },
        },
      };

      vi.spyOn(gasStorageService, 'loadPeriod').mockResolvedValue({
        success: true,
        hasData: true,
        resultExcelBuffer: buffer1,
        fileName: 'joined-result.xlsx',
        config: driveConfig,
      });

      await component.loadMultiQuarterFromCloud();

      expect(component.isMultiQuarterCloudMode()).toBe(true);
      expect(component.joinedRows().length).toBeGreaterThan(0);

      // Kategori harus langsung terisi otomatis
      expect(component.categories().length).toBeGreaterThan(0);
      const cat1 = component.categories().find((c) => (c.name || '').toLowerCase().includes('sebelum kelahiran') || (c.name || '').toLowerCase().includes('remaja'));
      expect(cat1).toBeDefined();

      const anemiaSub = cat1!.subCategories.find((s) => (s.name || '').toLowerCase().includes('anemia') || (s.name || '').toLowerCase().includes('skrining'));
      expect(anemiaSub).toBeDefined();
      expect(anemiaSub!.targetCurrentYear).toBe(77);

      const ancSub = cat1!.subCategories.find((s) => (s.name || '').toLowerCase().includes('anc'));
      expect(ancSub).toBeDefined();
      expect(ancSub!.targetCurrentYear).toBe(60);
    });

    it('menjalankan executeJoinFromPreset ketika berkas mentah multi-sheet dimuat bersama konfigurasi', async () => {
      // Buat workbook multi-sheet sintesis
      const wb = XLSX.utils.book_new();
      const wsRemaja = XLSX.utils.aoa_to_sheet([
        ['No', 'Kabupaten/Kota', 'Persentase remaja putri skrining anemia - % (3)'],
        [1, 'KABUPATEN BANYUMAS', 88.5],
        [2, 'KABUPATEN CILACAP', 91.2],
      ]);
      XLSX.utils.book_append_sheet(wb, wsRemaja, 'remaja');

      const wsBumil = XLSX.utils.aoa_to_sheet([
        ['No', 'Kabupaten/Kota', 'Laporan Pemeriksaan ANC - % K6'],
        [1, 'KABUPATEN BANYUMAS', 65.0],
        [2, 'KABUPATEN CILACAP', 70.0],
      ]);
      XLSX.utils.book_append_sheet(wb, wsBumil, 'BUMIL');

      const rawBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      component.periodSlots.set([
        { year: 2026, quarter: 'TW1', hasRaw: true, hasResult: false, hasConfig: true },
      ]);
      component.selectedYear.set(2026);
      component.selectedQuarterSlots.set({ TW1: true, TW2: false, TW3: false, TW4: false });

      const presetConfig = {
        sheets: [
          { sheetName: 'remaja', joinColumn: 'Kabupaten/Kota', variables: ['Persentase remaja putri skrining anemia - % (3)'] },
          { sheetName: 'BUMIL', joinColumn: 'Kabupaten/Kota', variables: ['Laporan Pemeriksaan ANC - % K6'] },
        ],
        joinBy: 'Kabupaten/Kota',
        customColumnNames: {
          'Persentase remaja putri skrining anemia - % (3)': '% Skrining Anemia',
          'Laporan Pemeriksaan ANC - % K6': '% ANC 6x',
        },
        columnTargets: {
          '% Skrining Anemia': { enabled: true, operator: '>=', value: 77 },
          '% ANC 6x': { enabled: true, operator: '>=', value: 60 },
        },
      };

      vi.spyOn(gasStorageService, 'loadPeriod').mockResolvedValue({
        success: true,
        hasData: true,
        rawExcelBuffer: rawBuffer,
        fileName: 'raw-data.xlsx',
        config: presetConfig,
      });

      await component.loadMultiQuarterFromCloud();

      expect(component.isMultiQuarterCloudMode()).toBe(true);
      expect(component.joinedColumns()).toContain('% Skrining Anemia');
      expect(component.joinedColumns()).toContain('% ANC 6x');
      expect(component.activeRegionRows().length).toBe(2);

      const cat1 = component.categories().find((c) => (c.name || '').toLowerCase().includes('sebelum kelahiran') || (c.name || '').toLowerCase().includes('remaja'));
      expect(cat1).toBeDefined();
      const anemiaSub = cat1!.subCategories.find((s) => (s.name || '').toLowerCase().includes('anemia') || (s.name || '').toLowerCase().includes('skrining'));
      expect(anemiaSub).toBeDefined();
      expect(anemiaSub!.targetCurrentYear).toBe(77);
    });

    it('berhasil memuat indikator dari data saat hanya memilih 1 triwulan (misal TW2)', async () => {
      const q2Data = [
        { 'Kabupaten/Kota': 'KABUPATEN BANYUMAS', '% Konsumsi TTD': 72.5, 'Rematri  Konsumsi TTD': 100 },
        { 'Kabupaten/Kota': 'KABUPATEN CILACAP', '% Konsumsi TTD': 78.0, 'Rematri  Konsumsi TTD': 110 },
        { 'Kabupaten/Kota': 'PROVINSI JAWA TENGAH', '% Konsumsi TTD': 75.0, 'Rematri  Konsumsi TTD': 210 },
        { 'Kabupaten/Kota': 'TARGET', '% Konsumsi TTD': 67 },
      ];

      const ws = XLSX.utils.json_to_sheet(q2Data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Hasil Join');
      const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      component.periodSlots.set([
        { year: 2026, quarter: 'TW2', hasRaw: true, hasResult: true, hasConfig: true },
      ]);
      component.selectedYear.set(2026);
      component.selectedQuarterSlots.set({ TW1: false, TW2: true, TW3: false, TW4: false });

      vi.spyOn(gasStorageService, 'loadPeriod').mockImplementation(async (year: number, quarter: string) => {
        if (quarter === 'TW2') {
          return { success: true, hasData: true, rawExcelBuffer: buffer, fileName: '2026_TW2.xlsx' };
        }
        return { success: false, hasData: false };
      });

      await component.loadMultiQuarterFromCloud();

      expect(component.isMultiQuarterCloudMode()).toBe(true);
      expect(component.activeQuarter()).toBe(2);
      expect(component.canProceedToStep3()).toBe(true);

      const res = component.evaluationResult();
      expect(res).not.toBeNull();
      expect(res!.availableQuarters).toEqual([2]);

      const ttdRow = res!.rows.find((r) => r.name.includes('TTD'));
      expect(ttdRow).toBeDefined();
      expect(ttdRow!.quarters[2].hasData).toBe(true);
      expect(ttdRow!.quarters[2].actualAchievement).toBe(75.0);
      expect(ttdRow!.quarters[1].hasData).toBe(false);

      // Verify clicking autoPopulateIndicatorsFromData again works seamlessly in single quarter mode
      component.autoPopulateIndicatorsFromData();
      expect(component.canProceedToStep3()).toBe(true);
      const cat1 = component.categories().find((c) => (c.name || '').includes('sebelum kelahiran') || (c.name || '').includes('remaja'));
      expect(cat1).toBeDefined();
      const ttdSub = cat1!.subCategories.find((s) => (s.name || '').includes('TTD'));
      expect(ttdSub).toBeDefined();
      expect(ttdSub!.quarterColumns?.[2]).toBeDefined();
      expect(ttdSub!.quarterColumns?.[2]?.meanCol).toBe('% Konsumsi TTD');
    });
  });

  describe('Regional Performance Evaluation (Kabupaten/Kota) in Step 3', () => {
    it('should render comparative matrix and support sorting, view mode toggle, and drilldown drawer', async () => {
      // Setup dataset with 2 regencies
      component.workflowEngine.setJoinedDataset({
        rows: [
          {
            __id: 'row-0',
            'Kabupaten/Kota': 'Kabupaten Cilacap',
            'Sasaran K4': 100,
            'Realisasi K4': 50,
          },
          {
            __id: 'row-1',
            'Kabupaten/Kota': 'Kabupaten Banyumas',
            'Sasaran K4': 100,
            'Realisasi K4': 95,
          },
        ],
        columns: ['Kabupaten/Kota', 'Sasaran K4', 'Realisasi K4'],
      });

      const cat1 = component.categories()[0];
      component.workflowEngine.addSubCategory(cat1.id, {
        name: 'Cakupan K4',
        numeratorCol: 'Realisasi K4',
        denominatorCol: 'Sasaran K4',
        targetCurrentYear: 90,
      });

      component.goToStep(3);
      fixture.detectChanges();

      // Check regional scorecards computation
      const regional = component.regionalScorecards();
      expect(regional.length).toBe(2);
      expect(regional[0].regionName).toBe('Kabupaten Cilacap'); // Needs acceleration first

      // Toggle sort by name
      component.toggleRegionalSort('name');
      expect(component.regionalSortBy()).toBe('name');
      expect(component.regionalSortDirection()).toBe('asc');
      expect(component.regionalScorecards()[0].regionName).toBe('Kabupaten Banyumas');

      // Toggle matrix view mode to single_indicator
      component.setMatrixViewMode('single_indicator');
      expect(component.matrixViewMode()).toBe('single_indicator');
      expect(component.selectedMatrixIndicatorId()).toBeDefined();

      // Open drilldown drawer
      expect(component.activeRegionalDrilldownScorecard()).toBeNull();
      component.openRegionalDrilldown('row-0');
      fixture.detectChanges();

      expect(component.activeRegionalDrilldownScorecard()).not.toBeNull();
      expect(component.activeRegionalDrilldownScorecard()?.regionName).toBe('Kabupaten Cilacap');

      // Close drilldown drawer
      component.closeRegionalDrilldown();
      fixture.detectChanges();
      expect(component.activeRegionalDrilldownScorecard()).toBeNull();

      // Test Escape key dismissal
      component.openRegionalDrilldown('row-1');
      fixture.detectChanges();
      expect(component.activeRegionalDrilldownScorecard()).not.toBeNull();
      component.handleEscapeKey();
      fixture.detectChanges();
      expect(component.activeRegionalDrilldownScorecard()).toBeNull();

      // Test status filter
      component.setMatrixStatusFilter('perlu_percepatan');
      expect(component.regionalScorecards().length).toBe(1);
      expect(component.regionalScorecards()[0].regionName).toBe('Kabupaten Cilacap');

      component.setMatrixStatusFilter('on_track');
      expect(component.regionalScorecards().length).toBe(1);
      expect(component.regionalScorecards()[0].regionName).toBe('Kabupaten Banyumas');

      component.setMatrixStatusFilter('all');
      expect(component.regionalScorecards().length).toBe(2);

      // Test longitudinal quarter and YoY sorting
      component.toggleRegionalSort('quarter', component.selectedMatrixIndicatorId() ?? undefined, 1);
      expect(component.regionalSortBy()).toBe('quarter');
      expect(component.regionalSortQuarter()).toBe(1);

      component.toggleRegionalSort('yoy', component.selectedMatrixIndicatorId() ?? undefined);
      expect(component.regionalSortBy()).toBe('yoy');
    });

    it('should hide comparative matrix card when enableComparativeMatrix is false and show it when true', () => {
      component.workflowEngine.setJoinedDataset({
        rows: [
          {
            __id: 'row-0',
            'Kabupaten/Kota': 'Kabupaten Cilacap',
            'Sasaran K4': 100,
            'Realisasi K4': 50,
          },
        ],
        columns: ['Kabupaten/Kota', 'Sasaran K4', 'Realisasi K4'],
      });

      const cat1 = component.categories()[0];
      component.workflowEngine.addSubCategory(cat1.id, {
        name: 'Cakupan K4',
        numeratorCol: 'Realisasi K4',
        denominatorCol: 'Sasaran K4',
        targetCurrentYear: 90,
      });

      component.goToStep(3);
      component.enableComparativeMatrix.set(false);
      fixture.detectChanges();

      let compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('Matriks Komparasi Antar-Wilayah (Kabupaten/Kota)');

      component.enableComparativeMatrix.set(true);
      fixture.detectChanges();

      compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Matriks Komparasi Antar-Wilayah (Kabupaten/Kota)');
    });

    it('should allow switching selectedScope between province and regency to display regency-specific table', () => {
      component.workflowEngine.setJoinedDataset({
        rows: [
          {
            __id: 'row-1',
            'Kabupaten/Kota': 'Kabupaten Banyumas',
            ttd_real: 850,
            ttd_sasaran: 1000,
          },
          {
            __id: 'row-2',
            'Kabupaten/Kota': 'Kabupaten Cilacap',
            ttd_real: 500,
            ttd_sasaran: 1000,
          },
        ],
        columns: ['Kabupaten/Kota', 'ttd_real', 'ttd_sasaran'],
      });

      const cat1 = component.categories()[0];
      component.workflowEngine.addSubCategory(cat1.id, {
        name: 'Rematri TTD',
        numeratorCol: 'ttd_real',
        denominatorCol: 'ttd_sasaran',
        targetCurrentYear: 80,
        polarity: 'positive',
      });

      component.goToStep(3);
      fixture.detectChanges();

      // Initially province
      expect(component.selectedScope()).toBe('province');
      expect(component.selectedScopeLabel()).toBe('PROVINSI JAWA TENGAH (Agregat)');
      expect(component.filteredGroupedRows().length).toBeGreaterThan(0);

      // Select Banyumas
      component.setSelectedScope('row-1');
      fixture.detectChanges();

      expect(component.selectedScope()).toBe('row-1');
      expect(component.selectedScopeLabel()).toBe('Kabupaten Banyumas');
      const banyumasRows = component.filteredGroupedRows();
      expect(banyumasRows[0].rows[0].activeActual).toBe(85);
      expect(banyumasRows[0].rows[0].status).toBe('on_track');
      expect(component.onTrackCount()).toBe(1);
      expect(component.perluPercepatanCount()).toBe(0);

      // Select Cilacap
      component.setSelectedScope('row-2');
      fixture.detectChanges();

      expect(component.selectedScope()).toBe('row-2');
      expect(component.selectedScopeLabel()).toBe('Kabupaten Cilacap');
      const cilacapRows = component.filteredGroupedRows();
      expect(cilacapRows[0].rows[0].activeActual).toBe(50);
      expect(cilacapRows[0].rows[0].status).toBe('perlu_percepatan');
      expect(component.onTrackCount()).toBe(0);
      expect(component.perluPercepatanCount()).toBe(1);

      // Reset to Province
      component.setSelectedScope('province');
      fixture.detectChanges();
      expect(component.selectedScope()).toBe('province');
      expect(component.selectedScopeLabel()).toBe('PROVINSI JAWA TENGAH (Agregat)');
    });

    it('should support tableDisplayMode "all" rendering n regency tables + 1 provincial table simultaneously', () => {
      component.workflowEngine.setJoinedDataset({
        rows: [
          {
            __id: 'row-1',
            'Kabupaten/Kota': 'Kabupaten Banyumas',
            ttd_real: 850,
            ttd_sasaran: 1000,
          },
          {
            __id: 'row-2',
            'Kabupaten/Kota': 'Kabupaten Cilacap',
            ttd_real: 500,
            ttd_sasaran: 1000,
          },
        ],
        columns: ['Kabupaten/Kota', 'ttd_real', 'ttd_sasaran'],
      });

      const cat1 = component.categories()[0];
      component.workflowEngine.addSubCategory(cat1.id, {
        name: 'Rematri TTD',
        numeratorCol: 'ttd_real',
        denominatorCol: 'ttd_sasaran',
        targetCurrentYear: 80,
        polarity: 'positive',
      });

      component.goToStep(3);
      fixture.detectChanges();

      // Default mode is 'single'
      expect(component.tableDisplayMode()).toBe('single');

      // Switch to 'all' mode
      component.setTableDisplayMode('all');
      fixture.detectChanges();
      expect(component.tableDisplayMode()).toBe('all');

      // allDisplayTables must contain 1 Provincial table + 2 Regency tables = 3 tables!
      const tables = component.allDisplayTables();
      expect(tables.length).toBe(3);
      expect(tables[0].id).toBe('province');
      expect(tables[0].isProvince).toBe(true);
      expect(tables[0].label).toContain('PROVINSI JAWA TENGAH');
      expect(tables[0].groupedRows.length).toBeGreaterThan(0);

      const banyumas = tables.find((t) => t.label === 'Kabupaten Banyumas')!;
      expect(banyumas).toBeDefined();
      expect(banyumas.isProvince).toBe(false);
      expect(banyumas.groupedRows[0].rows[0].activeActual).toBe(85);

      const cilacap = tables.find((t) => t.label === 'Kabupaten Cilacap')!;
      expect(cilacap).toBeDefined();
      expect(cilacap.isProvince).toBe(false);
      expect(cilacap.groupedRows[0].rows[0].activeActual).toBe(50);
    });
  });

  describe('Stage 2: Deriving Previous Year Target & Achievements from Preceding Year TW4', () => {
    it('should derive targetPrevYear and actualPrevYear from TW4 of preceding year when available', async () => {
      component.selectedYear.set(2026);

      const mockTw4Dataset: any = {
        columns: ['Kabupaten/Kota', '% Skrining Anemia', '% Konsumsi TTD'],
        summaryRow: {
          'Kabupaten/Kota': 'Rata-rata',
          '% Skrining Anemia': 94.75,
          '% Konsumsi TTD': 91.2,
        },
        targetRow: {
          'Kabupaten/Kota': 'Target',
          '% Skrining Anemia': '85',
          '% Konsumsi TTD': '70',
        },
        columnTargets: {
          '% Skrining Anemia': { enabled: true, operator: '>=', value: 85 },
          '% Konsumsi TTD': { enabled: true, operator: '>=', value: 70 },
        },
        regionRows: [],
      };

      const loadQuarterSpy = vi
        .spyOn(component.periodPartitionWorkspace, 'loadSingleQuarter')
        .mockImplementation(async (yr, qr) => {
          if (yr === 2025 && qr === 'TW4') {
            return {
              year: 2025,
              quarter: 'TW4',
              source: 'cloud',
              fileName: 'joined-result.xlsx',
              dataset: mockTw4Dataset,
            };
          }
          return null;
        });

      // Set current data for 2026
      component.workflowEngine.setJoinedDataset({
        rows: [
          { 'Kabupaten/Kota': 'Cilacap', '% Skrining Anemia': 82, '% Konsumsi TTD': 78 },
          { 'Kabupaten/Kota': 'Rata-rata', '% Skrining Anemia': 82, '% Konsumsi TTD': 78 },
        ],
        columns: ['Kabupaten/Kota', '% Skrining Anemia', '% Konsumsi TTD'],
      });

      await component.autoPopulateIndicatorsFromData();

      expect(loadQuarterSpy).toHaveBeenCalledWith(2025, 'TW4', { prefer: 'result' });

      // Cek indikator skrining anemia (#1)
      const sub1 = component.categories()[0].subCategories.find((s) => s.no === '1');
      expect(sub1).toBeDefined();
      expect(sub1?.targetPrevYear).toBe(85); // dari TW4 2025, bukan default 75
      expect(sub1?.actualPrevYear).toBe(94.75); // dari TW4 2025, bukan default 90.58

      // Cek indikator TTD (#2)
      const sub2 = component.categories()[0].subCategories.find((s) => s.no === '2');
      expect(sub2).toBeDefined();
      expect(sub2?.targetPrevYear).toBe(70); // dari TW4 2025, bukan default 65
      expect(sub2?.actualPrevYear).toBe(91.2); // dari TW4 2025, bukan default 89.34
    });

    it('should fallback to default attribute values when preceding year TW4 has no data', async () => {
      component.selectedYear.set(2026);

      vi.spyOn(component.periodPartitionWorkspace, 'loadSingleQuarter').mockResolvedValue(null);

      component.workflowEngine.setJoinedDataset({
        rows: [
          { 'Kabupaten/Kota': 'Cilacap', '% Skrining Anemia': 82 },
          { 'Kabupaten/Kota': 'Rata-rata', '% Skrining Anemia': 82 },
        ],
        columns: ['Kabupaten/Kota', '% Skrining Anemia'],
      });

      await component.autoPopulateIndicatorsFromData();

      // Indikator skrining anemia (#1) fallback ke default Dinkes: 75 & 90.58
      const sub1 = component.categories()[0].subCategories.find((s) => s.no === '1');
      expect(sub1).toBeDefined();
      expect(sub1?.targetPrevYear).toBe(75);
      expect(sub1?.actualPrevYear).toBe(90.58);
    });

    it('should synchronize existing categories with preceding year TW4 upon goToStep(2)', async () => {
      component.selectedYear.set(2026);

      const mockTw4Dataset: any = {
        columns: ['Kabupaten/Kota', '% Skrining Anemia'],
        summaryRow: {
          '% Skrining Anemia': 96.0,
        },
        columnTargets: {
          '% Skrining Anemia': { enabled: true, operator: '>=', value: 88 },
        },
        regionRows: [],
      };

      vi.spyOn(component.periodPartitionWorkspace, 'loadSingleQuarter').mockResolvedValue({
        year: 2025,
        quarter: 'TW4',
        source: 'cloud',
        fileName: 'joined-result.xlsx',
        dataset: mockTw4Dataset,
      });

      component.workflowEngine.setJoinedDataset({
        rows: [
          { 'Kabupaten/Kota': 'Cilacap', '% Skrining Anemia': 82 },
        ],
        columns: ['Kabupaten/Kota', '% Skrining Anemia'],
      });

      // Categories created without TW4 first
      component.workflowEngine.autoPopulateIndicators(null);
      let sub1 = component.categories()[0].subCategories.find((s) => s.no === '1');
      expect(sub1?.targetPrevYear).toBe(75);
      expect(sub1?.actualPrevYear).toBe(90.58);

      // Transition to Step 2
      await component.goToStep(2);
      expect(component.activeStep()).toBe(2);

      sub1 = component.categories()[0].subCategories.find((s) => s.no === '1');
      expect(sub1?.targetPrevYear).toBe(88);
      expect(sub1?.actualPrevYear).toBe(96.0);
    });

    it('should set district-specific previous year outcomes for individual regencies and provincial aggregate for province', async () => {
      component.selectedYear.set(2026);

      vi.spyOn(component.periodPartitionWorkspace, 'loadSingleQuarter').mockResolvedValue(null as any);

      component.workflowEngine.setJoinedDataset({
        rows: [
          { 'Kabupaten/Kota': 'GROBOGAN', '% Skrining Anemia': 87 },
          { 'Kabupaten/Kota': 'BREBES', '% Skrining Anemia': 91 },
        ],
        columns: ['Kabupaten/Kota', '% Skrining Anemia'],
      });

      component.workflowEngine.autoPopulateIndicators(null);
      await component.goToStep(3);

      const scorecards = component.rawRegionalScorecards();
      const groboganCard = scorecards.find((s) => s.regionName === 'GROBOGAN');
      const grobRow1 = groboganCard?.rows.find((r) => r.no === '1');

      const brebesCard = scorecards.find((s) => s.regionName === 'BREBES');
      const brebesRow1 = brebesCard?.rows.find((r) => r.no === '1');

      const provCard = component.activeDisplayScorecard();
      const provRow1 = provCard?.rows.find((r) => r.no === '1');

      // Individual regencies have district-specific outcomes, province has provincial aggregate
      expect(grobRow1?.actualPrevYear).toBe(95.18);
      expect(brebesRow1?.actualPrevYear).toBe(97.41);
      expect(provRow1?.actualPrevYear).toBe(90.58);
    });
  });
});



