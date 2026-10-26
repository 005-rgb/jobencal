# Laporan verifikasi Fase 0

**Tanggal:** 26 Oktober 2026  
**Status:** Fondasi lokal selesai dan terverifikasi. Uji kelayakan cPanel
masih **terblokir** sampai akses staging tersedia.

## Bukti lokal

| Kriteria | Hasil |
| --- | --- |
| Instalasi bersih | `npm ci` berhasil dengan Node.js 22.23.4 dan npm 10.9.9 dalam sekitar 10 detik; 0 kerentanan dilaporkan npm. |
| Lint, tipe, tes, build | `npm run check` lulus: lint bersih, Astro check tanpa error/peringatan/hint, 22 tes dari 4 berkas lulus, dan build statis selesai. |
| CI | `.github/workflows/ci.yml` menjalankan `npm ci` dan `npm run check` untuk push dan pull request dengan Node.js 22. Konfigurasi ditinjau lokal; run GitHub Actions tidak diklaim. |
| API dan database development | `GET /api/v1/health` melalui Astro proxy mengembalikan HTTP 200 dengan `status: ok` dan `db: ok`. Beranda mengembalikan HTTP 200. |
| Migrasi dan seed development | Menurut laporan pengguna, `001_init.sql` dan seed katalog sudah berhasil di database development tanpa menambahkan atau menerbitkan tarif. Tidak dijalankan ulang selama verifikasi ini. |
| Komponen UI | Button, Field, RupiahInput, Table, dan Toast memiliki tes; tes axe untuk WCAG A/AA lulus tanpa pelanggaran. |
| Halaman dan aksesibilitas | Beranda diperiksa pada lebar 320, 768, dan 1280 px. Pemeriksaan axe pada halaman tidak menemukan pelanggaran WCAG A/AA (16 pemeriksaan lulus). Favicon SVG tersedia agar browser tidak meminta favicon yang hilang. |
| Runtime lokal | Astro dev melaporkan siap dalam 385 ms pada restart akhir. Satu benchmark lokal `crypto.scrypt` (N=32768, r=8, p=3) selesai dalam 179,1 ms. Keduanya hasil lokal, bukan hasil Passenger/cPanel. |
| Memori proses lokal | Snapshot RSS dev: Astro sekitar 307 MB; API melalui `tsx watch` sekitar 71 MB untuk watcher dan 89 MB untuk proses Node. Ini bukan estimasi memori produksi/Passenger. |
| Pemasangan `BASE_PATH` | Tes otomatis mencakup jalur nested dan jalur tanpa prefix pada aplikasi lokal. Tes ini tidak membuktikan bagaimana Passenger staging meneruskan atau menghapus prefix. |

## Masih terblokir: verifikasi staging cPanel

Belum ada akses ke staging cPanel dalam sesi ini. Karena itu, kriteria berikut
belum boleh dinyatakan lulus:

- `GET /api/v1/health` pada staging dengan HTTP 200 dan `db: "ok"`.
- Perilaku `BASE_PATH` melalui Passenger pada staging.
- Waktu mulai dingin dan memori proses Passenger di hosting cPanel.
- Hasil hash scrypt pada lingkungan cPanel.
- Migrasi `001_init.sql` dan seed katalog pada database staging.

Hasil pengukuran Replit/local di atas tidak menggantikan pengujian staging.
Tidak ada kalkulator Fase 1 yang diklaim selesai.
