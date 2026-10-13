import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import { StuntingCohortComponent } from './stunting-cohort.component';
import { CohortTransitionStatus } from '../../core/stunting-cohort/stunting-cohort-engine';

describe('StuntingCohortComponent', () => {
  let fixture: ComponentFixture<StuntingCohortComponent>;
  let component: StuntingCohortComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StuntingCohortComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StuntingCohortComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render empty state when no data is loaded', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Analisis Kohort Balita Stunting');
    expect(el.textContent).toContain('Muat Data Contoh');
    expect(component.canEvaluate()).toBe(false);
  });

  it('should evaluate cohort comparison when data is populated', () => {
    const p1Rows = [
      { NIK: '3301010001', 'Nama Balita': 'Budi', 'Tanggal Lahir': '2023-01-01', Puskesmas: 'Pusk A' },
      { NIK: '3301010002', 'Nama Balita': 'Siti', 'Tanggal Lahir': '2022-06-01', Puskesmas: 'Pusk B' },
    ];
    const p2Rows = [
      { NIK: '3301010001', 'Nama Balita': 'Budi', 'Tanggal Lahir': '2023-01-01', Puskesmas: 'Pusk A' },
      { NIK: '3301010003', 'Nama Balita': 'Doni', 'Tanggal Lahir': '2023-05-01', Puskesmas: 'Pusk C' },
    ];

    component.period1Data.set(p1Rows);
    component.period2Data.set(p2Rows);
    component.period1Columns.set(['NIK', 'Nama Balita', 'Tanggal Lahir', 'Puskesmas']);
    component.period2Columns.set(['NIK', 'Nama Balita', 'Tanggal Lahir', 'Puskesmas']);
    component.p1Mapping.set({ nikKey: 'NIK', nameKey: 'Nama Balita', dobKey: 'Tanggal Lahir' });
    component.p2Mapping.set({ nikKey: 'NIK', nameKey: 'Nama Balita', dobKey: 'Tanggal Lahir' });
    fixture.detectChanges();

    expect(component.canEvaluate()).toBe(true);
    const result = component.comparisonResult();
    expect(result).not.toBeNull();
    expect(result?.summary.persistentCount).toBe(1); // Budi
    expect(result?.summary.recoveredCount).toBe(1);  // Siti
    expect(result?.summary.newCaseCount).toBe(1);    // Doni
  });

  it('should filter table rows by status tab', () => {
    const p1Rows = [
      { NIK: '3301010001', 'Nama Balita': 'Budi', 'Tanggal Lahir': '2023-01-01' },
      { NIK: '3301010002', 'Nama Balita': 'Siti', 'Tanggal Lahir': '2022-06-01' },
    ];
    const p2Rows = [
      { NIK: '3301010001', 'Nama Balita': 'Budi', 'Tanggal Lahir': '2023-01-01' },
    ];

    component.period1Data.set(p1Rows);
    component.period2Data.set(p2Rows);
    component.p1Mapping.set({ nikKey: 'NIK', nameKey: 'Nama Balita', dobKey: 'Tanggal Lahir' });
    component.p2Mapping.set({ nikKey: 'NIK', nameKey: 'Nama Balita', dobKey: 'Tanggal Lahir' });
    fixture.detectChanges();

    // Default: ALL
    expect(component.filteredChildren().length).toBe(2);

    // Switch to RECOVERED (Bebas Stunting)
    component.activeFilter.set(CohortTransitionStatus.RECOVERED);
    fixture.detectChanges();
    expect(component.filteredChildren().length).toBe(1);
    expect(component.filteredChildren()[0].nik).toBe('3301010002');
  });

  it('should filter table rows by search query', () => {
    const p1Rows = [
      { NIK: '3301010001', 'Nama Balita': 'Ahmad Fauzan', 'Tanggal Lahir': '2023-01-01' },
      { NIK: '3301010002', 'Nama Balita': 'Siti Nurhaliza', 'Tanggal Lahir': '2022-06-01' },
    ];
    const p2Rows = [
      { NIK: '3301010001', 'Nama Balita': 'Ahmad Fauzan', 'Tanggal Lahir': '2023-01-01' },
    ];

    component.period1Data.set(p1Rows);
    component.period2Data.set(p2Rows);
    component.p1Mapping.set({ nikKey: 'NIK', nameKey: 'Nama Balita', dobKey: 'Tanggal Lahir' });
    component.p2Mapping.set({ nikKey: 'NIK', nameKey: 'Nama Balita', dobKey: 'Tanggal Lahir' });
    fixture.detectChanges();

    component.searchQuery.set('nurhaliza');
    fixture.detectChanges();
    expect(component.filteredChildren().length).toBe(1);
    expect(component.filteredChildren()[0].nama).toBe('Siti Nurhaliza');
  });

  it('should reset all state when resetAll is called', () => {
    component.period1Data.set([{ NIK: '123' }]);
    component.period2Data.set([{ NIK: '123' }]);
    component.resetAll();
    fixture.detectChanges();

    expect(component.period1Data()).toBeNull();
    expect(component.period2Data()).toBeNull();
    expect(component.comparisonResult()).toBeNull();
  });

  it('should compute donutData and waterfallBars when comparison is active', () => {
    const p1Rows = [
      { NIK: '3301010001', 'Nama Balita': 'Budi', 'Tanggal Lahir': '2023-01-01' },
      { NIK: '3301010002', 'Nama Balita': 'Siti', 'Tanggal Lahir': '2022-06-01' },
    ];
    const p2Rows = [
      { NIK: '3301010001', 'Nama Balita': 'Budi', 'Tanggal Lahir': '2023-01-01' },
      { NIK: '3301010003', 'Nama Balita': 'Doni', 'Tanggal Lahir': '2023-05-01' },
    ];

    component.period1Data.set(p1Rows);
    component.period2Data.set(p2Rows);
    component.p1Mapping.set({ nikKey: 'NIK', nameKey: 'Nama Balita', dobKey: 'Tanggal Lahir' });
    component.p2Mapping.set({ nikKey: 'NIK', nameKey: 'Nama Balita', dobKey: 'Tanggal Lahir' });
    fixture.detectChanges();

    const donut = component.donutData();
    expect(donut.length).toBe(4);
    const persistentArc = donut.find((d) => d.status === CohortTransitionStatus.PERSISTENT);
    expect(persistentArc?.count).toBe(1);

    const bars = component.waterfallBars();
    expect(bars.length).toBe(5);
    expect(bars[0].label).toBe('Periode Awal');
    expect(bars[4].label).toBe('Periode Evaluasi');
  });

  it('should export Excel workbook without throwing error', () => {
    const p1Rows = [{ NIK: '3301010001', 'Nama Balita': 'Budi', 'Tanggal Lahir': '2023-01-01' }];
    const p2Rows = [{ NIK: '3301010001', 'Nama Balita': 'Budi', 'Tanggal Lahir': '2023-01-01' }];

    component.period1Data.set(p1Rows);
    component.period2Data.set(p2Rows);
    fixture.detectChanges();

    expect(() => component.exportExcel()).not.toThrow();
  });

  it('should update column mapping correctly', () => {
    component.updateMapping(1, 'nikKey', 'KTP_ANAK');
    expect(component.p1Mapping().nikKey).toBe('KTP_ANAK');

    component.updateMapping(2, 'nameKey', 'NAMA_SISWA');
    expect(component.p2Mapping().nameKey).toBe('NAMA_SISWA');
  });
});

