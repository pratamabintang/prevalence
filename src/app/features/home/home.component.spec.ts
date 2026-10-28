import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { HomeComponent } from './home.component';
import { DinkesSpreadsheetParser } from '../../core/excel/dinkes-spreadsheet-parser';
import { NUTRITION_PROBLEMS_DATA, SPECIFIC_INTERVENTIONS_DATA } from './home-data';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render the main title as "Sistem Pemantauan Intervensi Spesifik & Masalah Gizi"', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const h1 = compiled.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1?.textContent?.trim()).toBe('Sistem Pemantauan Intervensi Spesifik & Masalah Gizi');
  });

  it('should initialize with Category 1 (intervensi-heatmap) as active default', () => {
    expect(component.activeCategory()).toBe('intervensi-heatmap');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="category-intervensi-heatmap"]')).toBeTruthy();
  });

  it('should render the bottom oval navigation bar with 3 category buttons', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const navBar = compiled.querySelector('[data-testid="bottom-oval-navigation"]');
    const btnIntervensi = compiled.querySelector('[data-testid="tab-intervensi-heatmap"]');
    const btnGizi = compiled.querySelector('[data-testid="tab-gizi-heatmap"]');
    const btnOutcomes = compiled.querySelector('[data-testid="tab-intervensi-outcomes"]');

    expect(navBar).toBeTruthy();
    expect(btnIntervensi).toBeTruthy();
    expect(btnGizi).toBeTruthy();
    expect(btnOutcomes).toBeTruthy();
  });

  it('should switch active category when bottom oval buttons are clicked', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    // Click Category 2: Heatmap Masalah Gizi
    const btnGizi = compiled.querySelector('[data-testid="tab-gizi-heatmap"]') as HTMLButtonElement;
    btnGizi.click();
    fixture.detectChanges();

    expect(component.activeCategory()).toBe('gizi-heatmap');
    expect(compiled.querySelector('[data-testid="category-gizi-heatmap"]')).toBeTruthy();
    expect(compiled.querySelector('[data-testid="category-intervensi-heatmap"]')).toBeFalsy();

    // Click Category 3: Hasil Intervensi
    const btnOutcomes = compiled.querySelector('[data-testid="tab-intervensi-outcomes"]') as HTMLButtonElement;
    btnOutcomes.click();
    fixture.detectChanges();

    expect(component.activeCategory()).toBe('intervensi-outcomes');
    expect(compiled.querySelector('[data-testid="category-intervensi-outcomes"]')).toBeTruthy();
    expect(compiled.querySelector('[data-testid="category-gizi-heatmap"]')).toBeFalsy();

    // Click back to Category 1: Heatmap Intervensi Spesifik
    const btnIntervensi = compiled.querySelector('[data-testid="tab-intervensi-heatmap"]') as HTMLButtonElement;
    btnIntervensi.click();
    fixture.detectChanges();

    expect(component.activeCategory()).toBe('intervensi-heatmap');
    expect(compiled.querySelector('[data-testid="category-intervensi-heatmap"]')).toBeTruthy();
  });

  describe('Category 1: Heatmap Intervensi Spesifik', () => {
    beforeEach(() => {
      component.setActiveCategory('intervensi-heatmap');
      fixture.detectChanges();
    });

    it('should render a 2-column layout with 1:2 ratio', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const leftCol = compiled.querySelector('[data-testid="left-column-boxes"]');
      const rightCol = compiled.querySelector('[data-testid="right-column-heatmap"]');

      expect(leftCol).toBeTruthy();
      expect(rightCol).toBeTruthy();
      expect(leftCol?.classList.contains('lg:col-span-1')).toBe(true);
      expect(rightCol?.classList.contains('lg:col-span-2')).toBe(true);
    });

    it('should render overview information boxes in the left column (ratio 1)', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const boxes = compiled.querySelectorAll('[data-testid="left-column-boxes"] [data-testid^="box-"]');
      expect(boxes.length).toBeGreaterThanOrEqual(8);
    });

    it('should not render title text and filter category buttons in the left column boxes', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const leftCol = compiled.querySelector('[data-testid="left-column-boxes"]');
      expect(leftCol?.textContent?.includes('Metrik & Ringkasan')).toBe(false);
      expect(leftCol?.textContent?.includes('10 Kartu Data')).toBe(false);
      expect(leftCol?.querySelector('button')).toBeNull();
    });

    it('should filter overview information boxes when category chip is changed', () => {
      component.intervensiBoxFilter.set('wilayah');
      fixture.detectChanges();

      const filtered = component.filteredIntervensiBoxes();
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((b) => b.category === 'wilayah')).toBe(true);

      component.intervensiBoxFilter.set('capaian');
      fixture.detectChanges();
      expect(component.filteredIntervensiBoxes().every((b) => b.category === 'capaian')).toBe(true);
    });

    it('should render the SVG map with 35 district paths in the right column (ratio 2)', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const svgMap = compiled.querySelector('[data-testid="intervensi-svg-map"]');
      expect(svgMap).toBeTruthy();

      const districtPaths = compiled.querySelectorAll('[data-testid="intervensi-svg-map"] path[data-district-id]');
      expect(districtPaths.length).toBe(35);
    });

    it('should switch active indicator via setIntervensiIndicator', () => {
      component.setIntervensiIndicator('% ANC 6x');
      fixture.detectChanges();

      expect(component.activeIntervensiIndicatorKey()).toBe('% ANC 6x');
      expect(component.activeIntervensiIndicator().label).toContain('ANC');
    });

    it('should update inspector item on district hover', () => {
      const res = component.intervensiHeatmapResult();
      expect(res).toBeTruthy();
      const firstId = res?.items[0]?.district.id;
      if (firstId) {
        component.onDistrictHover(firstId);
        fixture.detectChanges();
        expect(component.hoveredDistrictId()).toBe(firstId);
        expect(component.intervensiInspectorItem()?.district.id).toBe(firstId);
      }
    });

    it('should toggle between map and per-indicator bar chart views in the right column', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="intervensi-map-view"]')).toBeTruthy();

      component.intervensiViewMode.set('table');
      fixture.detectChanges();

      expect(compiled.querySelector('[data-testid="intervensi-map-view"]')).toBeFalsy();
      const chartContainer = compiled.querySelector('[data-testid="intervensi-table-view"]');
      expect(chartContainer).toBeTruthy();

      // Should render SVG bar charts with bars and category groups from ChartSlicingEngine
      const svgCanvas = chartContainer?.querySelector('svg.chart-canvas');
      expect(svgCanvas).toBeTruthy();
      expect(chartContainer?.querySelectorAll('.bar-group').length).toBeGreaterThan(0);
    });

    it('should sort regions in per-indicator bar charts according to sort mode', () => {
      component.intervensiViewMode.set('table');
      component.intervensiSortMode.set('desc');
      fixture.detectChanges();

      const groups = component.filteredIntervensiIndicatorGroups();
      expect(groups.length).toBeGreaterThan(0);
      const firstGroup = groups[0];
      const bars = firstGroup.layout.categoryGroups;
      expect(bars.length).toBe(35);

      // Verify desc order of non-null numeric values
      const numericVals = bars
        .map((b) => b.bars[0]?.numericVal)
        .filter((v): v is number => v !== null && v !== undefined);
      for (let i = 1; i < numericVals.length; i++) {
        expect(numericVals[i - 1]).toBeGreaterThanOrEqual(numericVals[i]);
      }
    });
  });

  describe('Category 2: Heatmap Masalah Gizi', () => {
    beforeEach(() => {
      component.setActiveCategory('gizi-heatmap');
      fixture.detectChanges();
    });

    it('should render a 2-column layout with 1:2 ratio', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const leftCol = compiled.querySelector('[data-testid="left-column-gizi-boxes"]');
      const rightCol = compiled.querySelector('[data-testid="right-column-gizi-heatmap"]');

      expect(leftCol).toBeTruthy();
      expect(rightCol).toBeTruthy();
      expect(leftCol?.classList.contains('lg:col-span-1')).toBe(true);
      expect(rightCol?.classList.contains('lg:col-span-2')).toBe(true);
    });

    it('should render overview gizi boxes in the left column (ratio 1)', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const boxes = compiled.querySelectorAll('[data-testid="left-column-gizi-boxes"] [data-testid^="gizi-box-"]');
      expect(boxes.length).toBeGreaterThanOrEqual(8);
    });

    it('should not render title text and filter category buttons in the left column gizi boxes', () => {
      component.setActiveCategory('gizi-heatmap');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const leftCol = compiled.querySelector('[data-testid="left-column-gizi-boxes"]');
      expect(leftCol?.textContent?.includes('Beban Status Gizi')).toBe(false);
      expect(leftCol?.textContent?.includes('10 Kartu Indikator')).toBe(false);
      expect(leftCol?.querySelector('button')).toBeNull();
    });

    it('should filter gizi overview boxes when filter chip is changed', () => {
      component.giziBoxFilter.set('masalah');
      fixture.detectChanges();

      const filtered = component.filteredGiziBoxes();
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((b) => b.category === 'masalah')).toBe(true);
    });

    it('should render the Gizi SVG map and apply inverted polarity in right column', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="gizi-svg-map"]')).toBeTruthy();

      const res = component.giziHeatmapResult();
      expect(res).toBeTruthy();
      expect(res?.stats.targetOperator).toBe('<=');
    });

    it('should toggle between map and per-indicator bar chart views for Masalah Gizi', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="gizi-map-view"]')).toBeTruthy();

      component.giziViewMode.set('table');
      fixture.detectChanges();

      expect(compiled.querySelector('[data-testid="gizi-map-view"]')).toBeFalsy();
      const chartContainer = compiled.querySelector('[data-testid="gizi-table-view"]');
      expect(chartContainer).toBeTruthy();

      // Should render SVG bar charts with bars and category groups from ChartSlicingEngine for Gizi
      const svgCanvas = chartContainer?.querySelector('svg.chart-canvas');
      expect(svgCanvas).toBeTruthy();
      expect(chartContainer?.querySelectorAll('.bar-group').length).toBeGreaterThan(0);
    });

    it('should sort regions in gizi per-indicator bar charts according to sort mode', () => {
      component.giziViewMode.set('table');
      component.giziSortMode.set('desc');
      fixture.detectChanges();

      const groups = component.filteredGiziIndicatorGroups();
      expect(groups.length).toBeGreaterThan(0);
      const firstGroup = groups[0];
      const bars = firstGroup.layout.categoryGroups;
      expect(bars.length).toBe(35);

      // Verify desc order of non-null numeric values
      const numericVals = bars
        .map((b) => b.bars[0]?.numericVal)
        .filter((v): v is number => v !== null && v !== undefined);
      for (let i = 1; i < numericVals.length; i++) {
        expect(numericVals[i - 1]).toBeGreaterThanOrEqual(numericVals[i]);
      }
    });
  });

  describe('Category 3: Hasil & Capaian Intervensi Spesifik', () => {
    beforeEach(() => {
      component.setActiveCategory('intervensi-outcomes');
      fixture.detectChanges();
    });

    it('should render full-width executive layout without heatmap 2-column grid', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="category-intervensi-outcomes"]')).toBeTruthy();
      expect(compiled.querySelector('[data-testid="intervensi-2column-grid"]')).toBeFalsy();
      expect(compiled.querySelector('[data-testid="gizi-2column-grid"]')).toBeFalsy();
    });

    it('should display KPI summary metrics', () => {
      const kpis = component.outcomeKpiSummary();
      expect(kpis.total).toBe(15);
      expect(kpis.onTrack).toBeGreaterThan(0);
      expect(kpis.needAccel).toBeGreaterThan(0);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="outcomes-kpi-grid"]')).toBeTruthy();
    });

    it('should render table of intervention outcomes with 15 indicators', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="outcomes-table-container"]')).toBeTruthy();
      expect(component.filteredOutcomes().length).toBe(15);
    });

    it('should filter intervention outcomes by lifecycle category', () => {
      component.outcomeCategoryFilter.set('sebelum-kelahiran');
      fixture.detectChanges();

      const filtered = component.filteredOutcomes();
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((item) => item.categoryKey === 'sebelum-kelahiran')).toBe(true);
    });

    it('should filter intervention outcomes by status', () => {
      component.outcomeStatusFilter.set('On track');
      fixture.detectChanges();

      const filtered = component.filteredOutcomes();
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((item) => item.status === 'On track')).toBe(true);
    });

    it('should support switching scope between Province and each Regency/City', () => {
      // Default scope is province
      expect(component.selectedOutcomeScope()).toBe('province');
      expect(component.selectedOutcomeScopeLabel()).toBe('PROVINSI JAWA TENGAH (Agregat)');

      // Switch to CILACAP
      component.setSelectedOutcomeScope('CILACAP');
      fixture.detectChanges();

      expect(component.selectedOutcomeScope()).toBe('CILACAP');
      expect(component.selectedOutcomeScopeLabel()).toBe('CILACAP');

      const cilacapOutcomes = component.activeScopeOutcomes();
      expect(cilacapOutcomes.length).toBe(15);
      const row1 = cilacapOutcomes.find((o) => o.no === '1');
      expect(row1).toBeTruthy();
      expect(row1?.capaianTW2).toBe(94.64);
      expect(row1?.status).toBe('On track');

      // Reset to province
      component.setSelectedOutcomeScope('province');
      fixture.detectChanges();
      expect(component.selectedOutcomeScope()).toBe('province');
    });

    it('should switch between single focus mode and all tables mode', () => {
      expect(component.outcomeTableDisplayMode()).toBe('single');

      component.setOutcomeTableDisplayMode('all');
      fixture.detectChanges();

      expect(component.outcomeTableDisplayMode()).toBe('all');
      const allTables = component.allDisplayOutcomeTables();
      expect(allTables.length).toBe(36); // 1 province + 35 regencies/cities
      expect(allTables[0].isProvince).toBe(true);
      expect(allTables[1].isProvince).toBe(false);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('#table-province')).toBeTruthy();
    });

    it('should select district when clicking district in ranking matrix', () => {
      component.selectDistrictFromRanking('BANYUMAS');
      fixture.detectChanges();

      expect(component.selectedOutcomeScope()).toBe('BANYUMAS');
      expect(component.outcomeTableDisplayMode()).toBe('single');
    });

    it('should display all available quarters for current year (more than one entry) and use numbers without progress bars', () => {
      // Default loads all available quarters for current year
      expect(component.availableOutcomeQuarters().length).toBeGreaterThan(1);
      expect(component.displayedOutcomeQuarters()).toEqual([1, 2]);

      const compiled = fixture.nativeElement as HTMLElement;
      // Header should have Triwulan 1 and Triwulan 2 columns
      const headers = Array.from(compiled.querySelectorAll('#outcomes-main-table th')).map((th) => th.textContent?.trim());
      expect(headers.some((h) => h?.includes('Triwulan 1'))).toBe(true);
      expect(headers.some((h) => h?.includes('Triwulan 2'))).toBe(true);

      // Verify that no progress bar divs exist in the table data cells
      const progressBars = compiled.querySelectorAll('#outcomes-main-table tbody td .rounded-full.bg-slate-100');
      expect(progressBars.length).toBe(0);

      // Verify that quarter toggle switches to single quarter
      component.setOutcomeQuarterViewMode('single_quarter');
      component.setSelectedOutcomeQuarter(1);
      fixture.detectChanges();

      expect(component.displayedOutcomeQuarters()).toEqual([1]);
    });

    it('should not render the district ranking matrix card in the template', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(
        compiled.textContent?.includes('Peringkat Kelulusan Indikator Intervensi Spesifik Antar-Wilayah'),
      ).toBe(false);
    });

    it('should dynamically populate multiple quarters when loadedQuarterDatasets is supplied', () => {
      component.customAvailableQuarters.set([2, 3, 4]);
      component.loadedQuarterDatasets.set({
        2: {
          regionRows: [
            { 'Kabupaten/Kota': 'CILACAP', '% Skrining Anemia': 80, 'Rematri Skrining Anemia': 16071 },
          ],
          summaryRow: { '% Skrining Anemia': 82.46 },
          totalRow: { 'Rematri Skrining Anemia': 314147 },
        },
        3: {
          regionRows: [
            { 'Kabupaten/Kota': 'CILACAP', '% Skrining Anemia': 94.64, 'Rematri Skrining Anemia': 24676 },
          ],
          summaryRow: { '% Skrining Anemia': 94.04 },
          totalRow: { 'Rematri Skrining Anemia': 475717 },
        },
        4: {
          regionRows: [
            { 'Kabupaten/Kota': 'CILACAP', '% Skrining Anemia': 94.87, 'Rematri Skrining Anemia': 28458 },
          ],
          summaryRow: { '% Skrining Anemia': 94.1 },
          totalRow: { 'Rematri Skrining Anemia': 579995 },
        },
      });
      fixture.detectChanges();

      // Check province scope
      const provOutcomes = component.activeScopeOutcomes();
      const anemiaProv = provOutcomes.find((d) => d.no === '1');
      expect(anemiaProv).toBeDefined();
      expect(anemiaProv?.quarters?.[2]?.actualAchievement).toBe(82.46);
      expect(anemiaProv?.quarters?.[2]?.sumNumerator).toBe(314147);
      expect(anemiaProv?.quarters?.[3]?.actualAchievement).toBe(94.04);
      expect(anemiaProv?.quarters?.[3]?.sumNumerator).toBe(475717);
      expect(anemiaProv?.quarters?.[4]?.actualAchievement).toBe(94.1);
      expect(anemiaProv?.quarters?.[4]?.sumNumerator).toBe(579995);

      // Check district scope
      component.setSelectedOutcomeScope('CILACAP');
      fixture.detectChanges();
      const cilacapOutcomes = component.activeScopeOutcomes();
      const anemiaCilacap = cilacapOutcomes.find((d) => d.no === '1');
      expect(anemiaCilacap).toBeDefined();
      expect(anemiaCilacap?.quarters?.[2]?.actualAchievement).toBe(80);
      expect(anemiaCilacap?.quarters?.[2]?.sumNumerator).toBe(16071);
      expect(anemiaCilacap?.quarters?.[3]?.actualAchievement).toBe(94.64);
      expect(anemiaCilacap?.quarters?.[3]?.sumNumerator).toBe(24676);
      expect(anemiaCilacap?.quarters?.[4]?.actualAchievement).toBe(94.87);
      expect(anemiaCilacap?.quarters?.[4]?.sumNumerator).toBe(28458);
    });

    it('should set district-specific previous year outcomes for individual regencies/cities and provincial aggregate for province', () => {
      component.setSelectedOutcomeScope('province');
      fixture.detectChanges();
      const provRows = component.activeScopeOutcomes();
      const provRow1 = provRows.find((o) => o.no === '1');
      expect(provRow1?.realisasi2025).toBe(90.58);

      component.setSelectedOutcomeScope('CILACAP');
      fixture.detectChanges();
      const cilacapRows = component.activeScopeOutcomes();
      const cilacapRow1 = cilacapRows.find((o) => o.no === '1');
      expect(cilacapRow1?.realisasi2025).toBe(94.87); // Cilacap specific outcome

      component.setSelectedOutcomeScope('BANYUMAS');
      fixture.detectChanges();
      const banyumasRows = component.activeScopeOutcomes();
      const banyumasRow1 = banyumasRows.find((o) => o.no === '1');
      expect(banyumasRow1?.realisasi2025).toBe(100); // Banyumas specific outcome
    });

    it('should incorporate previous year dataset into outcomes table and KPI summary', () => {
      component.loadedPrevYearDataset.set({
        regionRows: [
          { 'Kabupaten/Kota': 'GROBOGAN', '% Skrining Anemia': 95.18 },
          { 'Kabupaten/Kota': 'BREBES', '% Skrining Anemia': 97.41 },
        ],
        summaryRow: { '% Skrining Anemia': 90.58 },
        totalRow: { 'Rematri Skrining Anemia': 579995 },
        targetRow: { '% Skrining Anemia': 75 },
      });
      fixture.detectChanges();

      // Check Grobogan
      component.setSelectedOutcomeScope('GROBOGAN');
      fixture.detectChanges();
      const grobRows = component.activeScopeOutcomes();
      const grobRow1 = grobRows.find((o) => o.no === '1');
      expect(grobRow1?.target2025).toBe('75%');
      expect(grobRow1?.realisasi2025).toBe(95.18);

      // Check Brebes
      component.setSelectedOutcomeScope('BREBES');
      fixture.detectChanges();
      const brebesRows = component.activeScopeOutcomes();
      const brebesRow1 = brebesRows.find((o) => o.no === '1');
      expect(brebesRow1?.target2025).toBe('75%');
      expect(brebesRow1?.realisasi2025).toBe(97.41);

      // Check KPI Summary incorporates previous year metrics
      const kpi = component.outcomeKpiSummary();
      expect(kpi.avgPrevScore).toBeGreaterThan(0);
      expect(kpi.avgYoYChange).toBeDefined();
    });
  });

  describe('Presentation Period Toolbar & State Management (Ticket 01)', () => {
    it('should render the presentation toolbar with source badge, year select, and quarter pills', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="presentation-period-bar"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="presentation-source-badge"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="period-year-select"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="period-slot-tw1"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="period-slot-tw2"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="period-slot-tw3"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="period-slot-tw4"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="period-mode-baseline"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="refresh-periods-btn"]')).toBeTruthy();
    });

    it('should display Data Bawaan (Baseline) badge by default and update when quarter is selected', () => {
      const el = fixture.nativeElement as HTMLElement;
      const badge = el.querySelector('[data-testid="presentation-source-badge"]');
      expect(badge?.textContent).toContain('Data Bawaan (Baseline)');

      component.setPresentationPeriod(2026, 3);
      fixture.detectChanges();

      expect(badge?.textContent).toContain('Periode Tersimpan: 2026 TW3');
      expect(component.activePresentationPeriod().mode).toBe('period');
      expect(component.activePresentationPeriod().quarter).toBe(3);
    });

    it('should display file name in presentation source badge when dataset has fileName', () => {
      component.presentationYear.set(2026);
      component.presentationQuarter.set(4);
      component.presentationMode.set('period');
      component.loadedQuarterDatasets.set({
        4: {
          regionRows: [],
          summaryRow: null,
          totalRow: null,
          fileName: '2026_TW4_Data_Intervensi.xlsx',
        },
      });
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const badge = el.querySelector('[data-testid="presentation-source-badge"]');
      expect(badge?.textContent).toContain('2026_TW4_Data_Intervensi.xlsx');
      expect(component.activePresentationPeriod().fileName).toBe('2026_TW4_Data_Intervensi.xlsx');
    });

    it('should display disabled styling on quarters with no stored data and prevent selection', () => {
      const el = fixture.nativeElement as HTMLElement;
      const tw4Btn = el.querySelector('[data-testid="period-slot-tw4"]') as HTMLButtonElement;
      expect(tw4Btn.disabled).toBe(true);
      expect(tw4Btn.getAttribute('aria-disabled')).toBe('true');

      tw4Btn.click();
      fixture.detectChanges();
      expect(component.activePresentationPeriod().mode).toBe('baseline');
    });

    it('should reset to baseline when clicking Data Bawaan button', () => {
      const el = fixture.nativeElement as HTMLElement;
      component.setPresentationPeriod(2026, 2);
      fixture.detectChanges();
      expect(component.activePresentationPeriod().mode).toBe('period');

      const baselineBtn = el.querySelector('[data-testid="period-mode-baseline"]') as HTMLButtonElement;
      baselineBtn.click();
      fixture.detectChanges();

      expect(component.activePresentationPeriod().mode).toBe('baseline');
      const badge = el.querySelector('[data-testid="presentation-source-badge"]');
      expect(badge?.textContent).toContain('Data Bawaan (Baseline)');
    });

    it('should call refreshPeriods when refresh button is clicked', async () => {
      const el = fixture.nativeElement as HTMLElement;
      const refreshSpy = vi.spyOn(component.periodPartitionWorkspace!, 'refreshPeriods').mockResolvedValue([]);
      const refreshBtn = el.querySelector('[data-testid="refresh-periods-btn"]') as HTMLButtonElement;
      refreshBtn.click();
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('Dynamic Category 1 Synchronization & Target Prioritization (Ticket 02)', () => {
    const mockDistricts = [
      'CILACAP', 'BANYUMAS', 'PURBALINGGA', 'BANJARNEGARA', 'KEBUMEN',
      'PURWOREJO', 'WONOSOBO', 'MAGELANG', 'BOYOLALI', 'KLATEN',
      'SUKOHARJO', 'WONOGIRI', 'KARANGANYAR', 'SRAGEN', 'GROBOGAN',
      'BLORA', 'REMBANG', 'PATI', 'KUDUS', 'JEPARA',
      'DEMAK', 'SEMARANG', 'TEMANGGUNG', 'KENDAL', 'BATANG',
      'PEKALONGAN', 'PEMALANG', 'TEGAL', 'BREBES', 'KOTA MAGELANG',
      'KOTA SURAKARTA', 'KOTA SALATIGA', 'KOTA SEMARANG', 'KOTA PEKALONGAN', 'KOTA TEGAL'
    ];

    it('should update intervensiRows and intervensiBoxes when a presentation period is loaded', async () => {
      const mockRows = mockDistricts.map((name) => ({
        'Kabupaten/Kota': name,
        '% Konsumsi TTD': 78.5,
        '% Skrining Anemia': 82.0,
      }));

      vi.spyOn(component.periodPartitionWorkspace!, 'isStorageConfigured').mockReturnValue(true);
      vi.spyOn(component.periodPartitionWorkspace!, 'loadSingleQuarter').mockResolvedValue({
        year: 2026,
        quarter: 'TW1',
        source: 'cloud',
        fileName: 'test.xlsx',
        dataset: {
          regionRows: mockRows,
          summaryRow: { '% Konsumsi TTD': 78.5, '% Skrining Anemia': 82.0 },
          totalRow: { 'Rematri Konsumsi TTD': 45000 },
          targetRow: { '% Konsumsi TTD': 85 },
        } as any,
      });

      await component.loadPeriodPresentationData(2026, 1);
      component.setPresentationPeriod(2026, 1);
      fixture.detectChanges();

      expect(component.intervensiRows().length).toBe(35);
      expect(component.intervensiRows()[0]['% Konsumsi TTD']).toBe(78.5);
    });

    it('should prioritize targetRow from loaded quarter over fallback targets', () => {
      component.loadedQuarterDatasets.set({
        1: {
          regionRows: [],
          summaryRow: null,
          totalRow: null,
          targetRow: { '% Konsumsi TTD': 89 },
        },
      });
      component.presentationMode.set('period');
      component.presentationQuarter.set(1);

      const resolved = component.getResolvedIntervensiTarget('% Konsumsi TTD', 67);
      expect(resolved).toBe(89);
    });

    it('should fall back to standard Dinkes target if targetRow is not present', () => {
      component.loadedQuarterDatasets.set({});
      component.presentationMode.set('baseline');

      const resolved = component.getResolvedIntervensiTarget('% Konsumsi TTD', 50);
      expect(resolved).toBe(67);
    });
  });

  describe('Bi-Category Masalah Gizi Extraction & Fallback (Ticket 03)', () => {
    const mockDistricts = [
      'CILACAP', 'BANYUMAS', 'PURBALINGGA', 'BANJARNEGARA', 'KEBUMEN',
      'PURWOREJO', 'WONOSOBO', 'MAGELANG', 'BOYOLALI', 'KLATEN',
      'SUKOHARJO', 'WONOGIRI', 'KARANGANYAR', 'SRAGEN', 'GROBOGAN',
      'BLORA', 'REMBANG', 'PATI', 'KUDUS', 'JEPARA',
      'DEMAK', 'SEMARANG', 'TEMANGGUNG', 'KENDAL', 'BATANG',
      'PEKALONGAN', 'PEMALANG', 'TEGAL', 'BREBES', 'KOTA MAGELANG',
      'KOTA SURAKARTA', 'KOTA SALATIGA', 'KOTA SEMARANG', 'KOTA PEKALONGAN', 'KOTA TEGAL'
    ];

    it('should extract Category 2 gizi rows when valid Masalah Gizi sheet is present', async () => {
      const mockGiziRows = mockDistricts.map((name) => ({
        'Kabupaten/Kota': name,
        'Stunting - %': 12.4,
      }));

      vi.spyOn(component.periodPartitionWorkspace!, 'isStorageConfigured').mockReturnValue(true);
      vi.spyOn(component.periodPartitionWorkspace!, 'loadSingleQuarter').mockResolvedValue({
        year: 2026,
        quarter: 'TW2',
        source: 'cloud',
        fileName: 'test.xlsx',
        resultBuffer: new ArrayBuffer(16),
        dataset: {
          regionRows: mockGiziRows,
          summaryRow: null,
          totalRow: null,
        } as any,
      });

      vi.spyOn(DinkesSpreadsheetParser, 'parse').mockReturnValue({
        regionRows: mockGiziRows,
        summaryRow: null,
        totalRow: null,
        targetRow: null,
      } as any);

      await component.loadPeriodPresentationData(2026, 2);
      expect(component.isGiziFallback()).toBe(false);
      expect(component.giziRows().length).toBe(35);
      expect(component.giziRows()[0]['Stunting - %']).toBe(12.4);
    });

    it('should fall back to NUTRITION_PROBLEMS_DATA and display notice badge if Masalah Gizi sheet is missing', async () => {
      vi.spyOn(component.periodPartitionWorkspace!, 'isStorageConfigured').mockReturnValue(true);
      vi.spyOn(component.periodPartitionWorkspace!, 'loadSingleQuarter').mockResolvedValue({
        year: 2026,
        quarter: 'TW2',
        source: 'cloud',
        fileName: 'test.xlsx',
        dataset: {
          regionRows: [],
          summaryRow: null,
          totalRow: null,
        } as any,
      });

      vi.spyOn(DinkesSpreadsheetParser, 'parse').mockImplementation(() => {
        throw new Error('Sheet not found');
      });

      await component.loadPeriodPresentationData(2026, 2);
      expect(component.isGiziFallback()).toBe(true);
      expect(component.giziRows()).toBe(NUTRITION_PROBLEMS_DATA);

      component.setActiveCategory('gizi-heatmap');
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const notice = el.querySelector('[data-testid="gizi-fallback-notice"]');
      expect(notice).toBeTruthy();
      expect(notice?.textContent).toContain('Data Masalah Gizi untuk periode ini tidak tersedia');
    });
  });

  describe('Category 3 Temporal Alignment & Session Integration (Ticket 04)', () => {
    it('should synchronize Category 3 selectedOutcomeQuarter when presentation quarter changes', () => {
      expect(component.selectedOutcomeQuarter()).toBe(2);

      component.setPresentationPeriod(2026, 1);
      expect(component.selectedOutcomeQuarter()).toBe(1);

      component.setPresentationPeriod(2026, 3);
      expect(component.selectedOutcomeQuarter()).toBe(3);

      component.setPresentationBaseline();
      expect(component.selectedOutcomeQuarter()).toBe(2);
    });

    it('should toggle session mode when HealthDataExchange has active dataset', () => {
      const mockDistricts = [
        'CILACAP', 'BANYUMAS', 'PURBALINGGA', 'BANJARNEGARA', 'KEBUMEN',
        'PURWOREJO', 'WONOSOBO', 'MAGELANG', 'BOYOLALI', 'KLATEN',
        'SUKOHARJO', 'WONOGIRI', 'KARANGANYAR', 'SRAGEN', 'GROBOGAN',
        'BLORA', 'REMBANG', 'PATI', 'KUDUS', 'JEPARA',
        'DEMAK', 'SEMARANG', 'TEMANGGUNG', 'KENDAL', 'BATANG',
        'PEKALONGAN', 'PEMALANG', 'TEGAL', 'BREBES', 'KOTA MAGELANG',
        'KOTA SURAKARTA', 'KOTA SALATIGA', 'KOTA SEMARANG', 'KOTA PEKALONGAN', 'KOTA TEGAL'
      ];
      const sessionRows = mockDistricts.map((name) => ({
        'Kabupaten/Kota': name,
        '% Konsumsi TTD': 91.2,
      }));

      component.healthDataExchange.setChartData({
        source: 'upload',
        categoryColumn: 'Kabupaten/Kota',
        columns: ['Kabupaten/Kota', '% Konsumsi TTD'],
        rows: sessionRows,
      });
      fixture.detectChanges();

      expect(component.hasActiveSessionData()).toBe(true);

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="period-mode-session"]')).toBeNull();

      component.setPresentationSession();
      fixture.detectChanges();

      expect(component.activePresentationPeriod().mode).toBe('session');
      const badge = el.querySelector('[data-testid="presentation-source-badge"]');
      expect(badge?.textContent).toContain('Sesi Aktif (/data)');
      expect(component.intervensiRows()[0]['% Konsumsi TTD']).toBe(91.2);

      component.healthDataExchange.setChartData({
        title: 'Grafik Hasil Join - dataset_stunting_2026.xlsx',
        source: 'upload',
        categoryColumn: 'Kabupaten/Kota',
        columns: ['Kabupaten/Kota', '% Konsumsi TTD'],
        rows: sessionRows,
      });
      fixture.detectChanges();
      expect(badge?.textContent).toContain('dataset_stunting_2026.xlsx');
    });

    it('should dynamically resolve targetCurrentYear and targetPrevYear from loaded datasets', () => {
      component.loadedPrevYearDataset.set({
        regionRows: [],
        summaryRow: null,
        totalRow: null,
        targetRow: {
          '% Skrining Anemia': '>= 88',
        },
        columnTargets: {
          '% Konsumsi TTD': { enabled: true, operator: '>=', value: 85 },
        },
      });

      component.loadedQuarterDatasets.set({
        2: {
          regionRows: [],
          summaryRow: null,
          totalRow: null,
          targetRow: {
            '% Skrining Anemia': '>= 92',
          },
          columnTargets: {
            '% Konsumsi TTD': { enabled: true, operator: '>=', value: 95 },
          },
        },
      });

      fixture.detectChanges();

      expect(component.getScopePrevYearTarget('1')).toBe('88%');
      expect(component.getScopePrevYearTarget('2')).toBe('85%');
      expect(component.getScopeCurrentYearTarget('1')).toBe('92%');
      expect(component.getScopeCurrentYearTarget('2')).toBe('95%');

      const outcomes = component.activeScopeOutcomes();
      const anemia = outcomes.find((d) => d.no === '1');
      const ttd = outcomes.find((d) => d.no === '2');

      expect(anemia?.target2025).toBe('88%');
      expect(anemia?.target2026).toBe('92%');
      expect(ttd?.target2025).toBe('85%');
      expect(ttd?.target2026).toBe('95%');
    });

    it('should dynamically resolve targetCurrentYear and targetPrevYear from workflowEngine categories if available', () => {
      if (component.workflowEngine) {
        component.workflowEngine.categories.set([
          {
            id: 'cat-test',
            name: 'Kategori Test',
            subCategories: [
              {
                id: 'sub-1',
                no: '1',
                name: '% Skrining Anemia',
                numeratorCol: '% Skrining Anemia',
                targetPrevYear: 82,
                targetCurrentYear: 90,
                calculationMode: 'percentage',
                polarity: 'positive',
              },
            ],
          },
        ]);
        fixture.detectChanges();

        expect(component.getScopePrevYearTarget('1')).toBe('82%');
        expect(component.getScopeCurrentYearTarget('1')).toBe('90%');
      }
    });
  });
});
