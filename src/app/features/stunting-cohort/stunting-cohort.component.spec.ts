import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import { ExcelEngine } from '../../shared/excel';
import { StuntingCohortComponent } from './stunting-cohort.component';
import {
  StuntingCohortEngine,
  CohortTransitionStatus,
} from '../../core/stunting-cohort/stunting-cohort-engine';

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

  it('should render clean layout when no data is loaded', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Analisis Kohort Balita Stunting');
    expect(el.textContent).not.toContain('Mulai Analisis Kohort Balita');
    expect(el.textContent).not.toContain('Muat Data Contoh');
    expect(component.comparisonResult()).toBeNull();
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

    const writeSpy = vi.spyOn(ExcelEngine, 'writeWorkbook').mockImplementation(() => {});
    expect(() => component.exportExcel()).not.toThrow();
    expect(writeSpy).toHaveBeenCalledTimes(1);
    writeSpy.mockRestore();
  });

  it('should update column mapping correctly', () => {
    component.updateMapping(1, 'nikKey', 'KTP_ANAK');
    expect(component.p1Mapping().nikKey).toBe('KTP_ANAK');

    component.updateMapping(2, 'nameKey', 'NAMA_SISWA');
    expect(component.p2Mapping().nameKey).toBe('NAMA_SISWA');
  });

  it('should default to Rekap Status Gizi sub-menu and allow toggling to Cohort', () => {
    expect(component.activeSubMenu()).toBe('rekap');

    component.activeSubMenu.set('cohort');
    fixture.detectChanges();
    expect(component.activeSubMenu()).toBe('cohort');
  });

  it('should aggregate raw data and calculate rekap summary when rekapRawData is set', () => {
    const rawRecords = [
      {
        kabupaten_kota: 'KABUPATEN BANYUMAS',
        status_bbu: 'Kurang',
        status_tbu: 'Pendek',
        status_bbtb: 'Gizi Kurang',
      },
      {
        kabupaten_kota: 'KABUPATEN BANYUMAS',
        status_bbu: 'Berat Badan Normal',
        status_tbu: 'Normal',
        status_bbtb: 'Normal',
      },
      {
        kabupaten_kota: 'KABUPATEN CILACAP',
        status_bbu: 'Berat Badan Normal',
        status_tbu: 'Normal',
        status_bbtb: 'Normal',
      },
    ];

    component.rekapRawData.set(rawRecords);
    component.rekapFileName.set('sample_data.csv');
    fixture.detectChanges();

    const res = component.rekapResult();
    expect(res).not.toBeNull();
    expect(res?.rows.length).toBe(2);
    expect(res?.totals.jumlahDitimbangDiukur).toBe(3);
    expect(res?.totals.stuntingCount).toBe(1);
    expect(res?.totals.wastingCount).toBe(1);

    // Filter rekap rows
    component.rekapSearchQuery.set('cilacap');
    fixture.detectChanges();
    expect(component.filteredRekapRows().length).toBe(1);
    expect(component.filteredRekapRows()[0].wilayah).toBe('KABUPATEN CILACAP');
  });

  it('should export rekap Excel report without throwing error', () => {
    const rawRecords = [
      {
        kabupaten_kota: 'KABUPATEN CILACAP',
        status_bbu: 'Berat Badan Normal',
        status_tbu: 'Normal',
        status_bbtb: 'Normal',
      },
    ];

    component.rekapRawData.set(rawRecords);
    fixture.detectChanges();

    const writeSpy = vi.spyOn(ExcelEngine, 'writeWorkbook').mockImplementation(() => {});
    expect(() => component.exportRekapExcel()).not.toThrow();
    expect(writeSpy).toHaveBeenCalledTimes(1);
    writeSpy.mockRestore();
  });

  it('should reset rekap data when resetRekap is called', () => {
    component.rekapRawData.set([{ a: 1 }]);
    component.rekapFileName.set('data.xlsx');
    component.rekapSearchQuery.set('test');

    component.resetRekap();
    expect(component.rekapRawData()).toBeNull();
    expect(component.rekapFileName()).toBe('');
    expect(component.rekapSearchQuery()).toBe('');
  });

  it('should load synthetic cohort sample data when loadSyntheticCohortSampleData is invoked', async () => {
    const csvP1 = 'nik_anak,nama_anak,tanggal_lahir,tinggi_badan_cm,stunting,status_tbu\n3301010001,Anak A,2023-01-01,70.5,Ya,Pendek\n3301010002,Anak B,2023-02-01,72.0,Ya,Pendek';
    const csvP2 = 'nik_anak,nama_anak,tanggal_lahir,tinggi_badan_cm,stunting,status_tbu\n3301010001,Anak A,2023-01-01,72.5,Ya,Pendek\n3301010002,Anak B,2023-02-01,79.5,Tidak,Normal';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('sample_kohort_periode_awal')) {
        return new Response(csvP1, { status: 200 });
      }
      return new Response(csvP2, { status: 200 });
    });

    await component.loadSyntheticCohortSampleData();
    fixture.detectChanges();

    expect(component.period1Data()?.length).toBe(2);
    expect(component.period2Data()?.length).toBe(2);
    expect(component.period1Label()).toBe('Juli 2025 (Baseline)');
    expect(component.period2Label()).toBe('Januari 2026 (Evaluasi)');

    const result = component.comparisonResult();
    expect(result).not.toBeNull();
    expect(result?.summary.persistentCount).toBe(1); // Anak A
    expect(result?.summary.recoveredCount).toBe(1);  // Anak B
    expect(result?.children.find((c) => c.nik === '3301010002')?.heightGain).toBe(7.5);

    fetchSpy.mockRestore();
  });

  it('should render clean table styling with clear borders, cell backgrounds, and no emoticons', () => {
    // Child with Excel serial date '44749.29180555556' (2022-07-07) and evaluation date 2026-01-20 -> age 42 months
    const p1Rows = [
      {
        NIK: '3325010707220025',
        'Nama Balita': 'Aditya Saputra',
        'Tanggal Lahir': '44749.29180555556',
        Puskesmas: 'Puskesmas Batang 1',
        stunting: 'Ya',
        tinggi_badan_cm: 86.3,
      },
    ];
    const p2Rows = [
      {
        NIK: '3325010707220025',
        'Nama Balita': 'Aditya Saputra',
        'Tanggal Lahir': '44749.29180555556',
        Puskesmas: 'Puskesmas Batang 1',
        stunting: 'Ya',
        tinggi_badan_cm: 88.3,
      },
    ];

    component.activeSubMenu.set('cohort');
    component.period1Data.set(p1Rows);
    component.period2Data.set(p2Rows);
    component.period1Columns.set(Object.keys(p1Rows[0]));
    component.period2Columns.set(Object.keys(p2Rows[0]));
    component.p1Mapping.set(StuntingCohortEngine.detectColumnKeys(Object.keys(p1Rows[0])));
    component.p2Mapping.set(StuntingCohortEngine.detectColumnKeys(Object.keys(p2Rows[0])));
    component.evaluationDate.set('2026-01-20');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const table = el.querySelector('table');
    expect(table?.className).toContain('border-slate-300');

    // Tanggal Lahir should be cleanly formatted as YYYY-MM-DD instead of raw serial
    expect(el.textContent).toContain('2022-07-07');
    expect(el.textContent).not.toContain('44749.29180555556');
    // Usia should be 42 Bln instead of '-'
    expect(el.textContent).toContain('42 Bln');

    // Pertumbuhan column should display +2 cm without emoticons (no 🚀, no ⚠️)
    expect(el.textContent).toContain('+2 cm');
    expect(el.textContent).not.toContain('+2 cm ⚠️');
    expect(el.textContent).not.toContain('🚀');
  });

  it('should switch cohort indicator and update labels reactively', () => {
    const p1Rows = [
      {
        NIK: '3301010001',
        'Nama Balita': 'Anak A',
        'Tanggal Lahir': '2023-01-01',
        Puskesmas: 'Pusk 1',
        stunting: 'Ya',
        wasting: 'Ya',
        underweight: 'Tidak',
        tinggi_badan_cm: 75.0,
        berat_badan_kg: 8.0,
      },
      {
        NIK: '3301010002',
        'Nama Balita': 'Anak B',
        'Tanggal Lahir': '2023-01-01',
        Puskesmas: 'Pusk 1',
        stunting: 'Ya',
        wasting: 'Tidak',
        underweight: 'Ya',
        tinggi_badan_cm: 76.0,
        berat_badan_kg: 8.5,
      },
    ];
    const p2Rows = [
      {
        NIK: '3301010001',
        'Nama Balita': 'Anak A',
        'Tanggal Lahir': '2023-01-01',
        Puskesmas: 'Pusk 1',
        stunting: 'Ya',
        wasting: 'Tidak',
        underweight: 'Tidak',
        tinggi_badan_cm: 78.0,
        berat_badan_kg: 9.5,
      },
      {
        NIK: '3301010002',
        'Nama Balita': 'Anak B',
        'Tanggal Lahir': '2023-01-01',
        Puskesmas: 'Pusk 1',
        stunting: 'Tidak',
        wasting: 'Ya',
        underweight: 'Ya',
        tinggi_badan_cm: 80.0,
        berat_badan_kg: 9.0,
      },
    ];

    component.activeSubMenu.set('cohort');
    component.period1Data.set(p1Rows);
    component.period2Data.set(p2Rows);
    component.period1Columns.set(Object.keys(p1Rows[0]));
    component.period2Columns.set(Object.keys(p2Rows[0]));
    component.p1Mapping.set(StuntingCohortEngine.detectColumnKeys(Object.keys(p1Rows[0])));
    component.p2Mapping.set(StuntingCohortEngine.detectColumnKeys(Object.keys(p2Rows[0])));
    fixture.detectChanges();

    // Default indicator: stunting
    expect(component.activeIndicator()).toBe('stunting');
    expect(component.getStatusLabel(CohortTransitionStatus.PERSISTENT)).toBe('Tetap Stunting');
    expect(component.getStatusLabel(CohortTransitionStatus.RECOVERED)).toBe('Bebas Stunting');

    // Switch to wasting
    component.activeFilter.set(CohortTransitionStatus.PERSISTENT);
    component.switchIndicator('wasting');
    fixture.detectChanges();

    expect(component.activeIndicator()).toBe('wasting');
    // activeFilter should be reset to 'ALL'
    expect(component.activeFilter()).toBe('ALL');
    expect(component.getStatusLabel(CohortTransitionStatus.PERSISTENT)).toBe('Tetap Wasting');
    expect(component.getStatusLabel(CohortTransitionStatus.RECOVERED)).toBe('Bebas Wasting');

    // Under wasting:
    // Anak A: P1=wasting(Ya), P2=wasting(Tidak) -> RECOVERED (Bebas Wasting)
    // Anak B: P1=wasting(Tidak), P2=wasting(Ya) -> NEW_CASE (Kasus Baru Wasting)
    const result = component.comparisonResult();
    expect(result?.indicator).toBe('wasting');
    expect(result?.summary.recoveredCount).toBe(1);
    expect(result?.summary.newCaseCount).toBe(1);
    expect(result?.summary.persistentCount).toBe(0);

    // Switch to underweight
    component.switchIndicator('underweight');
    fixture.detectChanges();
    expect(component.activeIndicator()).toBe('underweight');
    expect(component.getStatusLabel(CohortTransitionStatus.PERSISTENT)).toBe('Tetap Underweight');
    // Anak B: P1=underweight(Ya), P2=underweight(Ya) -> PERSISTENT (Tetap Underweight)
    expect(component.comparisonResult()?.summary.persistentCount).toBe(1);
  });

  it('should call ExcelEngine.writeWorkbook with dynamic indicator filename on export', () => {
    const p1Rows = [
      { NIK: '3301010001', 'Nama Balita': 'Budi', 'Tanggal Lahir': '2023-01-01', wasting: 'Ya' },
    ];
    const p2Rows = [
      { NIK: '3301010001', 'Nama Balita': 'Budi', 'Tanggal Lahir': '2023-01-01', wasting: 'Ya' },
    ];

    component.activeSubMenu.set('cohort');
    component.period1Data.set(p1Rows);
    component.period2Data.set(p2Rows);
    component.p1Mapping.set(StuntingCohortEngine.detectColumnKeys(Object.keys(p1Rows[0])));
    component.p2Mapping.set(StuntingCohortEngine.detectColumnKeys(Object.keys(p2Rows[0])));
    component.evaluationDate.set('2026-01-20');
    component.switchIndicator('wasting');
    fixture.detectChanges();

    const writeSpy = vi.spyOn(ExcelEngine, 'writeWorkbook').mockImplementation(() => {});

    component.exportExcel();
    expect(writeSpy).toHaveBeenCalled();
    const filename = writeSpy.mock.calls[0][1];
    expect(filename).toBe('Laporan_Kohort_WASTING_2026-01-20.xlsx');

    writeSpy.mockRestore();
  });

  it('should render missing P2 note in Card 3 and badge in table when children are missing in Period 2', () => {
    const p1Rows = [
      { NIK: '3301010001', 'Nama Balita': 'Budi Missing', 'Tanggal Lahir': '2023-01-01', stunting: 'Ya', tinggi_badan_cm: 75.0 },
    ];
    const p2Rows: Record<string, unknown>[] = [];

    component.activeSubMenu.set('cohort');
    component.period1Data.set(p1Rows);
    component.period2Data.set(p2Rows);
    component.period1Columns.set(Object.keys(p1Rows[0]));
    component.period2Columns.set([]);
    component.p1Mapping.set(StuntingCohortEngine.detectColumnKeys(Object.keys(p1Rows[0])));
    component.p2Mapping.set({});
    fixture.detectChanges();

    const res = component.comparisonResult();
    expect(res).not.toBeNull();
    expect(res?.summary.missingPeriod2Count).toBe(1);
    expect(res?.summary.recoveredCount).toBe(1);

    const el = fixture.nativeElement as HTMLElement;
    // Card 3 should mention *Termasuk 1 tidak terdata P2 (lulus)
    expect(el.textContent).toContain('*Termasuk 1 tidak terdata P2 (lulus)');

    // Table should contain 'Tidak terdata P2'
    expect(el.textContent).toContain('Tidak terdata P2');
  });

  describe('Table sorting functionality', () => {
    const setupCohortData = () => {
      const p1Rows = [
        { NIK: '3301010003', 'Nama Balita': 'Citra', 'Tanggal Lahir': '2023-05-10', Puskesmas: 'Pusk Candisari', stunting: 'Ya', tinggi_badan_cm: 72.0 },
        { NIK: '3301010001', 'Nama Balita': 'Andi', 'Tanggal Lahir': '2023-01-15', Puskesmas: 'Pusk Banyumanik', stunting: 'Ya', tinggi_badan_cm: 78.5 },
        { NIK: '3301010002', 'Nama Balita': 'Budi', 'Tanggal Lahir': '2022-11-20', Puskesmas: 'Pusk Tembalang', stunting: 'Ya', tinggi_badan_cm: 85.0 },
      ];
      const p2Rows = [
        { NIK: '3301010003', 'Nama Balita': 'Citra', 'Tanggal Lahir': '2023-05-10', Puskesmas: 'Pusk Candisari', stunting: 'Ya', tinggi_badan_cm: 75.0 }, // +3.0 cm, Tetap Stunting
        { NIK: '3301010001', 'Nama Balita': 'Andi', 'Tanggal Lahir': '2023-01-15', Puskesmas: 'Pusk Banyumanik', stunting: 'Tidak', tinggi_badan_cm: 86.0 }, // +7.5 cm, Bebas Stunting
        { NIK: '3301010002', 'Nama Balita': 'Budi', 'Tanggal Lahir': '2022-11-20', Puskesmas: 'Pusk Tembalang', stunting: 'Ya', tinggi_badan_cm: 87.0 }, // +2.0 cm, Tetap Stunting
      ];

      component.activeSubMenu.set('cohort');
      component.period1Data.set(p1Rows);
      component.period2Data.set(p2Rows);
      component.period1Columns.set(Object.keys(p1Rows[0]));
      component.period2Columns.set(Object.keys(p2Rows[0]));
      component.p1Mapping.set(StuntingCohortEngine.detectColumnKeys(Object.keys(p1Rows[0])));
      component.p2Mapping.set(StuntingCohortEngine.detectColumnKeys(Object.keys(p2Rows[0])));
      component.evaluationDate.set('2026-01-20');
      fixture.detectChanges();
    };

    it('should cycle sortDirection: asc -> desc -> none', () => {
      expect(component.sortColumn()).toBeNull();
      expect(component.sortDirection()).toBe('none');

      component.toggleSort('nama');
      expect(component.sortColumn()).toBe('nama');
      expect(component.sortDirection()).toBe('asc');

      component.toggleSort('nama');
      expect(component.sortColumn()).toBe('nama');
      expect(component.sortDirection()).toBe('desc');

      component.toggleSort('nama');
      expect(component.sortColumn()).toBeNull();
      expect(component.sortDirection()).toBe('none');
    });

    it('should reset sort when clicking a different column or resetSort()', () => {
      component.toggleSort('nama');
      expect(component.sortColumn()).toBe('nama');
      expect(component.sortDirection()).toBe('asc');

      component.toggleSort('nik');
      expect(component.sortColumn()).toBe('nik');
      expect(component.sortDirection()).toBe('asc');

      component.resetSort();
      expect(component.sortColumn()).toBeNull();
      expect(component.sortDirection()).toBe('none');
    });

    it('should sort rows by NIK Balita asc and desc', () => {
      setupCohortData();
      component.toggleSort('nik');
      const ascNiks = component.filteredChildren().map((c) => c.nik);
      expect(ascNiks).toEqual(['3301010001', '3301010002', '3301010003']);

      component.toggleSort('nik');
      const descNiks = component.filteredChildren().map((c) => c.nik);
      expect(descNiks).toEqual(['3301010003', '3301010002', '3301010001']);
    });

    it('should sort rows by Nama Balita asc and desc', () => {
      setupCohortData();
      component.toggleSort('nama');
      const ascNames = component.filteredChildren().map((c) => c.nama);
      expect(ascNames).toEqual(['Andi', 'Budi', 'Citra']);

      component.toggleSort('nama');
      const descNames = component.filteredChildren().map((c) => c.nama);
      expect(descNames).toEqual(['Citra', 'Budi', 'Andi']);
    });

    it('should sort rows by Tanggal Lahir asc and desc', () => {
      setupCohortData();
      component.toggleSort('tanggalLahir');
      const ascDates = component.filteredChildren().map((c) => c.tanggalLahir);
      expect(ascDates).toEqual(['2022-11-20', '2023-01-15', '2023-05-10']);

      component.toggleSort('tanggalLahir');
      const descDates = component.filteredChildren().map((c) => c.tanggalLahir);
      expect(descDates).toEqual(['2023-05-10', '2023-01-15', '2022-11-20']);
    });

    it('should sort rows by Usia (ageMonths) asc and desc', () => {
      setupCohortData();
      component.toggleSort('ageMonths');
      const ascAges = component.filteredChildren().map((c) => c.ageMonths);
      expect(ascAges[0]! <= ascAges[1]!).toBe(true);
      expect(ascAges[1]! <= ascAges[2]!).toBe(true);

      component.toggleSort('ageMonths');
      const descAges = component.filteredChildren().map((c) => c.ageMonths);
      expect(descAges[0]! >= descAges[1]!).toBe(true);
      expect(descAges[1]! >= descAges[2]!).toBe(true);
    });

    it('should sort rows by Puskesmas / Wilayah asc and desc', () => {
      setupCohortData();
      component.toggleSort('puskesmas');
      const ascPkm = component.filteredChildren().map((c) => c.puskesmas);
      expect(ascPkm).toEqual(['Pusk Banyumanik', 'Pusk Candisari', 'Pusk Tembalang']);

      component.toggleSort('puskesmas');
      const descPkm = component.filteredChildren().map((c) => c.puskesmas);
      expect(descPkm).toEqual(['Pusk Tembalang', 'Pusk Candisari', 'Pusk Banyumanik']);
    });

    it('should sort rows by Status Transisi asc and desc', () => {
      setupCohortData();
      component.toggleSort('status');
      const ascStatus = component.filteredChildren().map((c) => c.statusLabel);
      expect(ascStatus).toEqual(ascStatus.slice().sort((a, b) => a.localeCompare(b, 'id')));

      component.toggleSort('status');
      const descStatus = component.filteredChildren().map((c) => c.statusLabel);
      expect(descStatus).toEqual(descStatus.slice().sort((a, b) => b.localeCompare(a, 'id')));
    });

    it('should sort rows by TB Baseline (p1), TB Evaluasi (p2), and Pertumbuhan delta', () => {
      setupCohortData();
      // p1
      component.toggleSort('p1');
      const ascP1 = component.filteredChildren().map((c) => c.p1Height);
      expect(ascP1).toEqual([72.0, 78.5, 85.0]);

      // p2
      component.toggleSort('p2');
      const ascP2 = component.filteredChildren().map((c) => c.p2Height);
      expect(ascP2).toEqual([75.0, 86.0, 87.0]);

      // delta (growth)
      component.toggleSort('delta');
      const ascDelta = component.filteredChildren().map((c) => c.heightGain);
      expect(ascDelta).toEqual([2.0, 3.0, 7.5]);

      component.toggleSort('delta');
      const descDelta = component.filteredChildren().map((c) => c.heightGain);
      expect(descDelta).toEqual([7.5, 3.0, 2.0]);
    });

    it('should place null/undefined values at the bottom when sorting', () => {
      const p1Rows = [
        { NIK: '3301010001', 'Nama Balita': 'Andi', tinggi_badan_cm: 80.0 },
        { NIK: '3301010002', 'Nama Balita': 'Budi', tinggi_badan_cm: '' }, // null height
        { NIK: '3301010003', 'Nama Balita': 'Citra', tinggi_badan_cm: 70.0 },
      ];
      const p2Rows = [
        { NIK: '3301010001', 'Nama Balita': 'Andi', tinggi_badan_cm: 85.0 },
        { NIK: '3301010002', 'Nama Balita': 'Budi', tinggi_badan_cm: '' },
        { NIK: '3301010003', 'Nama Balita': 'Citra', tinggi_badan_cm: 76.0 },
      ];

      component.activeSubMenu.set('cohort');
      component.period1Data.set(p1Rows);
      component.period2Data.set(p2Rows);
      component.period1Columns.set(Object.keys(p1Rows[0]));
      component.period2Columns.set(Object.keys(p2Rows[0]));
      component.p1Mapping.set(StuntingCohortEngine.detectColumnKeys(Object.keys(p1Rows[0])));
      component.p2Mapping.set(StuntingCohortEngine.detectColumnKeys(Object.keys(p2Rows[0])));
      fixture.detectChanges();

      // Sort ASC by p1
      component.toggleSort('p1');
      const ascP1 = component.filteredChildren().map((c) => c.p1Height);
      expect(ascP1).toEqual([70.0, 80.0, null]);

      // Sort DESC by p1 - null remains at bottom
      component.toggleSort('p1');
      const descP1 = component.filteredChildren().map((c) => c.p1Height);
      expect(descP1).toEqual([80.0, 70.0, null]);
    });

    it('should return appropriate labels via getSortColumnLabel()', () => {
      component.sortColumn.set('nik');
      expect(component.getSortColumnLabel()).toBe('NIK Balita');

      component.sortColumn.set('nama');
      expect(component.getSortColumnLabel()).toBe('Nama Balita');

      component.sortColumn.set('delta');
      expect(component.getSortColumnLabel()).toBe('Pertumbuhan (Δ TB)');

      component.switchIndicator('underweight');
      expect(component.getSortColumnLabel()).toBe('Perubahan (Δ BB)');
    });
  });
});

