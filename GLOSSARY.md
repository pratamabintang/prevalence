# Dinkes Data Tools

Portal pengolahan, pembersihan, penggabungan, dan visualisasi indikator kesehatan untuk Dinas Kesehatan.

## Language

### Wilayah & Entitas
**Kategori Wilayah**:
Label identitas baris data pada sumbu vertikal (Y-axis) grafik atau kunci penggabungan tabel, seperti nama Kabupaten, Kota, atau Puskesmas.
_Avoid_: Label Y, row header, entitas nama

**Toleransi Daerah**:
Aturan domain penghapusan prefiks "Kabupaten", "Kab.", atau "Kab" dengan tetap mempertahankan prefiks "Kota" agar wilayah administratif bernama sama tidak bentrok.
_Avoid_: String clean, regex strip, pembersihan teks

### Pengolahan & Penggabungan Data
**Multi-Layer Header**:
Struktur header tabel Excel berjenjang yang memiliki pengelompokan judul induk di baris atas dan sub-judul spesifik di baris bawah.
_Avoid_: Merged header, header bertingkat tak beraturan

**Join Key**:
Kolom identifikasi bersama yang dijadikan rujukan dalam operasi penggabungan (Left Join) antar-sheet Excel.
_Avoid_: Kolom kunci mentah, primary key

### Visualisasi & Evaluasi Indikator
**Seri Indikator**:
Kumpulan kolom metrik numerik yang dibandingkan secara berdampingan sebagai batang-batang dalam satu kategori wilayah (misal: Triwulan 1 s.d. Triwulan 4).
_Avoid_: Bar cluster, kelompok batang, sub-kolom

**Garis Target**:
Garis acuan vertikal pada grafik atau batas operasional pada tabel untuk mengevaluasi pemenuhan standar indikator kesehatan.
_Avoid_: Threshold line, batas minimal, limit line

**Skor Capaian**:
Jumlah total indikator pada suatu baris data yang berhasil memenuhi target yang ditetapkan.
_Avoid_: Hitungan lulus, capaian mentah

**Nilai Non-Numerik**:
Kondisi data yang tidak memuat angka (seperti tanda strip "-", kosong, atau teks tak terdefinisi) yang menandakan indikator belum dilaporkan. Berbeda secara mendasar dengan nilai "0" yang merupakan angka pengukuran valid.
_Avoid_: Nilai nol, angka kosong

**Mode Per Wilayah**:
Mode tampilan visualisasi grafik batang horizontal di mana setiap baris vertikal (sumbu Y) mewakili satu Kategori Wilayah yang memuat batang untuk seluruh Seri Indikator terpilih secara berdampingan.
_Avoid_: Group bar biasa, multi-bar chart

**Mode Per Indikator (Per Kolom)**:
Mode tampilan visualisasi komparatif di mana setiap kolom indikator disajikan dalam satu kelompok grafik terpisah, membandingkan seluruh Kategori Wilayah secara langsung pada satu indikator tersebut lengkap dengan ringkasan statistik (rata-rata, tertinggi, terendah) dan target.
_Avoid_: Single-series chart, split chart, grafik per kolom mentah

### Pertukaran Data Lintas Modul (Health Data Exchange)
**Pertukaran Data Lintas Modul (Health Data Exchange)**:
Mekanisme pengiriman data terpadu berbasis Angular Signals dan `sessionStorage` yang menghubungkan hasil operasi penggabungan lembar kerja (`ExcelJoin`) ke modul visualisasi grafik (`ChartVisualizer`) atau evaluasi stunting (`StuntingMonitoring`), memastikan ketersediaan data tetap utuh saat navigasi antar-halaman maupun penyegaran (*refresh*) peramban.
_Avoid_: State global tidak terstruktur, event bus lepas, router state mentah

**Target Acuan Resilien**:
Nilai target operasional indikator kesehatan yang dipadankan secara otomatis antara konfigurasi join dan grafik komparatif melalui normalisasi string dan pengecekan alias. Jika target spesifik tidak ditemukan atau dinonaktifkan, sistem mengadopsi nilai standar aman 50 untuk menjaga keandalan visualisasi garis batas.
_Avoid_: Hardcoded target, batas statis acak, fallback kaku

**Seleksi Seri Persentase Otomatis**:
Logika seleksi bawaan pada visualisasi komparatif yang secara otomatis memilih kolom-kolom rasio/persentase untuk ditampilkan saat pertama kali dialihkan dari modul penggabungan Excel, dengan tetap mengizinkan pengguna memilih kolom metrik kuantitas riil lainnya tanpa batasan.
_Avoid_: Filter kunci mutlak, batasan kolom angka

### Pemantauan Stunting & Evaluasi Kinerja
**Intervensi Stunting**:
Program atau tindakan kesehatan spesifik (sebelum kelahiran/remaja-ibu hamil atau setelah kelahiran/balita) yang diukur capaian kinerjanya dalam percepatan penurunan stunting.
_Avoid_: Program gizi, kegiatan dinkes, proyek stunting

