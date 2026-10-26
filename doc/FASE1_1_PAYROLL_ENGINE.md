# Fase 1.1 — Engine logika gaji bersih

**Cakupan implementasi:** engine kalkulasi murni di `@jobenapp/engine`, formulir
payroll lokal di browser, pemeriksaan gerbang rilis, dan laporan yang dapat
dicetak atau diunduh sebagai CSV setelah aturan serta fixture lolos tinjauan.
Dataset tarif resmi dan fixture emas belum tersedia, sehingga halaman saat ini
tetap terkunci dan Fase 1.1 belum siap diterbitkan.

## Perilaku yang dihitung

- Penerimaan bulan berjalan menggunakan TER bulanan sesuai status pajak pada
  awal tahun dan tabel TER yang diberikan sebagai data aturan.
- Masa pajak terakhir (Desember atau bulan akhir bekerja) melakukan rekonsiliasi:
  bruto kena pajak tiap bulan dikurangi biaya jabatan bulanan dan kontribusi
  pegawai yang diizinkan aturan; penghasilan neto bagian tahun disetahunkan;
  PTKP dikurangkan; PKP dibulatkan ke bawah sesuai satuan konfigurasi; tarif
  progresif dihitung per lapisan; pajak diprorata untuk jumlah bulan kerja;
  pemotongan sebelumnya dikurangkan.
- Pemotongan terakhir boleh negatif. Nilai negatif dipertahankan sebagai
  indikasi kelebihan potong, bukan diam-diam diubah menjadi nol.
- Enam program—JKN, JHT, JP, JKK, JKM, dan JKP—dihitung terpisah dari dasar
  upah eksplisit, batas bawah/atas, tarif, kelas risiko bila diperlukan, serta
  mode pembulatan masing-masing. Porsi pegawai, pemberi kerja, dan pemerintah
  keluar sebagai nilai terpisah.
- Tanggungan tambahan JKN dapat dihitung hanya jika jumlah dan aturan tarif per
  tanggungan serta batas jumlah dinyatakan. Jika data aturan itu tidak tersedia,
  engine menolak kasus dengan tanggungan tambahan alih-alih menganggap iurannya
  nol.
- Gaji bersih hanya mengurangkan PPh 21 saat ini, porsi iuran pegawai, dan
  potongan pegawai lain dari pembayaran tunai. Manfaat kena pajak non-tunai
  dapat menambah bruto pajak tanpa dianggap sebagai uang tunai yang dibayar.
- Riwayat kerja wajib mencakup setiap bulan kerja sebelum bulan ini berikut
  jumlah PPh yang benar-benar dipotong; ketidaklengkapan riwayat adalah galat,
  bukan asumsi potongan nol.
- Batas atas setiap lapisan TER bulanan bersifat inklusif. Nilai tepat pada
  batas tetap menggunakan lapisan tersebut; lapisan berikutnya berlaku mulai
  satu Rupiah di atasnya.

## Formulir, laporan, dan gerbang rilis

Formulir meminta klasifikasi komponen tunai, bruto kena pajak, dasar upah enam
program BPJS, status awal tahun, partisipasi setiap program, dan riwayat
potongan bulanan. Seluruh perhitungan berjalan di browser; tidak ada input gaji
yang dikirim ke API.

Formulir juga meminta konfirmasi bahwa kewajiban pajak telah dimulai sejak
awal tahun, tidak ada pemberi kerja lain, pekerjaan tidak berakhir pada bulan
yang dihitung, dan tidak menggunakan gross-up. Kasus kewajiban yang mulai
pertengahan tahun, pekerjaan yang berakhir, beberapa pemberi kerja, atau
gross-up ditolak karena varian dan rumus rinci pada referensi belum diverifikasi.

Laporan menampilkan ringkasan pajak, rincian porsi BPJS pegawai/pemberi kerja/
pemerintah, versi aturan, catatan, dan hasil bersih. Setelah perhitungan
berhasil, laporan dapat dicetak/disimpan ke PDF melalui browser atau diunduh
sebagai CSV. Tidak ada form atau laporan bernilai gaji sebelum aturan dan
fixture pembanding lolos gerbang:

- Kedua dataset aturan harus lengkap, bertanggal efektif, berstatus terbit, dan
  mempunyai pemeriksa independen.
- Setidaknya 30 fixture PPh 21/TER dan 20 fixture BPJS harus memiliki sumber,
  hasil harapan, berkas test, hasil test lulus, dan pemeriksa yang berbeda dari
  penyusunnya.
