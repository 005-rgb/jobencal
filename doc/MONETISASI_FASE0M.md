# Addendum Fase 0-M — Fondasi monetisasi dan privasi iklan

**Status:** fondasi aplikasi dan backend tersedia; tidak ada jaringan iklan,
merchant afiliasi, publisher ID, atau permintaan pihak ketiga yang aktif.
**Prasyarat:** sebelum implementasi kalkulator Fase 1.1. **Batas:** ikuti
struktur dan stack yang telah ada; tidak menambah tabel atau migrasi.

## Konfigurasi backend

- Backend membaca `ADS_ENABLED` sebagai nilai boolean ketat (`true`/`false`).
- Nilai default adalah `false`; setel di environment server untuk staging atau
  produksi. Frontend tidak memiliki sakelar aktivasi sendiri.
- `GET /api/v1/public/monetization` hanya mengembalikan `{ "adsEnabled": boolean }`
  dan menggunakan `Cache-Control: no-store`. Jika backend tidak dapat dibaca,
  perilaku browser gagal tertutup (iklan mati).
- Pengaturan ini bukan endpoint admin dan tidak menerima perubahan melalui
  HTTP. Ubah environment melalui pengelolaan server yang berwenang. Pada fase
  ini nilainya wajib tetap `false`; sebelum mengaktifkan di fase berikutnya,
  tinjau skrip penyedia, consent, CSP, serta pengujian.
- `ADS_ENABLED=true` sendiri tidak memasang iklan: daftar skrip penyedia masih
  kosong dan aturan afiliasi contoh tidak pernah ditampilkan. Jangan
  mengubahnya menjadi `true` sebelum ada jaringan/merchant yang disetujui.

## Slot iklan dan tata letak

Konfigurasi tunggal ada di `data/ads/slots.json`. Slot sekarang ada pada
halaman inti:

| ID | Posisi | Ukuran minimum desktop | Ukuran minimum mobile |
| --- | --- | ---: | ---: |
| `tool-top` | Di bawah judul alat, sebelum formulir | 90 px | 90 px |
| `tool-sidebar` | Sisi kanan, desktop saja | 250 px | tersembunyi |
| `results-bottom` | Setelah hasil, sebelum bagian berikutnya | 100 px | 100 px |

Slot tidak boleh diletakkan di antara input, di antara input dan tombol hitung,
atau tepat di bawah tombol hitung. Slot tetap berupa placeholder dan selalu
memesan ukuran saat iklan mati/tidak disetujui. Label “Iklan” ditampilkan.
Jangan memasang pop-under, interstitial, sticky overlay, atau slot yang
menggeser fokus/alur hitung.

## Persetujuan dan pemuatan skrip

- Cookie `jb_consent` menyimpan hanya versi dan pilihan `necessary`,
  `analytics`, serta `ads`; `necessary` selalu benar. Cookie berlaku 180 hari,
  `SameSite=Lax`, `Path=/`, dan memakai `Secure` di HTTPS.
- Tidak ada pilihan tersimpan berarti banner muncul. “Tolak opsional” dan
  “Terima semua” sejajar; “Atur pilihan” membuka kontrol per kategori.
- Footer menyediakan “Ubah pilihan cookie”. Persetujuan saat ini disimpan di
  perangkat browser; tabel `consents` tetap menjadi titik sambung untuk
  autentikasi kelak, namun tidak disentuh di addendum ini.
- Skrip hanya boleh dimuat melalui `loadAdScripts()` jika backend mengirim
  `adsEnabled: true` **dan** cookie berisi `ads: true`. Semua skrip wajib HTTPS
  dan terdaftar eksplisit. Daftar skrip saat ini kosong; tidak ada provider.
- Font eksternal dihapus agar halaman tidak membuat koneksi pihak ketiga sebelum
  persetujuan.

## Afiliasi dan privasi input

