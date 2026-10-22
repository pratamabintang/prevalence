# Penyimpanan Terpusat Server Berbasis SQLite dan Kontainerisasi Docker

Diputuskan untuk menyediakan lapisan server backend mandiri berbasis **Node.js + SQLite (WAL Mode)** dan orkestrasi **Docker** untuk menyimpan data makro agregat kesehatan, partisi triwulan (TW1–TW4), arsip berkas Excel, dan konfigurasi secara terpusat, dengan mempertahankan modul penanganan data mikro individu (Kohor Balita) tetap di sisi klien (*client-side*).

### Konteks & Masalah
1. **Ketergantungan Eksternal Google Apps Script**:
   - Selama ini penyimpanan cloud mengandalkan Google Apps Script (GAS) Web App dan Google Drive pribadi/kedinasan. Arsitektur ini memiliki kendala kuota eksekusi harian Google, latensi *cold-start* GAS (~2–4 detik), dan batasan ukuran payload HTTP base64.
2. **Kebutuhan Kolaborasi Real-Time & Kueri Lintas Periode**:
   - Staf Dinkes di berbagai unit kerja memerlukan akses data agregat yang sinkron dan instan tanpa risiko saling menimpa. Diperlukan kemampuan kueri SQL lintas tahun dan triwulan yang sangat cepat.
3. **Kepatuhan Privasi Data Pribadi (UU PDP No. 27/2022)**:
   - Data mikro pada modul Pelacakan Kohor Stunting memuat NIK, nama lengkap balita, puskesmas, dan tanggal lahir. Memasukkan data tersebut ke server tanpa infrastruktur keamanan tingkat tinggi dan perizinan khusus akan menimbulkan risiko hukum yang berat.
4. **Kebutuhan Portabilitas & Kemudahan Deployment**:
   - Pengguna membutuhkan kemudahan menjalankan aplikasi di berbagai lingkungan: server lokal kantor dinas, *on-premise*, maupun VPS cloud murah, dengan instalasi satu perintah (*one-command deploy*).

### Keputusan Arsitektur
1. **Pemisahan Batas Data (Data Boundary)**:
   - **Data di Server (SQLite)**: Master 35 Kabupaten/Kota, master indikator target, observasi capaian triwulanan (TW1–TW4), riwayat konfigurasi join, dan metadata arsip berkas.
   - **Data di Klien (RAM Browser)**: Data mikro balita pada modul Kohor Balita tetap diproses lokal di peramban pengguna tanpa disimpan persisten di server.
2. **Pola Ingesti Berbantuan Klien (*Client-Assisted Ingestion*)**:
   - Frontend Angular tetap memanfaatkan mesin yang telah teruji (`ExcelJoinEngine`, `RegionNormalizer`, `SheetJS`) untuk parsing dan pencocokan wilayah di memori peramban.
   - Pengguna memverifikasi tabel pratinjau sebelum data resmi dikirim (*commit*) ke backend melalui REST API untuk ditulis ke database SQLite.
3. **Penyimpanan Berkas Ganda (Dual Storage: SQLite + Disk Server)**:
   - Berkas biner asli `.xlsx` (*raw-data* dan *joined-result*) disimpan langsung di direktori berkas server (`uploads/[tahun]/[tw]/`).
   - Database SQLite hanya mencatat metadata berkas (nama, path, ukuran, hash checksum, timestamp), menjaga ukuran database tetap ringkas dan performa kueri optimal.
4. **Teknologi Runtime & Konfigurasi SQLite Berperforma Tinggi**:
   - Runtime backend dibangun dengan **Node.js + Fastify/Express + `better-sqlite3`** (C-binding langsung tanpa abstraksi lambat, menjamin latensi < 1 ms).
   - Mengaktifkan Write-Ahead Logging (`PRAGMA journal_mode = WAL;`), `PRAGMA synchronous = NORMAL;`, dan `PRAGMA foreign_keys = ON;` agar mendukung banyak pembaca (*concurrent readers*) secara simultan tanpa terhalang saat operasi penulisan data berlangsung.
5. **Skema Relasional Database Normal**:
   - `districts`: Master 35 Kab/Kota (id, code, name, type: 'KAB' | 'KOTA').
   - `periods`: Manajemen tahun dan triwulan (`year`, `quarter`, `status`, `updated_at`).
   - `period_files`: Metadata berkas fisik di server (`period_id`, `file_type: 'raw' | 'result'`, `file_name`, `file_path`, `file_size`, `checksum`, `created_at`).
   - `period_observations`: Nilai capaian per sel (`period_id`, `district_id`, `indicator_key`, `numeric_value`, `display_text`).
   - `indicator_targets`: Nilai target acuan operasional per indikator (`indicator_key`, `target_value`, `standard_text`).
   - `configurations`: Penyimpanan preset JSON terpusat (`config_type: 'join' | 'chart' | 'stunting'`, `payload_json`, `updated_at`).
6. **Kontrak REST API Terpadu**:
   - `GET /api/health`: Status server, uptime, dan mode WAL.
   - `GET /api/districts`: Master 35 Kabupaten/Kota Jawa Tengah.
   - `GET /api/periods`: Daftar periode tersimpan dan ketersediaan berkas.
   - `GET /api/periods/:year/:quarter`: Memuat berkas dan dataset terpadu triwulan.
   - `POST /api/periods/:year/:quarter`: Menyimpan berkas biner `.xlsx` dan mengurai data capaian ke SQLite.
   - `GET /api/configs/:type` & `PUT /api/configs/:type`: Memuat dan menyimpan preset konfigurasi.
   - `GET /api/analytics/trends?indicator=...`: Kueri analitik lintas periode.
7. **Topologi Kontainer Docker Mandiri (*Single-Container Reverse Proxy*)**:
   - Menyediakan `Dockerfile` multi-stage dan `docker-compose.yml`. Nginx bertindak sebagai gerbang (port 80) menyajikan frontend Angular statis dan mem-proxy `/api/*` secara internal ke backend Node.js (port 3000).
   - Direktori data (`/data/dinkes.db` dan `/data/uploads/`) dipetakan ke Docker Named Volume persisten `dinkes_storage`.
8. **Strategi Adaptor Frontend (Graceful Degradation)**:
   - Menghadirkan `BackendStorageService` di frontend Angular yang secara otomatis menjadi penyedia utama saat berjalan di server Docker (`/api`).
   - Bila koneksi server backend tidak aktif atau aplikasi dijalankan dalam mode mandiri/offline, sistem secara mulus melakukan *fallback* ke Google Drive (GAS) atau aset lokal bawaan.

### Konsekuensi & Keuntungan
- **Performa Kueri & Latensi Sangat Rendah**: Kueri data indikator dan konfigurasi di SQLite berjalan dalam hitungan milidetik (<10 ms), jauh lebih cepat dibanding GAS (~2.000 ms).
- **Zero-Maintenance Database**: SQLite tidak memerlukan manajemen daemon database terpisah atau administrasi koneksi pool yang rumit.
- **Backup Sangat Sederhana**: Seluruh data tersimpan dalam 1 file `.db` yang mudah disalin atau direplikasi secara streaming dengan Litestream.
- **Kepatuhan Regulasi Terjaga**: Menghindarkan institusi dari risiko pelanggaran UU PDP karena data sensitif anak tidak diunggah ke server.
