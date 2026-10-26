# JOBENAPP — Rencana Teknis Hub Kalkulator & Alat Indonesia

Oct 26, 2026 · @exe23

## 1. Ringkasan & keputusan teknis

JOBENAPP adalah satu aplikasi Node.js yang melayani halaman statis hasil build dan API, memakai PostgreSQL, dan berjalan di cPanel pada jobenapp.cloud. Semua perhitungan berjalan di browser lewat mesin hitung murni TypeScript, jadi biaya per pengunjung nyaris nol dan hasilnya bisa diuji secara deterministik.

| Lapisan | Pilihan | Alasan |
| --- | --- | --- |
| Frontend | Astro (halaman statis) + Preact islands + Tailwind CSS | HTML sudah jadi saat build sehingga cepat dan ramah SEO; JavaScript hanya dimuat untuk widget kalkulator |
| Mesin hitung | Paket `@jobenapp/engine` (TypeScript murni, tanpa dependensi) | Dipakai browser dan server; mudah diuji; tarif dibaca dari data, bukan ditulis di kode |
| Backend | Node.js 22 LTS + Express + TypeScript + Zod | Stabil di Passenger cPanel; validasi input satu skema untuk semua endpoint |
| Database | PostgreSQL (dari cPanel) lewat `pg` + migrasi SQL `node-pg-migrate` | Tanpa ORM berbiner native, sehingga aman di hosting bersama |
| Autentikasi | Sesi cookie httpOnly, hash sandi `crypto.scrypt` bawaan Node | Tanpa modul native yang sering gagal dikompilasi di cPanel |
| Pengujian | Vitest, Supertest, Playwright, axe-core | Unit, API, E2E, dan aksesibilitas |
| Hosting | cPanel “Setup Node.js App” (Passenger), aplikasi JOBENAPP | Sesuai lingkungan yang Anda tentukan |

### Batasan cPanel yang memengaruhi desain

- Passenger menjalankan aplikasi sesuai permintaan dan dapat memulai ulang proses, jadi aplikasi harus stateless dan tidak memakai proses latar permanen.
- Tugas terjadwal (backup, pembaruan data, sitemap) memakai Cron cPanel, bukan worker di dalam aplikasi.
- Memori dan jumlah proses dibatasi (CloudLinux LVE), jadi build dilakukan di komputer atau CI, lalu hasilnya diunggah.
- WebSocket tidak diandalkan; semua fitur memakai HTTP biasa.

### Perlu diverifikasi di panel Anda sebelum mulai

- [x] Menu **Setup Node.js App** tersedia dan mendukung Node 22 (panel menawarkan 22.23.4)
- [x] **PostgreSQL Databases** tersedia di cPanel dan dapat diakses dari `localhost`
- [x] Akses SSH atau Terminal cPanel aktif
- [x] **Cron Jobs** dan **AutoSSL** (HTTPS) aktif untuk jobenapp.cloud
- [ ] Batas memori, proses, dan inode paket hosting (menentukan ukuran build dan jumlah halaman statis)

## 2. PRD & ruang lingkup MVP

Tujuan produk: menjadi situs alat dan kalkulator Indonesia yang dipercaya karena angkanya tepat, mencapai 1 juta kunjungan per bulan dalam 6–12 bulan, dan dimonetisasi lewat iklan.

### Masalah dan target pengguna

Orang Indonesia mencari hitungan spesifik (“gaji bersih UMR Bekasi”, “cicilan KPR 500 juta 15 tahun”, “kompres foto 200 KB”) dan sering menemukan situs lambat, penuh iklan, atau angkanya usang.

| Persona | Kebutuhan | Perilaku |
| --- | --- | --- |
| Karyawan / pencari kerja | Gaji bersih, THR, pesangon, lembur | Lewat HP, satu kali hitung, datang lagi tiap tahun |
| Pemilik UMKM / penjual online | HPP, harga jual, BEP, biaya marketplace | Menghitung berulang tiap produk, menyimpan hasil |
| Calon pembeli rumah / kendaraan | KPR, cicilan, kemampuan beli | Membandingkan skenario sebelum bertanya ke bank |
| Pendaftar CPNS, UTBK, lamaran kerja | Kompres foto/PDF, surat, invoice | Mendesak, musiman, ingin cepat selesai |
| Admin / editor konten | Memperbarui tarif, FAQ, halaman | Perlu mengubah data tanpa mengubah kode |

### Tujuan dan metrik keberhasilan

| Tujuan | Metrik | Target |
| --- | --- | --- |
| Traffic | Sesi organik per bulan | 100 ribu di bulan 6; 1 juta di bulan 12 |
| Kecepatan | LCP / INP / CLS pada 4G (p75) | ≤ 2,5 dtk / ≤ 200 ms / ≤ 0,1 |
| Presisi | Kasus uji kalkulator yang cocok dengan sumber resmi | 100% lulus sebelum rilis |
| Keterlibatan | Pengunjung yang menekan hitung / menyalin / membagikan | ≥ 45% |
| Monetisasi | RPM gabungan | ≥ $1 (target awal) |
| Keandalan | Ketersediaan bulanan | ≥ 99,5% |

### Ruang lingkup MVP

**Platform**

- Hub halaman: beranda, kategori, halaman alat, pencarian cepat, halaman legal (Tentang, Kontak, Privasi, Syarat, Disclaimer)
- Pengguna opsional: daftar/masuk, simpan riwayat hitungan, favorit, ekspor data sendiri, hapus akun
- Panel admin: kelola versi tarif, FAQ dan konten alat, publikasi, pesan masuk, ringkasan analitik
- Slot iklan yang tidak mengganggu form, dengan persetujuan cookie
- SEO teknis: sitemap otomatis, schema markup, canonical, robots, halaman 404 bermanfaat
- Analitik ringan tanpa data pribadi (tabel peristiwa sendiri)

**12 alat MVP**

1. Gaji bersih (PPh 21 TER, BPJS)
2. PPh 21 freelancer / tenaga ahli
3. Simulasi KPR (anuitas, flat, efektif) + tabel angsuran
4. Kalkulator HPP
5. Harga jual & margin
6. Break-even point (BEP)
7. Biaya marketplace (Shopee, Tokopedia, TikTok Shop)
8. Cicilan kendaraan
9. Terbilang
10. Kompres & resize foto/PDF (di browser)
11. Pembuat invoice / kwitansi (unduh PDF)
12. Kalender libur nasional & cuti bersama

### Spesifikasi akurasi dan tata kelola per alat

Sebelum alat atau perubahan tarif diterbitkan, spesifikasi berversi untuk alat tersebut wajib mencatat: rumus dan definisi setiap variabel; satuan dan urutan langkah; sumber primer beserta URL, nomor/pasal atau judul dokumen, tanggal sumber diperiksa, dan tanggal mulai/akhir berlakunya; aturan pembulatan pada tahap antara dan hasil akhir; pengecualian, batas, dan perilaku input tidak valid; serta tim penanggung jawab, pemeriksa yang berbeda dari penyusun, tanggal pemeriksaan, dan pemicu/jadwal pemeriksaan berikutnya. Tarif dan ambang yang berubah menurut tahun, wilayah, bank, kategori, program, atau jenis penjual harus menjadi data berversi—bukan konstanta di mesin hitung. Halaman hasil menampilkan metode, rujukan, masa berlaku, dan tanggal pemeriksaan terakhir. Bila sumber belum cukup atau masa berlakunya tidak diketahui, versi tidak boleh diterbitkan.

#### Spesifikasi khusus alat keuangan berisiko tinggi

| Alat | Rumus dan cakupan aturan | Sumber primer dan masa berlaku | Pembulatan dan pengecualian | Pemeriksa pembaruan |
| --- | --- | --- | --- | --- |
| Gaji bersih / PPh 21 TER | Untuk pegawai yang tercakup TER, masa selain masa pajak terakhir memakai bruto bulanan × tarif TER sesuai kategori. Pada masa pajak terakhir, hitung kembali kewajiban setahun menurut ketentuan PPh 21 yang berlaku, lalu kurangi pemotongan masa sebelumnya. PTKP, kategori TER, komponen bruto, dan status pegawai menjadi input/data berversi. | UU HPP (UU 7/2021), PP 58/2023, PMK 168/2023 beserta perubahan/petunjuk DJP yang berlaku. Gunakan naskah pada JDIH Kemenkeu/DJP; simpan pasal, URL, tanggal diperiksa, dan tanggal efektif tiap aturan. | Nyatakan pembulatan PKP, pajak tahunan, dan pemotongan bulanan secara terpisah mengikuti aturan sumber; jangan menyamakan pembulatan tahunan dan bulanan. Uji kategori TER, perubahan status, pegawai masuk/keluar di tengah tahun, masa pajak terakhir, serta fasilitas atau pengecualian yang masih berlaku. | Editor pajak/payroll menyusun; spesialis pajak lain memeriksa. Tinjau sebelum tiap tahun pajak dan segera saat aturan DJP berubah. |
| PPh 21 freelancer / tenaga ahli | Klasifikasikan penerima, sifat kesinambungan, dan cara pembayaran terlebih dahulu. Dasar pengenaan pajak dan tarif progresif Pasal 17 mengikuti klasifikasi serta ketentuan yang efektif; jangan menerapkan persentase DPP atau faktor tarif tambahan secara universal. | UU 7/2021, PMK 168/2023, dan aturan/petunjuk DJP terkait yang berlaku; JDIH Kemenkeu/DJP. Setiap komponen rumus dan pengecualian harus menunjuk pasal serta periode efektifnya. | Catat pembulatan DPP/PKP dan hasil pajak sesuai tahap yang ditentukan regulasi. Uji pembayaran berkesinambungan/tidak, kumulatif/tidak, ragam tenaga ahli, status identitas pajak, dan ambang tarif. | Editor pajak/payroll; pemeriksaan kedua oleh spesialis pajak. Tinjau minimal tiap semester dan pada setiap perubahan aturan. |
| Gaji bersih / iuran BPJS | BPJS Kesehatan PPU: dasar upah yang berlaku × tarif, lalu pisahkan porsi pemberi kerja dan pekerja; terapkan batas upah, anggota keluarga, dan ketentuan yang relevan. BPJS Ketenagakerjaan dihitung terpisah per program (JHT, JP, JKK, JKM, JKP), dengan dasar upah, porsi, batas, dan kelas risiko masing-masing sesuai aturan. | Peraturan dan tabel resmi BPJS Kesehatan/BPJS Ketenagakerjaan serta peraturan pemerintah/menteri yang mendasarinya. Simpan dokumen untuk setiap program, wilayah/kelas bila relevan, tanggal pemeriksaan, dan periode efektif; perlakukan batas yang diperbarui berkala sebagai versi baru. | Bulatkan setiap porsi hanya pada tahap yang ditentukan aturan, bukan dengan satu kebijakan umum. Uji nilai tepat di bawah/pada/di atas batas, upah minimum bila relevan, pemisahan porsi, kelas risiko JKK, jumlah tanggungan, serta insentif/pengecualian sementara. | Editor HR/compliance menyusun; spesialis penggajian memeriksa. Tinjau berkala sebelum periode pembaruan tahunan dan segera setelah keputusan/peraturan BPJS atau pemerintah berubah. |
| Simulasi KPR dan cicilan | Anuitas: `A = P × i / (1 − (1 + i)^−n)`; bunga bulanan = sisa pokok × `i`, pokok = angsuran − bunga. Flat: angsuran pokok `P/n` ditambah bunga sesuai dasar flat yang dinyatakan. Efektif: pokok `P/n`, bunga bulanan atas sisa pokok. Untuk fixed-to-floating, hitung ulang dari sisa pokok dan tenor tersisa menggunakan suku bunga periode baru. Nyatakan konvensi konversi suku bunga tahunan ke bulanan. | Suku bunga dan biaya wajib bersumber dari simulasi/ketentuan bank pemberi pinjaman untuk produk, tanggal, dan skenario yang dipilih; simpan tanggal kutipan dan masa promo. Rujuk BI/OJK untuk ketentuan yang memang diaturnya (mis. LTV/FTV), bukan sebagai sumber suku bunga bank. Bedakan angka input/asumsi pengguna dari penawaran bank. | Nyatakan presisi bunga, pembulatan angsuran tiap bulan, dan cara penyesuaian selisih angsuran terakhir agar sisa pokok tepat nol. Tampilkan provisi, administrasi, asuransi, pajak, dan notaris terpisah dari pokok kecuali pengguna memasukkannya. Uji perubahan bunga, tenor, pelunasan dipercepat, serta biaya/penalti sesuai produk. | Editor perbankan/keuangan memeriksa model dan kutipan bank. Suku bunga ditinjau pada setiap perubahan penawaran; asumsi regulasi saat ada pembaruan BI/OJK. |
| Biaya marketplace | Total biaya merupakan penjumlahan komponen yang benar-benar berlaku untuk platform, kategori produk, tipe/program penjual, harga transaksi, diskon/voucher, dan status pesanan. Dokumentasikan dasar pengenaan setiap komponen; jangan memakai rentang komisi umum sebagai tarif perhitungan. | Seller Centre/Education Center resmi Shopee, Tokopedia, dan TikTok Shop serta pengumuman kebijakan masing-masing. Simpan URL/dokumen, kategori/program yang dicakup, tanggal diumumkan/diperiksa, dan tanggal efektif per platform. | Ikuti urutan dasar komisi, diskon, voucher, biaya tetap, dan pembulatan yang tercermin pada kebijakan/invoice platform. Uji perbedaan per platform, pembatalan, retur/refund, subsidi ongkir, promo, biaya per pesanan, dan batas maksimum bila kebijakan menetapkannya. | Editor e-commerce/merchant specialist memeriksa. Tinjau setiap pengumuman perubahan dan lakukan pemeriksaan berkala sekurangnya bulanan selama tarif mudah berubah. |

