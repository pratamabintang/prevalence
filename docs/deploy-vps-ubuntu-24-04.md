# Deploy ke VPS Ubuntu 24.04 (Docker)

Panduan ini menaruh aplikasi Dinkes di VPS Ubuntu 24.04 dengan satu kontainer **Docker all-in-one**: Nginx (port 80 publik) + Node API (port 3000 internal) + SQLite (`/data/dinkes.db`).

- Akses: `http://<IP_VPS>` — tanpa domain, tanpa HTTPS.
- Data persisten: named volume `dinkes_storage`.
- Kode: `git clone` dari `https://github.com/pratamabintang/prevalence.git`, branch `main`.
- Semua perintah di bawah diganti: `USER` = user SSH, `IP` = IP publik VPS.

Terkait: `docs/docker-deployment-guide.md` (detail arsitektur kontainer).

---

## Prasyarat

- Ubuntu 24.04, user dengan akses `sudo`, port 22 dan 80 terbuka di panel provider VPS.
- **RAM minimal 2 GB.** Build pertama menjalankan `npm ci` + Angular build di dalam Docker. Kalau RAM kurang, kerjakan langkah 1b lebih dulu, jika tidak build bisa mati karena OOM.

---

## 1. Install Docker + plugin Compose

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Keluar dari sesi SSH lalu masuk lagi supaya keanggotaan grup `docker` aktif. Kalau belum logout, awali perintah `docker` dengan `sudo`.

Cek:

```bash
docker --version
docker compose version
```

## 1b. Swap (hanya kalau RAM < 2 GB)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

## 2. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw enable
sudo ufw status
```

Port 3000 **tidak** dibuka. Backend hanya dijangkau Nginx dari dalam kontainer.

## 3. Clone repo

```bash
sudo mkdir -p /opt/dinkes
sudo chown "$USER":"$USER" /opt/dinkes
git clone -b main https://github.com/pratamabintang/prevalence.git /opt/dinkes
cd /opt/dinkes
git log --oneline -1
```

Commit terakhir harus memuat `feat: target tahunan dinamis, perbaikan Beranda, siap deploy Docker` (hash `9f7c0d4` atau lebih baru). Kalau tidak, periksa branch dan `git pull`.

## 4. Buat `.env`

`.env` tidak ada di repo (di-`.gitignore`). Nilai bawaan di `docker-compose.yml` lemah, jadi wajib ditimpa.

```bash
cd /opt/dinkes
openssl rand -hex 32
```

Salin hasilnya, lalu:

```bash
cat > .env <<'EOF'
DATA_ADMIN_ID=bidangkesmas
DATA_ADMIN_PASSWORD=GANTI_DENGAN_PASSWORD_KUAT
AUTH_SECRET=TEMPEL_HASIL_OPENSSL_RAND_HEX_32
EOF
chmod 600 .env
```

- `DATA_ADMIN_ID` / `DATA_ADMIN_PASSWORD`: login halaman `/data`.
- `AUTH_SECRET`: kunci tanda tangan token sesi. Kalau berubah, semua sesi login lama gugur.
- Jangan commit `.env`, jangan kirim lewat chat.

## 5. Pindahkan aplikasi ke port 80

`docker-compose.yml` di repo memetakan `8080:80`. Buat override supaya tidak bentrok dengan `git pull` berikutnya:

```bash
cd /opt/dinkes
cat > docker-compose.override.yml <<'EOF'
services:
  dinkes-app:
    ports: !override
      - "80:80"
EOF
```

Tag `!override` butuh Docker Compose ≥ 2.24. Kalau `docker compose version` lebih lama, pakai cara ini sebagai gantinya:

```bash
sed -i 's/"8080:80"/"80:80"/' docker-compose.yml
```

## 6. Build dan jalankan

```bash
cd /opt/dinkes
sudo docker compose up -d --build
sudo docker compose ps
sudo docker compose logs -f dinkes-app
```

`Ctrl+C` untuk berhenti menonton log (kontainer tetap jalan). Build pertama 5–15 menit.

Verifikasi di VPS:

```bash
curl -s http://127.0.0.1/api/health
curl -s http://127.0.0.1/api/periods | head -c 300
```

Database masih kosong di tahap ini: `/api/periods` mengembalikan `[]`, tapi wilayah (35 kabupaten) sudah otomatis di-seed.

## 7. Pindahkan data dari komputer lokal

Data lokal: `server/data/dinkes.db` (2,99 MB, sudah rapat WAL) + `server/uploads/` (0,9 MB). Sudah distage ke `.scratch/deploy-seed/`, total 3,9 MB.

**Di Windows (PowerShell):**

```powershell
scp -r D:\intern\dinkes-2\.scratch\deploy-seed USER@IP:/tmp/dinkes-seed
```

**Di VPS** — seed ke dalam volume:

```bash
cd /opt/dinkes
sudo docker compose down
sudo docker run --rm -v dinkes_storage:/data -v /tmp/dinkes-seed:/seed alpine sh -c "cp -a /seed/dinkes.db /data/dinkes.db && mkdir -p /data/uploads && cp -a /seed/uploads/. /data/uploads/ && rm -f /data/dinkes.db-wal /data/dinkes.db-shm"
sudo docker compose up -d
```

`docker compose down` **tidak** menghapus volume `dinkes_storage` (hanya menghapus kontainer). Jangan tambahkan `-v`.

Cek hasil:

```bash
curl -s http://127.0.0.1/api/periods | head -c 400
curl -s http://127.0.0.1/api/targets | head -c 400
```

Harus terlihat 12 periode (2024–2026 × TW1–TW4) dan target per tahun terisi. Cek juga berkas:

```bash
sudo docker compose exec dinkes-app ls -l /data/uploads/2026/TW4
```

## 8. Verifikasi akhir

```bash
cd /opt/dinkes
sudo docker compose ps
sudo docker compose exec dinkes-app ls -l /data/dinkes.db
sudo docker compose exec dinkes-app sh -c "ls /data/uploads/2024/TW1"
```

Lalu di browser, buka `http://<IP_VPS>`:

