# Adendum Fase 1 — Core System dan 12 alat

**Status:** spesifikasi kerja untuk memecah implementasi Fase 1 menjadi gerbang
yang dapat diperiksa satu per satu. Adendum ini melengkapi Bagian 2, 9, 11, dan
12 pada [rencana teknis JOBENAPP](JOBENAPP_Rencana_Teknis_joben.cloud_1793015363469.md);
tidak mengganti stack, memperluas Fase 1 ke backend Fase 2, atau menyatakan
aturan/tarif tertentu sudah diverifikasi.

Repositori saat adendum ini dibuat masih melaporkan fondasi Fase 0 dan belum
mengklaim ada kalkulator Fase 1 yang selesai. Semua aturan eksternal tetap harus
diverifikasi terhadap sumber primer yang berlaku sebelum alat terkait
diterbitkan.

## 1. Cara memecah dan menutup fase

Fase 1 terdiri atas satu prasyarat bersama (1.0) dan dua belas subfase alat
(1.1–1.12). Kerjakan dan tinjau satu subfase alat sampai gerbangnya lulus sebelum
menganggapnya selesai. Subfase yang sedang terblokir sumber boleh ditunda tanpa
mengarang tarif; subfase lain boleh berlanjut, tetapi Fase 1 keseluruhan belum
lulus sampai semua alat lulus.

Setiap subfase alat mengikuti urutan berikut:

1. Tetapkan versi spesifikasi, ruang lingkup, definisi input, rumus/langkah,
   satuan, aturan pembulatan, batas, dan perilaku input tidak valid.
2. Catat sumber primer, URL dan bagian/dokumen yang tepat, tanggal pemeriksaan,
   masa berlaku, serta penyusun dan pemeriksa kedua. Untuk hitungan matematis
   tanpa tarif eksternal, catat definisi/standar dan pembanding independen.
3. Implementasikan kalkulasi sebagai fungsi murni di `packages/engine`; aturan
   yang berubah menurut waktu/kategori disuplai sebagai data versi, bukan
   konstanta tersembunyi di rumus.
4. Tambahkan fixture emas yang hasilnya ditentukan secara independen dari kode
   produksi, kasus batas, uji sifat, dan uji pembulatan.
5. Lengkapi widget dan halaman alat: validasi Indonesia, hasil terurai per
   langkah, asumsi, peringatan, sumber, versi/masa berlaku, tanggal diperiksa,
   serta salin, bagikan, dan cetak/unduh sebagaimana disyaratkan rencana utama.
6. Jalankan tes mesin, komponen, dan E2E alat; periksa setidaknya viewport
   ponsel dan desktop. Pastikan alat tidak mengirim input/berkas yang menurut
   spesifikasinya harus tetap lokal.

Fixture emas harus menyimpan identitas alat dan versi aturan, skenario/input,
hasil harapan, rujukan sumber (atau pembanding matematis independen), tanggal
periksa dan efektif, aturan pembulatan, status batas, serta pemeriksa. Kasus
tanpa jejak yang lengkap tidak dihitung terhadap minimum.

## 2. Fase 1.0 — Core System bersama

Fase 1.0 dikerjakan sebelum subfase alat. Tujuannya memastikan setiap alat
memakai kontrak angka, provenance, validasi, dan pengujian yang sama sehingga
perbedaan antaralat muncul dari aturan masing-masing, bukan dari perilaku dasar
yang tidak konsisten.

### Ruang lingkup dan gerbang lulus

- **Aritmetika deterministik:** uang tidak dihitung dengan operasi floating
  point biner yang dapat mengubah hasil rupiah. Gunakan representasi bilangan
  bulat/decimal yang sesuai rentang dan presisi domain; nyatakan presisi internal
  dan metode pembulatan pada setiap tahap. Pemeriksaan overflow dan angka di
  luar rentang harus eksplisit.
- **Batas domain/presentasi:** parsing `id-ID` menerima bentuk rupiah yang
  disepakati (termasuk `1.500.000` dan `1500000`); parsing, kalkulasi, serta
  formatting dipisahkan. Format UI tidak boleh mengubah nilai kalkulasi.
