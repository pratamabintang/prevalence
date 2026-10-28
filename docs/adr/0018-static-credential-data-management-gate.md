# 18. Gerbang Autentikasi Kelola Data Berbasis Token Server (Token-Based Data Management Gate)

## Status
Accepted

## Konteks & Masalah
Modul **Kelola Data** (`/data`) merupakan satu-satunya ruang kerja tempat pengelola sistem melakukan operasi mutasi data (input partisi triwulan baru, pembaruan partisi atau Default Kustom, serta penghapusan partisi), sementara modul lainnya (Beranda `/`, Visualisasi `/visualisasi`, dan Capaian Intervensi `/capaian-intervensi`) bersifat baca-saja untuk konsumsi publik dan eksekutif. Sistem membutuhkan perlindungan akses khusus pada `/data` dan endpoint penulisan backend tanpa menyimpan kata sandi pada bundle JavaScript peramban (*browser bundle*), tanpa tabel registrasi pengguna di database, serta tanpa fitur lupa kata sandi.

## Keputusan Arsitektur
Menerapkan **Gerbang Autentikasi Kelola Data (Data Management Authentication Gate)** dengan verifikasi server terpusat dan token sesi berbasis HMAC:

1. **Isolasi Rahasia pada Server Saja (Bebas Rahasia di Bundle Frontend)**:
   - Menghapus kredensial sensitif dari `environment.ts` agar kata sandi tidak pernah dikompilasi ke dalam berkas JavaScript klien.
   - Kredensial pengelola disimpan secara aman hanya di sisi server melalui variabel lingkungan (`DATA_ADMIN_ID` dan `DATA_ADMIN_PASSWORD`, bernilai bawaan `'bidangkesmas'` dan `'@Dinkes123#'`).
2. **Endpoint Verifikasi Server (`POST /api/auth/login`)**:
   - Komponen antarmuka mengirimkan ID dan kata sandi yang diketikkan pengguna ke endpoint `POST /api/auth/login`.
   - Server memvalidasi kredensial dan menerbitkan token sesi bertanda tangan digital (HMAC-SHA256) dengan masa berlaku 24 jam.
3. **Gerbang In-Place pada Rute `/data` & Persistensi Token di `sessionStorage`**:
   - Mengakses `/data` tanpa token aktif menampilkan kartu masuk (*in-place login gate*) di bawah header halaman **Kelola Data** tanpa mengubah URL atau mengganggu status aktif navigasi.
   - Token disimpan di `sessionStorage` melalui layanan domain terpusat (`DataAuthService`) sehingga bertahan saat penyegaran halaman (*refresh*) atau perpindahan antar-rute dalam tab yang sama, disertai tombol **Keluar** pada header **Kelola Data**.
4. **Perlindungan Endpoint Mutasi Backend (`POST`, `PUT`, `DELETE`)**:
   - Seluruh operasi baca (`GET /api/*`) tetap terbuka untuk publik agar Beranda dan Visualisasi bekerja tanpa login.
   - Seluruh endpoint mutasi (`POST /api/periods/:year/:quarter`, `DELETE /api/periods/:year/:quarter`, `PUT /api/configs/:type`, `POST /api/default`, `DELETE /api/default`) memverifikasi header `Authorization: Bearer <token>`.

## Konsekuensi
- Kata sandi pengelola tidak pernah bocor atau terlihat melalui DevTools / berkas JavaScript klien.
- Halaman `/data` dan seluruh operasi input, pembaruan, serta penghapusan data terlindungi dari akses tanpa izin baik melalui antarmuka web maupun pemanggilan API langsung.
- Tidak diperlukan migrasi tabel pengguna di SQLite, alur registrasi, maupun manajemen kata sandi eksternal.