`AffiliateSlot` mencocokkan aturan dan hasil kalkulasi di browser. Aturan contoh
ada di `data/affiliate/rules.example.json` untuk pengujian kebijakan, bukan
merchant atau iklan sungguhan, dan tidak dirender. Slot hanya dapat dirender
setelah consent iklan dan `ADS_ENABLED` backend aktif serta aturan noncontoh
yang sah tersedia. Semua tautan wajib memakai `rel="sponsored noopener"`.

Tidak ada `fetch`, beacon, analytics event, atau URL tracking dari slot yang
mengandung input atau hasil hitung. Jangan mengirim data kalkulasi ke merchant.
Alat finansial, termasuk KPR dan kendaraan, hanya boleh diarahkan ke mitra
berizin OJK yang status izin dan produknya sudah diverifikasi sebelum aturan
afiliasi noncontoh dibuat.

## Kebijakan kategori iklan terlarang

`data/ads/blocked-categories.json` adalah satu-satunya sumber daftar blokir.
Pornografi/konten dewasa serta perjudian (termasuk kasino, taruhan olahraga,
togel, slot, dan poker) dilarang. `validateAdPolicy()` memeriksa kategori,
teks/kata kunci, URL tujuan HTTPS, domain, ID duplikat, serta batas hasil.
`npm run build` menjalankan validator; pelanggaran membuat proses build gagal.
Komponen juga tidak merender aturan yang memiliki temuan kebijakan.

Saringan di situs **tidak cukup** untuk iklan yang ditayangkan jaringan.
Sebelum mendaftar atau mengaktifkan jaringan pascarilis, kategori dewasa/
pornografi dan perjudian wajib dimatikan di dasbor jaringan. Gunakan laporan
iklan pada `/lapor-iklan`; alamat penerima opsional dikonfigurasi melalui
`PUBLIC_AD_REPORT_EMAIL`. Tanpa alamat itu, pengguna dapat menyalin laporan
untuk dikirim melalui saluran internal yang tersedia.

Setiap temuan setelah go-live harus dicatat dengan kategori, halaman, jaringan,
tanggal, dan tangkapan layar; laporkan ke jaringan lalu blokir domain/URL
pengiklan melalui Blocking Controls atau fitur setara. Target waktu pemblokiran
adalah 48 jam.

## Verifikasi dan status

Paket otomatis memeriksa kebijakan afiliasi, konfigurasi backend, cookie,
responsivitas slot, aksesibilitas banner, dan lalu lintas browser. Jalankan:

```sh
npm run check
npm run test:e2e
```

Uji layout shift mengamati CLS selama pemuatan halaman di lebar 320, 768, dan
1280 px; batas penerimaan adalah `0.1`. Tes jaringan memeriksa tidak adanya
permintaan lintas-origin sebelum consent dan setelah penolakan. Tes privasi
memasukkan nominal serta tingkat persentase lalu memastikan permintaan browser
tidak berisi input/hasil tersebut. Pemeriksaan juga memastikan slot tidak
berada dalam formulir input.

## Kriteria selesai

- [x] Tiga slot placeholder dan tata letak responsif (desktop/mobile).
- [x] `ADS_ENABLED=false` default berasal dari backend; tidak ada skrip provider.
- [x] Consent perluas, tolak/terima, atur, serta tautan ubah pilihan.
- [x] Afiliasi browser-only; contoh diblokir dari rendering dan tidak ada tracking.
- [x] Kebijakan blokir dipakai saat build dan oleh komponen.
- [x] Pelaporan iklan memiliki halaman dan draf email yang dikonfigurasi.
- [x] Dokumentasi prosedur pascarilis dan larangan kategori jaringan.
- [ ] Pengukuran CLS dan aksesibilitas E2E: hasil aktual dicatat setelah
  `npm run test:e2e` berhasil dijalankan di lingkungan browser.

Kriteria terakhir sengaja belum dinyatakan lulus sampai tes berjalan pada browser.
