# Arsitektur Pemrosesan Spreadsheet 2-Tingkat (Strict 2-Tier Spreadsheet Adapter)

Diputuskan untuk menegakkan pemisahan 2-tingkat (*strict 2-tier seam*) pada pemrosesan berkas spreadsheet Excel, mengurung seluruh dependensi pustaka SheetJS (`xlsx`, `xlsx-js-style`) secara eksklusif ke dalam `ExcelWorkbookAdapter` pada lapisan `src/app/shared/excel.ts`.

### Konteks & Masalah Arsitektur
1. **Kebocoran Pustaka Pihak Ketiga (SheetJS Leaks) ke Lapisan UI**:
   - Pustaka SheetJS (`xlsx-js-style` / `xlsx`) diimpor langsung di 11 berkas berbeda, termasuk setidaknya 5 komponen dan store antarmuka pengguna (`excel-join.component.ts`, `chart-visualizer.component.ts`, `stunting-cohort.component.ts`, dsb.).
   - Komponen UI melakukan manipulasi sel tingkat rendah secara langsung:
     - `XLSX.utils.encode_col()`, `XLSX.utils.decode_range()`, `XLSX.utils.encode_cell()`
     - `XLSX.utils.book_new()`, `XLSX.utils.book_append_sheet()`, `XLSX.utils.aoa_to_sheet()`
     - Pewarnaan sel manual `ws[addr].s = { ... }`
     - Serialisasi biner langsung `XLSX.write(this.workbook, { bookType: 'xlsx', type: 'array' })`
2. **Bypass Sirkular pada Parser Tingkat-2**:
   - `DinkesSpreadsheetParser` sebelumnya mem-bypass `ExcelEngine` saat membaca berkas pre-joined dengan memanggil `XLSX.utils.sheet_to_json(ws, { header: 1 })` secara langsung.
3. **Kerapuhan dan Kesulitan Pemeliharaan**:
   - Perubahan format atau pembaruan pustaka spreadsheet menuntut modifikasi di banyak komponen UI sekaligus, melanggar prinsip lokality (*locality*) dan batas adapter (*adapter boundary*).

### Keputusan Arsitektur
1. **Tingkat 1 (Tier 1): `ExcelWorkbookAdapter`**:
   - Ditempatkan pada `src/app/shared/excel.ts` (dengan alias kompatibel `ExcelEngine = ExcelWorkbookAdapter`).
   - Merupakan satu-satunya titik batas (*only boundary*) yang mengimpor `xlsx-js-style` dan `xlsx`.
   - Menyediakan antarmuka bertipe kuat untuk:
     - **Serialisasi & Konversi Buffer**: `writeToBuffer(wb): ArrayBuffer`, `readWorkbook(buffer): ExcelWorkbook`.
     - **Pemeriksaan & Pembacaan Grid**: `readSheetAsGrid(ws): unknown[][]`, `encodeCol(colIdx): string`, `decodeRange(ref): ...`.
     - **Pembuatan & Penataan Gaya Ekspor**: `createStyledWorkbook(spec)`, `exportMultiSheetTables(specs)`.
     - **Tipe Opaque**: Mengekspor `export type ExcelWorkbook = XLSX.WorkBook;` dan `export type ExcelWorkSheet = XLSX.WorkSheet;` sehingga pemanggil UI tidak memerlukan impor langsung dari package `xlsx`.
2. **Tingkat 2 (Tier 2): Pipa Domain Spreadsheet**:
   - `DinkesSpreadsheetParser` dan `ExcelJoinEngine` beroperasi secara murni di atas `ExcelWorkbookAdapter` dan array grid, tanpa melakukan manipulasi sel koordinat fisik secara mandiri.
3. **Dekopling Komponen Antarmuka Pengguna**:
   - Menghapus seluruh impor `import * as XLSX from 'xlsx'` dan `xlsx-js-style` dari komponen antarmuka pengguna (`chart-visualizer.component.ts`, `excel-join.component.ts`, `stunting-monitoring.component.ts`).
   - Ekspor berkas di `ChartVisualizerComponent` dialihkan ke utilitas penataan gaya terpadu di `ExcelWorkbookAdapter`.

### Konsekuensi & Keuntungan
- **Lokalitas Mutlak**: Seluruh logika yang bersentuhan dengan spesifikasi biner dan koordinat sel Excel terkonsentrasi di satu modul `src/app/shared/excel.ts`.
- **Daya Ungkit (Leverage)**: Peningkatan kinerja parsing, penggantian mesin parser, atau perbaikan styling header berlaku seketika ke seluruh aplikasi tanpa menyentuh satu pun berkas presentasi.
- **Reduksi Kompleksitas UI**: Menghapus lebih dari 160 baris manipulasi sel koordinat dari `ChartVisualizerComponent` dan komponen join.
