# Partisi Penyimpanan Lintas Triwulan pada Google Apps Script dan Google Drive

Diputuskan untuk memperluas arsitektur penyimpanan eksternal Google Apps Script (GAS) dan Google Drive dengan skema partisi hierarkis berbasis tahun dan triwulan (`[Tahun] / [TW1 | TW2 | TW3 | TW4]`), serta menyimpan ganda (*dual storage*) baik berkas Excel mentah multi-sheet maupun berkas Excel hasil penggabungan ber-styling Dinkes.

### Konteks & Pertimbangan
1. **Siklus Pelaporan Berkala Dinkes**: Evaluasi indikator kesehatan dan gizi di Dinas Kesehatan dilakukan secara berkala tiap triwulan (TW1 hingga TW4) sepanjang tahun anggaran. Sebelumnya penyimpanan Google Drive hanya mendukung satu berkas default tunggal (`default-join-data.xlsx`), sehingga pelaporan antar-triwulan saling menimpa.
2. **Kebutuhan Arsip Mentah vs Hasil Join**:
   - **Berkas Mentah (`raw-data.xlsx`)**: Diperlukan oleh aplikasi web Dinkes Joiner agar pengguna dapat memuat ulang lembar kerja asli (*multi-sheet*), mengubah pemetaan kolom, menyesuaikan target indikator, atau menambah sheet baru secara interaktif.
   - **Berkas Hasil Penggabungan (`joined-result.xlsx`)**: Diperlukan agar pimpinan atau staf Dinkes lain dapat langsung membuka, mencetak, atau membagikan hasil rekapitulasi indikator berformat rapi langsung dari Google Drive tanpa harus membuka aplikasi web.
   - **Berkas Konfigurasi (`join-config.json`)**: Menyimpan konfigurasi pemetaan kolom (*joinBy*, toleransi wilayah, alias, target capaian) agar pemrosesan deterministik dapat diulang seketika.
3. **Keterbatasan Payload & Efisiensi Jaringan**: Mengunggah secara atomik dalam satu permintaan HTTP POST (`action=savePeriod`) berformat `text/plain` base64 menghindari CORS preflight OPTIONS dan mencegah kondisi *half-saved* (folder tersimpan sebagian).
4. **Resiliensi & Kompatibilitas**: Operasi default lama (`loadDefault`, `saveDefault`, `resetDefault`) tetap didukung untuk memastikan kompatibilitas mundur (*backward compatibility*). Apabila GAS belum dikonfigurasi, aplikasi tetap melakukan degradasi anggun (*graceful fallback*) ke template bawaan.

### Keputusan Rinci
1. **Hierarki Direktori Google Drive**:
   ```text
   Dinkes Excel Joiner Storage/
   └── [Tahun, misal: 2026]/
       ├── TW1/
       │   ├── raw-data.xlsx
       │   ├── joined-result.xlsx
       │   └── join-config.json
       ├── TW2/
       ├── TW3/
       └── TW4/
   ```
2. **Spesifikasi Protokol API Google Apps Script**:
   - `GET ?action=listPeriods`: Mengembalikan daftar seluruh tahun dan triwulan yang telah memiliki data di Google Drive beserta metadata ukuran dan waktu pembaharuan.
   - `GET ?action=loadPeriod&year=YYYY&quarter=TWx`: Mengambil berkas `raw-data.xlsx` (base64) dan `join-config.json` dari slot terkait untuk direhidrasi langsung ke memori peramban.
   - `POST { action: 'savePeriod', year, quarter, rawExcelBase64, resultExcelBase64, config }`: Menyimpan atomik ketiga berkas ke dalam sub-folder `[Tahun]/[TWx]`.
3. **Alur Hidrasi Klien**:
   - Saat memuat periode tertentu, aplikasi mengunduh `raw-data.xlsx` dan `join-config.json`, lalu secara instan menjalankan pipeline penggabungan di memori (~100 ms).
   - Seluruh status aplikasi (daftar sheet, pratinjau tabel, grafik visualisasi, pengaturan target) langsung terhidrasi utuh tanpa perlu rekayasa ulang data.
4. **Antarmuka Pengguna**:
   - Pemilih Tahun (Dropdown dinamis) dan Triwulan (Pills TW1–TW4) dengan indikator visual ketersediaan data di cloud.
   - Modal konfirmasi eksplisit yang menampilkan target Tahun & Triwulan sebelum penyimpanan dieksekusi guna mencegah penimpaan data tidak sengaja.
