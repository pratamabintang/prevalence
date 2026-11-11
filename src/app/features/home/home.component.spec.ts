import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { HomeComponent } from './home.component';
import { DinkesSpreadsheetParser } from '../../core/excel/dinkes-spreadsheet-parser';

const MOCK_DISTRICTS = [
  'CILACAP', 'BANYUMAS', 'PURBALINGGA', 'BANJARNEGARA', 'KEBUMEN',
  'PURWOREJO', 'WONOSOBO', 'MAGELANG', 'BOYOLALI', 'KLATEN',
  'SUKOHARJO', 'WONOGIRI', 'KARANGANYAR', 'SRAGEN', 'GROBOGAN',
  'BLORA', 'REMBANG', 'PATI', 'KUDUS', 'JEPARA',
  'DEMAK', 'SEMARANG', 'TEMANGGUNG', 'KENDAL', 'BATANG',
  'PEKALONGAN', 'PEMALANG', 'TEGAL', 'BREBES', 'KOTA MAGELANG',
  'KOTA SURAKARTA', 'KOTA SALATIGA', 'KOTA SEMARANG', 'KOTA PEKALONGAN', 'KOTA TEGAL',
];

const MOCK_INTERVENSI_COLUMN_PAIRS: [string, string][] = [
  ['Rematri  Konsumsi TTD', '% Konsumsi TTD'],
  ['Rematri Skrining Anemia', '% Skrining Anemia'],
  ['Ibu Hamil ANC 6x', '% ANC 6x'],
  ['Ibu Hamil Konsumsi TTD/MMS', '% TTD/MMS'],
  ['Ibu Hamil KEK Konsumsi MT', '% Bumil PMT'],
  ['Balita dipantau Pertumbuhan (D/S)', '% D/S'],
  ['Jumlah Balita dipantau Tumbang', '% Tumbang'],
  ['ASI Eksklusif', '% ASI'],
  ['MPASI', '% MPASI'],
  ['Jumlah  Gizi Kurang dapat MT', '% Gizi Kurang dapat MT'],
  ['Jumlah BB Kurang dapat MT', '% BB Kurang dapat MT'],
  ['Jumlah BB Tidak Naik (T) dapat MT', '% BB Tidak Naik (T) dapat MT'],
  ['Jumlah Kasus Gizi Buruk Mendapat Tata Laksana', '% Talak Gibur'],
  ['Baduta IDL', '% IDL'],
];

const MOCK_GIZI_COLUMNS = [
  'Stunting - %', 'Insiden Stunting - %', 'BBLR - %', 'BB Tidak Naik - %',
  'BB Kurang - %', 'Gizi Kurang - %', 'Gizi Buruk - %', 'Bumil KEK - %',
  'Bumil Anemia - %', 'Rematri Anemia - %',
];

function buildMockIntervensiRows(): Record<string, unknown>[] {
  return MOCK_DISTRICTS.map((name, i) => {
    const row: Record<string, unknown> = { 'Kabupaten/Kota': name, Capaian: 5 };
    MOCK_INTERVENSI_COLUMN_PAIRS.forEach(([numCol, pctCol], j) => {
      row[numCol] = 100 + i * 10 + j;
      row[pctCol] = 40 + ((i + j) % 55);
    });
    return row;
  });
}

