# Dummy Data Triwulan

Berkas dummy hasil generate ulang berbasis `example.xlsx`. Dipakai untuk menguji sistem (partisi periode per triwulan).

## Isi
12 berkas, 1 per triwulan:

| Tahun | Triwulan |
| --- | --- |
| 2024 | `TW1-2024.xlsx` … `TW4-2024.xlsx` |
| 2025 | `TW1-2025.xlsx` … `TW4-2025.xlsx` |
| 2026 | `TW1-2026.xlsx` … `TW4-2026.xlsx` |

`manifest.json` = urutan periode (year, quarter, step).

## Struktur
Identik `example.xlsx`:
- Sheet `Hasil Join` — 32 kolom indikator intervensi spesifik, 35 kabupaten/kota, baris `Jumlah` / `Rata-rata` / `Target`.
- Sheet `MASALAH GIZI` — header 2 tingkat (indikator + `Jumlah`/`%`), 22 kolom, 35 kabupaten/kota, baris ringkasan sama.

Wilayah, header, dan baris `Target` disalin persis dari `example.xlsx`.

## Aturan nilai
- Semua kolom numerik (cacah dan persen) **naik ketat** tiap triwulan, berurutan lintas periode: TW1 2024 → TW4 2024 → TW1 2025 → … → TW4 2026.
- Persen dijaga pada rentang 0–100.
- Nilai tiap kabupaten berbeda (faktor acak per wilayah per kolom), deterministik/reproducible.
- Baris `Jumlah` = penjumlahan kolom cacah; `Rata-rata` = rata-rata kolom persen. Keduanya dihitung dari data, bukan salinan.
- Kolom `Capaian` (skor cacah, diabaikan parser) juga naik ketat; nilainya sengaja boleh melewati angka target karena murni dummy.

## Regenerate
```
node .scratch/generate-dummy.mjs   # tulis ulang 12 berkas
node .scratch/validate-dummy.mjs   # cek struktur + kenaikan ketat
```
