import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { DatasetTableComponent } from './dataset-table.component';
import { DatasetTableModel } from './dataset-table.model';

describe('DatasetTableComponent', () => {
  let fixture: ComponentFixture<DatasetTableComponent>;
  let model: DatasetTableModel;

  async function createFixture(): Promise<void> {
    fixture = TestBed.createComponent(DatasetTableComponent);
    fixture.componentRef.setInput('model', model);
    fixture.componentRef.setInput('title', 'Hasil Join');
    fixture.componentRef.setInput('badgeLabel', 'Tabel Masalah Gizi');
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatasetTableComponent],
    }).compileComponents();

    model = new DatasetTableModel('masalah-gizi');
    model.load({
      rows: [
        { 'Kabupaten/Kota': 'CILACAP', 'Stunting - %': 5.11 },
        { 'Kabupaten/Kota': 'BANYUMAS', 'Stunting - %': 12.81 },
      ],
      columns: ['Kabupaten/Kota', 'Stunting - %'],
    });
    await createFixture();
  });

  function headerEl(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="dataset-table-header"]',
    ) as HTMLElement;
  }

  function expand(): void {
    headerEl().click();
    fixture.detectChanges();
  }

  it('should render collapsed by default with a hidden-table placeholder', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('table')).toBeNull();
    expect(el.querySelector('[data-testid="dataset-table-hidden-placeholder"]')).toBeTruthy();
    expect(headerEl().getAttribute('aria-expanded')).toBe('false');
  });

  it('should expand table content when the header is clicked', () => {
    const el = fixture.nativeElement as HTMLElement;
    expand();

    expect(el.querySelector('table')).toBeTruthy();
    expect(el.querySelector('[data-testid="dataset-table-hidden-placeholder"]')).toBeNull();
    expect(headerEl().getAttribute('aria-expanded')).toBe('true');
  });

  it('should expand via keyboard Enter on the header', () => {
    headerEl().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('table')).toBeTruthy();
  });

  it('should hide calculation feature toggle buttons', () => {
    const el = fixture.nativeElement as HTMLElement;
    expand();

    const text = el.textContent ?? '';
    expect(text).not.toContain('Jumlah: ');
    expect(text).not.toContain('Rata-rata: ');
    expect(text).not.toContain('Target: ');
    expect(text).not.toContain('Capaian: ');
  });

  it('should render summary rows active by default', async () => {
    model = new DatasetTableModel('masalah-gizi');
    model.load({
      rows: [{ 'Kabupaten/Kota': 'CILACAP', '% ANC 6x': 60 }],
      columns: ['Kabupaten/Kota', '% ANC 6x'],
      targets: { '% ANC 6x': { enabled: true, operator: '>=', value: 60 } },
    });
    await createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expand();

    expect(el.querySelector('tfoot')).toBeTruthy();
    expect(el.textContent).toContain('Capaian');
    expect(el.textContent).not.toContain('Target: Aktif');
  });
});
