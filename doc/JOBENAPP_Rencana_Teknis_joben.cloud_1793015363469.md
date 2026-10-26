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

- PostgreSQL 13 atau lebih baru, 19 tabel (bagian 6), pool koneksi maksimum 5, batas waktu kueri 5 detik.
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

Skema memakai 19 tabel PostgreSQL 13 atau lebih baru. Tidak ada ekstensi yang butuh hak superuser (`citext`, `btree_gist` dihindari), sehingga aman di cPanel.

### Daftar tabel

| Kelompok | Tabel | Fungsi |
| --- | --- | --- |
| Identitas | `users`, `sessions`, `auth_tokens`, `consents` | Akun, sesi, token verifikasi/reset, rekam persetujuan (UU PDP) |
| Katalog | `categories`, `tools`, `tool_contents`, `tool_relations` | Kategori, alat, FAQ/penjelasan/contoh, alat terkait |
| Tarif & data | `rate_versions`, `rate_test_cases`, `regions`, `minimum_wages`, `holidays` | Tarif bertanggal berlaku, kasus uji baku, wilayah, UMR, libur nasional |
| Pengguna | `projects`, `calculations` | Proyek dan riwayat hitungan |
| Operasional | `contact_messages`, `analytics_events`, `audit_logs`, `rate_limits` | Pesan, analitik tanpa data pribadi, log audit, pembatasan laju |

### Hubungan utama

- `users` 1—N `sessions`, `auth_tokens`, `projects`, `calculations`
- `categories` 1—N `tools`; `tools` 1—N `tool_contents`; `tools` N—N `tools` lewat `tool_relations`
- `projects` 1—N `calculations` (opsional); `tools` 1—N `calculations`
- `rate_versions` dirujuk oleh `calculations.rate_version_ids`, sehingga hitungan lama tetap bisa direproduksi dengan tarif saat itu
- `rate_test_cases` terikat pada `rate_key` dan `tools`; dipakai untuk pratinjau uji sebelum tarif diterbitkan
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

CREATE TABLE rate_versions (
  id             serial PRIMARY KEY,
  rate_key       text NOT NULL,                  -- 'pph21_ter','ptkp','bpjs',...
  version        integer NOT NULL,
  effective_from date NOT NULL,
  effective_to   date,
  data           jsonb NOT NULL,
  source_url     text NOT NULL,
  source_note    text NOT NULL DEFAULT '',
  status         publish_st NOT NULL DEFAULT 'draft',
  created_by     uuid REFERENCES users(id),
  published_by   uuid REFERENCES users(id),
  published_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rate_key, version),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
-- satu tarif terbit per tanggal berlaku (tumpang tindih dicek juga di service)
CREATE UNIQUE INDEX rate_pub_uq ON rate_versions (rate_key, effective_from)
  WHERE status = 'published';

CREATE TABLE rate_test_cases (
  id         serial PRIMARY KEY,
  rate_key   text NOT NULL,
  tool_id    integer NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name       text NOT NULL,
  input      jsonb NOT NULL,
  expected   jsonb NOT NULL,
  source_ref text NOT NULL,                      -- tautan atau pasal rujukan
  tolerance  numeric NOT NULL DEFAULT 0          -- 0 = harus persis sama
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
- **Uji sifat (property-based):** misalnya jumlah seluruh angsuran = pokok + total bunga; sisa pokok akhir = 0; gaji bersih = gaji kotor − semua potongan; hasil tidak turun saat input naik di luar titik ambang; tidak ada `NaN`, `Infinity`, atau angka negatif tak sah.
- **Uji batas:** tepat di ambang tiap lapisan tarif, batas upah BPJS, PTKP berubah status, tahun kabisat, tenor 1 bulan dan 30 tahun, input nol.
- **Dua sumber independen:** selain contoh resmi, tiap alat keuangan diverifikasi terhadap rumus spreadsheet; selisih nol rupiah dipersyaratkan.
- **Tarif sebagai data:** uji berjalan dengan tarif tahun lalu dan tahun ini, memastikan mesin tidak menyimpan angka tarif di kode.
- **Gerbang tarif:** skrip `verify-rates.mjs` menjalankan seluruh kasus uji pada `data/rates`; CI gagal jika ada selisih, dan tombol terbitkan di admin menolak tarif yang uji-nya gagal.

| Alat | Kasus uji minimum | Fokus |
| --- | --- | --- |
| Gaji bersih / PPh 21 TER | 30 | Kategori TER A/B/C, bulan Desember (penghitungan ulang tahunan), batas BPJS |
| PPh 21 freelancer | 20 | Dasar pengenaan 50%, tarif progresif, NPWP vs tanpa NPWP |
| KPR dan cicilan | 25 | Anuitas, flat, efektif, masa bunga berjenjang, pelunasan dipercepat |
| HPP, margin, BEP | 20 | Susut bahan, overhead, biaya tetap nol, laba negatif |
| Biaya marketplace | 15 | Tiap tingkat komisi, voucher, ongkir, pembulatan |
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

- [ ] 12 alat di bagian 2 tersedia sebagai fungsi murni di `packages/engine`, tanpa impor dari `apps/`
- [ ] Seluruh kasus uji baku bagian 9 lulus (minimal 170 kasus) dengan selisih 0 rupiah
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
- [ ] Alur tarif: draf → uji → uji gagal memblokir terbit (422) → uji lulus → terbit → `/rates/{key}/current` memakai versi baru pada tanggal berlaku; semuanya tercatat di `audit_logs`
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
