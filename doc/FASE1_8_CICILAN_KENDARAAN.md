# Fase 1.8 — Simulasi Cicilan Kendaraan

## Status dan batas klaim

Widget tersedia di `/modul/cicilan-kendaraan`. Engine berjalan di browser dan
tidak mengirim input untuk dihitung. Versi metode: `vehicle.installment-simulation`
`1.0.0`.

Ini adalah simulasi matematis berdasarkan asumsi pengguna, bukan kutipan,
persetujuan, tarif pasar, atau ketentuan lembaga pembiayaan. Tidak ada data
bunga, uang muka minimum, asuransi, pajak, maupun biaya produk eksternal yang
ditanam di engine. Catatan kutipan opsional hanya mengikat nama pemberi
pembiayaan, produk, URL sumber, tanggal kutipan, dan tanggal berlaku yang
dimasukkan pengguna; JOBENAPP tidak mengambil atau mengesahkan sumber itu.

## Input dan metode

- Harga kendaraan dan uang muka dalam Rupiah utuh. Uang muka tidak dapat lebih
  besar dari harga; pokok pembiayaan harus positif.
- Tenor bilangan bulat 1–360 bulan.
- Suku bunga tahunan nominal sebagai input pengguna, 0–100%, dibagi 12.
- Metode angsuran wajib dipilih: anuitas, flat, atau efektif.
- Administrasi, asuransi/produk tambahan, dan biaya lain diinput terpisah.
  Setiap baris dibayar di awal atau ditambahkan ke pokok pembiayaan sesuai
  pilihan. Nilai yang kosong tidak dihitung.

Semua nilai uang di engine memakai `bigint`; tidak ada floating point biner.
Bunga setiap periode dihitung sebagai `saldo dasar × basis point / 120.000`
dan dibulatkan ke Rupiah terdekat, dengan setengah menjauh dari nol.
Pembayaran dilakukan pada akhir bulan.

- **Anuitas:** angsuran tetap dihitung dari saldo dan tenor tersisa dengan
  rumus anuitas menggunakan aritmetika integer eksak; angsuran terakhir
  disesuaikan agar pokok terbayar tepat.
- **Flat:** bunga memakai pokok pembiayaan awal setiap bulan; pokok dibagi
  merata sepanjang tenor, lalu selisih pembulatan diselesaikan di angsuran
  terakhir.
- **Efektif:** pokok tersisa dibagi merata selama tenor tersisa; bunga memakai
  saldo awal periode, sehingga total angsuran dapat turun.

Total pengeluaran adalah uang muka ditambah biaya awal dan semua angsuran.
Biaya yang dimasukkan ke pembiayaan sudah tercakup dalam pokok dan angsuran,
sehingga tidak dijumlahkan ulang pada pembayaran awal.

## Pemeriksaan

Fixture emas minimum 10 tersedia di
`packages/engine/src/fixtures/vehicle-phase-1-8-math-vectors.json`. Hasil
dibandingkan dengan referensi Python `fractions.Fraction` yang terpisah dari
engine produksi, dengan pembulatan Rupiah half-away-from-zero. Fixture meliputi
ketiga metode, bunga nol, tenor pendek dan panjang, biaya awal dan yang
dibiayai, pembulatan angsuran terakhir, batas nominal, dan rekonsiliasi saldo
akhir nol.

Status fixture mencatat bahwa pemeriksaan referensi otomatis telah dilakukan,
tetapi pemeriksa independen manusia masih diperlukan. Gerbang Fase 1.8 belum
boleh disebut sepenuhnya terverifikasi sebelum pemeriksaan itu selesai.
