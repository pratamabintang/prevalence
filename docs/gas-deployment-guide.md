# Panduan Deployment Google Apps Script (GAS) untuk Dinkes Data Tools

Panduan ini menjelaskan cara memasang skrip [`scripts/gas/Code.gs`](file:///D:/intern/dinkes-2/scripts/gas/Code.gs) ke Google Apps Script dan menerbitkannya sebagai Web App agar dapat digunakan oleh aplikasi Dinkes.

---

## Langkah 1: Buka Google Apps Script
1. Buka [Google Apps Script](https://script.google.com/) menggunakan akun Google instansi / akun Google Drive Anda.
2. Klik tombol **"New Project"** (Proyek Baru).
3. Beri nama proyek, misalnya: `Dinkes Storage Backend`.

---

## Langkah 2: Salin Kode Skrip & Otorisasi Google Drive
1. Buka file editor `Code.gs` di Google Apps Script.
2. Hapus kode bawaan yang ada di editor.
3. Buka file [`scripts/gas/Code.gs`](file:///D:/intern/dinkes-2/scripts/gas/Code.gs) di repositori ini, salin seluruh kodenya, dan tempelkan (*paste*) ke editor Google Apps Script.
4. Klik tombol **Simpan** (ikon disket) atau tekan `Ctrl + S`.
5. **Penting (Otorisasi Izin Drive)**:
   - Pada toolbar di bagian atas editor, di samping tombol **Debug** dan **Run**, pilih fungsi **`testAuthorizeDrive`** dari dropdown pilihan fungsi.
   - Klik tombol **Run** (Jalankan).
   - Google akan menampilkan jendela pop-up otorisasi:
     - Klik **Review permissions** / **Authorize access**.
     - Pilih akun Google Anda.
     - Klik **Advanced** (Lanjutan) di kiri bawah > klik **Go to Dinkes Storage Backend (unsafe)**.
     - Klik **Allow** (Izinkan).
   - Pastikan di log eksekusi bawah muncul pesan: `Folder Google Drive berhasil diakses: Dinkes Excel Joiner Storage`.

---

## Langkah 3: Deploy sebagai Web App
1. Klik tombol **Deploy** di pojok kanan atas, lalu pilih **New deployment** (atau jika sudah pernah deploy, pilih **Manage deployments** lalu klik ikon pensil Edit dan pilih **New version**).
2. Pada menu pemilihan jenis (ikon gerigi di samping *Select type*), pilih **Web app**.
3. Isi konfigurasi sebagai berikut:
   - **Description**: `Penyimpanan Eksternal Dinkes Excel Joiner`
   - **Execute as**: Pilih **Me (emailanda@gmail.com)** *(skrip berjalan menggunakan akun Google Drive Anda)*.
   - **Who has access**: Pilih **Anyone** *(Siapa saja — **PENTING**: Jangan pilih "Only myself" atau "Anyone with Google account" karena akan menyebabkan error Failed to fetch)*.
4. Klik **Deploy**.

---

## Langkah 4: Salin Web App URL ke Aplikasi
1. Setelah deployment berhasil, Google akan menampilkan **Web app URL** berformat:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```
   *(Pastikan berakhiran `/exec`, bukan `/dev` atau `/edit`)*.
2. Salin URL tersebut.
3. Masukkan URL tersebut ke aplikasi web:
   - Buka menu **Pengaturan** di aplikasi web Dinkes, tempel URL pada kolom yang tersedia, klik **Uji Koneksi**, lalu klik **Simpan URL**.
   - Atau tempel permanen di [`src/environments/environment.ts`](file:///D:/intern/dinkes-2/src/environments/environment.ts).

---

## Panduan Troubleshooting: Error "Failed to fetch"

Jika muncul pesan error `Failed to fetch`, penyebab pastinya adalah salah satu dari 4 hal berikut:

1. **"Who has access" Belum "Anyone"**:
   - Jika disetel ke *"Anyone with a Google account"* atau *"Only myself"*, Google akan mengalihkan request ke halaman login Google (`accounts.google.com`).
   - Peramban memblokir pengalihan ini demi keamanan (CORS policy), sehingga muncul pesan `Failed to fetch`.
   - **Perbaikan**: Buka Apps Script > klik **Deploy** > **Manage deployments** > Ikon pensil (Edit) > Di bagian **Who has access**, ubah menjadi **Anyone** > Di bagian **Version**, pilih **New version** > klik **Deploy**.

2. **Skrip Mengalami Perubahan Tapi Belum Diterbitkan sebagai "New Version"**:
   - Menyimpan kode di editor Apps Script tidak otomatis memperbarui Web App yang sudah aktif.
   - **Perbaikan**: Selalu lakukan **Deploy > Manage deployments > Edit > Version: "New version" > Deploy** setiap kali ada perubahan kode.

3. **URL Menggunakan URL Pengujian (`/dev`), Bukan URL Produksi (`/exec`)**:
   - Periksa akhiran URL Anda. Jika berakhiran `/dev`, ganti dengan URL Web App produksi yang berakhiran `/exec`.

4. **Izin DriveApp Belum Diotorisasi**:
   - Jalankan fungsi `testAuthorizeDrive` sekali di editor Apps Script seperti pada Langkah 2 untuk memastikan Google Drive sudah diizinkan.
