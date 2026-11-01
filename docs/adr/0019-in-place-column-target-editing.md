# 19. Penyuntingan Target Kolom In-Place pada Tabel Kelola Data (In-Place Column Target Editing)

## Status
Accepted

## Konteks & Masalah
Pada modul **Kelola Data** (`/data`), pengguna (administrator/analis Dinkes) memproses penggabungan lembar kerja Excel dan mengevaluasi ketercapaian target indikator kesehatan 35 Kabupaten/Kota. Sebelumnya, target kolom indikator (operator pembanding seperti `>=` dan nilai target numerik seperti `80`) hanya dapat dikonfigurasi melalui panel pengaturan kolom (*Column Settings drawer*) atau modal pengisian target (*Target Modal*). Hal ini menimbulkan friksi alur kerja ketika pengguna sedang menelaah tabel pratinjau yang lebar dan ingin mengoreksi atau mencoba batas target yang berbeda untuk suatu indikator tertentu.

Di sisi lain, tabel pratinjau sudah memiliki mekanisme penyuntingan nama kolom secara langsung pada sel header (*double-click rename* atau tombol pensil hover). Pengguna menginginkan konsistensi interaksi yang sama untuk mengubah nilai dan operator target langsung pada sel baris **Target** di bagian footer tabel.

## Keputusan Arsitektur
Menerapkan arsitektur **Penyuntingan Target Kolom In-Place (In-Place Column Target Editing)** pada baris Target footer tabel modul Kelola Data (`ExcelJoinComponent`):

1. **State Sinyal Editor Inline**:
   - `editingTargetColKey`: Menyimpan kunci kolom (`string | null`) yang sedang aktif disunting.
   - `editingTargetOperator`: Menyimpan pilihan operator pembanding aktif (`TargetOperator`: `>=` | `<=` | `>` | `<` | `==`).
   - `editingTargetValue`: Menyimpan string input angka target sementara selama penyuntingan.

2. **Pemicu Interaksi & Kontrol Mini Terpadu**:
   - **Pemicu**: Pengguna mengklik 2x (`dblclick`) pada sel target numerik atau mengklik ikon pensil yang muncul saat sel di-*hover*.
   - **Sel Tanpa Target (Tanda `-`)**: Tetap mendukung interaksi double-click dengan teks petunjuk `+ Target` saat kursor berada di atas sel, otomatis mengisi nilai awal aman (`80` untuk kolom persentase, `0` untuk absolut). Kolom kategori wilayah (Kabupaten/Kota) dan kolom string tetap dilindungi (*disabled*).
   - **Kontrol Terpadu & Guard Min 0**: Menampilkan elemen pemilih operator ringkas (`<select>`) berdampingan dengan kotak input angka numerik (`<input type="number" min="0">`), disertai tombol aksi `↵ Simpan` dan `Esc Batal`. Nilai target memiliki proteksi ketat (*guard*) sehingga tidak dapat diatur di bawah 0 (`Math.max(0, val)`).
   - **Penyelesaian**: Menekan tombol `Enter` atau mengklik `↵ Simpan` atau berpindah fokus (*blur*) menyimpan perubahan; menekan tombol `Escape` atau mengklik `Esc Batal` membatalkan penyuntingan.

3. **Reaktivitas Penuh Instan & Persistensi**:
   - Saat disimpan, sistem memanggil `updateTargetConfig(colKey, { operator, value, enabled })` dan `saveCurrentStateToStore()`.
   - Perubahan ini secara reaktif memicu perhitungan ulang warna sel data (`getCellFormatClass`), statistik ketercapaian (`capaianStats`), kolom evaluasi `Capaian` per baris wilayah, serta penghitung target aktif (`activeTargetCount`) tanpa memerlukan penyegaran halaman maupun tombol simpan manual terpisah.

## Konsekuensi
- Efisiensi alur telaah data meningkat signifikan; analis dapat menyesuaikan target indikator secara *live* langsung di tabel tanpa harus keluar masuk modal pengaturan.
- Pola interaksi tabel menjadi kohesif dan konsisten antara header (nama kolom) dan footer (target indikator).
- Integritas data tetap terjaga karena kolom non-metrik (string/wilayah) tidak dapat diedit secara keliru, dan input numerik divalidasi sebelum diaplikasikan ke store.
