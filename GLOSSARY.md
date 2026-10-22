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
**Adapter Buku Kerja Excel (Excel Workbook Adapter)**:
Modul batas (*boundary adapter*) Tier-1 yang mengisolasi pustaka eksternal SheetJS (`xlsx`, `xlsx-js-style`), menyediakan operasi pembacaan, pembuatan, penataan gaya (*styling*), dan serialisasi biner tanpa membocorkan tipe atau fungsi SheetJS ke modul domain maupun komponen antarmuka pengguna.
_Avoid_: SheetJS helper, utilitas xlsx langsung, library wrapper bocor

**Arsitektur Pemrosesan Spreadsheet 2-Tingkat (2-Tier Spreadsheet Processing Architecture)**:
Pola rancangan pemisahan batas di mana Tingkat 1 (Adapter Buku Kerja) bertugas mengelola manipulasi sel dan berkas biner mentah, sedangkan Tingkat 2 (Parser Spreadsheet Dinkes & Mesin Penggabung) bertugas mengenali struktur domain kesehatan, mengekstrak baris target/ringkasan, dan memvalidasi dataset tanpa menyentuh koordinat sel fisik.
_Avoid_: Skrip baca excel campur aduk, pengolahan langsung di komponen

**Ingesti Buku Kerja Dinkes (Dinkes Workbook Ingestion)**:
Modul domain terpadu yang memproses dan menormalkan buku kerja Excel Dinkes (baik dalam format mentah multi-sheet yang perlu di-join maupun format hasil penggabungan standar yang sudah terformat) menjadi representasi dataset yang konsisten di balik satu antarmuka tunggal.
_Avoid_: File loader, helper baca excel, parser manual

**Dataset Terpadu Dinkes (Parsed Dinkes Dataset)**:
Struktur data hasil ingesti yang memisahkan baris data wilayah murni secara tegas dari baris ringkasan (Jumlah, Rata-rata, Target), serta menyediakan konfigurasi tipe data, target capaian, dan kolom agregasi secara terpusat.
_Avoid_: Objek excel mentah, JSON join bebas

**Multi-Layer Header**:
Struktur header tabel Excel berjenjang yang memiliki pengelompokan judul induk di baris atas dan sub-judul spesifik di baris bawah.
_Avoid_: Merged header, header bertingkat tak beraturan

**Join Key**:
Kolom identifikasi bersama yang dijadikan rujukan dalam operasi penggabungan (Left Join) antar-sheet Excel.
_Avoid_: Kolom kunci mentah, primary key

### Visualisasi & Evaluasi Indikator
**Mesin Pengiris Grafik (Chart Slicing Engine)**:
Modul logika domain-presentasi yang memproses pemotongan multi-dimensi dataset Dinkes (memilah per-indikator vs per-wilayah), mengkalkulasi ringkasan statistik kesehatan (angka valid, missing/non-numerik, angka 0, kelulusan target, rata-rata, capaian ekstrem tertinggi dan terendah), mengurutkan data sesuai mode peringkat (*sort mode*), dan mendelegasikan penyusunan tata letak ke Mesin Tata Letak Grafik (`ChartLayoutEngine`).
_Avoid_: Logika filter di template, pemrosesan chart di komponen, kalkulator statistik grafis terpisah

**Kelompok Grafik Indikator (Indicator Chart Group)**:
Struktur presentasi grafik yang merangkum visualisasi komparatif satu seri indikator untuk seluruh wilayah terpilih, dilengkapi tata letak visual SVG dan ringkasan metrik statistik kesehatan.
_Avoid_: Split indicator chart, sub-chart

**Kelompok Grafik Wilayah (Region Chart Group)**:
Struktur presentasi grafik yang merangkum visualisasi multi-indikator untuk satu wilayah terpilih, dilengkapi tata letak visual SVG dan ringkasan metrik statistik pencapaian target.
_Avoid_: Per-region card data, objek grafik wilayah mentah

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