- Sebelum produksi, validasi slip gaji nyata yang dianonimkan harus dicatat.
  Sampai itu terpenuhi, hasil perhitungan (jika gerbang sebelumnya dibuka)
  diberi label validasi terbatas dan bukan untuk produksi.

Saat ini `data/payroll-release.ts` sengaja tidak berisi aturan terbit maupun
fixture emas. Gerbang menolak dataset yang belum lengkap; vektor matematika
sintetis tidak dapat digunakan untuk membukanya.

## Kontrak data aturan dan batas publikasi

Engine tidak menyimpan tarif TER, lapisan pajak, PTKP, batas upah, tarif BPJS,
atau pemetaan klasifikasi komponen. Pemanggil harus memasok dua versi aturan
(`payroll.pph21-permanent` dan `payroll.bpjs-employee`) yang efektif pada tanggal
perhitungan, berstatus diterbitkan, memiliki sumber HTTPS, tanggal pemeriksaan,
penyusun, dan pemeriksa kedua sesuai kontrak Fase 1.0.

Klasifikasi bruto pajak, nilai tunai, dasar upah program, potongan yang dapat
mengurangi penghasilan neto tahunan, status per awal tahun, kelas risiko, serta
keikutsertaan setiap program BPJS juga harus diberikan eksplisit. Tidak ada
default tarif atau asumsi porsi nol untuk program yang tidak diklasifikasikan.
Program yang tidak berlaku harus dinyatakan secara eksplisit pada input.

Riwayat multi-pemberi kerja tidak digabungkan. Untuk menghitungnya, diperlukan
data bukti potong dan aturan rekonsiliasi lintas pemberi kerja yang terpisah;
hasil ini memberi peringatan tentang batas tersebut.

## Referensi yang perlu menjadi dasar dataset aturan

Sumber primer/penyelenggara berikut diperiksa pada 26 Oktober 2026 untuk
memahami domain, bukan untuk menerbitkan tabel tarif:

- PP Nomor 58 Tahun 2023, laman peraturan DJP:
  https://pajak.go.id/id/peraturan/tarif-pemotongan-pajak-penghasiian-pasal-21-atas-penghasilan-sehubungan-dengan-pekerjaan
- PMK Nomor 168 Tahun 2023, laman peraturan DJP. Rujukan implementasi meliputi
  Pasal 15 tentang pegawai tetap/masa pajak terakhir dan bagian penghitungan
  pada lampiran:
  https://pajak.go.id/id/peraturan/petunjuk-pelaksanaan-pemotongan-pajak-atas-penghasilan-sehubungan-dengan-pekerjaan-jasa-1
- BPJS Ketenagakerjaan, informasi peserta penerima upah:
  https://www.bpjsketenagakerjaan.go.id/penerima-upah.html
- PP Nomor 6 Tahun 2025 tentang JKP, salinan pada situs BPJS Ketenagakerjaan:
  https://www.bpjsketenagakerjaan.go.id/assets/uploads/peraturan/PP_Nomor_6_Tahun_2025.pdf
- Perpres Nomor 64 Tahun 2020 tentang Jaminan Kesehatan, JDIH BPK:
  https://peraturan.bpk.go.id/Details/136650/perpres-no-64-tahun-2020

Pemeriksaan halaman sumber bukan tinjauan hukum/payroll independen. Sebelum
menyusun data tarif siap pakai, periksa perubahan peraturan yang berlaku pada
periode sasaran, lampiran tarif lengkap, batas upah terbaru, pengecualian,
aturan efektif, serta perlakuan setiap porsi. Minta spesialis berbeda memeriksa
hasil dan fixture; jangan menandai aturan sebagai diterbitkan sebelum itu.

## Pengujian

`packages/engine/src/fixtures/payroll-phase-1-1-math-vectors.json` menyimpan 30
vektor TER sintetis dan 20 vektor kontribusi sintetis dengan hasil hitung
bilangan bulat. Vektor menguji kontrak matematika, pembatasan upah, pemisahan
porsi, dan pembulatan. Semuanya secara eksplisit **bukan** tarif hukum dan
**tidak dihitung** sebagai minimum 50 fixture emas bersumber pada adendum
Fase 1. Tes gerbang di `apps/web/src/data/payroll-release.test.ts` menggunakan
metadata dummy hanya untuk menguji perilaku gate; metadata tersebut juga bukan
fixture payroll dan tidak membuka gate aplikasi.

Tes tambahan menguji rekonsiliasi akhir tahun, status/TRE kategori, PTKP,
penghasilan bagian tahun, riwayat potong, deduksi yang diizinkan, status aturan,
keikutsertaan, kelas risiko, batas upah, pemisahan biaya, dan input yang
kurang/tidak sah.