Alat lain tetap wajib memiliki spesifikasi dengan kolom yang sama sebelum diterbitkan: HPP (jumlah biaya langsung/tidak langsung dan alokasi susut), harga jual/margin (bedakan margin atas harga jual dari markup atas biaya), BEP (biaya tetap dibagi kontribusi per unit), cicilan kendaraan (metode amortisasi dan biaya terpisah), terbilang (aturan angka/desimal), kompresi foto/PDF (batas format/ukuran dan pelestarian rasio), invoice (pajak/diskon sebagai konfigurasi yang memiliki sumber dan periode), serta kalender libur (keputusan resmi per tahun). Untuk alat tanpa aturan tarif eksternal, cantumkan standar/definisi yang menjadi acuan dan pemilik pemeriksa metode.

### Di luar MVP (fase berikutnya)

- Kalender Hijriah, weton, jadwal sholat, kesehatan dan keluarga, investasi dan zakat
- Halaman programmatic skala besar (ribuan halaman), bahasa Inggris, widget embed, versi Pro
- Pembayaran, aplikasi seluler asli, dan kolom komentar publik

### Persyaratan non-fungsional

- Mobile-first, responsif dari lebar 320 px; kontras dan navigasi keyboard sesuai WCAG 2.1 AA
- Data keuangan yang diketik pengguna tidak dikirim ke server kecuali pengguna masuk dan memilih menyimpan
- Kepatuhan UU Pelindungan Data Pribadi (UU PDP): persetujuan, ekspor, dan penghapusan data
- Bahasa awal: Indonesia (id-ID), zona waktu Asia/Jakarta, mata uang rupiah

## 3. User journey & daftar fitur

Setiap alat harus bisa dipakai tanpa daftar akun; akun hanya menambah kenyamanan (riwayat, favorit), bukan menjadi syarat.

### Journey 1 — Pengunjung dari Google (jalur utama)

1. Mencari “kalkulator gaji bersih UMR Bekasi 2026” dan membuka halaman alat.
2. Form sudah terisi contoh; pengunjung mengganti gaji, status PTKP, dan tunjangan.
3. Hasil muncul langsung di bawah form, lengkap dengan langkah perhitungan dan rujukan aturan.
4. Pengunjung menyalin hasil, membagikannya lewat WhatsApp, atau mengunduh PDF.
5. Alat terkait (THR, pesangon, KPR) muncul di bawah hasil; sebagian pengunjung berpindah alat.
6. Opsional: masuk untuk menyimpan hitungan ke riwayat.

### Journey 2 — Pemilik UMKM (pengguna kembali)

1. Masuk dengan email dan sandi (atau tautan ajaib).
2. Membuat proyek “Kue Ulang Tahun”, mengisi bahan dan biaya di kalkulator HPP.
3. Menyimpan hasil; HPP otomatis tersedia di kalkulator harga jual dan BEP.
4. Mengubah harga bahan bulan depan dan membandingkan dua versi hitungan.
5. Mengekspor semua hitungan ke Excel.

### Journey 3 — Admin memperbarui tarif

1. Masuk ke panel admin dengan peran admin dan verifikasi dua langkah.
2. Membuat versi tarif baru (misalnya PTKP atau batas upah BPJS) dengan tanggal berlaku.
3. Menjalankan **pratinjau uji**: sistem menghitung kasus uji baku dengan tarif baru dan menampilkan selisihnya.
4. Menerbitkan versi; halaman terkait memakai tarif baru dan tanggal pembaruan otomatis berubah.
5. Setiap perubahan tercatat di log audit.

### Daftar fitur per modul

| Modul | Fitur | Fase |
| --- | --- | --- |
| Hub & navigasi | Beranda, kategori, pencarian instan (tanpa server), breadcrumb, alat terkait, mode gelap | MVP |
| Alat (semua) | Form dengan nilai contoh, format rupiah otomatis, hasil langsung, langkah hitung, salin, bagikan WhatsApp, cetak | MVP |
| Alat (lanjutan) | Unduh PDF dan Excel, bandingkan dua skenario, grafik dan tabel angsuran | MVP (PDF), Fase 3 (bandingkan) |
| Konten SEO | Penjelasan rumus, contoh kasus, FAQ dengan schema, tanggal pembaruan, sumber hukum | MVP |
| Akun | Daftar, masuk, lupa sandi, verifikasi email, profil, hapus akun, ekspor data | MVP |
| Riwayat & proyek | Simpan hitungan, favorit, proyek (kumpulan hitungan), ekspor | MVP |
| Tarif & data | Versi tarif bertanggal berlaku, UMR per daerah, libur nasional | MVP |
| Admin | CRUD alat dan FAQ, versi tarif, pratinjau uji, penerbitan, pesan kontak, log audit | MVP |
| Iklan & persetujuan | Slot iklan responsif, banner persetujuan cookie, tanpa iklan di dalam form | MVP |
| Analitik | Peristiwa tanpa data pribadi: tayang, hitung, salin, unduh; laporan di admin | MVP |
| Programmatic SEO | Halaman per kota, plafon, tenor dari data | Fase 3 |
| Embed & Pro | Widget tanam untuk blog, ekspor tanpa batas | Fase 4 |

## 4. Arsitektur frontend, backend, dan database

Arsitektur sengaja dibuat sederhana untuk cPanel: halaman statis dan seluruh perhitungan berada di browser, sedangkan satu aplikasi Node.js kecil mengurus akun, tarif, dan riwayat di PostgreSQL.

&#91;embedded content: arsitektur runtime · browser, cPanel, Node.js, PostgreSQL\]

Pengunjung anonim hanya memanggil Apache; API dipanggil untuk tarif, peristiwa analitik, akun, riwayat, dan admin. Database tidak bisa diakses dari luar server.

### Frontend

- **Astro** membuat HTML statis saat build. Widget kalkulator berupa *islands* Preact yang dimuat hanya saat terlihat (`client:visible`); target JavaScript awal ≤ 120 KB gzip.
- **Mesin hitung** `@jobenapp/engine` ikut dibundel ke widget, sehingga hasil muncul tanpa permintaan jaringan. Tarif diambil dari `/api/v1/rates/{key}/current` (dengan ETag); jika API tidak terjangkau, alat memakai salinan tarif saat build dan menampilkan tanggal berlakunya.
- **Foto dan PDF** diproses di Web Worker memakai Canvas dan `pdf-lib`; pencarian biner pada kualitas gambar mencapai ukuran target tanpa membekukan layar.
- **Gaya:** Tailwind CSS dengan token desain, mode gelap, dan font sistem agar cepat; semua komponen diuji pada lebar 320 px ke atas.
- **Akun:** halaman masuk, riwayat, dan proyek berupa halaman statis yang memanggil API; state ringan dengan `nanostores`.
- **Iklan dan analitik** dimuat hanya setelah persetujuan cookie, dan slot iklan punya tinggi tetap agar tata letak tidak bergeser.

### Backend

- **Lapisan per modul:** `routes → controller → service → repository`. Hanya repository yang menyentuh SQL; service berisi aturan bisnis dan mudah diuji tanpa HTTP.
- **Urutan middleware:** ID permintaan → Helmet → batas ukuran badan → cookie → pembatasan laju → muat sesi → CSRF → validasi Zod → handler → penanganan galat seragam.
- **Tanpa status di memori:** sesi dan pembatasan laju ada di PostgreSQL, sehingga Passenger boleh memulai ulang proses kapan saja.
- **Tugas terjadwal** berupa skrip CLI di `jobs/` yang dipanggil Cron, bukan proses latar di dalam aplikasi.
- **Email** lewat `nodemailer` ke SMTP cPanel, dengan percobaan ulang tiga kali; kegagalan dicatat dan tidak menggagalkan permintaan pengguna.
- **Dokumentasi:** OpenAPI 3.1 dibuat dari skema Zod yang sama, jadi kontrak dan validasi tidak bisa berbeda.
- **Logging:** `pino` berformat JSON dengan penyamaran data sensitif dan ID permintaan di setiap baris.

### Database

- PostgreSQL 13 atau lebih baru, 20 tabel (bagian 6), pool koneksi maksimum 5, batas waktu kueri 5 detik.
- Migrasi SQL berurutan dengan `node-pg-migrate`, hanya maju, dijalankan dengan pengguna database terpisah.
- Tarif disimpan sebagai versi bertanggal berlaku; hitungan tersimpan menunjuk versi tarif yang dipakai, sehingga hasil lama dapat direproduksi.
- JSONB dipakai untuk input, ringkasan hasil, dan isi tarif; kolom yang sering difilter (pengguna, alat, waktu) tetap kolom biasa dengan indeks.

### Tiga alur data utama

1. **Kunjungan anonim:** Apache mengirim HTML → widget memuat tarif → browser menghitung → pengguna menyalin atau mengunduh hasil. Tidak ada data keuangan yang dikirim ke server.
2. **Menyimpan hitungan:** widget → `POST /calculations` dengan cookie sesi dan token CSRF → validasi Zod → simpan ke `calculations` beserta versi tarif → respons 201.
3. **Pembaruan tarif:** editor membuat draf → uji otomatis dengan kasus baku → admin menerbitkan → `/rates/{key}/current` menyajikan versi baru pada tanggal berlaku. Alat langsung memakai tarif baru; teks dan tabel tarif di halaman statis ikut diperbarui pada build berikutnya.

## 5. Struktur direktori yang disarankan

Satu repositori monorepo (npm workspaces) memisahkan mesin hitung, API, dan situs, sehingga logika perhitungan bisa diuji sendiri dan dipakai ulang oleh browser maupun server.

```text
jobenapp/
├─ package.json                 # workspaces: apps/*, packages/*
├─ .env.example                 # semua variabel lingkungan, tanpa nilai rahasia
├─ .github/workflows/ci.yml     # lint, tes, build, paket rilis
├─ apps/
│  ├─ web/                      # Astro (hasil build = berkas statis)
│  │  ├─ src/
│  │  │  ├─ pages/              # index, [kategori]/[alat], akun/, legal/, 404
│  │  │  ├─ layouts/            # BaseLayout, ToolLayout (SEO, schema, slot iklan)
│  │  │  ├─ components/
│  │  │  │  ├─ ui/              # Button, Field, RupiahInput, Table, Chart, Toast
│  │  │  │  ├─ tools/           # satu widget Preact per alat (GajiBersih.tsx, ...)
│  │  │  │  └─ ads/             # AdSlot, ConsentBanner
│  │  │  ├─ content/            # FAQ, penjelasan rumus, contoh kasus (Markdown)
│  │  │  ├─ lib/                # klien API, format angka, analitik
│  │  │  └─ styles/
│  │  └─ public/                # ikon, robots.txt, font
│  └─ api/                      # Express + TypeScript
│     ├─ src/
│     │  ├─ server.ts           # titik masuk (listen / Passenger)
│     │  ├─ app.ts              # rakitan middleware dan router
│     │  ├─ config/env.ts       # validasi env dengan Zod
│     │  ├─ db/                 # pool.ts, tx.ts, helper query
│     │  ├─ middleware/         # auth, role, csrf, rateLimit, validate, error
│     │  ├─ modules/
│     │  │  ├─ auth/            # routes, controller, service, repo, schema
│     │  │  ├─ users/
│     │  │  ├─ calculations/    # riwayat dan favorit
│     │  │  ├─ projects/
│     │  │  ├─ tools/           # katalog alat, kategori, FAQ
│     │  │  ├─ rates/           # versi tarif dan pratinjau uji
│     │  │  ├─ contact/
│     │  │  ├─ analytics/
│     │  │  └─ admin/
│     │  ├─ jobs/               # skrip untuk Cron (cleanup, backup, sitemap)
│     │  └─ utils/              # logger, mailer, hash, token
│     ├─ migrations/            # SQL berurutan: 001_init.sql, 002_...
│     ├─ seeds/                 # kategori, alat, tarif awal, admin pertama
│     └─ tests/                 # unit, integrasi (Supertest)
├─ packages/
│  ├─ engine/                   # mesin hitung murni, tanpa dependensi
│  │  ├─ src/{tax,loan,business,date,text,files}/
│  │  └─ tests/fixtures/        # kasus uji beserta sumber resmi
│  └─ shared/                   # skema Zod, tipe, konstanta untuk web dan api
├─ data/rates/                  # pph21_ter.json, ptkp.json, bpjs.json, umr.json, libur.json
├─ e2e/                         # Playwright
├─ scripts/                     # build-release.mjs, verify-rates.mjs, gen-sitemap.mjs
└─ deploy/cpanel/               # app.js (entri Passenger), .htaccess, cron.txt, README
```