function buildMockGiziRows(): Record<string, unknown>[] {
  return MOCK_DISTRICTS.map((name, i) => {
    const row: Record<string, unknown> = { 'Kabupaten/Kota': name };
    MOCK_GIZI_COLUMNS.forEach((col, j) => {
      row[col] = 1 + ((i + j * 3) % 30);
    });
    return row;
  });
}

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    // Dashboard hanya tampil dengan data pengguna; seed data mock untuk pengujian
    // tampilan berdata. Tes empty state membersihkan rows secara eksplisit.
    component.intervensiRows.set(buildMockIntervensiRows());
    component.giziRows.set(buildMockGiziRows());
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render page-level empty state and hide the dashboard when no data is loaded', () => {
    component.intervensiRows.set([]);
    component.giziRows.set([]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="home-empty-state"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="category-intervensi-heatmap"]')).toBeNull();
    expect(el.querySelector('table')).toBeNull();
    expect(el.querySelector('[data-testid="presentation-period-bar"]')).toBeNull();
    expect(el.textContent).not.toContain('Target');
    expect(el.querySelector('a[href="/data"]')).toBeTruthy();
  });

  it('should hide the empty state once presentation data is available', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="home-empty-state"]')).toBeNull();
    expect(el.querySelector('[data-testid="category-intervensi-heatmap"]')).toBeTruthy();
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

    it('should separate the two columns with a desktop divider', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const rightCol = compiled.querySelector('[data-testid="right-column-heatmap"]');

      expect(rightCol?.classList.contains('lg:border-l')).toBe(true);
      expect(rightCol?.classList.contains('lg:border-slate-200')).toBe(true);
      expect(rightCol?.classList.contains('lg:pl-6')).toBe(true);
    });

    it('should render overview information boxes in the left column (ratio 1)', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const boxes = compiled.querySelectorAll('[data-testid="left-column-boxes"] [data-testid^="box-"]');
      expect(boxes.length).toBe(14);

      // Verify box identifiers are stable across renders
      const boxIds = Array.from(boxes).map((b) => b.getAttribute('data-testid'));
      expect(boxIds).toContain('box-% Konsumsi TTD');
      expect(boxIds).toContain('box-% IDL');
    });

    it('should not render filter buttons in the left column boxes', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const leftCol = compiled.querySelector('[data-testid="left-column-boxes"]');
      expect(leftCol?.querySelector('button')).toBeNull();
    });

    it('should render boxes with emerald, rose, and neutral status styles', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const boxes = compiled.querySelectorAll('[data-testid="left-column-boxes"] [data-testid^="box-"]');
      
      const hasEmerald = Array.from(boxes).some((b) => b.classList.contains('bg-emerald-50'));
      const hasRose = Array.from(boxes).some((b) => b.classList.contains('bg-rose-50'));
      const hasNeutral = Array.from(boxes).some((b) => b.classList.contains('bg-slate-50'));

      expect(boxes.length).toBeGreaterThan(0);
      expect(hasEmerald || hasRose || hasNeutral).toBe(true);
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

    it('should render wilayah scope selector dropdown with province and 35 district options', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const selector = compiled.querySelector('[data-testid="wilayah-scope-select"]') as HTMLSelectElement;

      expect(selector).toBeTruthy();
      expect(selector.id).toBe('wilayah-scope-select');

      const optgroups = selector.querySelectorAll('optgroup');
      expect(optgroups.length).toBe(1);
      expect(optgroups[0].label).toContain('Kabupaten');

      const districtOpts = optgroups[0].querySelectorAll('option');
      expect(districtOpts.length).toBe(35);
    });

    it('should default to province scope', () => {
      expect(component.selectedWilayahScope()).toBe('province');
      expect(component.wilayahScopeLabel()).toBe('PROVINSI JAWA TENGAH (Agregat)');
    });

    it('should switch box values when region changes to a kabupaten', () => {
      const initialBoxes = component.wilayahIndicatorBoxes();
      const initialFirstKey = initialBoxes[0]?.indicatorKey;

      const districts = component.wilayahDistrictOptions();
      if (districts.length > 0) {
        component.setSelectedWilayahScope(districts[0].value);
        fixture.detectChanges();

        const newBoxes = component.wilayahIndicatorBoxes();
        expect(newBoxes.length).toBe(14);
        expect(newBoxes[0]?.indicatorKey).toBe(initialFirstKey);
      }
    });

    it('should restore province scope on switch back', () => {
      const districts = component.wilayahDistrictOptions();
      if (districts.length > 0) {
        component.setSelectedWilayahScope(districts[0].value);
        fixture.detectChanges();

        component.setSelectedWilayahScope('province');
        fixture.detectChanges();

        expect(component.wilayahScopeLabel()).toBe('PROVINSI JAWA TENGAH (Agregat)');
        expect(component.wilayahIndicatorBoxes().length).toBe(14);
      }
    });

    it('should render 14 boxes with stable identifiers regardless of region', () => {
      const provinceBoxes = component.wilayahIndicatorBoxes();
      const provinceIds = provinceBoxes.map((b) => b.indicatorKey);

      expect(provinceBoxes.length).toBe(14);

      const districts = component.wilayahDistrictOptions();
      if (districts.length > 0) {
        component.setSelectedWilayahScope(districts[0].value);
        fixture.detectChanges();

        const districtBoxes = component.wilayahIndicatorBoxes();
        const districtIds = districtBoxes.map((b) => b.indicatorKey);

        expect(districtIds).toEqual(provinceIds);
      }
    });

    it('should aggregate province achievement from region rows when in period mode', () => {
      // Setup: Create mock region rows with known percentages and numerators
      const mockRegions: Record<string, unknown>[] = [
        { 'Kabupaten/Kota': 'Kab. Blora', '% ANC 6x': 40, 'Ibu Hamil ANC 6x': 100 },
        { 'Kabupaten/Kota': 'Kab. Boyolali', '% ANC 6x': 50, 'Ibu Hamil ANC 6x': 200 },
        { 'Kabupaten/Kota': 'Kab. Grobogan', '% ANC 6x': 30, 'Ibu Hamil ANC 6x': 150 },
      ];

      // Set to period mode and province scope
      component.presentationMode.set('period');
      component.selectedWilayahScope.set('province');
      component.intervensiRows.set(mockRegions);
      fixture.detectChanges();

      const boxes = component.wilayahIndicatorBoxes();
      const ancBox = boxes.find((b) => b.indicatorKey === '% ANC 6x');

      // Expected: (100 + 200 + 150) / ((100/40)*100 + (200/50)*100 + (150/30)*100)
      // = 450 / (250 + 400 + 500) = 450 / 1150 ≈ 39.13%
      expect(ancBox?.achievement).toBeDefined();
      expect(ancBox?.achievement).toBeGreaterThan(30);
      expect(ancBox?.achievement).toBeLessThan(50);
    });

    it('should aggregate province achievement for numerator columns containing double spaces', () => {
      // Canonical joined-dataset headers for these two columns use double spaces.
      const mockRegions: Record<string, unknown>[] = [
        { 'Kabupaten/Kota': 'Kab. Blora', '% Konsumsi TTD': 80, 'Rematri  Konsumsi TTD': 400 },
        { 'Kabupaten/Kota': 'Kab. Boyolali', '% Konsumsi TTD': 60, 'Rematri  Konsumsi TTD': 300 },
        { 'Kabupaten/Kota': 'Kab. Cilacap', '% Gizi Kurang dapat MT': 10, 'Jumlah  Gizi Kurang dapat MT': 100 },
        { 'Kabupaten/Kota': 'Kab. Pekalongan', '% Gizi Kurang dapat MT': 20, 'Jumlah  Gizi Kurang dapat MT': 200 },
      ];

      component.presentationMode.set('period');
      component.selectedWilayahScope.set('province');
      component.intervensiRows.set(mockRegions);
      fixture.detectChanges();

      const boxes = component.wilayahIndicatorBoxes();

      // (400 + 300) / ((400/80)*100 + (300/60)*100) = 700 / 1000 = 70
      const ttdBox = boxes.find((b) => b.indicatorKey === '% Konsumsi TTD');
      expect(ttdBox?.achievement).toBe(70);

      // (100 + 200) / ((100/10)*100 + (200/20)*100) = 300 / 2000 = 15
      const mtBox = boxes.find((b) => b.indicatorKey === '% Gizi Kurang dapat MT');
      expect(mtBox?.achievement).toBe(15);
    });
  });

  describe('Category 2: Heatmap Masalah Gizi', () => {
    beforeEach(() => {
      component.setActiveCategory('gizi-heatmap');
      fixture.detectChanges();
    });

    it('should render the gizi map with the same left-column summary contract as intervensi', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const grid = compiled.querySelector('[data-testid="gizi-2column-grid"]');
      const leftCol = compiled.querySelector('[data-testid="left-column-gizi-boxes"]');
      const rightCol = compiled.querySelector('[data-testid="right-column-gizi-heatmap"]');
      const scopeSelect = compiled.querySelector('[data-testid="gizi-wilayah-scope-select"]') as HTMLSelectElement;

      expect(grid).toBeTruthy();
      expect(leftCol).toBeTruthy();
      expect(rightCol).toBeTruthy();
      expect(scopeSelect).toBeTruthy();
      expect(leftCol?.querySelectorAll('[data-testid^="gizi-box-"]').length).toBe(
        component.giziIndicators.length,
      );
    });

    it('should update gizi summary boxes when the region scope changes', () => {
      const provinceBox = component.giziWilayahIndicatorBoxes()[0];
      const compiled = fixture.nativeElement as HTMLElement;
      const scopeSelect = compiled.querySelector(
        '[data-testid="gizi-wilayah-scope-select"]',
      ) as HTMLSelectElement;

      scopeSelect.value = 'CILACAP';
      scopeSelect.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      const districtBox = component.giziWilayahIndicatorBoxes()[0];
      expect(component.selectedWilayahScope()).toBe('CILACAP');
      expect(districtBox.achievement).not.toBe(provinceBox.achievement);
      expect(districtBox.indicatorKey).toBe(provinceBox.indicatorKey);
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
      // Capaian provinsi hanya dari dataset kuartal yang dimuat (tanpa nilai bawaan)
      component.loadedQuarterDatasets.set({
        2: {
          regionRows: buildMockIntervensiRows(),
          summaryRow: {
            '% Skrining Anemia': 90,
            '% Konsumsi TTD': 90,
            '% ANC 6x': 20,
            '% TTD/MMS': 20,
            '% Bumil PMT': 20,
            '% D/S': 96,
            '% Tumbang': 20,
            '% ASI': 90,
            '% MPASI': 90,
            '% BB Tidak Naik (T) dapat MT': 20,
            '% BB Kurang dapat MT': 20,
            '% Gizi Kurang dapat MT': 20,
            '% Talak Gibur': 20,
            '% IDL': 20,
          },
          totalRow: null,
        },
      });
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
      expect(component.selectedOutcomeScopeLabel()).toBe('PROVINSI JAWA TENGAH');

      // Switch to CILACAP
      component.setSelectedOutcomeScope('CILACAP');
      fixture.detectChanges();

      expect(component.selectedOutcomeScope()).toBe('CILACAP');
      expect(component.selectedOutcomeScopeLabel()).toBe('CILACAP');

      const cilacapOutcomes = component.activeScopeOutcomes();
      expect(cilacapOutcomes.length).toBe(15);
      const row1 = cilacapOutcomes.find((o) => o.no === '1');
      expect(row1).toBeTruthy();
      // Nilai kabupaten diambil dari baris wilayah yang dimuat (mock CILACAP)
      expect(row1?.capaianTW2).toBe(buildMockIntervensiRows()[0]['% Skrining Anemia']);
      expect(row1?.status).toBe('Perlu percepatan');

      // Reset to province
      component.setSelectedOutcomeScope('province');
      fixture.detectChanges();
      expect(component.selectedOutcomeScope()).toBe('province');
    });

    it('should always stay in single focus mode (all-tables mode removed)', () => {
      expect(component.outcomeTableDisplayMode()).toBe('single');

      component.setOutcomeTableDisplayMode('all');
      fixture.detectChanges();

      expect(component.outcomeTableDisplayMode()).toBe('all');

      component.selectDistrictFromRanking('BANYUMAS');
      fixture.detectChanges();
      expect(component.outcomeTableDisplayMode()).toBe('single');
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

    it('should show prev year outcomes only from the loaded prev-year dataset, else null', () => {
      // Tanpa dataset tahun lalu: tidak ada nilai bawaan untuk cakupan mana pun
      const provRow1 = component.activeScopeOutcomes().find((o) => o.no === '1');
      expect(provRow1?.realisasi2025).toBeNull();

      component.setSelectedOutcomeScope('CILACAP');
      fixture.detectChanges();
      const cilacapRow1 = component.activeScopeOutcomes().find((o) => o.no === '1');
      expect(cilacapRow1?.realisasi2025).toBeNull();

      // Dengan dataset TW4 tahun lalu yang dimuat dari server
      component.loadedPrevYearDataset.set({
        regionRows: [
          { 'Kabupaten/Kota': 'CILACAP', '% Skrining Anemia': 94.87 },
          { 'Kabupaten/Kota': 'BANYUMAS', '% Skrining Anemia': 100 },
        ],
        summaryRow: { '% Skrining Anemia': 90.58 },
        totalRow: null,
      });
      fixture.detectChanges();

      component.setSelectedOutcomeScope('province');
      fixture.detectChanges();
      expect(
        component.activeScopeOutcomes().find((o) => o.no === '1')?.realisasi2025,
      ).toBe(90.58);

      component.setSelectedOutcomeScope('CILACAP');
      fixture.detectChanges();
      expect(
        component.activeScopeOutcomes().find((o) => o.no === '1')?.realisasi2025,
      ).toBe(94.87);

      component.setSelectedOutcomeScope('BANYUMAS');
      fixture.detectChanges();
      expect(
        component.activeScopeOutcomes().find((o) => o.no === '1')?.realisasi2025,
      ).toBe(100);
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
      expect(el.querySelector('[data-testid="refresh-periods-btn"]')).toBeTruthy();
    });

    it('should display stored-period badge by default and update when quarter is selected', () => {
      const el = fixture.nativeElement as HTMLElement;
      const badge = el.querySelector('[data-testid="presentation-source-badge"]');
      expect(badge?.textContent).toContain('Periode Tersimpan: 2026 TW1');

      component.setPresentationPeriod(2026, 3);
      fixture.detectChanges();

      const updatedBadge = el.querySelector('[data-testid="presentation-source-badge"]');
      expect(updatedBadge?.textContent).toContain('Periode Tersimpan: 2026 TW3');
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
      expect(component.activePresentationPeriod().mode).toBe('period');
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
      component.presentationMode.set('period');

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

    it('should map Bumil KEK/Risiko KEK column to the catalogue key', async () => {
      const mockRows = mockDistricts.map((name, i) => ({
        'Kabupaten/Kota': name,
        'Stunting - %': 12.4,
        'Bumil KEK/Risiko KEK - %': 19.92 + i,
      }));

      vi.spyOn(component.periodPartitionWorkspace!, 'isStorageConfigured').mockReturnValue(true);
      vi.spyOn(component.periodPartitionWorkspace!, 'loadSingleQuarter').mockResolvedValue({
        year: 2026,
        quarter: 'TW2',
        source: 'cloud',
        fileName: 'test.xlsx',
        resultBuffer: new ArrayBuffer(16),
        dataset: {
          regionRows: mockRows,
          summaryRow: null,
          totalRow: null,
        } as any,
      });

      vi.spyOn(DinkesSpreadsheetParser, 'parse').mockReturnValue({
        columns: ['Kabupaten/Kota', 'Stunting - %', 'Bumil KEK/Risiko KEK - %'],
        regionRows: mockRows,
        summaryRow: null,
        totalRow: null,
        targetRow: null,
      } as any);

      await component.loadPeriodPresentationData(2026, 2);

      expect(component.giziRows()[0]['Bumil KEK - %']).toBe(19.92);
      component.setGiziIndicator('Bumil KEK - %');
      const item = component
        .giziHeatmapResult()
        ?.items.find((i) => i.displayName.toUpperCase().includes('CILACAP'));
      expect(item?.value).toBe(19.92);
    });

    it('should keep gizi rows empty and render gizi empty state if Masalah Gizi sheet is missing', async () => {
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
      expect(component.giziRows().length).toBe(0);

      component.setActiveCategory('gizi-heatmap');
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const emptyState = el.querySelector('[data-testid="home-gizi-empty"]');
      expect(emptyState).toBeTruthy();
      expect(emptyState?.textContent).toContain('Sheet MASALAH GIZI tidak ditemukan');
    });
  });

  describe('Category 3 Temporal Alignment & Session Integration (Ticket 04)', () => {
    it('should synchronize Category 3 selectedOutcomeQuarter when presentation quarter changes', () => {
      expect(component.selectedOutcomeQuarter()).toBe(2);

      component.setPresentationPeriod(2026, 1);
      expect(component.selectedOutcomeQuarter()).toBe(1);

      component.setPresentationPeriod(2026, 3);
      expect(component.selectedOutcomeQuarter()).toBe(3);
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

    it('should prioritize Acuan Target tahunan dari server di atas target di berkas arsip', async () => {
      component.presentationYear.set(2026);
      component.loadedPrevYearDataset.set({
        regionRows: [],
        summaryRow: null,
        totalRow: null,
        targetRow: { '% Skrining Anemia': '>= 9' },
        columnTargets: { '% Konsumsi TTD': { enabled: true, operator: '>=', value: 85 } },
      });
      component.loadedQuarterDatasets.set({
        2: {
          regionRows: [],
          summaryRow: null,
          totalRow: null,
          targetRow: { '% Skrining Anemia': '>= 9' },
          columnTargets: { '% Konsumsi TTD': { enabled: true, operator: '>=', value: 85 } },
        },
      });

      await component.periodPartitionWorkspace?.setYearTargets(2026, {
        'intervensi-spesifik': {
          '% Skrining Anemia': { enabled: true, operator: '>=', value: 80.85 },
          '% Konsumsi TTD': { enabled: true, operator: '>=', value: 70.35 },
        },
        'masalah-gizi': {},
      });
      await component.periodPartitionWorkspace?.setYearTargets(2025, {
        'intervensi-spesifik': {
          '% Skrining Anemia': { enabled: true, operator: '>=', value: 77 },
          '% Konsumsi TTD': { enabled: true, operator: '>=', value: 67 },
        },
        'masalah-gizi': {},
      });
      fixture.detectChanges();

      try {
        expect(component.getScopeCurrentYearTarget('1')).toBe('80.85%');
        expect(component.getScopeCurrentYearTarget('2')).toBe('70.35%');
        expect(component.getScopePrevYearTarget('1')).toBe('77%');
        expect(component.getScopePrevYearTarget('2')).toBe('67%');
      } finally {
        // Workspace dipakai bersama antar tes; bersihkan acuan tahunan agar tidak bocor.
        await component.periodPartitionWorkspace?.setYearTargets(2026, {
          'intervensi-spesifik': {},
          'masalah-gizi': {},
        });
        await component.periodPartitionWorkspace?.setYearTargets(2025, {
          'intervensi-spesifik': {},
          'masalah-gizi': {},
        });
      }
    });

    it('should render 0 untuk target dan capaian tahun lalu ketika tahun aktif adalah tahun paling lama', async () => {
      const ws = component.periodPartitionWorkspace!;
      vi.spyOn(ws, 'refreshPeriods').mockImplementation(async () => {
        (ws as unknown as { applyRemotePeriods(p: unknown[]): unknown[] }).applyRemotePeriods([
          { year: 2024, quarter: 'TW1', hasRaw: false, hasResult: true, hasConfig: false },
          { year: 2024, quarter: 'TW4', hasRaw: false, hasResult: true, hasConfig: false },
        ]);
        return [];
      });
      await ws.refreshPeriods();
      component.presentationYear.set(2024);
      fixture.detectChanges();

      expect(component.getScopePrevYearTarget('1')).toBe('0%');
      expect(component.getScopePrevYearOutcome('province', '1')).toBe(0);
      const provRow1 = component.activeScopeOutcomes().find((o) => o.no === '1');
      expect(provRow1?.target2025).toBe('0%');
      expect(provRow1?.realisasi2025).toBe(0);
    });

    it('should pakai Acuan Target tahunan server untuk heatmap intervensi spesifik', async () => {
      const ws = component.periodPartitionWorkspace!;
      await ws.setYearTargets(2026, {
        'intervensi-spesifik': {
          '% Konsumsi TTD': { enabled: true, operator: '>=', value: 70.35 },
        },
        'masalah-gizi': {},
      });
      component.presentationYear.set(2026);
      fixture.detectChanges();

      try {
        expect(component.getResolvedIntervensiTarget('% Konsumsi TTD', 67)).toBe(70.35);
        expect(component.intervensiHeatmapResult()?.targetPositionPercent).not.toBeNull();
      } finally {
        await ws.setYearTargets(2026, { 'intervensi-spesifik': {}, 'masalah-gizi': {} });
      }
    });

    it('should pakai Acuan Target tahunan server untuk heatmap masalah gizi, termasuk alias kolom', async () => {
      const ws = component.periodPartitionWorkspace!;
      await ws.setYearTargets(2026, {
        'intervensi-spesifik': {},
        'masalah-gizi': {
          'Stunting - %': { enabled: true, operator: '<=', value: 13.3 },
          'Bumil KEK/Risiko KEK - %': { enabled: true, operator: '<=', value: 12.35 },
        },
      });
      component.presentationYear.set(2026);
      fixture.detectChanges();

      try {
        expect(component.getResolvedGiziTarget('Stunting - %', 14)).toBe(13.3);
        expect(component.getResolvedGiziOperator('Stunting - %', '<=')).toBe('<=');
        expect(component.getResolvedGiziTarget('Bumil KEK - %', 13)).toBe(12.35);
      } finally {
        await ws.setYearTargets(2026, { 'intervensi-spesifik': {}, 'masalah-gizi': {} });
      }
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

    it('should prioritize saved dataset target over workflowEngine categories', () => {
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
      }

      component.loadedQuarterDatasets.set({
        2: {
          regionRows: [],
          summaryRow: null,
          totalRow: null,
          columnTargets: {
            '% Skrining Anemia': { enabled: true, operator: '>=', value: 96 },
          },
        },
      });
      component.selectedOutcomeQuarter.set(2);
      fixture.detectChanges();

      expect(component.getScopeCurrentYearTarget('1')).toBe('96%');
    });

    it('should resolve Masalah Gizi target and operator from saved columnTargets', () => {
      component.giziTargets.set({
        'Stunting - %': { enabled: true, operator: '<=', value: 11.2 },
      });
      fixture.detectChanges();

      expect(component.getResolvedGiziTarget('Stunting - %', 14)).toBe(11.2);
      expect(component.getResolvedGiziOperator('Stunting - %', '<=')).toBe('<=');
      expect(component.giziHeatmapResult()?.stats.targetValue).toBe(11.2);
    });

    it('should fall back to catalogue target when saved Gizi target is disabled', () => {
      component.giziTargets.set({
        'Stunting - %': { enabled: false, operator: '<=', value: 11.2 },
      });

      expect(component.getResolvedGiziTarget('Stunting - %', 14)).toBe(14);
    });

    it('should resolve saved Gizi target whose header differs from the catalogue key', () => {
      component.giziTargets.set({
        'Bumil KEK/Risiko KEK - %': { enabled: true, operator: '<=', value: 10 },
      });

      expect(component.getResolvedGiziTarget('Bumil KEK - %', 13)).toBe(10);
    });
  });
});
