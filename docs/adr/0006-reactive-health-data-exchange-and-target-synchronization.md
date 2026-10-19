# Modul Domain Pertukaran Data Reaktif (HealthDataExchange) dan Sinkronisasi Target

## Status
Diterima

## Konteks
Aplikasi Dinkes memiliki beberapa modul analitis yang saling berhubungan:
1. `ExcelJoin`: Menggabungkan tabel lintas sheet dan menghitung metrik agregat.
2. `ChartVisualizer`: Memvisualisasikan seri indikator komparatif per wilayah atau per indikator.
3. `StuntingMonitoring`: Melakukan evaluasi capaian intervensi stunting terhadap target triwulanan dan tahunan.

Sebelumnya, pengiriman data antar-modul mengandalkan layanan jembatan (*bridge services*) yang terfragmentasi (`chart-data-bridge.ts`, `stunting-data-bridge.ts`). Pola ini rentan terhadap kehilangan status saat navigasi atau pemuatan ulang peramban (*browser refresh*), menyulitkan sinkronisasi target per indikator, dan membatasi fleksibilitas seleksi kolom pada visualisasi grafik.

## Keputusan
1. **Penerapan Domain Service `HealthDataExchange`**:
   - Menyatukan kanal komunikasi data antara `ExcelJoin`, `ChartVisualizer`, dan `StuntingMonitoring` ke dalam satu modul domain terpadu (`src/app/core/domain/health-data-exchange.ts`).
   - Menggunakan Angular Signals (`chartData`, `stuntingData`) untuk reaktivitas instan tanpa memicu deteksi perubahan zoneless yang tidak perlu.
   - Mengimplementasikan `SessionStorageAdapter` (dengan implementasi `BrowserSessionStorageAdapter` dan `InMemorySessionStorageAdapter`) untuk persistensi transparan lintas navigasi rute dan kemudahan pengujian unit tanpa peramban.

2. **Sinkronisasi Target & Pencocokan Resilien**:
   - Nilai target indikator yang dikonfigurasi di `ExcelJoin` (`columnTargets`) diteruskan secara otomatis ke `ChartVisualizer`.
   - Menggunakan pencocokan nama kolom yang fleksibel (`findMatchingColumnTarget`) yang tahan terhadap penamaan alias kustom maupun pembersihan spasi.
   - Mengadopsi nilai standar aman `50` sebagai *fallback target* apabila target spesifik kolom tidak tersedia atau dinonaktifkan, memastikan grafik batang selalu memiliki garis acuan evaluasi.

3. **Otomatisasi Seri Persentase dengan Seleksi Bebas**:
   - Saat dialihkan dari `ExcelJoin` ke `ChartVisualizer`, sistem secara otomatis mengaktifkan mode komparatif per indikator (`by-indicator`) dan memilih seluruh kolom bertipe persentase/rasio sebagai pilihan bawaan.
   - Menyediakan panel kendali "Kelola Indikator" pada toolbar grafik untuk memberikan keleluasaan penuh bagi pengguna dalam menambah, mengubah, atau menampilkan kolom numerik non-persentase (angka riil/sasaran) tanpa batasan kaku.
   - Menyediakan tampilan *fallback* informatif dengan tombol pemulihan cepat saat seluruh seri dinonaktifkan.

## Konsekuensi
- **Keandalan**: Data hasil join tetap aman dan dapat dimuat ulang saat halaman di-refresh tanpa perlu melakukan proses join ulang.
- **Konsistensi Visual**: Setiap indikator kesehatan menampilkan garis target acuan yang akurat sesuai target dinkes atau nilai batas evaluasi standar.
- **Pembersihan Arsitektur**: Menghilangkan dependensi terhadap bridge services dan modal kesalahan lawas, menghasilkan arsitektur modul yang lebih dalam (*deep module*) dan mudah diuji.