### Aturan struktur

- `packages/engine` tidak boleh mengimpor apa pun dari `apps/`; satu fungsi `hitung(input) → hasil` per alat, tanpa efek samping.
- Tarif tidak pernah ditulis di kode; mesin menerima objek tarif sebagai argumen, sehingga uji bisa memakai tarif tahun mana pun.
- Situs statis disajikan Apache dari `public_html`; hanya jalur `/api` yang diarahkan ke aplikasi Node (satu domain, jadi cookie sesi tanpa CORS).

## 6. Skema tabel & hubungan data

Skema memakai 20 tabel PostgreSQL 13 atau lebih baru. Tidak ada ekstensi yang butuh hak superuser (`citext`, `btree_gist` dihindari), sehingga aman di cPanel.

### Daftar tabel

| Kelompok | Tabel | Fungsi |
| --- | --- | --- |
| Identitas | `users`, `sessions`, `auth_tokens`, `consents` | Akun, sesi, token verifikasi/reset, rekam persetujuan (UU PDP) |
| Katalog | `categories`, `tools`, `tool_contents`, `tool_relations`, `tool_spec_versions` | Kategori, alat, FAQ/penjelasan/contoh, alat terkait, rumus dan aturan alat berversi |
| Tarif & data | `rate_versions`, `rate_test_cases`, `regions`, `minimum_wages`, `holidays` | Tarif bertanggal berlaku, kasus uji baku, wilayah, UMR, libur nasional |
| Pengguna | `projects`, `calculations` | Proyek dan riwayat hitungan |
| Operasional | `contact_messages`, `analytics_events`, `audit_logs`, `rate_limits` | Pesan, analitik tanpa data pribadi, log audit, pembatasan laju |

### Hubungan utama

- `users` 1—N `sessions`, `auth_tokens`, `projects`, `calculations`
- `categories` 1—N `tools`; `tools` 1—N `tool_contents`; `tools` N—N `tools` lewat `tool_relations`
- `tools` 1—N `tool_spec_versions`; setiap versi menyimpan rumus, pembulatan, pengecualian, sumber, masa berlaku, dan hasil pemeriksaan untuk alat tersebut
- `projects` 1—N `calculations` (opsional); `tools` 1—N `calculations`
- `rate_versions` dirujuk oleh `calculations.rate_version_ids`, sehingga hitungan lama tetap bisa direproduksi dengan tarif saat itu
- `rate_test_cases` terikat pada `rate_key`, `tools`, dan versi spesifikasi alat; dipakai untuk pratinjau uji sebelum tarif diterbitkan
- `regions` 1—N `minimum_wages` (satu nilai per tahun); `regions` menunjuk induknya sendiri (provinsi → kabupaten/kota)
- `users` 1—N `audit_logs` (pelaku) dan `rate_versions` (pembuat dan penerbit)

### DDL inti (`001_init.sql`)

```sql
CREATE TYPE user_role   AS ENUM ('user','editor','admin');
CREATE TYPE token_type  AS ENUM ('verify_email','reset_password','magic_link');
CREATE TYPE publish_st  AS ENUM ('draft','published','archived');
CREATE TYPE content_kind AS ENUM ('explanation','example','faq','legal_note');
CREATE TYPE holiday_kind AS ENUM ('nasional','cuti_bersama');
CREATE TYPE msg_status  AS ENUM ('new','read','replied','spam');

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  password_hash   text NOT NULL,                 -- scrypt$N$r$p$salt$hash
  display_name    text NOT NULL DEFAULT '',
  role            user_role NOT NULL DEFAULT 'user',
  email_verified_at timestamptz,
  totp_secret_enc text,                          -- terenkripsi AES-256-GCM
  totp_enabled    boolean NOT NULL DEFAULT false,
  recovery_hashes text[] NOT NULL DEFAULT '{}',  -- 10 kode pemulihan (hash)
  failed_logins   smallint NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email)) WHERE deleted_at IS NULL;

CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   bytea NOT NULL UNIQUE,            -- SHA-256 dari token cookie
  csrf_secret  text  NOT NULL,
  ip_hash      text,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE auth_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       token_type NOT NULL,
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE consents (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  anon_id    text,                               -- id acak di cookie persetujuan
  purpose    text NOT NULL,                      -- 'analytics','ads','save_history'
  granted    boolean NOT NULL,
  policy_ver text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id         smallserial PRIMARY KEY,
  slug       text NOT NULL UNIQUE,
  name       text NOT NULL,
  summary    text NOT NULL DEFAULT '',
  sort_order smallint NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true
);

CREATE TABLE tools (
  id              serial PRIMARY KEY,
  category_id     smallint NOT NULL REFERENCES categories(id),
  slug            text NOT NULL,
  name            text NOT NULL,
  summary         text NOT NULL DEFAULT '',
  engine_key      text NOT NULL,                 -- nama fungsi di packages/engine
  rate_keys       text[] NOT NULL DEFAULT '{}',  -- tarif yang dipakai alat ini
  seo_title       text,
  seo_description text,
  status          publish_st NOT NULL DEFAULT 'draft',
  sort_order      smallint NOT NULL DEFAULT 0,
  published_at    timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);

CREATE TABLE tool_contents (
  id         serial PRIMARY KEY,
  tool_id    integer NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  kind       content_kind NOT NULL,
  title      text NOT NULL DEFAULT '',
  body_md    text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);
CREATE INDEX tool_contents_tool_idx ON tool_contents (tool_id, kind, sort_order);

CREATE TABLE tool_relations (
  tool_id         integer REFERENCES tools(id) ON DELETE CASCADE,
  related_tool_id integer REFERENCES tools(id) ON DELETE CASCADE,
  sort_order      smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (tool_id, related_tool_id),
  CHECK (tool_id <> related_tool_id)
);

CREATE TABLE tool_spec_versions (
  id                 serial PRIMARY KEY,
  tool_id            integer NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  version            integer NOT NULL,
  formula_definition jsonb NOT NULL,             -- variabel, satuan, dan langkah hitung
  rounding_rule      jsonb NOT NULL,              -- tahap, metode, presisi
  exception_rules    jsonb NOT NULL DEFAULT '{}',
  source_refs        jsonb NOT NULL,              -- sumber, URL, pasal, diperiksa, masa berlaku
  effective_from     date NOT NULL,
  effective_to       date,
  owner_team         text NOT NULL,
  created_by         uuid REFERENCES users(id),
  reviewed_by        uuid REFERENCES users(id),
  reviewed_at        timestamptz,
  source_checked_at  date NOT NULL,
  review_due_at      date,
  status             publish_st NOT NULL DEFAULT 'draft',
  published_by       uuid REFERENCES users(id),
  published_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tool_id, version),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CHECK (jsonb_typeof(source_refs) = 'array'),
  CHECK (status <> 'published' OR (
    created_by IS NOT NULL AND reviewed_by IS NOT NULL
    AND reviewed_by <> created_by AND reviewed_at IS NOT NULL
    AND published_by IS NOT NULL AND published_at IS NOT NULL
    AND jsonb_array_length(source_refs) > 0
  ))
);

CREATE TABLE rate_versions (
  id             serial PRIMARY KEY,
  rate_key       text NOT NULL,                  -- 'pph21_ter','ptkp','bpjs',...
  version        integer NOT NULL,
  effective_from date NOT NULL,
  effective_to   date,
  data           jsonb NOT NULL,
  source_url     text NOT NULL,
  source_note    text NOT NULL DEFAULT '',
  source_refs    jsonb NOT NULL DEFAULT '[]',     -- sumber tambahan, pasal, tanggal diperiksa
  source_checked_at date NOT NULL,
  formula_type   text NOT NULL DEFAULT 'standard',
  rounding_rule  jsonb NOT NULL DEFAULT '{}',
  exception_rules jsonb NOT NULL DEFAULT '{}',
  owner_team     text NOT NULL,
  reviewed_by    uuid REFERENCES users(id),
  reviewed_at    timestamptz,
  review_due_at  date,
  status         publish_st NOT NULL DEFAULT 'draft',
  created_by     uuid REFERENCES users(id),
  published_by   uuid REFERENCES users(id),
  published_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rate_key, version),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CHECK (jsonb_typeof(source_refs) = 'array'),
  CHECK (status <> 'published' OR (
    created_by IS NOT NULL AND reviewed_by IS NOT NULL
    AND reviewed_by <> created_by AND reviewed_at IS NOT NULL
    AND published_by IS NOT NULL AND published_at IS NOT NULL
  ))
);
-- satu tarif terbit per tanggal berlaku (tumpang tindih dicek juga di service)
CREATE UNIQUE INDEX rate_pub_uq ON rate_versions (rate_key, effective_from)
  WHERE status = 'published';

CREATE TABLE rate_test_cases (
  id         serial PRIMARY KEY,
  rate_key   text NOT NULL,
  tool_id    integer NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  spec_version_id integer NOT NULL REFERENCES tool_spec_versions(id),
  rate_version_id integer REFERENCES rate_versions(id),
  name       text NOT NULL,
  input      jsonb NOT NULL,
  expected   jsonb NOT NULL,
  source_ref text NOT NULL,                      -- tautan atau pasal rujukan
  regulation_ref text NOT NULL DEFAULT '',       -- peraturan/pasal atau kebijakan platform
  is_edge_case boolean NOT NULL DEFAULT false,
  last_verified_at timestamptz,
  verified_by uuid REFERENCES users(id),
  tolerance  numeric NOT NULL DEFAULT 0          -- toleransi dalam satuan hasil (mis. rupiah)
);

CREATE TABLE regions (
  id        serial PRIMARY KEY,
  code      text NOT NULL UNIQUE,                -- kode BPS/Kemendagri
  name      text NOT NULL,
  slug      text NOT NULL UNIQUE,
  type      text NOT NULL CHECK (type IN ('provinsi','kabupaten','kota')),
  parent_id integer REFERENCES regions(id)
);

CREATE TABLE minimum_wages (
  region_id  integer NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  year       smallint NOT NULL,
  amount     bigint NOT NULL CHECK (amount > 0), -- rupiah, bilangan bulat
  source_url text NOT NULL,
  PRIMARY KEY (region_id, year)
);

CREATE TABLE holidays (
  id        serial PRIMARY KEY,
  day       date NOT NULL,
  name      text NOT NULL,
  kind      holiday_kind NOT NULL,
  source_url text NOT NULL,
  UNIQUE (day, name)
);
CREATE INDEX holidays_year_idx ON holidays (day);

CREATE TABLE projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX projects_user_idx ON projects (user_id) WHERE deleted_at IS NULL;

CREATE TABLE calculations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id          integer NOT NULL REFERENCES tools(id),
  project_id       uuid REFERENCES projects(id) ON DELETE SET NULL,
  title            text NOT NULL DEFAULT '',
  input            jsonb NOT NULL,
  result_summary   jsonb NOT NULL,
  rate_version_ids integer[] NOT NULL DEFAULT '{}',
  is_favorite      boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);
CREATE INDEX calc_user_idx ON calculations (user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX calc_project_idx ON calculations (project_id) WHERE project_id IS NOT NULL;

CREATE TABLE contact_messages (
  id         bigserial PRIMARY KEY,
  name       text NOT NULL,
  email      text NOT NULL,
  subject    text NOT NULL,
  message    text NOT NULL,
  status     msg_status NOT NULL DEFAULT 'new',
  ip_hash    text,
  handled_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE analytics_events (
  id          bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event       text NOT NULL,                     -- 'view','calculate','copy','share','download'
  tool_id     integer REFERENCES tools(id) ON DELETE SET NULL,
  path        text NOT NULL,
  visitor_key text NOT NULL,                     -- hash harian, berputar tiap 24 jam
  device      text,
  referrer_host text
);
CREATE INDEX analytics_time_idx ON analytics_events (occurred_at);
CREATE INDEX analytics_tool_idx ON analytics_events (tool_id, occurred_at);

CREATE TABLE audit_logs (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  action      text NOT NULL,                     -- 'rate.publish','tool.update',...
  entity_type text NOT NULL,
  entity_id   text NOT NULL,
  diff        jsonb,
  ip_hash     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_entity_idx ON audit_logs (entity_type, entity_id);

CREATE TABLE rate_limits (
  key          text PRIMARY KEY,                 -- 'login:ip:<hash>', 'contact:ip:<hash>'
  hits         integer NOT NULL,
  window_start timestamptz NOT NULL
);
```

