# 18. Gerbang Autentikasi Kelola Data Berbasis Kredensial Statis (Static Credential Data Management Gate)

## Status
Accepted

## Konteks & Masalah
Modul **Kelola Data** (`/data`) merupakan satu-satunya ruang kerja tempat pengelola sistem melakukan operasi mutasi data (input partisi triwulan baru, pembaruan partisi atau Default Kustom, serta penghapusan partisi), sementara modul lainnya (Beranda `/`, Visualisasi `/visualisasi`, dan Capaian Intervensi `/capaian-intervensi`) bersifat baca-saja untuk konsumsi publik dan eksekutif. Sistem membutuhkan perlindungan akses khusus pada `/data` dan endpoint penulisan backend tanpa kompleksitas tabel pengguna di database, alur registrasi akun, atau fitur lupa kata sandi.

## Keputusan Arsitektur
Menerapkan **Gerbang Autentikasi Kelola Data (Data Management Authentication Gate)** dengan penegakan ganda (*Dual Enforcement*) berbasis kredensial statis yang dikonfigurasi melalui repositori/waktu kompilasi:

1. **Kredensial Statis Terkonfigurasi (`environment.ts` & Variabel Lingkungan Server)**:
   - Menyimpan pasangan kredensial pengelola (`dataAdminId: 'bidangkesmas'`, `dataAdminPassword: '@Dinkes123#'`) pada berkas lingkungan Angular (`environment.ts` dan `environment.development.ts`) serta variabel lingkungan backend (`DATA_ADMIN_ID` dan `DATA_ADMIN_PASSWORD` dengan nilai bawaan yang selaras).
2. **Gerbang In-Place pada Rute `/data` & Persistensi `sessionStorage`**:
   - Mengakses `/data` tanpa sesi aktif menampilkan kartu masuk (*in-place login gate*) di bawah header halaman **Kelola Data** tanpa mengubah URL atau mengganggu status aktif navigasi.
   - Status autentikasi disimpan di `sessionStorage` melalui layanan domain terpusat (`DataAuthService`) sehingga bertahan saat penyegaran halaman (*refresh*) atau perpindahan antar-rute dalam tab yang sama, disertai tombol **Keluar** pada header **Kelola Data**.
3. **Perlindungan Endpoint Mutasi Backend (`POST`, `PUT`, `DELETE`)**:
   - Seluruh operasi baca (`GET /api/*`) tetap terbuka untuk publik agar Beranda dan Visualisasi bekerja tanpa login.
   - Seluruh endpoint mutasi (`POST /api/periods/:year/:quarter`, `DELETE /api/periods/:year/:quarter`, `PUT /api/configs/:type`, `POST /api/default`, `DELETE /api/default`) memverifikasi header kredensial yang dikirim oleh `BackendStorageService`.

## Konsekuensi
- Halaman `/data` dan seluruh operasi input, pembaruan, serta penghapusan data terlindungi dari akses tanpa izin baik melalui antarmuka web maupun pemanggilan API langsung.
- Tidak diperlukan migrasi tabel pengguna di SQLite, alur registrasi, maupun manajemen kata sandi eksternal.
