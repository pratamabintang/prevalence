# Panduan Deployment Docker: Dinkes Data Tools & Server SQLite

Dokumen ini menjelaskan cara menjalankan aplikasi Dinkes secara mandiri (*self-hosted*) menggunakan kontainer **Docker** dan **Docker Compose**.

---

### 1. Arsitektur Kemasan Kontainer

Aplikasi dikemas dalam **1 kontainer Docker terpadu (*All-in-One*)** yang memuat:
- **Nginx Web Server** (port 80): Menyajikan antarmuka web SPA Angular yang telah di-build secara statis dan melakukan *reverse proxy* untuk rute `/api/*` ke backend.
- **Node.js API Server** (port 3000 internal): Mengelola akses data, migrasi skema, dan kueri analitik.
- **SQLite Database** (`/data/dinkes.db`): Beroperasi dalam mode performa tinggi **Write-Ahead Logging (WAL)**.
- **Direktori Berkas Fisik** (`/data/uploads`): Menyimpan arsip berkas Excel mentah (*raw*) dan hasil join (*result*) per tahun dan triwulan.

Seluruh data persisten dipetakan ke Docker Named Volume `dinkes_storage` sehingga data tetap utuh saat kontainer di-restart atau di-upgrade.

---

### 2. Prasyarat

Pastikan host server (Linux VPS / Windows / macOS) telah terinstal:
- **Docker Engine** (versi 20.10 ke atas)
- **Docker Compose** (versi v2.0 ke atas, biasanya sudah terintegrasi via perintah `docker compose`)

---

### 3. Cara Menjalankan dengan Docker Compose (Sangat Direkomendasikan)

1. **Jalankan Aplikasi Latar Belakang**:
   ```bash
   docker compose up -d --build
   ```

2. **Periksa Status Kontainer**:
   ```bash
   docker compose ps
   ```

3. **Buka Aplikasi di Peramban**:
   - Antarmuka Web: [http://localhost:8080](http://localhost:8080)
   - Status Kesehatan Server: [http://localhost:8080/api/health](http://localhost:8080/api/health)
   - Master 35 Wilayah: [http://localhost:8080/api/districts](http://localhost:8080/api/districts)

4. **Memeriksa Log Berjalan**:
   ```bash
   docker compose logs -f
   ```

5. **Menghentikan Layanan**:
   ```bash
   docker compose down
   ```

---

### 4. Menjalankan Manual dengan Perintah `docker run`

Jika tidak ingin menggunakan Docker Compose:

1. **Build Image**:
   ```bash
   docker build -t dinkes-app:latest .
   ```

2. **Jalankan Kontainer**:
   ```bash
   docker run -d \
     --name dinkes_app \
     -p 8080:80 \
     -v dinkes_storage:/data \
     --restart unless-stopped \
     dinkes-app:latest
   ```

---

### 5. Prosedur Pencadangan & Pemulihan Data (Backup & Restore)

Seluruh data berada di dalam volume `/data`:

- **Mencadangkan Database SQLite & Berkas**:
  ```bash
  # Salin berkas database keluar kontainer
  docker cp dinkes_app:/data/dinkes.db ./backup_dinkes_$(date +%Y%m%d).db

  # Salin seluruh folder uploads
  docker cp dinkes_app:/data/uploads ./backup_uploads_$(date +%Y%m%d)
  ```

- **Memulihkan Database dari Cadangan**:
  ```bash
  docker compose stop
  docker cp ./backup_dinkes.db dinkes_app:/data/dinkes.db
  docker compose start
  ```

---

### 6. Variabel Lingkungan Opsional

| Variabel | Default | Keterangan |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port internal backend API Node.js |
| `DB_PATH` | `/data/dinkes.db` | Lokasi berkas database SQLite di dalam volume |
| `UPLOADS_DIR` | `/data/uploads` | Lokasi direktori penyimpanan berkas Excel biner |
| `NODE_ENV` | `production` | Mode lingkungan Node.js |
