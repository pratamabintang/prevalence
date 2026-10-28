import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HomeComponent } from './home.component';

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
});
