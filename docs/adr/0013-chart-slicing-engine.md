# Mesin Pengiris Grafik Presentasi (ChartSlicingEngine)

Diputuskan untuk mengekstraksi seluruh logika pemotongan multi-dimensi (*multi-dimensional slicing*), pengelompokan grafik komparatif (per-indikator vs per-wilayah), kalkulasi ringkasan metrik statistik kesehatan, dan pengurutan peringkat dari `ChartVisualizerComponent` ke dalam modul domain presentasi dalam (*deep presentation module*) `ChartSlicingEngine` pada lapisan `src/app/core/chart/chart-slicing-engine.ts`.

### Konteks & Masalah Arsitektur
1. **Pencampuran Logika Domain-Presentasi dengan Komponen DOM**:
   - `ChartVisualizerComponent` sebelumnya memuat lebih dari 2.250 baris kode yang menggabungkan manajemen UI (modal, tombol pengaturan, unduhan SVG/PNG) dengan logika analitik statistik yang mendalam.
   - Sinyal terkomputasi `regionLayouts` dan `indicatorLayouts` memakan lebih dari 240 baris perulangan bersarang (`nested loops`), manipulasi `Map`, pemilahan angka pintar (`IndicatorEvaluator.parseSmartNumber`), agregasi capaian, penentuan nilai ekstrem (tertinggi dan terendah), serta komparasi pemeringkatan (`sortMode`).
2. **Keterbatasan Pengujian Logika Analitik Grafik**:
   - Karena logika pengirisan (*slicing*) dan statistik tertanam di dalam sinyal komponen Angular, pengujian fungsionalitas statistik (apakah angka 0 dihitung terpisah dari data kosong, apakah pengurutan descending/ascending menangani nilai `null` dengan benar, apakah garis target per-indikator digambar tepat) memerlukan inisialisasi berat melalui `TestBed`.
3. **Batas Modul yang Tidak Tepat jika Dimasukkan ke `ChartLayoutEngine`**:
   - `ChartLayoutEngine` bertugas murni mengonversi matriks 2D tunggal menjadi sistem koordinat kartesian SVG (sumbu X/Y, label bar, tinggi bar, margin).
   - Menambahkan tanggung jawab pengirisan multi-grafik, kalkulasi kesehatan agregat, dan pemeringkatan wilayah ke dalam `ChartLayoutEngine` akan membuat modul tersebut menjadi lebar (*shallow/broad*) dan mengaburkan tanggung jawab geometri grafisnya.

### Keputusan Arsitektur
1. **Pemisahan Modul `ChartSlicingEngine`**:
   - Ditempatkan di `src/app/core/chart/chart-slicing-engine.ts`.
   - Diimplementasikan sebagai kelas *stateless* murni dengan metode statis murni (`pure static functions`):
     - `ChartSlicingEngine.computeRegionGroups(spec: RegionSlicingSpec): RegionChartGroup[]`
     - `ChartSlicingEngine.computeIndicatorGroups(spec: IndicatorSlicingSpec): IndicatorChartGroup[]`
   - Memanfaatkan `IndicatorEvaluator.parseSmartNumber` untuk parsing data resilien dan mendelegasikan komputasi tata letak visual setiap kelompok ke `ChartLayoutEngine.computeLayout`.
2. **Spesifikasi Tipe & Kontrak Data**:
   - Mengekstrak antarmuka `IndicatorStats`, `RegionChartGroup`, `IndicatorChartGroup`, `RegionSlicingSpec`, dan `IndicatorSlicingSpec` ke dalam `chart-slicing-engine.ts`.
   - Memastikan properti statistik mencakup:
     - `total`, `totalTargeted`, `validCount`, `missingCount`, `zeroCount`, `achievedCount`
     - `avgValue` (pembulatan 1 desimal presisi)
     - `highest` dan `lowest` (nilai ekstrem beserta label/nama terkait)
     - `targetValue`
3. **Penanganan Pengurutan Resilien (*Resilient Sorting*)**:
   - Memproses pengurutan `sortMode: 'desc' | 'asc' | 'default'` secara konsisten:
     - Untuk per-wilayah: mengurutkan Kategori Wilayah berdasarkan nilai rata-rata (`avgValue`), di mana nilai `null` selalu ditempatkan di posisi paling akhir.
     - Untuk per-indikator: mengurutkan Kategori Wilayah berdasarkan nilai capaian indikator tersebut, di mana nilai `null` selalu ditempatkan di posisi paling akhir.
4. **Integrasi Komponen tanpa Pemecahan API (Zero Breakage Facade)**:
   - `ChartVisualizerComponent` mempertahankan sinyal terkomputasi `regionLayouts` dan `indicatorLayouts` sebagai antarmuka reaktif yang langsung mendelegasikan eksekusi ke `ChartSlicingEngine`.
   - Seluruh template HTML dan 64 pengujian unit pada `chart-visualizer.component.spec.ts` tetap berjalan tanpa perubahan pemanggilan.

### Konsekuensi & Keuntungan
- **Lokalitas & Kedalaman**: Logika analitik pengirisan data grafik dan penghitungan agregat kesehatan kini terpusat dalam satu modul fungsional mendalam yang mudah dipelihara dan dipelajari.
- **Pengujian Cepat (Headless Sub-Millisecond Unit Testing)**: Algoritma statistik dan perancangan kelompok grafik dapat diuji secara terisolasi tanpa overhead `TestBed` atau DOM rendering.
- **Komponen UI Ramping**: Mengurangi lebih dari 240 baris kode logika komputasi kompleks dari `ChartVisualizerComponent`, memperjelas peran komponen sebagai pengendali presentasi murni.
