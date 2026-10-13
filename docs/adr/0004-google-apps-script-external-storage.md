# Integrasi Google Apps Script (GAS) dan Google Drive sebagai Penyimpanan Eksternal

Diputuskan untuk menggunakan **Google Apps Script (GAS) Web App** yang terhubung ke **Google Drive** sebagai lapisan penyimpanan eksternal (*external persistent storage*) untuk menyimpan dan memuat file Excel biner (`.xlsx`) serta konfigurasi join (`.json`) secara terpusat di cloud.

### Konteks & Pertimbangan
1. **Ekosistem Dinas Kesehatan**: Pengguna dan unit kerja Dinkes umumnya telah memiliki akun Google Workspace / Google Drive kedinasan, sehingga memanfaatkan Google Apps Script tidak memerlukan pengadaan, konfigurasi, atau biaya sewa server database/backend terpisah.
2. **Keterbatasan LocalStorage**: `localStorage` peramban dibatasi maksimal ~5 MB dan tidak memadai untuk menyimpan file biner Excel multi-sheet yang besar.
3. **Pemberian Hak Akses & Kemudahan Kolaborasi**: Staf Dinkes dapat langsung memeriksa file Excel dan konfigurasi kustom yang tersimpan di Google Drive melalui antarmuka Google Drive biasa jika dibutuhkan.
4. **Fallback Terjaga**: Aplikasi tetap mempertahankan mekanisme *graceful degradation* ke aset lokal bawaan sistem (`/data/default-join-data.xlsx`) apabila URL GAS belum dikonfigurasi, terjadi kegagalan jaringan, atau peramban dalam keadaan offline.

### Keputusan Rinci
- **Struktur File di Google Drive**: Dua file terpisah di folder `Dinkes Excel Joiner Storage`: file Excel biner `default-join-data.xlsx` dan file konfigurasi `default-join-config.json`.
- **Konfigurasi URL**: Disediakan melalui `src/environments/environment.ts` dengan placeholder default `''`, serta dapat di-override melalui pengaturan lokal.
- **Konfirmasi Timpa Data**: Dialog modal konfirmasi wajib muncul sebelum operasi simpan ke Google Drive dieksekusi agar tidak menimpa data default secara tidak sengaja.
- **Template Skrip**: Skrip Google Apps Script siap pakai disediakan di `scripts/gas/Code.gs` beserta panduan deployment di `docs/gas-deployment-guide.md`.
