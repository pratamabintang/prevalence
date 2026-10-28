import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { StuntingDashboardComponent } from './stunting-dashboard.component';
import { provideRouter } from '@angular/router';

describe('StuntingDashboardComponent', () => {
  let component: StuntingDashboardComponent;
  let fixture: ComponentFixture<StuntingDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StuntingDashboardComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(StuntingDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should display the main title and metadata badges', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const h1 = compiled.querySelector('h1');
    expect(h1?.textContent).toContain('Stunting Jawa Tengah');
    expect(compiled.textContent).toContain('TW1 2025 – TW1 2026');
    expect(compiled.textContent).toContain('35 Kabupaten/Kota');
    expect(compiled.textContent).toContain('9 Intervensi Spesifik');
  });

  it('should display Section B summary cards with exact values', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('35');
    expect(compiled.textContent).toContain('5 Triwulan');
    expect(compiled.textContent).toContain('9.52%');
    expect(compiled.textContent).toContain('-0.18');
    expect(compiled.textContent).toContain('Median antar kabupaten/kota');
  });

  it('should render Section C trend chart and update when a wilayah is chosen', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Tren Prevalensi Stunting (5 Triwulan)');
    expect(compiled.textContent).toContain('Interpretasi Tren');

    // Change wilayah in store
    component.store.setWilayah('KABUPATEN CILACAP');
    fixture.detectChanges();

    expect(component.selectedWilayah()).toBe('KABUPATEN CILACAP');
    expect(compiled.textContent).toContain('KABUPATEN CILACAP');
  });

  it('should render Section D quarterly transition bars', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Perubahan Antartriwulan');
    expect(compiled.textContent).toContain('TW1 2025 → TW2 2025');
    expect(compiled.textContent).toContain('TW4 2025 → TW1 2026');
  });

  it('should render Section E heatmap with 35 rows and mandatory explanation', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Heatmap Prevalensi: 35 Wilayah × 5 Triwulan');
    expect(compiled.textContent).toContain(
      'Warna digunakan untuk membantu membaca perbedaan nilai, bukan sebagai label keberhasilan atau kegagalan daerah',
    );
    const rows = compiled.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThanOrEqual(35);
  });

  it('should render Section F boxplot with distribution metrics', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Distribusi Statistik Prevalensi Antarwilayah (Boxplot)');
    expect(compiled.textContent).toContain('Median (Q2)');
    expect(compiled.textContent).toContain('Rentang (Max - Min)');
  });

  it('should render Section G spatial map, Java island sketch, and district boundaries', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Peta Geografis & Batas 35 Wilayah Jawa Tengah');
    expect(compiled.textContent).toContain('Sketsa Pulau Jawa - Posisi Geografis Jawa Tengah');
    expect(compiled.textContent).toContain('Batas Poligon Wilayah');
    expect(component.spatialMapFeatures().length).toBe(35);
  });

  it('should render Excel upload toolbar and toggle constraints modal', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Unggah Berkas Excel (.xlsx)');
    expect(compiled.textContent).toContain('Ketentuan & Skrip Berkas');

    component.showConstraintModal.set(true);
    fixture.detectChanges();
    expect(compiled.textContent).toContain('Ketentuan Berkas Excel (.xlsx) & Skrip Otomatis');
    expect(compiled.textContent).toContain('TTD REMATRI');
  });

  it('should hover on district and show inspector details', () => {
    const features = component.spatialMapFeatures();
    expect(features.length).toBe(35);

    component.hoveredDistrict.set(features[0]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(features[0].kabupatenKota);
    expect(compiled.textContent).toContain('Prevalensi Stunting:');
  });

  it('should render Section H 9 intervention indicators line chart', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Capaian 9 Indikator Intervensi Spesifik');
    expect(compiled.textContent).toContain('capaian indikator');

    // Switch indicator
    component.store.setIndicator('x5_asi_eksklusif');
    fixture.detectChanges();
    expect(component.selectedIndicator().name).toBe('ASI Eksklusif');
  });

  it('should render Section I scatter plot with association disclaimers', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Hubungan Capaian Intervensi dan Prevalensi Stunting');
    expect(compiled.textContent).toContain('Hubungan statistik tidak dengan sendirinya membuktikan bahwa perubahan intervensi menyebabkan perubahan stunting');
    expect(compiled.textContent).toContain('Korelasi Pearson (r)');
  });

  it('should toggle Section J advanced statistical analysis', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Analisis Ekonometrika & Statistik Lanjutan');
    expect(component.showAdvancedStats()).toBe(false);

    // Click toggle button
    component.toggleAdvancedStats();
    fixture.detectChanges();

    expect(component.showAdvancedStats()).toBe(true);
    expect(compiled.textContent).toContain('Two-Way Fixed Effects');
    expect(compiled.textContent).toContain('First Difference');
    expect(compiled.textContent).toContain("Moran's I");
    expect(compiled.textContent).toContain('Geographically Weighted Regression');
  });

  it('should render Section K human-language takeaways', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Apa yang Dapat dan Tidak Dapat Disimpulkan dari Data?');
    expect(compiled.textContent).toContain('Yang Terlihat');
    expect(compiled.textContent).toContain('Perubahannya');
    expect(compiled.textContent).toContain('Pola Wilayah');
    expect(compiled.textContent).toContain('Hubungan Statistik');
    expect(compiled.textContent).toContain('Yang Perlu Diperhatikan');
  });

  it('should render Section L data transparency and limitations', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Tentang Data & Batasan Analisis');
    expect(compiled.textContent).toContain('Dinas Kesehatan Provinsi Jawa Tengah');
    expect(compiled.textContent).toContain('175 baris observasi panel seimbang');
  });
});
