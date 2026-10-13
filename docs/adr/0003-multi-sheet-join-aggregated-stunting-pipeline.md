# Pipeline Penggabungan Multi-Sheet dan Agregasi Indikator Pemantauan Stunting Berbasis Stepper

## Status
Diterima

## Konteks
Data mentah indikator intervensi stunting di Dinas Kesehatan (Dinkes) berasal dari laporan berkala per-Puskesmas/Kecamatan yang tersebar di beberapa lembar kerja (multi-sheet) dalam berkas Excel. Analis memerlukan mekanisme penggabungan data berbasis kolom kunci (wilayah/Puskesmas), pembersihan baris ringkasan (seperti TOTAL/JUMLAH) untuk mencegah *double-counting*, pembuatan kategori intervensi langsung, serta pembentukan sub-kategori indikator melalui pasangan kolom agregasi: Penyebut (Denominator/Sasaran) dan Pembilang (Numerator/Realisasi), dengan nama kolom realisasi otomatis diadopsi sebagai nama sub-kategori. Evaluasi difokuskan pada satu triwulan aktif dengan target tahunan dan pembanding capaian tahun lalu.

## Keputusan
1. Mengadopsi arsitektur 3-langkah terpadu (*3-Step Pipeline Stepper*) di modul `/stunting-monitoring`:
   - **Langkah 1**: Unggah berkas Excel (mendukung 1 berkas multi-sheet atau berkas tahun lalu terpisah), join lembar kerja dengan kunci wilayah dan normalisasi nama daerah (`RegionNormalizer`), serta seleksi baris (mengecualikan baris TOTAL/JUMLAH).
   - **Langkah 2**: Perancang Kategori & Sub-Kategori Indikator (*Interactive Indicator Builder*). Pengguna menginput nama kategori, menambahkan sub-kategori dengan memilih pasangan Kolom Sasaran (`SUM(Denominator)`) dan Kolom Realisasi (`SUM(Numerator)`), menetapkan target tahun berjalan, serta menghubungkan data capaian tahun lalu (via pasangan kolom atau input angka langsung).
   - **Langkah 3**: Dashboard Hasil Pemantauan & Analisis (Tabel Monitoring Utama, KPI Eksekutif, Indikator Perlu Percepatan, Ekspor Excel ber-styling warna, dan Bridge ke `/chart`).
2. Menghitung capaian triwulan aktif dari agregasi riil: `Capaian (%) = (SUM(Numerator) / SUM(Denominator)) * 100` (atau `SUM(Numerator)` untuk indikator absolut), lalu membandingkannya terhadap *Expected Achievement* triwulan aktif (`Bobot Triwulan × Target Berjalan`) dan capaian tahun lalu.
3. Menyediakan dukungan persistensi penuh melalui *Configuration Preset Store* (`.json` dan `localStorage`) agar skema kategori dan pasangan kolom dapat disimpan dan dimuat ulang secara instan pada triwulan berikutnya.

## Konsekuensi
- Menghilangkan friksi pra-pengolahan: Pengguna tidak perlu lagi membuat tabel ringkasan terpisah di Excel sebelum melakukan evaluasi kinerja.
- Menjamin konsistensi agregasi kabupaten: Nilai persentase capaian dihitung dari rasio total populasi riil (`SUM / SUM`), bukan rata-rata dari rata-rata (*average of averages*).
- Konfigurasi tersimpan memampukan analisis berulang dalam hitungan detik untuk periode mendatang.