1. Beranda → pilih tahun **2024**: kolom Target Tahun Lalu dan Capaian Tahun Lalu harus `0%`.
2. Ganti ke **2026**: target lebih tinggi daripada 2024, dan peta intervensi spesifik + peta masalah gizi ikut berubah.
3. Buka `/data`, login dengan `DATA_ADMIN_ID` / `DATA_ADMIN_PASSWORD` dari `.env`.
4. Unduh satu berkas hasil join dari daftar periode untuk memastikan arsip terbaca.

---

## Update aplikasi

```bash
cd /opt/dinkes
git pull
sudo docker compose up -d --build
```

Volume `dinkes_storage` tidak tersentuh, jadi data aman. Kalau `.env` berubah, `docker compose up -d` akan me-restart kontainer dengan nilai baru.

## Backup

Simpan `dinkes.db` dan `uploads/` keluar dari volume:

```bash
cd /opt/dinkes
sudo docker run --rm -v dinkes_storage:/data -v /tmp:/out alpine sh -c "cp -a /data/dinkes.db /out/dinkes-$(date +%F).db && cp -a /data/uploads /out/uploads-$(date +%F)"
tar -czf /tmp/dinkes-$(date +%F).tar.gz -C /tmp dinkes-$(date +%F).db uploads-$(date +%F)
ls -lh /tmp/dinkes-$(date +%F).tar.gz
```

Sebelum menyalin, checkpoint WAL-nya dulu supaya konsisten:

```bash
sudo docker compose exec dinkes-app sh -c "node -e \"const D=require('better-sqlite3');const db=new D('/data/dinkes.db');console.log(db.pragma('wal_checkpoint(TRUNCATE)'));db.close()\""
```

Lalu unduh dengan `scp` dari komputer lokal:

```powershell
scp USER@IP:/tmp/dinkes-YYYY-MM-DD.tar.gz D:\backup\
```

## Restore backup

```bash
cd /opt/dinkes
sudo docker compose down
sudo docker run --rm -v dinkes_storage:/data -v /tmp:/in alpine sh -c "cp -a /in/dinkes.db /data/dinkes.db && rm -rf /data/uploads && cp -a /in/uploads /data/uploads && rm -f /data/dinkes.db-wal /data/dinkes.db-shm"
sudo docker compose up -d
```

---

## Catatan keamanan

- Akses sekarang lewat **HTTP polos**. Password login `/data` dan token sesi terkirim tanpa enkripsi, sehingga bisa disadap di jaringan yang sama. Untuk data kesehatan, sebaiknya segera pasang domain + HTTPS (mis. Nginx host + certbot, kontainer diubah ke `127.0.0.1:8080:80`) sebelum dipakai oleh banyak orang.
- `DATA_ADMIN_PASSWORD` dan `AUTH_SECRET` bawaan repo (`@Dinkes123#`, `dinkes-auth-secret-key-2026`) harus diganti seperti langkah 4.
- Port 3000 tetap internal; jangan di-`ports:` ke host.

## Troubleshooting

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Build mati di `npm ci` / `ng build` | RAM habis | Kerjakan langkah 1b, lalu `sudo docker compose up -d --build` lagi |
| `docker: permission denied` saat pull | Grup `docker` belum aktif | Logout lalu login lagi, atau pakai `sudo docker` |
| Port 80 sudah dipakai | Ada web server host (Apache/Nginx) | `sudo ss -lptn 'sport = :80'` lalu hentikan layanan itu |
| `ports: !override` error | Compose < 2.24 | Pakai `sed` di langkah 5 |
| `502 Bad Gateway` di browser | Backend Node belum siap / crash | `sudo docker compose logs dinkes-app` |
| Unggah Excel gagal di atas 50 MB | Batas Nginx | Ubah `client_max_body_size` di `docker/nginx.conf`, rebuild |