### Aturan data

- Uang disimpan dan dihitung sebagai bilangan bulat rupiah (`bigint`); persentase dan bunga memakai `numeric` atau pustaka desimal, tidak pernah `float`.
- Hitungan pengguna bersifat *soft delete*; hapus akun menghapus permanen seluruh data pengguna setelah masa tunggu 7 hari.
- Analitik disimpan 400 hari lalu dihapus oleh Cron; `visitor_key` tidak bisa dikaitkan ke orang.
- Migrasi hanya maju (forward-only) dan berjalan dalam transaksi; setiap migrasi diuji pada salinan data sebelum produksi.

## 7. Kontrak API

API berjalan di `https://jobenapp.cloud/api/v1`, memakai JSON, dan divalidasi dengan skema Zod yang sama di `packages/shared`. Daftar di bawah menjadi dasar dokumen OpenAPI 3.1 yang dibuat otomatis dari skema tersebut.

### Konvensi

- **Autentikasi:** cookie `jb_sid` (httpOnly, Secure, SameSite=Lax). Metode tulis (POST, PATCH, DELETE) wajib menyertakan header `X-CSRF-Token` yang didapat dari `/auth/me` atau `/auth/login`.
- **Format:** waktu ISO 8601 UTC; uang berupa bilangan bulat rupiah; id pengguna dan hitungan berupa UUID; nama field `camelCase`.
- **Paginasi:** berbasis kursor, `?limit=20&cursor=...`, respons memuat `nextCursor`.
- **Cache:** endpoint publik (katalog, tarif, libur) mengirim `ETag` dan `Cache-Control: public, max-age=300`.
- **Pelacakan:** tiap respons membawa `X-Request-Id`; sama dengan `requestId` di galat.

### Format galat (seragam)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data tidak valid",
    "details": [{ "path": "grossSalary", "message": "Harus bilangan bulat ≥ 0" }],
    "requestId": "c7b1f0a2-5e19-4f7d-9c1e-3a4b8d2e6f10"
  }
}
```

| HTTP | `code` | Kapan dipakai |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Input tidak sesuai skema |
| 401 | `UNAUTHENTICATED` | Belum masuk atau sesi berakhir |
| 403 | `FORBIDDEN` / `CSRF_INVALID` | Peran tidak cukup atau token CSRF salah |
| 404 | `NOT_FOUND` | Data tidak ada atau bukan milik pengguna |
| 409 | `CONFLICT` | Email sudah terdaftar, versi tarif bentrok |
| 422 | `BUSINESS_RULE` | Melanggar aturan, misalnya menerbitkan tarif yang kasus ujinya gagal |
| 429 | `RATE_LIMITED` | Terlalu banyak permintaan; ada header `Retry-After` |
| 500 | `INTERNAL` | Galat server; detail hanya di log |

### Endpoint publik

| Metode | Jalur | Fungsi |
| --- | --- | --- |
| GET | `/health` | Status aplikasi dan database (untuk pemantauan) |
| GET | `/categories` | Daftar kategori aktif |
| GET | `/tools?category=&q=&limit=&cursor=` | Daftar alat terbit, dengan pencarian |
| GET | `/tools/{category}/{slug}` | Detail alat: konten, FAQ, alat terkait, kunci tarif |
| GET | `/rates/{rateKey}/current?date=YYYY-MM-DD` | Tarif yang berlaku pada tanggal tertentu (bawaan: hari ini) |
| GET | `/regions?type=&q=` | Daftar provinsi, kabupaten, kota |
| GET | `/regions/{slug}/minimum-wage?year=` | UMR suatu wilayah |
| GET | `/holidays?year=` | Libur nasional dan cuti bersama |
| POST | `/contact` | Kirim pesan (dibatasi laju, ada honeypot) |
| POST | `/events` | Kirim hingga 10 peristiwa analitik; diabaikan tanpa persetujuan |
| POST | `/consents` | Catat persetujuan cookie |

### Autentikasi & akun

| Metode | Jalur | Fungsi |
| --- | --- | --- |
| POST | `/auth/register` | Daftar; kirim email verifikasi |
| POST | `/auth/verify-email` | Verifikasi dengan token |
| POST | `/auth/login` | Masuk; `totp` wajib untuk editor dan admin |
| POST | `/auth/logout` | Cabut sesi saat ini |
| GET | `/auth/me` | Profil dan token CSRF; 401 jika belum masuk |
| POST | `/auth/forgot-password` | Selalu 202, tanpa membocorkan apakah email ada |
| POST | `/auth/reset-password` | Atur sandi baru dengan token sekali pakai |
| POST | `/auth/change-password` | Ganti sandi; mencabut sesi lain |
| POST | `/auth/2fa/setup`, `/auth/2fa/enable`, `/auth/2fa/disable` | Kelola verifikasi dua langkah (TOTP) |
| GET / DELETE | `/auth/sessions`, `/auth/sessions/{id}` | Lihat dan cabut sesi aktif |
| PATCH | `/me` | Ubah nama tampilan |
| GET | `/me/export` | Unduh seluruh data pengguna (JSON) |
| DELETE | `/me` | Jadwalkan hapus akun (tunggu 7 hari); `POST /me/delete/cancel` membatalkan |

### Riwayat & proyek (perlu masuk)

| Metode | Jalur | Fungsi |
| --- | --- | --- |
| GET | `/calculations?toolId=&projectId=&favorite=&cursor=` | Daftar hitungan milik pengguna |
| POST | `/calculations` | Simpan hitungan |
| GET | `/calculations/{id}` | Detail |
| PATCH | `/calculations/{id}` | Ubah judul, favorit, proyek |
| DELETE | `/calculations/{id}` | Hapus (soft delete) |
| GET / POST | `/projects` | Daftar dan buat proyek |
| GET / PATCH / DELETE | `/projects/{id}` | Detail, ubah, hapus |

### Admin (peran `editor` atau `admin`, TOTP aktif)

| Metode | Jalur | Peran | Fungsi |
| --- | --- | --- | --- |
| GET / POST | `/admin/tools` | editor | Daftar dan buat alat |
| PATCH | `/admin/tools/{id}` | editor | Ubah metadata, SEO, status terbit |
| PUT | `/admin/tools/{id}/contents` | editor | Ganti seluruh FAQ, penjelasan, contoh |
| PUT | `/admin/tools/{id}/relations` | editor | Atur alat terkait |
| GET / POST | `/admin/rates/{rateKey}/versions` | editor | Riwayat dan buat versi tarif (draf) |
| POST | `/admin/rates/{rateKey}/versions/{id}/test` | editor | Jalankan kasus uji dengan tarif draf |
| POST | `/admin/rates/{rateKey}/versions/{id}/publish` | admin | Terbitkan; hanya jika semua uji lulus |
| POST | `/admin/rates/{rateKey}/versions/{id}/archive` | admin | Arsipkan |
| GET / POST / PATCH | `/admin/rate-test-cases` | editor | Kelola kasus uji baku |
| PUT | `/admin/regions/{slug}/minimum-wage/{year}` | editor | Isi UMR |
| PUT | `/admin/holidays/{year}` | editor | Isi libur nasional |
| GET / PATCH | `/admin/messages` | editor | Pesan kontak dan statusnya |
| GET / PATCH | `/admin/users` | admin | Daftar pengguna, ubah peran, kunci akun |
| GET | `/admin/audit-logs` | admin | Log audit dengan filter |
| GET | `/admin/analytics/summary?from=&to=` | editor | Ringkasan tayang, hitungan, per alat |

### Contoh pertukaran

Masuk:

```json
POST /api/v1/auth/login
{ "email": "rina@example.com", "password": "••••••••••••" }

200 OK  (Set-Cookie: jb_sid=...; HttpOnly; Secure; SameSite=Lax)
{
  "user": { "id": "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90", "email": "rina@example.com",
            "displayName": "Rina", "role": "user", "emailVerified": true },
  "csrfToken": "p2Vw..."
}
```

Menyimpan hitungan:

```json
POST /api/v1/calculations        (X-CSRF-Token: p2Vw...)
{
  "toolSlug": "gaji-bersih",
  "title": "Gaji Januari 2027",
  "input": { "grossSalary": 12000000, "ptkpStatus": "K1", "month": 1 },
  "resultSummary": { "takeHomePay": 11120000 },
  "rateVersionIds": [12, 15, 21]
}

201 Created
{ "id": "b9a0d6f4-2c11-4d8e-8a53-0e7f1c9b2a44", "createdAt": "2026-10-26T11:20:00Z" }
```

Menerbitkan tarif (admin):

```json
POST /api/v1/admin/rates/ptkp/versions/21/publish
{ "effectiveFrom": "2027-01-01" }

422 Unprocessable Entity
{ "error": { "code": "BUSINESS_RULE",
  "message": "3 dari 24 kasus uji gagal; tarif tidak diterbitkan",
  "details": [{ "path": "testCases[7]", "message": "Hasil 4.512.000, seharusnya 4.521.000" }],
  "requestId": "0d6e1a9b-77c2-4f31-8b1d-52a6c3e9f804" } }
