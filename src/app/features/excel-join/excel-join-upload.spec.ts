import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
// @ts-ignore -- Node built-in dipakai hanya untuk membaca fixture di folder public/
import { readFileSync } from 'node:fs';
import { ExcelJoinComponent } from './excel-join.component';
import { BackendStorageService } from '../../core/storage/backend-storage.service';
import { ExcelWorkbookAdapter } from '../../shared/excel';

function loadFile(path: string, name: string): File {
  const buf: Uint8Array = readFileSync(path);
  return new File([new Uint8Array(buf)], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

const DEFAULT_FILE = 'public/data/default-join-data.xlsx';
const HASIL_FILE = 'public/Hasil_Join_TW1.xlsx';

function hasilJoinHeaders(): string[] {
  const wb = ExcelWorkbookAdapter.readWorkbook(
    new Uint8Array(readFileSync(HASIL_FILE)).buffer as ArrayBuffer,
  );
  const grid = ExcelWorkbookAdapter.readSheetAsGrid(wb.Sheets['Hasil Join']);
  // Buang kolom "No" (nomor urut) dan "Capaian" (kolom turunan, bukan kolom data).
  return (grid[0] as string[]).filter((h) => h !== 'No' && h !== 'Capaian');
}

describe('ExcelJoinComponent - regresi unggah berkas dengan penyimpanan server', () => {
  async function setup(serverConfig: unknown) {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ExcelJoinComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    const backend = TestBed.inject(BackendStorageService);
    vi.spyOn(backend, 'isConfigured').mockReturnValue(true);
    vi.spyOn(backend, 'getConfig').mockResolvedValue(
      serverConfig
        ? ({ success: true, hasConfig: true, config: serverConfig } as never)
        : ({ success: true, hasConfig: false } as never),
    );
    return TestBed.createComponent(ExcelJoinComponent).componentInstance;
  }

  const upload = (c: ExcelJoinComponent, f: File) =>
    c.onFileSelected({ target: { files: [f], value: '' } } as unknown as Event);

  const displayNames = (c: ExcelJoinComponent) =>
    c.resultColumns().map((k) => c.getColumnDisplayName(k));

  it('default-join-data.xlsx langsung datar (flat) dengan urutan kolom sesuai konfigurasi awal', async () => {
    const c = await setup(null);
    await upload(c, loadFile(DEFAULT_FILE, 'default-join-data.xlsx'));

    expect(c.outputHeaderFormat()).toBe('concat');
    expect(c.htmlHeaderGrid().length).toBe(1);
    expect(displayNames(c)).toEqual(hasilJoinHeaders());
  });

  it('unggah Hasil Join lalu default-join-data.xlsx tidak memunculkan peringatan sheet tidak cocok', async () => {
    const c = await setup(null);
    await upload(c, loadFile(HASIL_FILE, 'Hasil_Join_TW1.xlsx'));
    await upload(c, loadFile(DEFAULT_FILE, 'default-join-data.xlsx'));

    expect(c.configNotification()?.type).not.toBe('warning');
    expect(c.resultRows().length).toBeGreaterThan(0);
    expect(c.htmlHeaderGrid().length).toBe(1);
    expect(displayNames(c)).toEqual(hasilJoinHeaders());
  });

  it('preset basi di server yang tidak menghasilkan data digantikan template standar Dinkes', async () => {
    const c = await setup({
      version: '1.0',
      joinBy: 'Kabupaten/Kota',
      sheets: [{ sheetName: 'Gizi', variables: ['Stunting %'] }],
    });
    await upload(c, loadFile(DEFAULT_FILE, 'default-join-data.xlsx'));

    expect(c.resultRows().length).toBeGreaterThan(0);
    expect(displayNames(c)).toEqual(hasilJoinHeaders());
  });
});