- **Kontrak kalkulasi murni:** masukan aturan dan input pengguna menghasilkan
  hasil/langkah yang sama setiap kali. Engine tidak mengimpor `apps/`, tidak
  membaca jaringan, database, jam sistem, atau browser. Input tidak sah
  menghasilkan galat domain yang terstruktur—bukan `NaN`, `Infinity`, hasil
  diam-diam, atau angka default.
- **Provenance dan versi:** data aturan mencakup alat/kunci aturan, versi,
  tanggal efektif mulai dan (jika diketahui) akhir, sumber, tanggal diperiksa,
  serta metadata peninjauan. Kombinasi input dan versi yang sama harus dapat
  direproduksi. Jika sumber primer, peninjauan kedua, atau masa berlaku yang
  wajib belum ada, statusnya tidak boleh diperlakukan sebagai siap terbit.
- **Keluaran yang dapat dijelaskan:** setiap kalkulator mengembalikan hasil
  angka, rincian langkah, asumsi, pembulatan, peringatan/galat, dan referensi
  versi yang digunakan. UI menampilkan konteks yang relevan, bukan hanya angka
  akhir.
- **Fondasi pengujian:** fixture terpisah dari implementasi; tambahkan uji
  batas, pembulatan, input tak sah, dan uji sifat sesuai domain. Target cakupan
  mesin di rencana utama tetap berlaku (baris ≥95%, cabang ≥90%); tes bersama
  Fase 1.0 merupakan tambahan, bukan pengganti fixture alat.
- **Privasi dan responsivitas:** input hitungan finansial tidak dikirim ke
  server hanya untuk menghitung; tidak ada nilai tarif yang belum terverifikasi
  yang disamarkan sebagai nilai resmi. Antarmuka tetap memenuhi kriteria mobile
  pada rencana utama.

Fase 1.0 dinyatakan selesai hanya jika kontrak ini punya tes yang membuktikan
perilaku deterministik, parsing/validasi, pemilihan versi data, galat eksplisit,
dan reproduksi hasil. Fase ini tidak menetapkan angka tarif atau menerbitkan
aturan hukum.

### Pemantauan aturan tanpa membebani jalur utama

Pemantauan sumber dan pemeriksaan calon perubahan adalah pekerjaan backend
terjadwal, bukan bagian dari kalkulasi pengguna dan bukan proses latar permanen
di aplikasi Passenger:

- Jalankan pemeriksa sebagai skrip CLI terbatas di `jobs/`, dipanggil Cron
  cPanel. Pengaturan di backend admin menentukan sumber yang aktif, frekuensi
  dalam batas aman, waktu pemeriksaan berikutnya, zona waktu (`Asia/Jakarta`
  sebagai bawaan), dan bila perlu jendela waktu sepi. Pengaturan jadwal
  divalidasi dan dicatat di audit log; jangan menerima ekspresi jadwal bebas
  yang dapat meminta frekuensi berlebihan. Simpan status pemeriksaan terakhir,
  pemeriksaan berikutnya, dan hasil terakhir per sumber. Frekuensi per sumber
  tidak boleh lebih rapat daripada pemanggilan runner terjadwal.
- Jika sumber resmi menyediakan notifikasi/peristiwa yang andal, gunakan untuk
  memasukkan pekerjaan ke antrean pemeriksaan; webhook/notifikasi tidak
  menjalankan pengambilan sumber atau tes di dalam permintaan yang menerimanya.
  Jika tidak, runner memeriksa sumber yang sudah jatuh tempo pada Cron
  berikutnya. Maka “real-time” hanya dijanjikan untuk sumber yang benar-benar
  menyediakan pemicu semacam itu dan worker yang mampu memproses antreannya;
  sumber lain mengikuti interval pemeriksaan yang disetel.
- Pemeriksa hanya mendeteksi perubahan. Gunakan ETag/`If-Modified-Since` bila
  tersedia; beri batas waktu permintaan, jumlah sumber per batch, frekuensi
  permintaan, dan konkurensi yang rendah serta dapat dikonfigurasi dalam rentang
  aman. Cegah dua runner tumpang tindih dengan lock/idempotency; kegagalan
  mencoba ulang dengan jeda bertambah dan jitter.
- Jangan menahan koneksi/transaksi database selama mengambil sumber eksternal.
  Batasi akses database job dan tulis status setelah permintaan selesai. Jadwal
  berat ditempatkan di luar jam sibuk dan tidak bersamaan dengan backup,
  migrasi, atau pekerjaan CPU berat. Pemeriksaan sumber tidak menjalankan
  seluruh suite fixture di dalam permintaan HTTP; validasi draf dijalankan
  sebagai pekerjaan terpisah dan statusnya dapat dilihat admin.