**Mode Peta Heatmap (District Spatial Heatmap)**:
Mode visualisasi spasial geografis pada modul Visualisasi Grafik yang memetakan capaian indikator kesehatan terpilih ke dalam polygon peta SVG 35 Kabupaten/Kota Jawa Tengah. Menyajikan gradasi warna HSL adaptif, peringkat wilayah, selisih terhadap target/rata-rata provinsi, serta pemeriksa wilayah interaktif (*District Inspector*). Menampilkan satu indikator dalam satu layar dengan kendali pemilih indikator dinamis.
_Avoid_: Peta biasa, GIS mentah, peta gambar statis

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
**Mesin Alur Kerja Pemantauan Stunting (Stunting Workflow Engine)**:
Modul domain terpadu yang mengoordinasikan seluruh alur evaluasi stunting 3-langkah (Unggah & Gabung Lembar Kerja $\to$ Perancang Kategori & Indikator $\to$ Evaluasi Capaian & Scorecard). Mengelola status reaktif, mengeksekusi penggabungan data via `ExcelJoinEngine`, melakukan auto-populasi indikator standar Dinkes, memvalidasi invarian transisi langkah secara ketat di luar lapisan UI/DOM, serta memicu kalkulasi pada `StuntingEvaluationEngine`.
_Avoid_: UI Stepper component, state holder lepas, logic helper

**Invarian Transisi Langkah (Step Transition Invariant)**:
Aturan prasyarat domain yang wajib dipenuhi sebelum sistem mengizinkan perpindahan antar-tahap dalam alur kerja pemantauan stunting (misalnya: Langkah 2 mewajibkan dataset gabungan terisi dan valid; Langkah 3 mewajibkan minimal satu kategori memiliki sub-kategori indikator).
_Avoid_: Kondisi disabled tombol, validasi form biasa, if-check UI

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
**Ruang Kerja Konfigurasi (Configuration Workspace)**:
Modul domain terpusat untuk mengelola siklus hidup persistensi konfigurasi preset Dinkes (penggabungan Excel, pemantauan stunting, dan visualisasi grafik). Menyediakan validasi skema JSON, persistensi media lokal (`localStorage` / memori), penamaan berkas unduh otomatis, serta memisahkan persistensi dari algoritma pencocokan fuzzy kolom spreadsheet (`ExcelResilientMatcher`).
_Avoid_: Preset helper terpisah, static pass-through store, wrapper konfigurasi redundan

**Preset Konfigurasi Dinkes (Dinkes Configuration Preset)**:
Struktur data JSON terstandarisasi yang merekam metadata pemetaan sheet, aturan join, target evaluasi indikator, atau pengaturan tata letak grafik agar alur kerja pengolahan data dapat dipulihkan atau dibagikan secara instan tanpa konfigurasi ulang manual.
_Avoid_: File config mentah, objek JSON acak

**Ruang Kerja Partisi Periode (Period Partition Workspace)**:
Modul domain terpusat yang mengoordinasikan pemilihan tahun anggaran dan triwulan, pemindaian ketersediaan slot partisi Google Drive, pengunduhan dan penggabungan berkas multi-triwulan (lintas cloud dan berkas lokal), serta pemetaan otomatis ke dalam dataset terpadu Dinkes di balik satu antarmuka reaktif tunggal.
_Avoid_: GAS helper, file manager komponen, quarter loader lepas

**Penyimpanan Eksternal Google Apps Script**:
Layanan backend berbasis Google Apps Script Web App yang terhubung ke Google Drive untuk menyimpan dan memuat file Excel biner (`.xlsx`) dan konfigurasi join (`.json`) secara terpusat di cloud tanpa membutuhkan server database terpisah.
_Avoid_: Database server, local storage eksternal, backend API server

**Slot Periode Lintas Triwulan**:
Partisi penyimpanan di Google Drive yang diidentifikasi oleh pasangan Tahun Anggaran dan Triwulan (misal: 2025/TW1), yang menampung berkas data mentah, berkas hasil penggabungan, dan konfigurasi join resmi untuk triwulan tersebut.
_Avoid_: Folder acak, save slot bebas, tag periode

**Berkas Data Mentah (Raw Excel)**:
Berkas buku kerja Excel multi-sheet asli yang diunggah oleh pengguna ke sistem sebelum dilakukan proses penggabungan atau normalisasi kolom.
_Avoid_: Data awal, uncleaned data, file mentah sembarang

**Berkas Hasil Penggabungan (Joined Result Excel)**:
Berkas lembar kerja Excel teragregasi yang telah melalui proses Left Join, normalisasi wilayah, kalkulasi indikator, dan pembersihan baris, siap digunakan untuk visualisasi dan pelaporan.
_Avoid_: File final, joined table, data bersih lepas

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



