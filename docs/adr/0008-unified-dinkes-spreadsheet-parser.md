# Ingesti Terpadu Buku Kerja Dinkes melalui DinkesSpreadsheetParser

Diputuskan untuk mengekstraksi seluruh logika deteksi format buku kerja, pemindaian header multi-lapis, pemisahan baris ringkasan (Jumlah, Rata-rata, Target), dan eksekusi penggabungan otomatis ke dalam modul dalam (*deep module*) `DinkesSpreadsheetParser` di lapisan core.

### Konteks & Masalah Arsitektur
1. **Asimetri & Duplikasi pada Komponen UI**:
   - `ExcelJoinComponent` dan `StuntingMonitoringComponent` memuat lebih dari 450 baris kode pemindaian spreadsheet tingkat rendah: inspeksi baris per baris, pencocokan nama wilayah (`Kabupaten/Kota`, `Puskesmas`), regex target (`>= 80`), inferensi tipe data numerik vs persentase, dan pemisahan baris ringkasan sintetis.
   - Kode yang berulang ini menyebabkan bug divergensi (misalnya lembar mentah `MASALAH GIZI` pada berkas multi-sheet sempat salah terdeteksi sebagai lembar Hasil Join jadi karena memiliki baris berlabel `Jumlah`).
2. **Ketiadaan Batas Domain Murni (*Shallow Seam*)**:
   - Fungsi pemindaian buku kerja terikat erat pada *lifecycle* dan *signals* komponen Angular, sehingga tidak dapat diuji secara terisolasi tanpa memasang `TestBed` yang berat.
   - Komponen pemanggil harus menangani percabangan manual antara berkas mentah multi-sheet yang harus di-join dan berkas pre-joined yang langsung diekstrak.

### Keputusan Arsitektur
1. **Modul Dalam `DinkesSpreadsheetParser`**:
   - Ditempatkan pada `src/app/core/excel/dinkes-spreadsheet-parser.ts`.
   - Menerima `ArrayBuffer` maupun `XLSX.WorkBook` sebagai masukan melalui satu antarmuka tunggal:
     ```typescript
     DinkesSpreadsheetParser.parse(workbookOrBuffer, options?: ParseOptions): ParsedDinkesDataset
     ```
2. **Penanganan Format Ganda di Balik Satu Antarmuka**:
   - **Pre-Joined / Hasil Join Dinkes**: Dideteksi apabila workbook memiliki sheet bernama "Hasil Join" atau merupakan buku kerja satu sheet dengan indikator persentase dan baris ringkasan. Modul mengekstrak baris data wilayah, baris Jumlah, Rata-rata, Target, dan konfigurasi kolom.
   - **Raw Multi-Sheet**: Jika buku kerja memiliki sheet-sheet standar Dinkes (`remaja`, `BUMIL`, `gizi`, `anak`, `idl`), modul secara otomatis mengeksekusi penggabungan (Left Join) menggunakan `DEFAULT_JOIN_CONFIG`.
   - **Hasil Terpadu**: Pemanggil selalu menerima dataset yang seragam (35 baris wilayah dengan 28 indikator lengkap).
3. **Pemisahan Tegas Baris Data dan Ringkasan**:
   - `rows` hanya memuat data entitas wilayah (35 Kabupaten/Kota).
   - Baris ringkasan dipisahkan ke dalam `summaryRows: { jumlah, average, target }` bersama metadata `columnConfigs`, `columnTargets`, `sumColumns`, dan `avgColumns`.
4. **Pembersihan Komponen UI (*Strict Deletion*)**:
   - Menghapus ~450 baris fungsi `detectHasilJoinSheet`, `loadPreJoinedHasilJoinSheet`, `extractDatasetFromBuffer`, dan `separateSpecialRows` dari komponen UI dan mengarahkan seluruh aliran ingesti ke `DinkesSpreadsheetParser`.