```

Angka pada contoh hanya ilustrasi format, bukan hasil perhitungan resmi.

## 8. Autentikasi, otorisasi & keamanan

Prinsipnya: pengunjung anonim tidak menyimpan apa pun di server, akun pengguna hanya menyimpan yang perlu, dan akses admin dikunci dengan peran, verifikasi dua langkah, dan log audit. Kontrol mengacu pada OWASP ASVS level 2.

### Autentikasi

- **Sandi:** minimal 10 karakter, ditolak jika ada di daftar sandi umum (10 ribu entri). Hash memakai `crypto.scrypt` bawaan Node dengan N=2^15, r=8, p=3 (rekomendasi OWASP), parameter tersimpan di string hash sehingga bisa dinaikkan dan di-*rehash* saat login. Jumlah hash serentak dibatasi 2 agar memori cPanel tidak melonjak.
- **Sesi:** token acak 32 byte di cookie `jb_sid` (httpOnly, Secure, SameSite=Lax); di database hanya hash SHA-256. Pengguna: kedaluwarsa 14 hari sejak aktivitas terakhir, maksimal 30 hari. Editor dan admin: 2 jam tanpa aktivitas, maksimal 8 jam. Token diganti saat login, ganti sandi, dan perubahan peran.
- **Penguncian:** 5 gagal berturut-turut mengunci akun 15 menit; pesan galat login selalu sama agar tidak membocorkan email terdaftar.
- **Verifikasi email:** wajib sebelum menyimpan riwayat; token sekali pakai, berlaku 24 jam, disimpan sebagai hash.
- **Verifikasi dua langkah (TOTP):** wajib untuk editor dan admin; rahasia dienkripsi AES-256-GCM, 10 kode pemulihan disimpan sebagai hash.
- **Reset sandi:** token sekali pakai, berlaku 30 menit; setelah reset, semua sesi dicabut.

### Otorisasi

| Kemampuan | Anonim | `user` | `editor` | `admin` |
| --- | --- | --- | --- | --- |
| Memakai semua alat, membaca katalog dan tarif | Ya | Ya | Ya | Ya |
| Simpan riwayat, favorit, proyek, ekspor data sendiri | Tidak | Ya | Ya | Ya |
| Ubah konten alat, FAQ, kasus uji, UMR, libur; baca pesan | Tidak | Tidak | Ya | Ya |
| Membuat draf tarif dan menjalankan uji | Tidak | Tidak | Ya | Ya |
| Menerbitkan atau mengarsipkan tarif | Tidak | Tidak | Tidak | Ya |
| Kelola pengguna dan peran, baca log audit | Tidak | Tidak | Tidak | Ya |

- Peran dicek di middleware `requireRole()` pada tiap rute admin; tidak ada pengecekan peran di frontend yang dianggap sebagai kontrol keamanan.
- Setiap kueri data pengguna memakai `WHERE user_id = $1`. Data milik orang lain dijawab 404, bukan 403, agar id tidak bisa ditebak.
- Admin pertama dibuat lewat skrip seed sekali jalan dengan sandi acak; tidak ada jalur pendaftaran admin lewat API.

### Perlindungan aplikasi

| Ancaman | Pengendalian |
| --- | --- |
| Injeksi SQL | Hanya kueri berparameter (`$1`); aturan lint melarang penggabungan string pada kueri |
| XSS | Konten Markdown admin disanitasi saat build; tanpa `innerHTML` untuk input pengguna; CSP ketat, skrip iklan dimuat hanya setelah persetujuan |
| CSRF | Cookie SameSite=Lax + header `X-CSRF-Token` terikat sesi + pengecekan header `Origin` |
| Brute force dan spam | Tabel `rate_limits`: login 10 per 15 menit per IP dan per email, daftar 5 per jam, lupa sandi 5 per jam, kontak 5 per jam, peristiwa 120 per menit |
| Spam formulir kontak | Honeypot, jebakan waktu (kirim < 3 detik ditolak), opsional Cloudflare Turnstile |
| Pembocoran data | Respons tidak pernah memuat `password_hash`; log disamarkan (email, token, sandi) |
| Muatan besar | Batas badan permintaan 100 KB; batas waktu kueri 5 detik |
| Dependensi rentan | Kunci versi dengan lockfile, `npm audit` dan Dependabot di CI, Node LTS |
| Unggah berkas berbahaya | Tidak ada unggahan ke server; pemrosesan foto/PDF seluruhnya di browser |
| Pembajakan sesi | Cookie Secure + HSTS, rotasi token, pencabutan sesi dari halaman akun |

### Header dan jaringan

- HTTPS wajib (AutoSSL), pengalihan HTTP → HTTPS, HSTS 1 tahun setelah staging stabil.
- Header: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Frame-Options: DENY`. Untuk halaman statis diatur lewat `.htaccess`, untuk API lewat Helmet.
- Email transaksional: SPF, DKIM, dan DMARC untuk jobenapp.cloud agar tidak masuk spam.

### Rahasia dan konfigurasi

- Rahasia (`DATABASE_URL`, `SESSION_PEPPER`, `TOTP_ENC_KEY`, `SMTP_*`) diisi lewat variabel lingkungan di menu Node.js App; tidak ada di repositori maupun `public_html`.
- Aplikasi menolak berjalan jika variabel wajib kosong atau terlalu pendek (validasi Zod di `config/env.ts`).
- Pengguna database aplikasi hanya punya hak DML pada skema aplikasi; migrasi memakai pengguna terpisah.

### Pelindungan data pribadi (UU PDP)

- Data yang disimpan: email, nama tampilan, sandi (hash), riwayat yang dipilih pengguna. Alamat IP hanya disimpan sebagai hash berputar.
- Persetujuan cookie (analitik, iklan) dicatat di `consents`; analitik dan iklan tidak berjalan sebelum setuju.
- Hak pengguna: unduh data (`GET /me/export`), hapus akun (`DELETE /me`), ubah profil.
- Kebocoran data: prosedur tertulis, pemberitahuan kepada pengguna dan otoritas paling lambat 3×24 jam; mintalah tinjauan konsultan hukum sebelum rilis publik.
- Pencadangan: `pg_dump` terenkripsi tiap malam lewat Cron; simpan 14 harian dan 8 mingguan di penyimpanan di luar server; uji pemulihan tiap kuartal.

## 9. Strategi pengujian

Pengujian dipusatkan pada dua hal: angka kalkulator harus benar menurut sumber resmi, dan akses data harus aman. Semua tes berjalan otomatis di CI; rilis ditolak jika ada yang gagal.

### Tingkat pengujian

| Tingkat | Alat | Yang diuji | Target |
| --- | --- | --- | --- |
| Unit mesin hitung | Vitest + fast-check | Setiap fungsi `hitung()`, pembulatan, batas tarif | Cakupan baris ≥ 95%, cabang ≥ 90% |
| Unit dan integrasi API | Vitest + Supertest + PostgreSQL uji | Rute, validasi, layanan, kueri, migrasi | Cakupan ≥ 80%; semua rute punya tes |
| Matriks otorisasi | Supertest | Tiap rute × tiap peran (anonim, user, editor, admin) | 100% rute terpetakan |
| Komponen UI | Testing Library | Form, format rupiah, pesan galat, tabel | Komponen `ui/` dan semua widget alat |
| End-to-end | Playwright | Journey utama di Chromium dan WebKit, viewport 360×640 dan 1280×800 | Semua journey di bagian 3 lulus |
| Aksesibilitas | axe-core di Playwright | Pelanggaran tingkat serius dan kritis | 0 pelanggaran |
| Performa | Lighthouse CI | LCP, INP, CLS, ukuran JS per halaman | Skor performa ≥ 90; JS awal ≤ 120 KB gzip |
| Beban | k6 pada staging | API dan halaman statis | 50 permintaan/dtk selama 5 menit, p95 < 300 ms, galat < 1% |
| Keamanan | `npm audit`, ESLint security, OWASP ZAP baseline | Dependensi, pola berbahaya, kerentanan umum | 0 temuan tinggi/kritis |

### Presisi kalkulator (inti kepercayaan)

- **Kasus uji baku bersumber:** tiap kasus di `rate_test_cases` dan `tests/fixtures` mencantumkan `source_ref` (contoh resmi DJP, BPJS, OJK, atau hitungan spreadsheet independen). Hasil harus **persis sama** (toleransi 0) untuk rupiah; pengecualian hanya bila sumber resmi memakai pembulatan lain.
- **Jejak sumber wajib:** setiap fixture mencatat alat dan versi aturan/spesifikasi yang diuji, sumber primer dan pasal/kebijakan, tanggal sumber diperiksa, tanggal efektif, aturan pembulatan, status kasus batas, tanggal dan pemeriksa verifikasi. Kasus tanpa jejak ini tidak dihitung untuk memenuhi target minimum.
- **Pemeriksaan independen:** penyusun perubahan tarif tidak boleh menjadi satu-satunya pemeriksa. Publikasi diblokir bila sumber primer, masa berlaku, peninjau kedua, atau pengujian versi baru belum lengkap; versi lama tetap tersimpan agar hitungan terdahulu dapat direproduksi.
- **Uji sifat (property-based):** misalnya jumlah seluruh angsuran = pokok + total bunga; sisa pokok akhir = 0; gaji bersih = gaji kotor − semua potongan; hasil tidak turun saat input naik di luar titik ambang; tidak ada `NaN`, `Infinity`, atau angka negatif tak sah.
- **Uji batas:** tepat di ambang tiap lapisan tarif, batas upah BPJS, PTKP berubah status, tahun kabisat, tenor 1 bulan dan 30 tahun, input nol.
- **Dua sumber independen:** selain contoh resmi, tiap alat keuangan diverifikasi terhadap rumus spreadsheet; selisih nol rupiah dipersyaratkan.
- **Tarif sebagai data:** uji berjalan dengan tarif tahun lalu dan tahun ini, memastikan mesin tidak menyimpan angka tarif di kode.
- **Gerbang tarif:** skrip `verify-rates.mjs` menjalankan seluruh kasus uji pada `data/rates`; CI gagal jika ada selisih, dan tombol terbitkan di admin menolak tarif yang uji-nya gagal.
- **Pemicu uji ulang:** perubahan undang-undang/peraturan, keputusan BPJS, tabel upah, suku bunga/biaya bank, atau kebijakan marketplace mewajibkan versi sumber dan spesifikasi baru serta menjalankan ulang seluruh fixture terdampak sebelum publikasi. Tanggal efektif masa lalu tidak boleh menimpa versi historis.

| Alat | Kasus uji minimum | Fokus |
| --- | --- | --- |
| Gaji bersih / PPh 21 TER | 30 | Kategori TER A/B/C, kategori/status dan ambang tarif, masa pajak terakhir (rekonsiliasi setahun), pegawai masuk/keluar di tengah tahun |
| Iuran BPJS Kesehatan & Ketenagakerjaan | 20 | Uji batas upah di bawah/pada/di atas batas efektif, dasar dan porsi tiap program, kelas risiko, tanggungan, serta aturan pengecualian yang berlaku |
| PPh 21 freelancer / tenaga ahli | 20 | Klasifikasi penerima dan kesinambungan, dasar pengenaan sesuai ketentuan, lapisan progresif, pembayaran kumulatif, dan status identitas pajak |
| KPR dan cicilan | 25 | Anuitas, flat, efektif, konversi bunga, transisi fixed-floating, pelunasan dipercepat, sisa pokok dan angsuran terakhir |
| HPP, margin, BEP | 20 | Susut bahan, overhead, biaya tetap nol, laba negatif |
| Biaya marketplace | 20 | Tarif per platform/kategori/program, dasar komisi, voucher, ongkir, biaya pesanan, pembatalan/retur, batas, dan pembulatan invoice |
| Terbilang | 40 | 0, ribuan, jutaan, triliun, desimal, angka besar |
| Libur nasional | 10 | Tahun berjalan dan berikutnya, cuti bersama |
| Kompres foto/PDF | 12 | Ukuran target tercapai atau pesan galat jelas; tanpa mengubah rasio |

### Basis data uji

- Setiap proses tes membuat skema PostgreSQL sementara, menjalankan seluruh migrasi dari nol, lalu membuangnya; tidak ada data bersama antar tes.
- Tes migrasi tambahan: jalankan migrasi pada salinan data tiruan berukuran 100 ribu baris dan pastikan waktu eksekusi wajar.

### Alur CI

1. Lint dan pengecekan tipe
2. Tes unit mesin hitung dan `verify-rates`
3. Tes API dan otorisasi (dengan PostgreSQL di layanan CI)
4. Build situs dan API
5. E2E, axe, dan Lighthouse pada hasil build
6. `npm audit`; paket rilis dibuat hanya jika semua langkah lulus

### Uji penerimaan pengguna (UAT) sebelum rilis publik

- [ ] Bandingkan 10 slip gaji nyata (dengan izin, data dianonimkan) dengan hasil Gaji Bersih; selisih harus nol atau terjelaskan
- [ ] Bandingkan 5 simulasi KPR dari situs resmi bank dengan hasil KPR
- [ ] Uji di 3 ponsel nyata (Android lama, Android baru, iPhone) pada jaringan 4G
- [ ] Uji kompres foto dengan portal pendaftaran yang sebenarnya
- [ ] Dua orang non-teknis menyelesaikan tiap journey tanpa bantuan

## 10. Rencana deployment ke cPanel (JOBENAPP di jobenapp.cloud)

Situs statis disajikan langsung oleh Apache dari `public_html`, sedangkan hanya API yang berjalan sebagai aplikasi Node.js bernama **JOBENAPP** lewat Passenger. Build dilakukan di CI atau komputer lokal, bukan di server, karena memori cPanel terbatas.

### Pembagian tempat

| Komponen | Lokasi di server | Disajikan oleh |
| --- | --- | --- |
| Situs statis (hasil build Astro) | `~/public_html/` | Apache |
| Aplikasi API (Node.js) | `~/public_html/jobenapp/` (`/home/smknwon2/public_html/jobenapp`), dilindungi `.htaccess` | Passenger, URL aplikasi `jobenapp.cloud/api` |
| Database | PostgreSQL cPanel, `localhost:5432` | Layanan PostgreSQL |
| Rilis dan cadangan | `~/releases/`, `~/backups/` | Tidak publik |
| Staging | Subdomain `staging.jobenapp.cloud` dengan aplikasi dan database terpisah | Apache + Passenger |

### Persiapan satu kali

