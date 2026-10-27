# Fase 1.9 — Terbilang

## Status dan batas klaim

Kalkulator dan engine Fase 1.9 tersedia di `/modul/terbilang`. Implementasi
mengikuti spesifikasi input dan metode di dokumen ini. Kumpulan 57 gold vector
berisi teks harapan statis dan diuji terpisah dari fungsi produksi. **Tinjauan
bahasa independen atas konvensi dan seluruh hasil harapan belum dilakukan**;
gerbang formal Fase 1.9 tetap menunggu tinjauan tersebut.

## Input dan aturan konversi

- Input memakai notasi Indonesia: titik opsional memisahkan kelompok tiga
  digit; koma memperkenalkan pecahan. Contoh: `1500000`, `1.500.000`,
  `1.234,50`, `-1.234,50`.
- Angka dengan pemisah kelompok yang salah, koma tanpa digit pecahan, titik
  desimal bergaya Inggris, tanda plus, atau lebih dari 64 karakter ditolak
  dengan galat domain yang eksplisit.
- Bilangan bulat berada di antara
  `-999.999.999.999.999.999` dan
  `999.999.999.999.999.999`. Sampai 18 digit pecahan diterima; digit pecahan
  ke-19 dan seterusnya ditolak.
- `0` disebut **nol**. Tanda minus memakai kata **minus**; `-0` dinormalisasi
  menjadi nol. Nilai negatif yang pecahannya bukan nol tetap memakai kata
  minus.
- Bentuk dasar mengikuti numeralia Bahasa Indonesia: bentuk khusus `sepuluh`,
  `sebelas`, `belas`, `puluh`, `seratus`, dan `seribu`, lalu skala `juta`,
  `miliar`, `triliun`, dan `kuadriliun`.
- Setiap digit sesudah koma dibaca satu per satu setelah kata **koma**. Digit
  nol di akhir tidak dihilangkan. Contoh: `12,3400` → “dua belas koma tiga
  empat nol nol”.
- Format **Nominal Rupiah** menambahkan kata **rupiah** setelah bilangan bulat.
  Bagian pecahan, bila ada, tetap dibaca setelah kata **koma**; alat tidak
  mengonversinya ke satuan mata uang lain.
- Konversi bersifat tekstual dan eksak. Tidak ada operasi floating point,
  pembulatan, pengambilan waktu, atau ketergantungan pada locale perangkat.

## Sumber dan provenance

Standar numeralia dirujuk ke *Tata Bahasa Baku Bahasa Indonesia* (bagian
numeralia), EYD V Bagian G (Angka dan Bilangan), dan entri KBBI Daring
“kuadriliun”. URL sumber dan tanggal pemeriksaan `2026-10-27` tertanam pada
metadata hasil engine. Pemisah desimal per digit, kata minus, dan letak kata
Rupiah adalah konvensi produk yang dinyatakan di atas, bukan klaim bahwa EYD
mengatur format kalkulator ini.

## Fixture dan perilaku gagal

`packages/engine/src/fixtures/terbilang-phase-1-9-gold-vectors.json` memuat
identitas spesifikasi/metode, tanggal pemeriksaan, masa berlaku yang tidak
relevan untuk konvensi bahasa, sumber, aturan pembulatan, status pemeriksa,
status batas per vektor, dan teks harapan tetap. Vektornya mencakup nol, satuan, belasan, puluhan, ratusan,
ribuan, jutaan, miliaran, triliunan, kuadriliun, batas maksimum, bilangan
negatif, desimal, Rupiah, dan nol di akhir pecahan.

Input kosong atau sintaks keliru menghasilkan `invalid_input`; format keluaran
tak dikenal menghasilkan `invalid_format`; nilai melampaui panjang, skala, atau
presisi menghasilkan `amount_out_of_range`. Tidak ada fallback ke angka default
atau hasil parsial.

## Privasi dan halaman

Semua perhitungan berlangsung di browser. Input tidak dikirim untuk dihitung,
disimpan, atau dicatat oleh API. Hasil disertai rincian bilangan bulat dan
pecahan, asumsi, versi metode, sumber, serta status tinjauan. Pengguna dapat
menyalin, membagikan, mencetak/menyimpan sebagai PDF, atau mengunduh ringkasan
`.txt`; hasil dan unduhan masing-masing mengikuti gerbang yang dapat dilewati
tanpa iklan.

## Pemeriksaan

Fixture statis, validasi batas/sintaks, metadata provenance, perilaku komponen,
gerbang hasil dan unduhan, alur lokal, dan tata letak 320 px diuji otomatis.
Fixture bukan pengganti tinjauan manusia oleh pemeriksa Bahasa Indonesia yang
independen. Jangan mengubah status menjadi “terverifikasi penuh” sebelum
pemeriksa tersebut menyetujui konvensi pembacaan dan seluruh fixture.