- Perbedaan yang ditemukan membuat notifikasi dan versi **draf** untuk
  pemeriksaan manusia. Tidak ada tarif aktif yang berubah otomatis, build situs
  tidak terpicu otomatis, dan permintaan kalkulasi tidak menunggu pemeriksaan
  sumber, tes draf, maupun respons email. Publikasi tetap mengikuti alur draf →
  tes → pemeriksa independen → admin menerbitkan.
- Rute publik hanya membaca versi yang sudah diterbitkan dan berlaku. Setelah
  penerbitan, ETag/cache hanya diperbarui untuk kunci aturan terdampak. Jika
  sumber atau runner gagal, catat status dan kirim peringatan setelah batas
  percobaan; jangan merusak health endpoint atau kalkulator lain. Jika versi
  aktif melewati masa berlaku, tampilkan status data kedaluwarsa dan terapkan
  kebijakan alat berisiko tinggi—jangan menyebut data lama masih mutakhir.

Gerbang performa: uji beban API ketika job pemeriksaan dan tes draf berjalan
bersamaan. Keduanya tetap memenuhi target beban/performa Bagian 9; job gagal
atau tertunda tidak boleh menahan respons API, membuka transaksi lama, atau
menjalankan pekerjaan tanpa batas. Pada tahap awal, jadwalkan runner ringan
sekali per jam dan gunakan interval per sumber yang lebih renggang; ubah
frekuensi runner hanya setelah uji staging membuktikan anggaran sumber daya
tetap terpenuhi.

## 3. Subfase alat

### Fase 1.1 — Gaji bersih (PPh 21 TER dan BPJS)

**Cakupan:** hasil bersih pegawai dengan komponen bruto, PPh 21, dan iuran
pegawai yang didukung aturan berlaku. Pisahkan rincian pajak, setiap program
BPJS, porsi pegawai, dan porsi pemberi kerja; jangan menyajikan potongan
pemberi kerja sebagai potongan pegawai.

**Input/aturan:** periode dan masa pajak; status/kategori yang diwajibkan aturan;
komponen bruto yang memenuhi definisi; serta dasar upah, batas, program, dan
kelas risiko BPJS yang relevan. Untuk masa pajak terakhir, rekonsiliasi pajak
tahunan sesuai aturan efektif lalu kurangi pemotongan sebelumnya. Detail
klasifikasi, tarif, PTKP, batas, dan pembulatan mengikuti sumber primer
terverifikasi di Bagian 2 rencana utama—bukan nilai yang ditebak.

**Minimum fixture: 50:** 30 PPh 21/TER dan 20 BPJS, sesuai pecahan minimum
Bagian 9. Harus mencakup kategori/ambang TER, masa pajak terakhir, pegawai
masuk/keluar di tengah tahun; batas upah tepat di bawah/pada/di atas; pemisahan
porsi/program, tanggungan, dan pengecualian yang benar-benar berlaku.

**Gerbang lulus khusus:** setiap komponen dapat ditelusuri ke versi aturan dan
diuji independen. Jika komponen wajib untuk hasil gaji bersih belum punya
sumber/versi yang layak, tampilkan status belum dapat dihitung atau batasi
cakupan secara terang—jangan mengasumsikan potongan nol.

### Fase 1.2 — PPh 21 freelancer / tenaga ahli

**Cakupan:** hitung pemotongan berdasarkan klasifikasi penerima, sifat
kesinambungan, bentuk/cara pembayaran, perhitungan kumulatif bila berlaku,
dasar pengenaan, status identitas pajak, dan ketentuan progresif yang efektif.
Jangan memakai satu faktor DPP atau tarif tambahan untuk semua freelancer.

**Minimum fixture: 20.** Tutup variasi klasifikasi, pembayaran berkesinambungan
dan tidak, kumulatif dan tidak, tenaga ahli, status identitas, ambang/lapisan
tarif, serta input yang tidak cukup untuk menentukan perlakuan. Setiap cabang
harus menunjuk pasal/petunjuk DJP yang berlaku dan aturan pembulatannya.

