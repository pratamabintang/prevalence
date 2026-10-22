# Mesin Alur Kerja Pemantauan Stunting Terpadu (StuntingWorkflowEngine)

Diputuskan untuk mengekstraksi seluruh logika alur pemantauan stunting 3-tahap (Unggah & Gabung Lembar Kerja, Perancang Kategori Indikator, dan Evaluasi Capaian/Scorecard) dari `StuntingMonitoringComponent` ke dalam modul domain dalam (*deep module*) `StuntingWorkflowEngine` pada lapisan `src/app/core/stunting/`.

### Konteks & Masalah Arsitektur
1. **God-Component 3.100+ Baris**:
   - `StuntingMonitoringComponent` menampung lebih dari 70 sinyal reaktif dan mencampuradukkan penanganan antarmuka pengguna (tabel, modal, form input) dengan logika domain inti.
   - Pengujian alur bisnis stunting secara menyeluruh sebelumnya mustahil dilakukan tanpa me-mount komponen DOM Angular yang sangat besar melalui `TestBed`.
2. **Duplikasi Logika Penggabungan Lembar Kerja (Sheet Join Loop)**:
   - Pada baris 1400–1545 dari `StuntingMonitoringComponent`, terdapat implementasi perulangan penggabungan multi-sheet kustom yang menduplikasi normalisasi nama wilayah, resolusi tabrakan nama kolom (*collision prefixing*), dan deteksi baris ringkasan/target/total.
   - Penggabungan ini mengabaikan mesin `ExcelJoinEngine` yang telah teruji, sehingga menciptakan risiko divergensi semantik penggabungan data.
3. **Ketiadaan Validasi Invarian Transisi Langkah (*Step Invariant*)**:
   - Navigasi stepper (Langkah 1 $\to$ 2 $\to$ 3) sebelumnya hanya dikendalikan oleh kondisi tombol `disabled` di lapisan HTML template.
   - Tidak ada penjaga status domain (*state guard*) yang mencegah pemrosesan evaluasi ketika data gabungan belum tervalidasi atau ketika belum ada kategori indikator yang dikonfigurasi.

### Keputusan Arsitektur
1. **Modul Domain `StuntingWorkflowEngine`**:
   - Ditempatkan pada `src/app/core/stunting/stunting-workflow-engine.ts`.
   - Didaftarkan sebagai `@Injectable({ providedIn: 'root' })` berbasis Angular Signals.
   - Menyediakan antarmuka reaktif yang mencakup:
     - **Status Alur Stepper**: `activeStep: Signal<1 | 2 | 3>`, `canTransitionTo(targetStep): { allowed: boolean; reason?: string }`, dan `transitionTo(targetStep): boolean`.
     - **Ingest & Join Data**: `ingestWorkbook(workbook, setup)`, `setJoinedDataset(rows, columns, keyCol, summaryRow?, targetRow?, totalRow?)`, pengecualian baris berbasis kata kunci dan baris kosong, serta penanda baris manual.
     - **Perancang Kategori & Indikator**: Manajemen kategori (`categories`), penambahan sub-kategori, kalkulasi pasangan agregasi pembilang/penyebut, dan auto-populasi indikator standar Dinkes Jawa Tengah (`autoPopulateIndicators`).
     - **Siklus Evaluasi Capaian**: Sinyal komputasi `evaluationResult` yang memanggil `StuntingEvaluationEngine.evaluateAggregatedDataset`, penghitungan agregat KPI (`onTrackCount`, `perluPercepatanCount`, dsb.), dan pemilihan triwulan aktif.
2. **Penghapusan Duplikasi Join & Integrasi `ExcelJoinEngine`**:
   - Menghapus perulangan kustom di komponen dan mendelegasikan penggabungan multi-sheet secara langsung ke `ExcelJoinEngine.executeJoin`.
   - Hasil penggabungan (`JoinedDatasetResult`) dinormalisasi secara otomatis oleh mesin alur kerja dengan deteksi baris ringkasan, baris target, dan baris total.
3. **Penegakan Invarian Transisi Langkah**:
   - **Langkah 1 $\to$ 2**: Memeriksa bahwa baris data gabungan yang valid (`validJoinedRows`) tidak boleh kosong.
   - **Langkah 2 $\to$ 3**: Memeriksa bahwa terdapat minimal satu kategori yang memiliki sub-kategori indikator.
   - Perpindahan langkah yang melanggar invarian akan ditolak secara atomik disertai pesan penjelasan.
4. **Strategi Refaktorisasi Facade di `StuntingMonitoringComponent`**:
   - `StuntingMonitoringComponent` bertindak sebagai penyaji antarmuka (*presentation facade*) yang menyambungkan sinyal dan aksi UI langsung ke `StuntingWorkflowEngine`.
   - Menjaga kompatibilitas 100% terhadap seluruh pengujian unit yang telah ada pada `stunting-monitoring.component.spec.ts`.

### Konsekuensi & Keuntungan
- **Leverage Tinggi**: Seluruh alur pemantauan stunting dari pengunggahan lembar kerja hingga penilaian scorecard triwulan kini dapat diuji secara *headless* dalam hitungan milidetik tanpa `TestBed` Angular.
- **Lokalitas Tunggal**: Semantik penggabungan data lembar kerja terpusat pada `ExcelJoinEngine`, menghilangkan ~150 baris duplikasi kode perulangan join.
- **Integritas Domain**: Penegakan invarian transisi langkah mencegah kondisi balapan (*race condition*) atau eksekusi evaluasi pada status data yang korup/kosong.