**Expected Achievement**:
Target capaian proporsional waktu atau target spesifik triwulan yang seharusnya sudah dicapai pada periode tertentu agar target tahunan tercapai tepat waktu.
_Avoid_: Target antara, estimasi capaian, target sementara

**Gap Capaian**:
Selisih matematis antara capaian aktual pada periode berjalan dengan expected achievement periode tersebut.
_Avoid_: Deviasi minus, selisih target, sisa capaian

**Status Kinerja Pemantauan**:
Klasifikasi empat tingkat (On Track, Perlu Perhatian, Perlu Percepatan, Belum Dapat Dinilai) yang mengevaluasi posisi capaian terhadap expected achievement, target tahunan, dan tren perbandingan tahun sebelumnya.
_Avoid_: Nilai rapor, status kelulusan, kategori skor

**Polaritas Indikator**:
Arah efektivitas pengukuran indikator yang membedakan indikator menaik (makin tinggi makin baik, seperti cakupan intervensi) dan indikator menurun (makin rendah makin baik, seperti jumlah kasus/prevalensi stunting).
_Avoid_: Tipe arah, sifat target, arah tren

**Sub-Kategori Indikator**:
Unit intervensi spesifik di bawah suatu Kategori yang nilainya dihasilkan dari agregasi pasangan kolom sasaran dan realisasi. Nama sub-kategori secara bawaan mengadopsi nama kolom realisasi.
_Avoid_: Variabel intervensi, item indikator, baris sub

**Agregasi Pembilang (Numerator / Realisasi)**:
Akumulasi penjumlahan (`SUM`) dari kolom yang mencatat subjek/sasaran yang telah menerima intervensi kesehatan.
_Avoid_: Kolom capaian mentah, sum atas

**Agregasi Penyebut (Denominator / Sasaran)**:
Akumulasi penjumlahan (`SUM`) dari kolom sasaran riil populasi di tingkat wilayah/Puskesmas sebagai dasar pembagi persentase cakupan.
_Avoid_: Kolom target riil, sum bawah

### Penyimpanan & Persistensi Eksternal
**Penyimpanan Eksternal Google Apps Script**:
Layanan backend berbasis Google Apps Script Web App yang terhubung ke Google Drive untuk menyimpan dan memuat file Excel biner (`.xlsx`) dan konfigurasi join (`.json`) secara terpusat di cloud tanpa membutuhkan server database terpisah.
_Avoid_: Database server, local storage eksternal, backend API server

**Default Kustom**:
Pasangan file Excel dan konfigurasi preset yang ditetapkan oleh pengguna/admin pada penyimpanan eksternal untuk menggantikan file bawaan sistem saat aplikasi diinisialisasi.
_Avoid_: Custom setting, override file, data baru

**Bawaan Sistem**:
File Excel template dan konfigurasi statis awal (`/data/default-join-data.xlsx`) yang disediakan sebagai aset bawaan aplikasi saat penyimpanan eksternal tidak aktif, gagal dijangkau, atau di-reset.
_Avoid_: Hardcoded data, default asset

### Analisis Kohort & Pelacakan Individu Stunting
**Kohort Stunting**:
Modul dan metodologi pelacakan perkembangan status stunting anak secara individual lintas periode waktu pemantauan berbasis identitas tunggal NIK.
_Avoid_: Komparasi data, join NIK, tracking balita biasa

**Tetap Stunting**:
Kategori transisi bagi balita yang tercatat mengalami stunting pada Periode Awal dan masih tercatat mengalami stunting pada Periode Evaluasi (irisan langsung kedua periode).
_Avoid_: Stunting menetap, kasus persisten, stunting ganda

**Bebas Stunting**:
Kategori transisi bagi balita yang tercatat stunting pada Periode Awal tetapi tidak lagi tercatat stunting pada Periode Evaluasi serta usianya masih dalam rentang usia pemantauan balita (<60 bulan).
_Avoid_: Sembuh stunting, lolos stunting, keluar cohort biasa

**Kasus Baru Stunting**:
Kategori transisi bagi balita yang tidak tercatat stunting pada Periode Awal namun baru teridentifikasi mengalami stunting pada Periode Evaluasi.
_Avoid_: Stunting baru, insiden baru, new case mentah

**Lulus Usia Balita**:
Kategori transisi pemantauan bagi anak yang tercatat pada Periode Awal tetapi pada Periode Evaluasi usianya telah mencapai atau melampaui batas balita (>=60 bulan), sehingga keluar dari kohort pemantauan bukan semata karena pemulihan status gizi.
_Avoid_: Drop out usia, kadaluwarsa, lewat umur

**Outlier Usia Stunting**:
Anomali data pemantauan di mana anak yang telah mencapai atau melampaui batas usia balita (>=60 bulan) masih tercatat mengalami stunting pada Periode Evaluasi, mengindikasikan adanya kekeliruan input tanggal lahir atau keterlambatan pengeluaran anak yang telah memasuki usia prasekolah/sekolah dasar dari pelaporan sasaran balita.
_Avoid_: Error data mentah, anak salah, balita kadaluarsa