**Gerbang lulus khusus:** skenario ambigu meminta klasifikasi yang dibutuhkan
atau ditolak dengan alasan yang jelas; alat tidak menyebut hasil sebagai
kepastian pajak untuk kasus di luar cakupan yang terverifikasi.

### Fase 1.3 — Simulasi KPR

**Cakupan:** simulasi anuitas, flat, dan efektif; jadwal angsuran yang
memisahkan pokok dan bunga; bunga tetap lalu mengambang bila skenario didukung;
serta biaya lain sebagai baris terpisah. Konvensi suku bunga tahunan ke bulanan,
waktu pembayaran, dan presisi harus terlihat dan dapat diuji. Asumsi pengguna
dibedakan dari kutipan produk bank; hasil adalah simulasi, bukan penawaran bank.

**Minimum fixture: 15** dari minimum gabungan KPR/cicilan di Bagian 9. Uji
masing-masing model, tenor dan bunga batas, konversi bunga, perubahan bunga,
pelunasan dipercepat, biaya terpisah, pembulatan angsuran, jumlah pokok/bunga,
dan penyesuaian angsuran terakhir hingga saldo pokok tepat nol. Kutipan bank
harus membawa produk, tanggal, dan masa promosi/berlaku; BI/OJK hanya menjadi
sumber untuk ketentuan yang memang ditetapkannya.

**Gerbang lulus khusus:** perbedaan model amortisasi tidak boleh disamarkan;
jadwal lengkap harus konsisten dengan totalnya dan tidak boleh berakhir dengan
sisa pokok akibat pembulatan yang tidak dijelaskan.

### Fase 1.4 — Kalkulator HPP

**Cakupan:** biaya langsung dan tidak langsung untuk jumlah hasil produksi
tertentu; alokasi overhead dan penyusutan dengan metode/penggerak alokasi yang
dinyatakan; serta biaya susut bahan bila dipakai. Hasil membedakan total biaya
batch dari HPP per unit.

**Minimum fixture: 7** dari kelompok 20 kasus HPP/margin/BEP. Sertakan alokasi
penyusutan/overhead, biaya per batch dan per unit, susut, kuantitas produksi
nol/tidak sah, dan biaya atau alokasi yang tidak lengkap.

**Gerbang lulus khusus:** tidak ada alokasi overhead tersembunyi. Jika metode
alokasi belum ditentukan pengguna atau standar produk, hasil menandai asumsi
atau meminta input sebelum menyebut HPP final.

### Fase 1.5 — Harga jual & margin

**Cakupan:** bedakan margin sebagai persentase harga jual dari markup sebagai
persentase biaya. Tampilkan biaya dasar, target margin/markup, harga hasil, dan
laba nominal. Biaya, diskon, pajak, atau biaya platform hanya masuk rumus bila
dipilih dan dasar perhitungannya dinyatakan.

**Minimum fixture: 7** dari kelompok 20 kasus HPP/margin/BEP. Uji margin dan
markup sebagai mode yang berbeda; persentase nol, batas yang menghasilkan
pembagi nol/tidak mungkin, diskon/biaya terpisah, laba negatif, serta presisi
dan pembulatan harga.

**Gerbang lulus khusus:** input bernama “margin” tidak boleh dihitung sebagai
markup. Tolak nilai yang membuat rumus tak terdefinisi, dan jelaskan bila
pembulatan harga mengubah margin aktual.

### Fase 1.6 — Break-even point (BEP)

**Cakupan:** biaya tetap dan kontribusi per unit (`harga jual − biaya variabel
per unit`), dengan BEP unit dan nilai penjualan bila asumsi datanya tersedia.
Tampilkan hasil pecahan matematis dan jumlah unit utuh yang perlu dijual bila
produk hanya dapat dijual per unit.

**Minimum fixture: 6** dari kelompok 20 kasus HPP/margin/BEP. Uji kontribusi
positif, nol, dan negatif; biaya tetap nol; hasil pecahan; pembulatan ke unit
utuh; serta laba/rugi tepat sebelum dan setelah BEP.

**Gerbang lulus khusus:** jika kontribusi per unit nol atau negatif, jangan
membagi dan jangan melaporkan angka BEP yang seolah-olah valid; jelaskan bahwa
BEP tidak tercapai dengan asumsi tersebut.

### Fase 1.7 — Biaya marketplace

