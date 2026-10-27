# Fase 1.11 — Invoice dan kwitansi

**Implementasi:** tersedia di `/modul/invoice-kwitansi`. Formulir dan kalkulasi
berjalan di browser; data tidak disimpan dan tidak dikirim untuk dihitung.
Invoice adalah permintaan pembayaran. Kwitansi adalah bukti penerimaan
pembayaran. Keduanya menghasilkan dokumen terpisah dengan nomor, tanggal,
identitas pihak, item, kuantitas, harga satuan, subtotal, diskon, dan total.

## Aturan aritmetika

- Harga satuan dan diskon adalah Rupiah utuh, dibatasi 18 digit.
- Kuantitas positif mendukung hingga tiga angka desimal, dimasukkan dengan koma
  (misalnya `1,25`); satu baris memakai `kuantitas × harga satuan`.
- Setiap baris dibulatkan ke Rupiah terdekat, dan nilai tepat setengah menjauhi
  nol (`half-away-from-zero`). Subtotal adalah jumlah hasil pembulatan tiap
  baris. Diskon nominal dikurangkan sesudah subtotal.
- Diskon negatif atau lebih besar daripada subtotal, kuantitas nol/tidak sah,
  dokumen tanpa item, nama/nomor kosong, tanggal yang bukan tanggal kalender,
  serta hasil di luar batas ditolak dengan pesan eksplisit.
- Batas dokumen adalah 100 item; teks item 200 karakter, nomor dokumen 50
  karakter, nama pihak 120 karakter, dan kuantitas maksimal `999.999.999,999`.
- Metode versi `documents.invoice-receipt` v`1.11.0` tidak menerapkan pajak,
  PPN, pemotongan, bea meterai, atau tarif lain. Ketiadaan konfigurasi tidak
  bermakna tarif tersebut nol. Dokumen adalah template umum, bukan faktur pajak
  atau nasihat hukum/perpajakan.
- Tombol cetak membuka dialog cetak browser. Pengguna memilih “Simpan sebagai
  PDF”; hasil PDF mencetak dokumen yang sama dengan rincian kalkulasi.

## Bukti dan status peninjauan

Fixture terpisah memuat 12 skenario hitung dan skenario validasi tambahan:
kuantitas bulat/pecahan, satu dan beberapa item, kedua sisi batas pembulatan,
pembulatan per baris, nol, diskon, kwitansi tanpa pajak, batas nominal, serta
input tidak sah. Nilai harapan ditulis sebagai rasio integer exact terpisah dari
fungsi produksi. Tes komponen dan E2E memeriksa validasi, rekonsiliasi UI, mode
kwitansi, privasi request, dan tindakan cetak.

**Batas klaim:** implementasi teknis dan fixture otomatis tersedia. Pemeriksaan
manusia independen atas fixture belum dilakukan. E2E Chromium menghasilkan PDF
A4 dan memeriksa mode cetak; teks PDF yang diekstrak juga sudah dicocokkan
dengan nomor, nama penerima, jumlah baris, subtotal, diskon, total, dan
peringatan pajak pada dokumen layar. Pengujian visual lintas browser dan
pengaturan printer belum dilakukan. Karena itu modul belum boleh dinyatakan
lulus gerbang formal Fase 1.11 sampai pemeriksaan independen dan target cetak
dicatat. Tidak ada tarif hukum yang ditampilkan atau diklaim telah diverifikasi.

Jalankan tes terkait dengan `npm test -- --run packages/engine/src/invoice.test.ts
apps/web/src/components/InvoiceCalculator.test.tsx` setelah membangun workspace
shared dan engine, atau jalankan `npm run check` untuk pemeriksaan proyek.
