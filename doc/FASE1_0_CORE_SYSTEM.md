# Fase 1.0 — Core System

**Status:** implementasi fondasi kalkulasi selesai dan diuji secara lokal.
Status ini hanya berlaku untuk core system; bukan klaim bahwa alat 1.1–1.12,
verifikasi hukum, atau staging produksi telah selesai.

## Kontrak angka

- Nominal dihitung dengan `bigint` Rupiah utuh, bukan operasi floating point.
- Rentang yang didukung: `0` sampai `999.999.999.999.999.999` untuk input
  kalkulasi; formatter mendukung nilai bertanda sampai batas absolut yang sama.
- Parsing nominal menerima digit biasa dan pengelompokan ribuan Indonesia
  (contoh `1500000` dan `1.500.000`); nominal pecahan, tanda, serta sintaks
  ambigu ditolak. Input kosong dibedakan dari nominal nol.
- Input persentase memakai koma desimal hingga dua angka; disimpan sebagai
  basis point integer (`2,5%` menjadi `250` basis point). Parsing, aritmetika,
  dan pemformatan adalah tahap terpisah.
- Operasi rasio mendukung `half-away-from-zero`, `floor`, dan `ceiling`.
  Penyebut nol, nilai di luar rentang, dan mode pembulatan tidak dikenal
  menghasilkan galat domain dengan kode terstruktur.

## Kontrak engine dan versi aturan

- Fungsi kalkulasi menerima semua input dan versi metode secara eksplisit,
  lalu mengembalikan hasil, langkah, asumsi, peringatan, metode pembulatan,
  serta kunci/versi yang dipakai.
- Serialisasi hasil mengubah `bigint` ke string desimal dengan urutan properti
  tetap agar hasil yang sama dapat direproduksi.
- Seleksi aturan bergantung pada tanggal ISO yang diberikan pemanggil. Versi
  hanya dapat dipilih jika diterbitkan, efektif pada tanggal itu, punya sumber
  HTTPS dan bagian rujukan, tanggal pemeriksaan, penyusun, serta pemeriksa kedua
  yang berbeda. `effectiveTo` bersifat eksklusif. Draf, tinjauan kedaluwarsa,
  periode yang tumpang tindih, dan tanggal tidak sah ditolak secara eksplisit.
- Engine tetap murni: tidak mengakses UI, browser, jam, jaringan, atau database.

## Playground

Beranda menyediakan demo hitung persentase generik dengan input sepenuhnya dari
pengguna. UI menampilkan rincian hasil, pembulatan, asumsi, versi metode,
ringkasan yang dapat disalin, dan JSON reproduksi. Input tidak dikirim ke API.
Demo ini bukan kalkulator pajak, iuran, marketplace, atau penawaran bank.

## Bukti dan batas klaim

- Fixture internal terpisah dari implementasi berada di
  `packages/engine/src/fixtures/core-money.json`. Fixture berisi nominal normal,
  batas pembulatan, nol, dan batas domain, dengan pembanding aritmetika dan
  metadata tanggal serta status non-publikasi.
- Tes mencakup pembulatan positif/negatif dan penyebut negatif, pembagian nol,
  batas nominal/persentase, determinisme serialisasi, relasi floor/ceiling,
  seleksi versi tanggal-efektif, provenance, dan UI lokal tanpa request `fetch`.
- Cakupan engine terukur dengan V8: 100% baris, 98,23% cabang, dan 100% fungsi
  untuk modul uang serta aturan; target ≥95% baris dan ≥90% cabang dipasang
  sebagai ambang tes.
- Fixture tersebut adalah bukti core matematika, bukan fixture sumber resmi
  untuk 12 alat. Belum ada tarif eksternal yang diterbitkan.
- Pengujian UI otomatis dan screenshot lokal membuktikan tampilan desktop/mobile
  pada aplikasi dev. Verifikasi staging cPanel tetap memerlukan akses staging
  dan database yang benar.

Jalankan validasi dengan `npm run check`. Aplikasi dev memakai Node.js 22.
Frontend demo dapat menghitung tanpa database. API tetap memerlukan
`DATABASE_URL` development tersendiri untuk lulus health check.