1. **Domain dan HTTPS:** arahkan jobenapp.cloud ke server, aktifkan AutoSSL, paksa HTTPS.
2. **Database:** di *PostgreSQL Databases* gunakan database `smknwon2_jobencal_db` dan pengguna `smknwon2_jobencal_user` (awalan `smknwon2` ditambahkan otomatis oleh cPanel). Untuk tahap awal pengguna ini dipakai bersama oleh aplikasi dan migrasi; **sebelum go-live** buat pengguna kedua khusus migrasi (mis. `smknwon2_jobenmig`, hak DDL) dan turunkan `smknwon2_jobencal_user` menjadi hak DML saja. Staging memakai database dan pengguna terpisah (mis. `smknwon2_jobencal_stg`).
3. **Aplikasi Node.js:** di *Setup Node.js App* → *Create Application*, isi persis seperti berikut:
   | Kolom form | Isi |
   | --- | --- |
   | Node.js version | **22.23.4** |
   | Application mode | **Production** |
   | Application root | `public_html/jobenapp` (lihat catatan perlindungan di bawah) |
   | Application URL | pilih domain `jobenapp.cloud` di dropdown, lalu isi kolom jalur dengan `api` |
   | Application startup file | `app.js` |
   Setelah **Create**, tambahkan variabel di bagian *Environment variables* (tombol *Add variable*) sesuai tabel di bawah, lalu jalankan **Run NPM Install**.
   > **Catatan Application root:** karena root berada di `public_html`, folder `public_html/jobenapp` bisa dijangkau Apache. Wajib dilakukan sebelum mengunggah kode:
   > 1. Buat `public_html/jobenapp/.htaccess` berisi `Require all denied` untuk blok akses langsung ke berkas, tetapi **jangan** memblokir lalu lintas Passenger. Jika `Require all denied` ternyata ikut memutus `/api`, ganti dengan aturan `<FilesMatch "^(\.env|package(-lock)?\.json|.*\.(ts|map|sql|sh|md|log))$">Require all denied</FilesMatch>` dan `Options -Indexes`, lalu uji.
   > 2. Uji dari luar: `https://jobenapp.cloud/jobenapp/package.json` dan `/jobenapp/.env` harus mengembalikan 403 atau 404.
   > 3. Jangan menaruh `.env` di folder ini; isi variabel lewat menu Node.js App.
   >
   > Lingkungan Node aplikasi ini aktif dengan: `source /home/smknwon2/nodevenv/public_html/jobenapp/22/bin/activate && cd /home/smknwon2/public_html/jobenapp`. Perintah ini dipakai untuk `npm ci --omit=dev`, `npm run migrate`, dan seed lewat Terminal. Jalur Node untuk Cron: `/home/smknwon2/nodevenv/public_html/jobenapp/22/bin/node`.
4. **Variabel lingkungan:** isi di halaman aplikasi (tabel di bawah). Jangan menaruh berkas `.env` di `public_html`; jika sudah terlanjur ada, hapus dan pindahkan nilainya ke menu Node.js App.
5. **Email:** buat akun `noreply@jobenapp.cloud`, lalu pastikan SPF dan DKIM aktif (menu *Email Deliverability*); tambahkan DMARC di DNS.
6. **Pengguna admin pertama:** jalankan skrip seed sekali lewat Terminal; simpan sandi sementara dan ganti saat login pertama.
7. **Staging:** ulangi langkah 2–5 pada subdomain staging, pasang `noindex` dan autentikasi dasar.

### Variabel lingkungan

| Nama | Isi | Catatan |
| --- | --- | --- |
| `NODE_ENV` | `production` |  |
| `APP_BASE_URL` | `https://jobenapp.cloud` | Dipakai untuk tautan email |
| `BASE_PATH` | `/api` | Awalan jalur; diverifikasi di staging bahwa Passenger meneruskan jalur utuh |
| `DATABASE_URL` | `postgresql://smknwon2_jobencal_user:<DB_PASSWORD>@localhost:5432/smknwon2_jobencal_db` | Pengguna aplikasi. Tanpa `?schema=public` (itu parameter Prisma; proyek ini memakai `pg`, skema bawaan sudah `public`). Jika sandi berisi simbol (`@ : / # ?`), ubah ke bentuk URL-encoded |
| `MIGRATION_DATABASE_URL` | Awalnya sama dengan `DATABASE_URL`; nanti diganti pengguna migrasi terpisah | Hanya dipakai saat migrasi |
| `SITE_URL` | `https://jobenapp.cloud` (nanti `https://joben.cloud`) | Dibaca saat build (Astro `site`), sitemap, canonical, schema, dan `robots.txt`. Satu-satunya tempat domain didefinisikan, sehingga pindah domain cukup ubah nilai ini lalu build ulang |
| `SESSION_PEPPER` | Acak 48 byte | Tambahan untuk hash token sesi |
| `TOTP_ENC_KEY` | Acak 32 byte (base64) | Enkripsi rahasia TOTP |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Dari akun email |  |
| `TRUST_PROXY` | `1` | Wajib jika memakai Cloudflare atau proxy lain |
| `DB_POOL_MAX` | `5` | Menjaga koneksi dalam batas hosting |
| `LOG_LEVEL` | `info` |  |

### Entri Passenger (`deploy/cpanel/app.js`)

Berkas kecil yang memuat hasil build: `require('./dist/server.js')`. Server memanggil `app.listen()` sekali; Passenger mengatur port dan soketnya, sehingga tidak ada nomor port yang ditulis manual.

### Paket rilis

`npm run release` menjalankan tes lalu membuat `release-AAAAMMDD-HHMM.zip` berisi: `dist/` API, `package.json` dan `package-lock.json`, `migrations/`, `seeds/`, `deploy/app.js`, dan `web-dist/` (situs statis). `node_modules` tidak ikut; dipasang di server.

### Prosedur deploy (rutin)

1. **Cadangkan:** jalankan skrip `backup.sh` (dump database ke `~/backups/`) dan simpan rilis lama di `~/releases/`.
2. **Unggah:** kirim zip ke `~/releases/` lewat SFTP atau File Manager; verifikasi checksum SHA-256.
3. **Terapkan API:** ekstrak ke `~/public_html/jobenapp/` dengan `rsync --delete`, kecuali `node_modules`, `tmp`, dan `logs`.
4. **Dependensi:** jika `package-lock.json` berubah, tekan **Run NPM Install** di halaman aplikasi (atau `npm ci --omit=dev` setelah mengaktifkan lingkungan Node dari Terminal).
5. **Migrasi:** `npm run migrate` memakai `MIGRATION_DATABASE_URL`; migrasi dalam transaksi, berhenti pada galat pertama.
6. **Mulai ulang:** tekan **Restart** di halaman aplikasi (atau `touch ~/public_html/jobenapp/tmp/restart.txt`).
7. **Uji asap:** periksa `GET /api/v1/health`, buka beranda, buka satu alat, hitung, dan masuk dengan akun uji.
8. **Terapkan situs statis:** salin `web-dist/` ke `~/public_html/` dengan `rsync --delete`, mengecualikan `jobenapp/` (folder aplikasi API, jika ikut terhapus aplikasi mati), `api/`, `.well-known/`, dan `cgi-bin/`. Lakukan ini setelah API sehat.
9. **Verifikasi akhir:** cek sitemap, `robots.txt`, header keamanan, dan Search Console tanpa galat baru.

### Pemulihan jika gagal (rollback)

- Kode: terapkan kembali zip rilis sebelumnya dengan prosedur yang sama (langkah 3–6).
- Database: migrasi hanya maju. Setiap migrasi dibuat kompatibel dengan kode versi sebelumnya (tambah kolom dulu, hapus kolom di rilis berikutnya), sehingga rollback kode tidak memerlukan rollback skema.
- Kerusakan data: pulihkan dari cadangan terakhir ke database baru, uji, lalu arahkan `DATABASE_URL`.

### Tugas terjadwal (Cron cPanel)

| Jadwal | Perintah | Fungsi |
| --- | --- | --- |
| Tiap jam | `node dist/jobs/cleanup.js` | Hapus sesi, token, dan `rate_limits` kedaluwarsa |
| Harian 02.15 WIB | `backup.sh` | `pg_dump` terkompresi dan terenkripsi, kirim ke penyimpanan luar, buang cadangan lama |
| Harian 03.00 WIB | `node dist/jobs/retention.js` | Hapus peristiwa analitik > 400 hari; hapus permanen akun yang lewat masa tunggu 7 hari |
| 1 Des dan 1 Jun | `node dist/jobs/rate-reminder.js` | Kirim email pengingat meninjau tarif pajak, BPJS, UMR, dan libur |

Perintah Cron memakai jalur lengkap ke Node dari lingkungan cPanel (`/home/smknwon2/nodevenv/public_html/jobenapp/22/bin/node`).

### Pemantauan dan performa

- Pemantau eksternal (misalnya UptimeRobot) memeriksa `/api/v1/health` tiap 5 menit dan mengirim peringatan email.
- Log JSON dengan rotasi harian di `~/public_html/jobenapp/logs/` (atau `~/logs/jobenapp/` di luar `public_html`, lebih disarankan, diatur lewat variabel `LOG_DIR`); simpan 30 hari. Opsional: Sentry tingkat gratis untuk galat.
- Cloudflare tingkat gratis di depan situs sangat disarankan: menyimpan cache aset statis, mengurangi beban server, dan menahan lalu lintas buruk. Atur `TRUST_PROXY` dan pakai `CF-Connecting-IP` untuk pembatasan laju.
- Apache: kompresi gzip/brotli, `Cache-Control: immutable` selama 1 tahun untuk `/_astro/`, 5 menit untuk HTML.
- Target sumber daya: memori aplikasi < 150 MB, pool database maksimum 5 koneksi; diuji dengan k6 di staging sebelum rilis.

### Kesiapan migrasi ke joben.cloud

Saat ini aplikasi berjalan di **jobenapp.cloud** (domain yang tampil di dropdown *Application URL* cPanel). Tujuan migrasi adalah **joben.cloud**. Dokumen ini ditulis agar domain, nama database, dan jalur akun tidak tertanam di kode; semuanya berasal dari variabel lingkungan atau satu berkas konfigurasi, sehingga pemindahan tidak mengubah kode.

#### Prinsip agar mudah dipindah

- **Domain hanya di `SITE_URL`** (build) dan `APP_BASE_URL` (runtime). Tidak ada `https://joben.cloud` yang ditulis langsung di komponen, templat email, atau JSON-LD; semuanya memakai konstanta dari konfigurasi.
- **Satu domain untuk situs dan API** (`/api` di domain yang sama), jadi tidak ada CORS atau `Domain=` pada cookie. Cookie sesi bersifat host-only (tanpa atribut `Domain`), sehingga otomatis mengikuti domain baru.
- **Tautan internal relatif** (`/alat/gaji-bersih`), kecuali canonical, `og:url`, sitemap, dan tautan email yang wajib absolut.
- **Tidak ada nama akun cPanel di kode**; jalur seperti `/home/smknwon2/...` hanya ada di crontab dan `backup.sh`, dan dibaca dari variabel (`$HOME`).
- **Database mudah dipindah**: migrasi SQL murni dan `pg_dump`/`pg_restore` biasa, tanpa ekstensi yang butuh superuser.

#### Skenario A: joben.cloud ditambahkan ke akun cPanel yang sama (paling sederhana)

1. Di cPanel → *Domains*, tambahkan `joben.cloud` sebagai domain tambahan; arahkan DNS-nya ke server ini dan aktifkan AutoSSL.
2. Database, folder aplikasi, dan cron tidak berubah, jadi tidak perlu dump atau restore.
3. Ubah `SITE_URL` dan `APP_BASE_URL` menjadi `https://joben.cloud`, ubah `MAIL_FROM` dan `SMTP_USER`, build ulang situs, lalu rilis.
4. Di *Setup Node.js App* → JOBENAPP → *Edit*, ubah *Application URL* ke `joben.cloud` dengan jalur `api`, lalu **Restart**.
5. Pasang pengalihan 301 dari `jobenapp.cloud` ke `joben.cloud` (jalur yang sama), lalu lanjut ke langkah pascamigrasi di bawah.

#### Skenario B: pindah ke server atau akun cPanel lain

Ikuti urutan berikut.

1. **Pra-cek (H-7):** verifikasi daftar di bagian 1; pastikan versi PostgreSQL tujuan ≥ versi sumber (13+); turunkan TTL DNS joben.cloud menjadi 300 detik.
2. **Siapkan lingkungan tujuan:** arahkan joben.cloud ke server, aktifkan AutoSSL, buat database dan pengguna (bagian 10, langkah 2), buat aplikasi Node.js **JOBENAPP** dengan *Application URL* `joben.cloud/api`, isi variabel lingkungan dengan `SITE_URL=https://joben.cloud` dan `APP_BASE_URL=https://joben.cloud`.
3. **Email:** buat `noreply@joben.cloud`; aktifkan SPF dan DKIM; tambahkan DMARC (mulai `p=none`, naikkan ke `quarantine` setelah laporan bersih).
4. **Latihan di staging (`staging.joben.cloud`):** jalankan deploy penuh dari paket rilis, `npm run migrate`, seed, dan uji asap. Lakukan *restore* dari cadangan nyata untuk membuktikan data bisa dipulihkan.
5. **Bekukan perubahan (H-0):** hentikan penulisan di sumber (mode pemeliharaan), jalankan `backup.sh`, lalu ekspor:
   `pg_dump --no-owner --no-privileges -Fc -f jobencal.dump smknwon2_jobencal_db`
