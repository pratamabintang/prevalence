# 17. Periode Presentasi Aktif pada Beranda (Homepage Active Presentation Period)

## Status
Accepted

## Konteks & Masalah
Sebelum keputusan ini, halaman Beranda (`HomeComponent`) memuat data partisi kuartal hanya satu kali saat inisialisasi (`ngOnInit`) dan secara kaku mengunci tampilan hanya pada kuartal tertinggi yang tersedia (`latestQ`) untuk tahun berjalan saat ini. Tidak terdapat mekanisme kendali bagi pengguna untuk memuat atau beralih ke periode kuartal tertentu pada Beranda ketika sedang melakukan pemaparan atau presentasi eksekutif. Selain itu, visualisasi Masalah Gizi (Kategori 2) masih terkunci pada data statis bawaan (`NUTRITION_PROBLEMS_DATA`), dan target evaluasi indikator heatmap tidak diselaraskan dengan standar tahun berjalan maupun baris target kuartal terkait.

## Keputusan Arsitektur
Menetapkan arsitektur **Periode Presentasi Aktif (Active Presentation Period)** pada Beranda yang mengintegrasikan kendali presentasi kuartal langsung di header halaman dan menyelaraskan seluruh kategori tampilan secara serentak:

1. **Kendali Header Terpadu**: Menyediakan bilah kendali ringkas di header Beranda yang memuat lencana sumber aktif (`Periode Tersimpan`, `Sesi Aktif (/data)`, atau `Data Bawaan`), selektor Tahun (hanya menampilkan tahun yang memiliki partisi tersimpan), tombol pil Triwulan (`TW1` - `TW4`), tombol akses cepat `Sesi Aktif` bila terdapat data transferan dari `/data`, tombol pemulihan `Data Bawaan`, serta tombol penyegaran partisi.
2. **Sinkronisasi Multi-Kategori Serentak**: Pemilihan periode aktif (`Tahun + Triwulan`) langsung memperbarui:
   - **Kategori 1 (Heatmap Intervensi Spesifik)**: Menghitung ulang kotak metrik, peta sebaran 35 wilayah, dan grafik batang per-indikator berdasarkan data kuartal terpilih, lengkap dengan target dinamis yang diprioritaskan dari `targetRow` kuartal tersebut.
   - **Kategori 2 (Heatmap Masalah Gizi)**: Mengekstrak sheet `MASALAH GIZI` menggunakan `MASALAH_GIZI_JOIN_CONFIG` dari buku kerja periode tersimpan untuk memperbarui kotak metrik dan peta masalah gizi. Jika lembar gizi belum tersedia pada partisi tersebut, sistem secara anggun melakukan degradasi (*graceful fallback*) ke data bawaan disertai lencana informasi non-obstruktif.
   - **Kategori 3 (Hasil Intervensi)**: Menampilkan lintasan tahunan seluruh kuartal pada tahun terpilih dengan fokus evaluasi kartu ringkasan KPI diselaraskan ke triwulan yang sedang aktif.
3. **Prioritas Pemuatan Awal**: Beranda memprioritaskan partisi tersimpan terbaru di server SQLite/Google Drive; jika belum ada data tersimpan, sistem memeriksa sesi aktif dari `HealthDataExchange`, dan terakhir melakukan fallback ke dataset dasar bawaan.

## Konsekuensi
- Presenter dinas kesehatan dapat berpindah antar-triwulan dalam satu kali klik selama rapat koordinasi tanpa harus bolak-balik ke modul pengolahan `/data` atau `/capaian-intervensi`.
- Seluruh grafik, peta, kotak ringkasan, dan target acuan pada ketiga kategori Beranda selalu berada dalam konteks waktu yang konsisten.
- Pengujian unit pada `HomeComponent` diperluas untuk memvalidasi transisi antar-periode, isolasi fallback, dan integritas resolusi target.