**Cakupan:** Shopee, Tokopedia, dan TikTok Shop hanya untuk platform, kategori,
jenis/program penjual, tanggal, status pesanan, dan dasar transaksi yang
didukung data kebijakan versi. Urai komisi, biaya tetap, voucher/diskon,
subsidi ongkir, pajak/biaya lain jika memang berlaku, dan total. Tarif yang
berubah harus berasal dari Seller Centre/Education Center atau pengumuman resmi
platform; rentang tarif umum tidak cukup untuk menghitung hasil.

**Minimum fixture: 20.** Uji kombinasi platform/kategori/program, dasar komisi,
voucher, ongkir, biaya per pesanan, batas, pembatalan, retur/refund, dan aturan
pembulatan invoice. Fixture mengikat ke tanggal dan kebijakan tertentu.

**Gerbang lulus khusus:** pengguna memilih parameter yang memengaruhi tarif;
parameter yang tidak diketahui tidak diam-diam memilih komisi “rata-rata”.
Tanpa kebijakan resmi yang efektif, kombinasi tersebut tidak tersedia untuk
hasil final.

### Fase 1.8 — Cicilan kendaraan

**Cakupan:** simulasi harga kendaraan, uang muka, jumlah pembiayaan, tenor,
metode angsuran, serta biaya/produk pembiayaan terpisah sesuai skenario yang
dipilih. Jangan mengasumsikan semua lembaga memakai metode bunga, uang muka,
asuransi, atau biaya yang sama.

**Minimum fixture: 10** dari minimum gabungan 25 kasus KPR/cicilan Bagian 9.
Uji metode yang dinyatakan, uang muka dan pokok pembiayaan, tenor, biaya
administrasi/asuransi terpisah, pembulatan angsuran terakhir, batas nilai, dan
ketidaktersediaan parameter produk.

**Gerbang lulus khusus:** metode amortisasi dan dasar bunga terlihat di UI
serta sumber kutipan terikat ke pemberi pembiayaan/produk/tanggal. Jika belum
ada sumber produk, mode generik harus diberi label simulasi asumsi pengguna,
bukan tarif pasar atau penawaran.

### Fase 1.9 — Terbilang

**Cakupan:** konversi angka menjadi kata bahasa Indonesia secara deterministik,
termasuk penggunaan sebagai nominal rupiah bila dipilih. Aturan tanda negatif,
angka nol, skala besar, pemisah/desimal, dan penambahan satuan harus ditetapkan
serta dibedakan dari format angka UI.

**Minimum fixture: 40.** Mencakup nol, satuan, belasan/puluhan, ratusan,
ribuan, jutaan, miliaran/triliunan, batas maksimum, angka negatif, pecahan/
desimal, dan bentuk rupiah. Uji juga penolakan untuk input di luar rentang.

**Gerbang lulus khusus:** dokumentasikan sumber/standar bahasa yang dipakai
dan perilaku tiap skala; hasil tidak boleh berubah karena locale perangkat.

### Fase 1.10 — Kompres dan resize foto/PDF

**Cakupan:** pilih foto/PDF lokal, resize atau kompres di browser, pertahankan
rasio aspek foto, dan berikan berkas keluaran yang dapat diunduh. Batas format,
ukuran input, dimensi, jumlah halaman, penggunaan memori, kualitas, dan target
harus jelas sebelum proses. Hasil harus menyatakan ukuran aktual; jangan
mengklaim target tercapai bila tidak.

**Minimum fixture: 12.** Uji ukuran target tercapai dan target tak tercapai
dengan galat yang jelas, rasio aspek, orientasi, format didukung/tidak
didukung, berkas rusak/kosong, batas ukuran/dimensi/halaman, serta foto
10 megapiksel (<5 detik sesuai kriteria utama). E2E membuktikan tidak ada
permintaan jaringan yang membawa berkas pengguna.

**Gerbang lulus khusus:** berkas tetap di browser; tidak ada unggah, logging
konten, atau fallback server. Kegagalan memberi alasan yang bisa ditindaklanjuti
dan tidak merusak berkas sumber.

### Fase 1.11 — Pembuat invoice / kwitansi