6. **Pulihkan ke tujuan:** `pg_restore --no-owner --no-privileges -d smknwon2_jobencal_db jobencal.dump`, lalu `npm run migrate` (harus menyatakan tidak ada migrasi tertunda).
7. **Verifikasi data:** bandingkan jumlah baris tiap tabel (19 tabel), jumlah versi tarif terbit, dan jumlah pengguna antara sumber dan tujuan; jalankan `GET /api/v1/health` (`db: "ok"`).
8. **Rilis situs statis** dengan `SITE_URL` baru (build ulang, bukan sekadar mengganti teks di hasil build), lalu salin ke `~/public_html/`.
9. **Alihkan DNS** ke joben.cloud; tunggu AutoSSL terbit; uji ulang beranda, satu alat, masuk, simpan hitungan, dan kirim email uji.
10. **Pasang pengalihan 301** dari jobenapp.cloud ke joben.cloud dengan jalur yang sama, dan pertahankan domain lama aktif minimal 12 bulan.
11. **Pascamigrasi (H+1 sampai H+14):** tambahkan properti joben.cloud di Search Console dan gunakan *Change of Address* bila domain lama sudah terindeks; ajukan sitemap baru; perbarui pemantau uptime, Cloudflare, jaringan iklan (daftar situs dan `ads.txt`), dan analitik; pertahankan domain lama dan cadangan sumber minimal 30 hari.

#### Titik yang wajib diubah saat pindah domain

| Tempat | Perubahan |
| --- | --- |
| Variabel lingkungan | `SITE_URL`, `APP_BASE_URL`, `MAIL_FROM`, `SMTP_USER` |
| DNS | A/AAAA, MX, SPF, DKIM, DMARC, CAA bila ada |
| Cloudflare / proxy | Zona baru, `TRUST_PROXY`, aturan cache |
| Search Console | Properti baru, sitemap, Change of Address |
| Iklan dan analitik | Domain terdaftar, `ads.txt`, filter internal |
| Pemantau uptime | URL `/api/v1/health` |
| Crontab | Jalur akun, bila akun cPanel berubah |

#### Daftar periksa kesiapan (semua harus tercentang sebelum H-0)

- [ ] Tidak ada domain atau nama akun tertanam di kode (`grep -rn "joben" apps packages` hanya menemukan konfigurasi dan dokumentasi)
- [ ] Build dengan `SITE_URL` berbeda menghasilkan canonical, sitemap, dan schema yang ikut berubah (diuji di CI)
- [ ] `pg_dump` lalu `pg_restore` ke database kosong lulus dalam < 30 menit dan jumlah baris cocok
- [ ] `npm run migrate` pada database hasil restore tidak menghasilkan galat
- [ ] Email uji dari `noreply@joben.cloud` masuk ke kotak masuk (bukan spam) dengan SPF, DKIM, DMARC lulus
- [ ] Pengalihan 301 jobenapp.cloud ke joben.cloud diuji dan tidak berantai
- [ ] Rencana rollback tertulis: arahkan DNS kembali ke sumber dan buka kembali penulisan; data baru selama jendela migrasi dibekukan sehingga tidak ada rekonsiliasi
- [ ] Sandi database sudah diganti (lihat catatan keamanan di bawah)

#### Catatan keamanan kredensial

Sandi database sempat dibagikan dalam teks percakapan. Anggap sandi itu sudah terpapar: **ganti sandi** `smknwon2_jobencal_user` di cPanel (*PostgreSQL Databases*) dengan sandi acak ≥ 24 karakter dari pengelola sandi, lalu perbarui hanya di variabel lingkungan menu Node.js App. Jangan menulis `DATABASE_URL` berisi sandi di repositori, `.env.example`, tiket, atau percakapan; `.env.example` hanya berisi `<DB_PASSWORD>`.

### Daftar periksa go-live

- [ ] Semua gerbang CI lulus; UAT bagian 9 selesai
- [ ] HTTPS, HSTS, dan pengalihan www ↔ non-www benar
- [ ] Cadangan pertama berhasil dan *restore* sudah dicoba
- [ ] Halaman Tentang, Kontak, Privasi, Syarat, dan Disclaimer terbit
- [ ] Sitemap diajukan di Search Console; `robots.txt` tidak memblokir
- [ ] Banner persetujuan cookie aktif; iklan dan analitik tidak jalan sebelum setuju
- [ ] Pemantau uptime dan pengingat tarif aktif
- [ ] Admin memakai TOTP; sandi sementara sudah diganti

## 11. Acceptance criteria per fase

Sebuah fase dianggap selesai hanya jika **semua** butir di bawahnya terpenuhi dan terbukti (tes otomatis, tangkapan layar, atau laporan). Perkiraan waktu mengasumsikan satu pengembang penuh waktu; MVP (fase 0–4) sekitar 10 minggu.

| Fase | Nama | Perkiraan waktu |
| --- | --- | --- |
| 0 | Fondasi dan uji kelayakan cPanel | Minggu 1–2 |
| 1 | Mesin hitung dan 12 alat inti | Minggu 3–5 |
| 2 | Backend, akun, dan panel admin | Minggu 5–7 |
| 3 | Hub, SEO, konten, dan iklan | Minggu 7–9 |
| 4 | Pengerasan, staging, dan rilis produksi | Minggu 9–10 |
| 5 | Skala konten dan halaman programmatic | Bulan 3–4 |
| 6 | Optimasi dan ekspansi | Bulan 6–12 |

### Definition of Done (berlaku untuk setiap perubahan)

- [ ] Lewat tinjauan kode (pull request) oleh orang lain atau tinjauan mandiri berdaftar periksa
- [ ] Lint, tipe, dan semua tes lulus di CI; cakupan tidak turun dari ambang
- [ ] Migrasi (jika ada) kompatibel dengan kode sebelumnya dan diuji dari nol
- [ ] Tidak ada rahasia, `console.log` data pribadi, atau angka tarif di kode
- [ ] Tampilan diperiksa di lebar 320, 768, dan 1280 px; axe tanpa pelanggaran serius
- [ ] Dokumentasi (README, OpenAPI, catatan rilis) diperbarui

### Fase 0 — Fondasi dan uji kelayakan cPanel

- [ ] `npm ci && npm run build` dari klon bersih berhasil dalam < 5 menit
- [ ] CI menjalankan lint, tipe, dan tes pada setiap pull request
- [ ] Aplikasi JOBENAPP di staging menjawab `GET /api/v1/health` dengan 200 dan `db: "ok"`
- [ ] Hasil uji kelayakan tercatat: perilaku `BASE_PATH` di Passenger, waktu mulai dingin < 3 detik, memori per proses, waktu hash scrypt < 500 ms
- [ ] Migrasi `001_init.sql` dan seed berjalan di staging tanpa galat
- [ ] Komponen `ui/` dasar (Button, Field, RupiahInput, Table, Toast) selesai dan lulus axe

### Fase 1 — Mesin hitung dan 12 alat inti

- Rincian wajib per subfase, gerbang sumber, dan kasus uji ada di
  [Adendum Fase 1 — Core System dan 12 alat](ADENDUM_FASE1_CORE_SYSTEM.md).
  Implementasikan dan tutup Fase 1.0 lalu subfase alat 1.1–1.12; target
  keseluruhan adendum adalah minimal 209 fixture, termasuk 12 fixture invoice
  yang menutup kekosongan hitungan di tabel Bagian 9.
- [ ] 12 alat di bagian 2 tersedia sebagai fungsi murni di `packages/engine`, tanpa impor dari `apps/`
- [ ] Seluruh kasus uji baku bagian 9 dan adendum lulus (minimal 209 fixture) dengan selisih sesuai toleransi per alat
- [ ] Mengubah nilai di `data/rates/*.json` mengubah hasil tanpa mengubah kode (dibuktikan tes)
- [ ] Input rupiah menerima `1.500.000` dan `1500000`; input tidak valid menampilkan pesan jelas berbahasa Indonesia
- [ ] Hasil muncul < 100 ms setelah input pada ponsel kelas menengah; tampilan benar di 320 px tanpa gulir horizontal
- [ ] Setiap alat menampilkan langkah perhitungan, serta tombol salin, bagikan WhatsApp, dan cetak/unduh PDF
- [ ] Kompres foto/PDF: ukuran target tercapai dalam ±5% atau tampil pesan galat jelas; foto 10 MP diproses < 5 detik; E2E membuktikan tidak ada permintaan jaringan yang membawa berkas

### Fase 2 — Backend, akun, dan panel admin

- [ ] Seluruh endpoint bagian 7 terimplementasi; dokumen OpenAPI dibuat otomatis dan tes kontrak lulus
- [ ] Matriks otorisasi: 100% rute × peran diuji; tidak ada rute yang bisa diakses dengan peran yang salah
- [ ] E2E lulus: daftar → verifikasi email → masuk → simpan hitungan → ekspor data → hapus akun
- [ ] Penguncian akun (5 gagal) dan semua pembatasan laju terbukti oleh tes
- [ ] Editor/admin tidak bisa masuk tanpa TOTP; editor tidak bisa menerbitkan tarif
- [ ] Setiap spesifikasi/tarif menyimpan rumus, sumber, tanggal diperiksa dan berlaku, pembulatan, pengecualian, serta tim pemilik; pemeriksa berbeda dari pembuat
- [ ] Alur tarif: draf → uji → uji gagal memblokir terbit (422) → pemeriksaan independen → terbit → `/rates/{key}/current` memakai versi baru pada tanggal berlaku; semuanya tercatat di `audit_logs`
- [ ] Tes otomatis membuktikan `password_hash`, token, dan sandi tidak pernah muncul di respons maupun log
- [ ] Pekerjaan Cron `retention.js` menghapus akun yang lewat 7 hari dan semua datanya, dibuktikan tes

### Fase 3 — Hub, SEO, konten, dan iklan

- [ ] Terbit: beranda, halaman kategori, 12 halaman alat, dan 5 halaman legal
- [ ] Tiap halaman alat memiliki judul ≤ 60 karakter, deskripsi ≤ 160 karakter, canonical, penjelasan unik ≥ 300 kata, ≥ 2 contoh hitungan, FAQ ≥ 4 butir, tanggal pembaruan, dan sumber hukum
- [ ] Schema `FAQPage` dan `BreadcrumbList` valid di Rich Results Test; sitemap memuat semua halaman terbit
- [ ] Lighthouse mobile pada beranda dan 12 alat: Performa ≥ 90, Aksesibilitas ≥ 95, SEO ≥ 95, Best Practices ≥ 95; LCP ≤ 2,5 dtk, CLS ≤ 0,1
- [ ] Tidak ada iklan atau skrip analitik sebelum persetujuan; slot iklan tidak menggeser tata letak (CLS tetap ≤ 0,1) dan tidak menutupi form atau tombol
- [ ] Pencarian cepat menemukan alat yang tepat di tiga hasil teratas untuk 20 kueri uji, < 100 ms
- [ ] Situs terverifikasi di Search Console tanpa galat; dasbor admin menampilkan tayang dan hitungan per alat

### Fase 4 — Pengerasan, staging, dan rilis produksi

- [ ] UAT bagian 9 selesai; selisih dengan slip gaji dan simulasi bank nol atau terjelaskan
- [ ] Uji beban k6: p95 < 300 ms dan galat < 1% pada 50 permintaan/dtk selama 5 menit; memori < 150 MB; tidak ada proses dimulai ulang oleh batas hosting
- [ ] OWASP ZAP baseline: 0 temuan tinggi atau kritis; `npm audit`: 0 kerentanan tinggi
- [ ] Header keamanan nilai A (securityheaders.com); SSL Labs nilai A
- [ ] Latihan pemulihan: database kosong terisi dari cadangan dalam < 30 menit dan datanya terverifikasi
- [ ] Orang selain penulis menjalankan prosedur deploy dan rollback di staging hanya dengan mengikuti dokumen ini
- [ ] Peringatan uptime teruji: simulasi mati menghasilkan email dalam 10 menit
- [ ] Daftar periksa go-live bagian 10 terpenuhi 100%; kebijakan privasi dan syarat sudah ditinjau

