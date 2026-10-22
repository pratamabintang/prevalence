# Ruang Kerja Partisi Periode Terpusat (PeriodPartitionWorkspace)

Diputuskan untuk mengekstraksi seluruh logika orkestrasi partisi triwulan, pemindaian ketersediaan slot Google Drive, pengunduhan berkas multi-triwulan, resolusi prioritas berkas lokal vs cloud, serta hidrasi ke dalam dataset terpadu Dinkes ke dalam satu modul dalam (*deep module*) `PeriodPartitionWorkspace` pada lapisan `src/app/core/storage/`.

### Konteks & Masalah Arsitektur
1. **Duplikasi Logika Orkestrasi Lintas Komponen UI**:
   - `ExcelJoinComponent` dan `StuntingMonitoringComponent` menduplikasi lebih dari 400 baris logika penanganan slot periode:
     - Perhitungan dan derivasi daftar tahun aktif (`availableYears`).
     - Pemindaian berkala slot triwulan Google Drive (`listPeriods`).
     - Pengecekan ketersediaan data per kuartal (`isQuarterAvailable`).
     - Alur pemuatan paralel multi-triwulan dengan prioritas fallback (berkas lokal pengguna menimpa slot cloud, dan slot yang hilang dicatat dalam peringatan non-fatal).
   - Ketiadaan batas modul tunggal ini memaksa setiap fitur baru yang membutuhkan data lintas triwulan mengulang kode *imperative* yang sama.
2. **Lapisan Seam yang Terlalu Rendah**:
   - `GasStorageService` hanya bertindak sebagai *HTTP transport adapter* mentah (mengonversi `ArrayBuffer` ke `base64`, memanggil endpoint Web App GAS, mengurai JSON respons).
   - Seluruh logika bisnis partisi (seperti kapan memilih berkas mentah `raw-data.xlsx` vs berkas hasil `joined-result.xlsx`, atau cara menggabungkan berkas lokal untuk TW1 dengan cloud untuk TW2) bocor ke dalam komponen antarmuka pengguna.
3. **Kompleksitas Pengujian Komponen**:
   - Pengujian alur cloud triwulan sebelumnya membutuhkan *fixture* `TestBed` Angular yang berat dan lambat pada berkas spesifikasi komponen (`stunting-monitoring.component.spec.ts`).

### Keputusan Arsitektur
1. **Modul Dalam `PeriodPartitionWorkspace`**:
   - Ditempatkan pada `src/app/core/storage/period-partition-workspace.ts`.
   - Didaftarkan sebagai `@Injectable({ providedIn: 'root' })` berbasis Angular Signals.
   - Menyediakan sinyal reaktif bersama:
     - `availableYears: Signal<number[]>`
     - `periodSlots: Signal<GasPeriodItem[]>`
     - `isLoading: Signal<boolean>`
2. **Kontrak Resolusi Multi-Triwulan (`loadMultiQuarters`)**:
   - Mengadopsi rantai prioritas ketat:
     1. Berkas lokal unggahan pengguna (prioritas utama).
     2. Slot cloud Google Drive (berkas hasil `joined-result.xlsx` atau berkas mentah `raw-data.xlsx`).
     3. Penanda slot hilang non-fatal (`missingQuarters: QuarterSlot[]`).
   - Secara otomatis mengurai *buffer* melalui `DinkesSpreadsheetParser.parse`, sehingga pemanggil langsung menerima `ParsedDinkesDataset` yang bersih dan tervalidasi.
   - Mendukung opsi preferensi varian berkas: `{ prefer: 'raw' | 'result' | 'auto' }`.
3. **Penyimpanan Atomik & Pembuatan Hasil Otomatis (`savePeriodPartition`)**:
   - Menyediakan metode penyimpanan mandiri di mana jika `resultExcelBuffer` tidak disertakan oleh pemanggil, modul secara otomatis mengeksekusi penggabungan di memori untuk menghasilkan lembar rekapitulasi, lalu mengunggah ketiga artefak (`raw-data.xlsx`, `joined-result.xlsx`, `join-config.json`) secara atomik ke Google Drive.
4. **Strategi Refaktorisasi Facade**:
   - Komponen UI `ExcelJoinComponent` dan `StuntingMonitoringComponent` tetap mempertahankan tanda tangan metode publiknya untuk kompatibilitas pengujian, namun mendelegasikan pemrosesan internalnya secara langsung ke `PeriodPartitionWorkspace`.

### Konsekuensi & Keuntungan
- **Leverage Tinggi**: Pemanggilan multi-triwulan yang sebelumnya membutuhkan loop 150 baris kini dapat diselesaikan dalam 1 baris panggilan: `await this.periodWorkspace.loadMultiQuarters(year, selectedSlots, localFiles)`.
- **Lokality Kuat**: Perubahan pada aturan partisi, skema folder Google Drive, maupun penanganan cache terlokalisasi di satu berkas inti di lapisan `core/storage/`.
- **Pengujian Cepat**: Seluruh skenario partisi dan resolusi fallback dapat diuji secara murni menggunakan Vitest tanpa dependensi DOM Angular.