**Cakupan:** data penjual/penerima, nomor/tanggal dokumen, item, kuantitas,
harga, subtotal, diskon, total, dan PDF. Invoice dan kwitansi dibedakan secara
jelas. Pajak, PPN, pemotongan, atau klaim sebagai faktur pajak hanya boleh
ditambahkan sebagai konfigurasi dengan dasar hukum/sumber, periode efektif,
dan pemeriksaan tersendiri; keadaan awal tidak boleh mengarang pajak.

**Minimum fixture: 12 kasus tambahan.** Minimum baru ini menutup celah
Bagian 9 yang mencantumkan invoice sebagai alat MVP tetapi tidak menetapkan
fixture invoice. Uji satu/banyak item, kuantitas, subtotal, diskon, angka nol,
pembulatan per baris vs total, pajak tanpa konfigurasi (tidak diterapkan),
pajak dengan konfigurasi terverifikasi, validasi identitas/tanggal/nomor, dan
kesesuaian angka pada PDF dengan hasil kalkulasi.

**Gerbang lulus khusus:** total dapat direkonsiliasi dari baris yang terlihat;
metode pembulatan tercetak konsisten dengan hasil. Jangan menyebut template
umum sebagai dokumen pajak yang memenuhi ketentuan hukum. Data dokumen tidak
disimpan/dikirim tanpa pilihan dan dasar yang memang direncanakan.

### Fase 1.12 — Kalender libur nasional & cuti bersama

**Cakupan:** daftar hari libur nasional dan cuti bersama per tahun berdasarkan
keputusan resmi. Tampilkan jenis hari, tanggal, nama, tahun, sumber, tanggal
pemeriksaan, dan versi. Jangan menyamakan hari libur nasional dengan cuti
bersama.

**Minimum fixture: 10.** Uji tahun berjalan dan berikutnya ketika keputusan
resmi tersedia, tanggal batas tahun, tahun kabisat, tanggal ganda/duplikat,
klasifikasi libur vs cuti bersama, dan tahun yang datanya belum diumumkan.

**Gerbang lulus khusus:** data setiap tahun berversi dan bersumber; tidak
mengekstrapolasi daftar tahun lalu ke tahun depan. Tahun tanpa keputusan resmi
yang tersedia ditandai belum tersedia, bukan dipublikasikan sebagai jadwal
pasti.

## 4. Target fixture dan cakupan tes setelah adendum

Bagian 9 rencana utama menetapkan **197 fixture baku** untuk alat-alatnya,
namun tidak memberi minimum bagi invoice. Adendum ini mempertahankan seluruh
target yang sudah ada, membagi kelompok gabungan tanpa menguranginya, lalu
menambahkan 12 fixture invoice. Karena itu target penutupan Fase 1 adalah
197 fixture semula + 12 fixture invoice = minimum 209 fixture baku bersumber.

| Subfase | Rincian minimum | Jumlah |
| --- | --- | ---: |
| 1.1 Gaji bersih | PPh 21/TER 30 + BPJS 20 | 50 |
| 1.2 PPh 21 freelancer / tenaga ahli | Minimum alat | 20 |
| 1.3 Simulasi KPR | Bagian dari minimum gabungan cicilan | 15 |
| 1.4 HPP | Bagian dari kelompok HPP/margin/BEP | 7 |
| 1.5 Harga jual & margin | Bagian dari kelompok HPP/margin/BEP | 7 |
| 1.6 BEP | Bagian dari kelompok HPP/margin/BEP | 6 |
| 1.7 Biaya marketplace | Minimum alat | 20 |
| 1.8 Cicilan kendaraan | Bagian dari minimum gabungan cicilan | 10 |
| 1.9 Terbilang | Minimum alat | 40 |
| 1.10 Kompres & resize foto/PDF | Minimum alat | 12 |
| 1.11 Invoice / kwitansi | Minimum baru agar semua alat MVP punya fixture | 12 |
| 1.12 Kalender libur | Minimum alat | 10 |
| **Total penutupan Fase 1** | **197 awal + 12 invoice** | **209** |

Jumlah 209 adalah fixture emas minimum; tidak menggantikan uji unit tambahan,
property-based, validasi, komponen, E2E, aksesibilitas, performa, atau uji
keamanan dalam rencana utama. Uji bersama Fase 1.0 juga di luar hitungan ini.
Fixture keuangan wajib cocok dengan sumber/pembanding independen sesuai
toleransi nol rupiah yang ditetapkan rencana utama; bila dokumen resmi memakai
pembulatan lain, fixture harus menyimpan dasar pengecualian tersebut.

