# Konsolidasi Ruang Kerja Konfigurasi Preset (ConfigurationWorkspace)

Diputuskan untuk mengonsolidasikan pengelolaan persistensi preset konfigurasi (Join Excel, Pemantauan Stunting, dan Visualisasi Grafik) ke dalam modul domain terpadu `ConfigurationWorkspace` pada lapisan `src/app/core/storage/configuration-workspace.ts`, serta memisahkan logika persistensi berkas/penyimpanan dari algoritma pencocokan fuzzy kolom spreadsheet (`ExcelResilientMatcher`).

### Konteks & Masalah Arsitektur
1. **Proliferasi Toko Preset Pasif (Three Shallow Static Pass-Throughs)**:
   - Terdapat tiga modul toko preset statis di lapisan fitur:
     - `src/app/features/excel-join/preset-store.ts` (`PresetStore`)
     - `src/app/features/stunting-monitoring/stunting-preset-store.ts` (`StuntingPresetStore`)
     - `src/app/features/chart-visualizer/chart-preset-store.ts` (`ChartPresetStore`)
   - Ketiga modul ini hanya bertindak sebagai *pass-through* 1-baris ke `GenericPresetStore<T>`, sehingga gagal memenuhi uji penghapusan (*deletion test*) dan menciptakan redundansi kode boilerplate.
2. **Kopling Keliru Antara Persistensi dan Pencocokan Fuzzy Kolom**:
   - Ketiga toko preset mengekspor ulang atau membungkus metode dari `ExcelResilientMatcher` (`findMatchingSheet`, `findMatchingHeader`, `findMatchingJoinKey`, `matchSheets`).
   - Akibatnya, modul persistensi penyimpanan terikat erat dengan logika penelusuran variasi header spreadsheet Dinkes. Pemanggil yang hanya butuh mencocokkan kolom terpaksa mengimpor modul penyimpanan data.
3. **Pemberian Nama dan Validasi Skema yang Tersebar**:
   - Penamaan berkas unduh `.json` dan penanganan validasi skema dibuat secara terpisah di masing-masing modul fitur tanpa satu kontrak domain terpusat.

### Keputusan Arsitektur
1. **Modul Domain `ConfigurationWorkspace`**:
   - Ditempatkan di `src/app/core/storage/configuration-workspace.ts`.
   - Mengintegrasikan persistensi preset untuk ketiga modul utama Dinkes:
     - **Join Excel**: `JoinConfigurationPreset`, kunci penyimpanan `dinkes_excel_join_config_last`.
     - **Stunting Monitoring**: `AnyStuntingPreset` (`StuntingPipelinePreset` v2.0 & `StuntingConfigurationPreset` v1.0), kunci penyimpanan `dinkes_stunting_config_last`.
     - **Chart Visualizer**: `ChartConfigurationPreset`, kunci penyimpanan `dinkes_chart_visualizer_config_last`.
   - Menyediakan instance `GenericPresetStore` bertipe kuat untuk masing-masing preset (`ConfigurationWorkspace.excelJoin`, `ConfigurationWorkspace.stunting`, `ConfigurationWorkspace.chart`), serta metode fasad praktis:
     - `ConfigurationWorkspace.hasSavedPreset(type)`
     - `ConfigurationWorkspace.loadLastPreset(type)`
     - `ConfigurationWorkspace.savePreset(type, preset, triggerDownload?)`
     - `ConfigurationWorkspace.parsePresetJson(type, text)`
     - `ConfigurationWorkspace.clearPreset(type)`
2. **Pemisahan Tegas `ExcelResilientMatcher`**:
   - Seluruh logika pencocokan fuzzy header dan sheet Excel dikembalikan ke modul asalnya: `ExcelResilientMatcher` (`src/app/core/excel/excel-resilient-matcher.ts`).
   - Komponen antarmuka pengguna memanggil `ExcelResilientMatcher` langsung ketika memetakan kolom spreadsheet, tanpa melalui toko penyimpanan.
3. **Penghapusan Total Toko Preset Pasif di Lapisan Fitur**:
   - Berkas *pass-through* di lapisan fitur (`features/excel-join/preset-store.ts`, `features/stunting-monitoring/stunting-preset-store.ts`, `features/chart-visualizer/chart-preset-store.ts`) dihapus sepenuhnya dan seluruh komponen serta pengujian unit diarahkan langsung ke `ConfigurationWorkspace` dan `ExcelResilientMatcher`.

### Konsekuensi & Keuntungan
- **Lokalitas Tunggal**: Skema konfigurasi, validasi JSON, dan kunci penyimpanan browser kini terpusat dalam satu modul konfigurasi yang jelas.
- **Batas Bersih (Clean Seams)**: Mengeliminasi kopling antara penyimpanan browser dan pemrosesan spreadsheet.
- **Kemudahan Pengujian**: Seluruh alur serialisasi dan deserialisasi preset dapat diuji dengan mudah menggunakan `InMemoryStorageAdapter` dan `InMemoryFileDownloadAdapter`.
