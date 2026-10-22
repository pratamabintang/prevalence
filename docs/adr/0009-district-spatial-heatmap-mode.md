# Mode Spasial Heatmap Kabupaten/Kota pada Visualisasi Grafik

Diputuskan untuk menambahkan mode visualisasi ke-3 pada modul Visualisasi Grafik (`ChartVisualizerComponent`), yaitu **Peta Heatmap Indikator** (*District Spatial Heatmap*), dengan logika komputasi spasial, normalisasi wilayah, penentuan gradasi warna HSL adaptif, perankingan, dan agregasi statistik yang didelegasikan ke modul dalam (*deep module*) `DistrictHeatmapEngine`.

### Konteks & Latar Belakang
1. Modul Visualisasi Grafik sebelumnya memiliki dua mode utama:
   - **Mode Per Wilayah** (`'by-region'`): Membandingkan beberapa indikator kesehatan sekaligus untuk satu kabupaten/kota.
   - **Mode Per Indikator** (`'by-indicator'`): Menampilkan grafik batang horizontal terpisah untuk masing-masing kolom indikator.
2. Pengguna membutuhkan cara baru untuk melihat sebaran spasial geografis di 35 Kabupaten/Kota Provinsi Jawa Tengah untuk setiap indikator satu per satu dalam satu layar, disertai kendali `<select>` untuk berpindah indikator secara dinamis (mengadaptasi keunggulan visualisasi spasial peta SVG pada modul Dashboard Stunting).

### Keputusan Arsitektur
1. **Modul Dalam `DistrictHeatmapEngine`**:
   - Ditempatkan pada `src/app/core/chart/district-heatmap-engine.ts`.
   - Menggabungkan data polygon 35 Kabupaten/Kota Jawa Tengah (`DistrictMapFeature` dari `stunting-map-data.ts`) dengan baris data dinamis spreadsheet (`ChartDataRow[]`).
   - Memanfaatkan `RegionNormalizer.normalizeJoinKey(name, true)` untuk menjamin pencocokan nama daerah yang tahan variasi (misal awalan kode BPS `3301 - `, singkatan `KAB.`, `KOTA`, kapitalisasi, dan spasi ganda) serta secara ketat membedakan Kabupaten vs Kota bernama sama (misal `Kabupaten Magelang` vs `Kota Magelang`).
   - Menghitung gradasi warna HSL adaptif berdasarkan hue indikator (`extractHueFromHex`), rasio nilai terhadap rentang min-max, peringkat capaian daerah (`rank`), dan status capaian target (`achieved` / `unachieved` / `missing`).
   - Menyediakan `gradientCss` untuk bilah legenda warna kontinu (CSS `linear-gradient`) beserta kalkulasi posisi penanda target (`targetPositionPercent`) dan penanda dinamis wilayah yang disorot (`ratioPercent`).
2. **Modul Pengetahuan Domain `IndicatorStuntingKnowledge`**:
   - Ditempatkan pada `src/app/core/chart/indicator-stunting-knowledge.ts`.
   - Mengintegrasikan basis data domain intervensi stunting spesifik Dinkes (Remaja Putri, Ibu Hamil, Balita, Gizi, Imunisasi) yang secara otomatis menyajikan:
     - **Definisi Indikator (Ini Apa)**: Definisi operasional teknis pengukuran.
     - **Hubungan Terhadap Stunting (1000 HPK)**: Jalur biologis dan kausalitas pencegahan stunting.
     - Sasaran intervensi dan standar target acuan.
3. **Perluasan `viewMode` dan Eliminasi Glitch UI**:
   - Tipe `viewMode` diperluas menjadi `'by-region' | 'by-indicator' | 'by-map'`.
   - Sinyal `activeMapIndicator` menyimpan key indikator aktif pada peta (default ke indikator pertama yang dipilih).
   - Menata ulang tata letak bilah samping (*sidebar*): menempatkan daftar **Top 5 Peringkat** di atas kartu **Pemeriksa Wilayah** (*District Inspector*) serta memberikan `min-h-[280px]` yang stabil untuk mengeliminasi pergeseran tata letak (*layout shift*) dan glitch berkedip saat kursor mouse melintasi item peringkat.
   - Menambahkan `pointer-events-none` pada elemen teks dan titik centroid SVG peta agar transisi hover poligon wilayah berjalan mulus tanpa fluktuasi *event bubbling*.
4. **Persistensi Preset**:
   - Antarmuka `ChartConfigurationPreset` dan `ChartPresetStore` diperbarui untuk menyimpan dan memulihkan `viewMode: 'by-map'` serta `activeMapIndicator`.
5. **Pengujian Komprehensif (TDD)**:
   - Pengujian terisolasi unit engine pada `district-heatmap-engine.spec.ts` (5 pengujian).
   - Pengujian terisolasi pengetahuan stunting pada `indicator-stunting-knowledge.spec.ts` (8 pengujian).
   - Pengujian integrasi komponen Angular pada `chart-visualizer.component.spec.ts` (total 64 pengujian komponen).
   - Seluruh rangkaian unit test proyek (28 suite, 408 pengujian) lulus 100%.
