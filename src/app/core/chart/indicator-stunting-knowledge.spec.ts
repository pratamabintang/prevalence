import { describe, it, expect } from 'vitest';
import { IndicatorStuntingKnowledge } from './indicator-stunting-knowledge';

describe('IndicatorStuntingKnowledge', () => {
  it('identifies Rematri TTD correctly', () => {
    const res = IndicatorStuntingKnowledge.getExplanation(
      'Persentase remaja putri mendapatkan dan mengonsumsi TTD - % (2)',
    );
    expect(res.key).toBe('ttd_rematri');
    expect(res.category).toBe('Remaja');
    expect(res.stuntingRelation).toContain('anemia');
    expect(res.calculation.formulaText).toBe('(A / B) × 100%');
    expect(res.calculation.numeratorDescription).toContain('tablet TTD');
    expect(res.calculation.denominatorDescription).toContain('satuan pendidikan');
  });

  it('identifies ANC K6 correctly', () => {
    const res = IndicatorStuntingKnowledge.getExplanation('Laporan Pemeriksaan ANC - % K6');
    expect(res.key).toBe('anc_k6');
    expect(res.category).toBe('Ibu Hamil');
    expect(res.stuntingRelation).toContain('janin');
  });

  it('identifies ASI Eksklusif correctly', () => {
    const res = IndicatorStuntingKnowledge.getExplanation(
      'Persentase bayi usia <6 bulan mendapat ASI Eksklusif - %',
    );
    expect(res.key).toBe('asi_eksklusif');
    expect(res.category).toBe('Gizi');
    expect(res.definition).toContain('Air Susu Ibu');
  });

  it('identifies MP-ASI Beragam correctly', () => {
    const res = IndicatorStuntingKnowledge.getExplanation(
      'Persentase Anak 6-23 bulan mendapat MPASI - % (4)',
    );
    expect(res.key).toBe('mpasi_beragam');
    expect(res.stuntingRelation).toContain('protein hewani');
  });

  it('identifies IDL correctly', () => {
    const res = IndicatorStuntingKnowledge.getExplanation('IDL - (%) Capaian');
    expect(res.key).toBe('imunisasi_dasar_lengkap');
    expect(res.category).toBe('Imunisasi');
  });

  it('identifies Stunting prevalensi correctly', () => {
    const res = IndicatorStuntingKnowledge.getExplanation('Prevalensi Balita Stunting');
    expect(res.key).toBe('prevalensi_stunting');
    expect(res.category).toBe('Hasil Luaran');
    expect(res.calculation.formulaText).toBe('(A / B) × 100%');
    expect(res.calculation.numeratorDescription).toContain('pendek');
  });

  it('handles triwulan series keys gracefully', () => {
    const res = IndicatorStuntingKnowledge.getExplanation('Triwulan 2');
    expect(res.key).toBe('tw_2');
    expect(res.category).toBe('Umum');
    expect(res.calculation.formulaText).toBe('(A / B) × 100%');
    expect(res.calculation.numeratorDescription).toContain('Triwulan 2');
  });

  it('provides safe fallback for unknown indicators', () => {
    const res = IndicatorStuntingKnowledge.getExplanation('Kunjungan Lansia Posbindu');
    expect(res.category).toBe('Umum');
    expect(res.definition).toContain('Kunjungan Lansia Posbindu');
    expect(res.calculation.formulaText).toBe('(A / B) × 100%');
    expect(res.calculation.numeratorDescription).toContain('Kunjungan Lansia Posbindu');
  });
});
