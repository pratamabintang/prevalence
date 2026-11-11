import { describe, expect, it } from 'vitest';
import { DatasetTableModel } from './dataset-table.model';

describe('DatasetTableModel', () => {
  const basePayload = {
    rows: [
      { 'Kabupaten/Kota': 'CILACAP', 'Ibu Hamil ANC 6x': 100, '% ANC 6x': 60 },
      { 'Kabupaten/Kota': 'BANYUMAS', 'Ibu Hamil ANC 6x': 200, '% ANC 6x': 50 },
    ],
    columns: ['Kabupaten/Kota', 'Ibu Hamil ANC 6x', '% ANC 6x'],
    targets: { '% ANC 6x': { enabled: true, operator: '>=' as const, value: 60 } },
    sums: { 'Ibu Hamil ANC 6x': true },
    averages: { '% ANC 6x': true },
  };

  it('should activate all calculation features by default', () => {
    const model = new DatasetTableModel('masalah-gizi');
    model.load({ ...basePayload });

    expect(model.enableJumlah()).toBe(true);
    expect(model.enableAverage()).toBe(true);
    expect(model.enableTarget()).toBe(true);
    expect(model.enableCapaian()).toBe(true);
  });

  it('should activate features even when payload has no sums or targets', () => {
    const model = new DatasetTableModel('masalah-gizi');
    model.load({
      rows: [{ 'Kabupaten/Kota': 'CILACAP', '% ANC 6x': 60 }],
      columns: ['Kabupaten/Kota', '% ANC 6x'],
    });

    expect(model.enableJumlah()).toBe(true);
    expect(model.enableAverage()).toBe(true);
    expect(model.enableTarget()).toBe(true);
    expect(model.enableCapaian()).toBe(true);
  });

  it('should keep an explicit opt-out from the payload', () => {
    const model = new DatasetTableModel('masalah-gizi');
    model.load({ ...basePayload, enableJumlah: false, enableCapaian: false });

    expect(model.enableJumlah()).toBe(false);
    expect(model.enableAverage()).toBe(true);
    expect(model.enableTarget()).toBe(true);
    expect(model.enableCapaian()).toBe(false);
  });
});
