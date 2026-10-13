# Pelacakan Kohort Balita Stunting Dua Periode Berbasis NIK

Untuk kebutuhan evaluasi efektivitas intervensi dan dinamika stunting antar-periode (misal: semester atau triwulan), diputuskan untuk membangun modul analisis **Kohort Stunting** yang membandingkan dua dataset anak stunting berbasis kunci tunggal `NIK`.

### Keputusan Kunci:
1. **Diferensiasi Status Transisi**: Mengklasifikasikan balita ke dalam 4 kategori deterministik:
   - *Tetap Stunting*: Balita tercatat stunting pada Periode Awal dan Periode Evaluasi.
   - *Bebas Stunting*: Balita tercatat stunting pada Periode Awal namun tidak tercatat pada Periode Evaluasi, dan usianya masih dalam rentang balita (<60 bulan).
   - *Kasus Baru*: Balita baru tercatat stunting pada Periode Evaluasi tanpa riwayat stunting pada Periode Awal.
   - *Lulus Usia Balita*: Balita keluar dari kohort karena usianya telah mencapai $\ge 60$ bulan pada tanggal evaluasi, mencegah bias overestimasi kesembuhan gizi.
2. **Sanitasi NIK & Privasi Klien**: Pembersihan notasi ilmiah Excel (`3.301E+15`), penanganan leading-zero, dan deduplikasi baris dilakukan seutuhnya di sisi klien (in-memory) tanpa pengiriman data identitas anak (PII) ke server eksternal.
3. **Ekspor Multi-Sheet Terstruktur**: Hasil perbandingan diekspor ke dalam buku kerja Excel multi-sheet (Ringkasan Eksekutif, Semua Balita, Tetap Stunting, Bebas Stunting, Kasus Baru, Lulus Usia) menggunakan `xlsx-js-style` untuk memfasilitasi tindak lanjut lintas program di lapangan.