## 5. Gerbang penutupan keseluruhan Fase 1

Fase 1 hanya boleh dinyatakan selesai jika seluruh syarat berikut terpenuhi:

- Fase 1.0 dan semua subfase 1.1–1.12 lulus gerbang masing-masing; tidak ada
  alat yang hanya berupa halaman kosong, angka contoh, atau hasil tiruan.
- Seluruh minimum 209 fixture lulus, setiap fixture memiliki jejak versi/
  sumber dan pemeriksaan yang dipersyaratkan, serta hasil rupiah cocok dengan
  pembanding independen.
- Fungsi kalkulasi tetap murni di `packages/engine`; perubahan pada data tarif
  versi mengubah hasil lewat tes tanpa mengubah rumus.
- UI setiap alat menampilkan langkah, asumsi, metode, pembulatan, sumber, masa
  berlaku, tanggal pemeriksaan, dan batas/galat yang relevan.
- Semua alat lulus komponen/E2E dan pemeriksaan viewport/aksesibilitas sesuai
  kriteria rencana utama; hasil hitung memenuhi sasaran <100 ms dan halaman
  tidak meluber pada lebar 320 px.
- Beranda hanya menjadi katalog; 12 kartu menuju halaman modul masing-masing
  melalui gerbang akses yang sesuai persetujuan iklan. Gerbang hasil dan unduhan
  lulus uji satu-eksekusi, privasi, aksesibilitas, dan jalur tanpa iklan.
- Pemrosesan berkas tetap sepenuhnya lokal; target kompres foto/PDF memenuhi
  toleransi ±5% atau gagal secara eksplisit.
- Sumber yang tidak lengkap, kedaluwarsa, belum efektif, atau belum ditinjau
  kedua tidak diterbitkan sebagai aturan aktif. Tidak ada tarif atau keputusan
  tahunan yang direka untuk menghilangkan blocker.

Kelulusan Fase 1 berarti alat memenuhi cakupan yang dinyatakan dan lulus
gerbangnya. Itu bukan pengganti verifikasi staging, review hukum, persetujuan
konten, atau kriteria Fase 2 dan rilis produksi.

## 6. Navigasi, halaman alat, dan gerbang iklan Fase 1

### 6.1 Beranda sebagai katalog

- Beranda berfungsi sebagai halaman pengenalan dan katalog. Beranda boleh
  menampilkan nama, kategori, deskripsi singkat, status, dan tautan setiap alat;
  beranda **tidak** memuat formulir input modul, mesin kalkulasi, hasil,
  pratinjau dokumen, pemrosesan berkas, atau tombol unduh modul.
- Demo kontrak Fase 1.0 yang bukan salah satu dari 12 alat berada pada URL dan
  halaman tersendiri. Keberadaan demo tersebut tidak menandai salah satu
  subfase 1.1–1.12 selesai.
- Setiap kartu adalah satu tautan yang dapat dioperasikan dengan mouse, sentuh,
  dan keyboard. Tautan mengarah ke gerbang `/iklan` dengan tujuan modul unik
  `/modul/{slug}`; tidak boleh memakai `href="#"`, tombol tanpa aksi, atau kartu
  duplikat. Slug tidak berubah saat judul tampil dilokalkan atau diperbaiki.
- Semua halaman modul dapat dibuka langsung melalui URL, dimuat ulang, dan
  dibagikan. Gerbang akses hanya perantara navigasi dari katalog; akses langsung
  tidak boleh menyebabkan loop redirect atau kehilangan halaman.

### 6.2 Halaman mandiri untuk setiap modul

- Satu URL mandiri dibuat per alat: `/modul/gaji-bersih`,
  `/modul/pph-21-freelancer`, `/modul/simulasi-kpr`,
  `/modul/kalkulator-hpp`, `/modul/harga-jual-margin`,
  `/modul/break-even-point`, `/modul/biaya-marketplace`,
  `/modul/cicilan-kendaraan`, `/modul/terbilang`,
  `/modul/kompres-resize-foto-pdf`, `/modul/invoice-kwitansi`, dan
  `/modul/kalender-libur`.