### Fase 5 — Skala konten dan halaman programmatic

- [ ] 25 alat tambahan, masing-masing memenuhi kriteria fase 1 dan 3
- [ ] 300–500 halaman programmatic dibuat dari data; tiap halaman punya pengantar, tabel hasil hitungan, dan FAQ dengan ≥ 3 nilai yang spesifik pada halaman itu
- [ ] Skrip build menggagalkan rilis jika ada halaman < 250 kata atau kemiripan teks antar halaman ≥ 70%
- [ ] ≥ 90% halaman terindeks dalam 8 minggu; halaman yang tidak terindeks ditinjau, bukan digandakan
- [ ] Peninjauan tarif sebelum 1 Januari selesai dan diterbitkan lewat alur admin

### Fase 6 — Optimasi dan ekspansi

- [ ] Mode bandingkan dua skenario, ekspor Excel, dan widget embed (iframe + `postMessage`, ≤ 100 KB) berfungsi dan diuji
- [ ] Versi bahasa Inggris dengan `hreflang` valid, tanpa penurunan Core Web Vitals
- [ ] Peralihan jaringan iklan tanpa penurunan skor kecepatan; RPM diukur per kategori
- [ ] Indikator: 500 ribu–1 juta sesi per bulan pada bulan 9–12, dengan keandalan ≥ 99,5%

## 12. Prompt eksekusi fase (implementasi nyata, bertahap, hemat kredit)

Repositori saat ini berisi dokumen rencana, belum berisi aplikasi JOBENAPP. Bagian ini adalah urutan prompt untuk membangun aplikasi sesuai PRD; bukan bukti bahwa aplikasinya sudah dibuat. Fase hanya boleh diberi status **COMPLETED** setelah kriteria penerimaannya benar-benar dijalankan dan bukti hasilnya tersedia. Status lain yang diperbolehkan: `NOT_STARTED`, `IN_PROGRESS`, atau `BLOCKED`.

### Cara pakai agar pengerjaan tuntas dan hemat kredit

1. Gunakan **Prompt induk** sekali pada sesi implementasi. Lalu berikan satu prompt fase pada satu waktu; jangan meminta semua fase sekaligus.
2. Berikan fase berikutnya hanya setelah fase aktif berstatus `COMPLETED`. Jika diblokir oleh akses/secrets/keputusan bisnis, minta daftar input minimum yang diperlukan; lanjutkan pekerjaan lain yang tidak bergantung padanya.
3. Prompt merujuk ke PRD ini agar spesifikasi tidak perlu ditempel ulang. Jangan membuat ulang struktur, mengganti stack, atau menambah dependensi besar tanpa alasan yang dibuktikan.
4. Agent harus mengerjakan perubahan di repositori, menjalankan pemeriksaan yang relevan, memperbaiki kegagalan dalam fase itu, dan melaporkan hasil faktual. Jawaban berupa rencana, mockup, stub, TODO, atau kode yang belum diuji tidak memenuhi fase.

### Prompt induk — tempel sekali

```text
Anda adalah engineer implementasi JOBENAPP. Baca dokumen
doc/JOBENAPP_Rencana_Teknis_joben.cloud_1793015363469.md, khususnya Bagian 2
dan 4–12, lalu kerjakan Fase [NOMOR DAN NAMA FASE] saja sampai tuntas.

Kerjakan produk nyata langsung di repositori; jangan hanya memberi rencana,
contoh kode, mockup, atau placeholder. Ikuti stack dan batasan yang sudah
dipilih dalam PRD. Pertahankan struktur yang ada dan jangan mengganti teknologi
atau melakukan refactor luas di luar kebutuhan fase.

Setiap jalur pengguna harus berfungsi end-to-end: validasi, loading, hasil,
empty state, galat yang dapat dipahami, dan persistence/API nyata bila
disyaratkan. Jangan menganggap tombol, formulir, endpoint, migrasi, atau tes
selesai jika masih dummy/TODO. Nilai tarif hanya boleh dipakai dengan sumber
primer dan masa berlaku yang tercatat. Jangan mengarang tarif, secrets, hasil
tes, atau bukti deployment.

Sebelum mengubah kode, periksa struktur dan pola yang sudah ada. Setelah satu
batch perubahan yang koheren, jalankan lint/tipe/tes/build yang relevan,
perbaiki kegagalan, lalu lakukan pemeriksaan akhir fase. Hindari menjalankan
ulang pemeriksaan yang tidak terpengaruh. Gunakan ulang dependensi dan
komponen; jangan menambah paket jika fitur dapat dibuat dengan stack yang ada.
Jangan bypass tes, menurunkan ambang, atau menghapus fitur lama demi membuat
build hijau.

Untuk secrets, database, layanan email, akun bank/marketplace, atau akses
cPanel yang belum tersedia: jangan hardcode atau berpura-pura terhubung.
Selesaikan semua pekerjaan lokal yang tidak terhalang, siapkan integrasi yang
benar, tandai hanya bagian yang benar-benar menunggu akses sebagai BLOCKED,
dan minta tepat daftar input minimum. Jangan menjalankan deployment atau
migrasi produksi tanpa izin.

Status fase hanya COMPLETED bila semua kriteria fase terkait dalam Bagian 11
dan prompt ini lulus serta ada bukti nyata. Jika belum, laporkan IN_PROGRESS
atau BLOCKED dengan alasan dan pekerjaan tersisa. Akhiri laporan dengan:
status; fitur/berkas yang benar-benar dikerjakan; perintah pemeriksaan dan
hasilnya; bukti UI/API yang relevan; serta satu daftar singkat hambatan/input
yang memang masih diperlukan. Jangan mengklaim tes atau fitur yang tidak
dijalankan.
```

### Prompt Fase 0 — fondasi dan uji kelayakan

```text
Jalankan Fase 0 sesuai Prompt induk dan kriteria Bagian 11. Repo saat ini
hanya berisi PRD; temukan dahulu konvensi/workflow yang tersedia. Buat fondasi
proyek minimum sesuai struktur dan stack PRD: workspace/package setup, aplikasi
Astro dan Express yang bisa dijalankan, TypeScript, lint, pemeriksaan tipe,
tes awal, konfigurasi lingkungan tervalidasi, health endpoint, serta migrasi
awal PostgreSQL dan seed yang aman. Tambahkan workflow preview Replit untuk
pengembangan lokal tanpa mengubah target deployment cPanel. Jangan membangun
seluruh fitur fase lain di sini.

Buktikan dari kondisi bersih bahwa instalasi, tes, dan build berjalan; buka
preview dan periksa halaman yang tampil; uji health endpoint dan status
koneksi database yang benar-benar tersedia. Jika layanan cPanel tidak dapat
diakses, jangan mengarang hasil uji cPanel: dokumentasikan blokirnya, tetapi
pastikan aplikasi lokal/preview berfungsi penuh untuk fondasi ini.
```

### Prompt Fase 1 — mesin hitung dan 12 alat

```text
Ikuti doc/ADENDUM_FASE1_CORE_SYSTEM.md dan kriteria Bagian 11. Kerjakan Fase
1.0 terlebih dahulu, lalu satu subfase alat 1.1–1.12 pada satu waktu. Untuk
setiap subfase, tuntaskan spesifikasi/sumber, fungsi murni TypeScript, fixture
independen, UI, dan E2E sebelum menyatakan subfase lulus. Pertahankan semua
ketentuan sumber, versi, masa berlaku, pembulatan, dan privasi pada adendum.

Jangan menanam tarif/keputusan yang belum diverifikasi. Target penutupan
keseluruhan adalah minimal 209 fixture (197 minimum lama ditambah 12 fixture
invoice), beserta uji batas, pembulatan, uji sifat, E2E, dan pemeriksaan mobile
serta desktop. Jangan menyatakan alat atau fase selesai jika sumber, pemeriksa
kedua, hasil independen, atau gerbang khususnya belum lulus.
```

### Prompt Fase 2 — API, akun, riwayat, dan admin

```text
Jalankan Fase 2 sesuai Prompt induk dan kriteria Bagian 11. Implementasikan
API Express dan PostgreSQL nyata menurut kontrak Bagian 6–8: validasi Zod,
akun/sesi aman, verifikasi email sesuai konfigurasi, TOTP untuk editor/admin,
otorisasi semua peran, riwayat dan proyek pengguna, ekspor/penghapusan data,
rate limiting, audit log, dan endpoint tarif.

Bangun panel admin fungsional untuk konten dan versi tarif/spesifikasi:
draf → validasi sumber → pratinjau semua fixture → pemeriksaan oleh orang
berbeda dari pembuat → publikasi sesuai tanggal berlaku. Uji gagal harus
mencegah publikasi; versi historis tidak boleh tertimpa. Buat dan uji seluruh
migrasi dari database kosong, tes integrasi/otorisasi, serta E2E untuk alur
akun dan admin. Jangan mengganti penyimpanan dengan data memory/mock.
```

### Prompt Fase 3 — hub, SEO, konten, dan persetujuan

```text
Jalankan Fase 3 sesuai Prompt induk dan kriteria Bagian 11. Bangun beranda,
kategori, pencarian, 12 halaman alat, halaman legal, navigasi responsif,
konten rumus/contoh/FAQ, metadata SEO, schema, sitemap, robots, dan halaman 404
yang benar-benar tersambung ke API/mesin hitung yang telah dibangun.

Implementasikan persetujuan cookie: skrip iklan dan analitik tidak boleh
dimuat sebelum izin yang sesuai. Jangan menampilkan klaim legal atau tarif
tanpa sumber/tanggal pada spesifikasi. Isi konten harus unik dan informatif,
bukan teks SEO berulang. Uji navigasi keyboard, kontras, axe, pencarian tiga
hasil teratas, metadata/schema, dan Lighthouse mobile sesuai target Bagian 11.
```

### Prompt Fase 4 — integrasi, uji rilis, keamanan, dan deployment

```text
Jalankan Fase 4 sesuai Prompt induk dan kriteria Bagian 11. Jangan menambah
fitur baru sebelum menyelesaikan seluruh journey aplikasi. Jalankan rangkaian
CI penuh: lint/tipe, 197+ fixture, migrasi, integrasi dan matriks otorisasi,
E2E, aksesibilitas, performa, audit dependensi, serta uji beban yang
direncanakan. Perbaiki temuan yang bisa diperbaiki dalam repo; jangan
menonaktifkan pemeriksaan.

Uji backup/pemulihan dan prosedur deploy/rollback pada lingkungan nonproduksi.
Siapkan paket dan petunjuk Passenger/cPanel yang dapat direproduksi; verifikasi
preview Replit dan hasil build. Deployment produksi, DNS, email, bank, dan
cPanel hanya boleh dinyatakan selesai jika benar-benar ada akses dan hasil
nyata. Jika belum tersedia, fase rilis tetap BLOCKED, tetapi semua pemeriksaan
lokal dan staging yang mungkin harus COMPLETED dan bukti serta daftar akses
yang dibutuhkan dilaporkan.
```

### Prompt Fase 5 — skala konten dan halaman programmatic

```text
Jalankan Fase 5 sesuai Prompt induk dan kriteria Bagian 11 hanya setelah MVP
Fase 0–4 COMPLETED. Implementasikan alat tambahan dan halaman programmatic
berdasarkan dataset tervalidasi (bukan halaman hasil duplikasi). Buat pipeline
build yang menolak konten tipis/duplikat, setiap halaman menyertakan nilai
spesifik, sumber, tanggal, FAQ, canonical, dan schema yang benar. Jalankan
tes kualitas konten dan sitemap sebelum mengindeks; jangan mengirimkan
permintaan indexing massal atau mengklaim hasil indeks tanpa bukti Search
Console.
```

### Prompt Fase 6 — fitur lanjutan dan ekspansi

```text
Jalankan Fase 6 sesuai Prompt induk dan kriteria Bagian 11 hanya setelah MVP
stabil. Bangun perbandingan skenario, ekspor Excel, widget embed dengan
origin-check dan batas payload, lokalisasi bahasa Inggris/hreflang, serta
optimasi performa/iklan yang tetap menghormati persetujuan pengguna. Sertakan
validasi, error state, kontrol privasi, tes keamanan dan E2E untuk setiap
fitur. Ukur trafik/RPM hanya dari data nyata; jangan mengarang metrik atau
mengorbankan akurasi kalkulator dan Core Web Vitals demi target pertumbuhan.
```