- Setiap halaman berisi judul alat, tujuan/cakupan, status ketersediaan,
  navigasi kembali ke katalog, dan keterangan privasi. Jika subfase belum lulus,
  tampilkan status “belum tersedia/dalam persiapan”; jangan merender form palsu,
  angka contoh seolah hasil, tarif yang belum terverifikasi, atau tombol
  kalkulasi/unduh yang tidak bekerja.
- Ketika alat siap, formulir, validasi, langkah, asumsi, sumber/versi, hasil,
  aksi salin/bagikan/cetak/unduh, serta peringatan ditempatkan hanya di halaman
  alat yang bersangkutan. Modul tidak boleh menumpang di halaman utama.
- Halaman placeholder, tautan, kerangka UI, maupun halaman iklan bukan bukti
  implementasi kalkulator dan tidak menutup gerbang fixture, sumber, uji, atau
  kriteria penerimaan subfase.

### 6.3 Aturan gerbang iklan

Gerbang iklan adalah prasyarat UX, bukan fungsi kalkulasi dan bukan syarat untuk
mengakses produk. Detail persetujuan, provider, daftar slot, dan larangan kategori
mengikuti [Addendum Monetisasi Fase 0-M](MONETISASI_FASE0M.md).

| Tindakan pengguna | Alur yang disyaratkan | Slot |
| --- | --- | --- |
| Membuka kartu dari katalog | Tautan menuju halaman pengantar `/iklan?tujuan=/modul/{slug}`; pengguna memilih “Lanjut ke modul” untuk membuka halaman alat | `module-entry-gate` |
| Meminta hasil hitung | Tindakan ditahan sementara di halaman modul; gerbang muncul sebelum hasil dibuka. “Lihat hasil” melanjutkan kalkulasi tepat satu kali | `results-gate` |
| Mengunduh hasil/berkas | Gerbang muncul sebelum pembuatan/pengiriman unduhan. “Unduh” meneruskan proses tepat satu kali | `download-gate` |

Gerbang hanya menampilkan konten iklan bila **semua** kondisi benar: backend
mengirim `adsEnabled: true`, cookie persetujuan yang valid menunjukkan `ads:
true`, dan provider/slot telah disetujui serta terkonfigurasi untuk halaman dan
format tersebut. Nilai awal `ADS_ENABLED=false`, kegagalan backend, consent
kosong/kedaluwarsa/ditolak, provider atau slot kosong, blocker jaringan, atau
gagal memuat iklan membuat jalur tanpa iklan langsung tersedia. Jangan menunggu
impresi, membuat hitung mundur, menyembunyikan tombol lanjut, atau mengulang
gerbang tanpa tindakan pengguna. Akses hasil dan unduhan tidak boleh dikunci oleh
consent iklan.

Gerbang hasil dan unduhan harus berada di halaman yang sama (dialog/panel yang
aksesibel atau pola setara) sehingga input tetap berada hanya di memori browser.
Lanjutkan menjalankan aksi yang diminta satu kali; tutup, batal, atau gagal
memuat iklan tidak boleh mengubah input, mereset halaman, menghitung dua kali,
atau membuat unduhan duplikat. Jangan menaruh input, output, nama, nomor
dokumen, metadata berkas, atau URL blob pada query string, penyimpanan yang tidak
disetujui, referer, permintaan iklan, tracking, atau analytics. Transformasi
foto/PDF dan pembentukan dokumen tetap lokal sesuai subfase masing-masing.

### 6.4 Verifikasi dan status

- E2E memastikan semua 12 kartu punya tautan unik yang cocok dengan daftar
  slug, setiap URL modul memuat halaman mandiri, dan tidak ada formulir
  kalkulator/hasil/unduh pada beranda.
- Uji gerbang dengan kombinasi backend aktif/nonaktif, consent diterima/ditolak/
  belum diberikan, provider terdaftar/tidak ada, dan pemuatan gagal. Uji bahwa
  jalur tanpa iklan selalu dapat dipakai dan aksi hasil/unduhan hanya terjadi
  sekali.
- Periksa tab order, fokus setelah membuka/menutup panel, label tombol, pembaca
  layar, serta lebar 320 px dan desktop. Pastikan data input dan berkas tidak
  muncul di URL atau permintaan jaringan pihak ketiga dalam semua kondisi.
- Saat ini semua 12 halaman modul masih berstatus belum tersedia. Pembuatan
  halaman dan gerbang katalog tidak mengubah status implementasi alat Fase 1.
