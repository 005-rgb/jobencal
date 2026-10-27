# Fase 1.5 — Harga jual dan margin

## Cakupan

Modul `/modul/harga-jual-margin` menyediakan tiga mode:

- **Target margin:** laba bersih dibagi omzet setelah diskon.
- **Target markup:** laba bersih dibagi biaya dasar / HPP.
- **Cek harga jual:** analisis harga yang sudah ada, termasuk laba negatif.

Semua perhitungan memakai biaya dan persentase dari pengguna. Tidak ada tarif
pajak atau marketplace bawaan, dan hasil pajak bukan nasihat atau kalkulasi
pajak resmi.

## Dasar rumus

Notasi:

- `C`: biaya dasar / HPP.
- `K`: biaya tetap tambahan per transaksi.
- `d`: diskon dari harga tertera.
- `f`: biaya platform dari omzet setelah diskon.
- `t`: pajak input pengguna dari omzet setelah diskon.
- `m`: target margin atas omzet setelah diskon.
- `u`: target markup atas biaya dasar.
- `B`: 10.000 basis point per 100%.
- `P`: harga tertera dan `S = P − diskon` omzet setelah diskon.

Laba bersih dihitung sebagai `S − biaya platform − pajak − C − K`.

Harga sebelum pembulatan dihitung dengan aritmetika rasional:

- Margin: `(C + K) × B² ÷ ((B − d) × (B − f − t − m))`
- Markup: `(C × (B + u) + K × B) × B ÷ ((B − d) × (B − f − t))`

Harga hasil dibulatkan ke atas ke Rupiah utuh. Diskon, biaya platform, dan
pajak dihitung terpisah atas dasar yang ditampilkan, lalu dibulatkan
half-away-from-zero ke Rupiah utuh. Hasil selalu menampilkan rasio margin dan
markup aktual, sehingga dampak pembulatan terlihat. Target yang memiliki
pembagi nol atau negatif ditolak dengan alasan.

Diskon 100% hanya dapat dianalisis pada mode cek harga; tidak dapat digunakan
untuk mencari harga target. Margin target harus kurang dari 100% setelah
memperhitungkan biaya platform dan pajak. Markup boleh lebih dari 100%.

## Privasi, UI, dan verifikasi

Formulir, hasil, salin, bagikan, dan cetak/PDF berjalan di browser. Komponen ini
tidak mengirim input atau hasil ke API, URL, atau analitik. Layout satu kolom
di layar sempit dan menguji lebar minimum 320 px.

Tujuh fixture aritmetika versi `1.5.0` berada di
`packages/engine/src/fixtures/phase-1-5-price-margin-vectors.json`. Fixture
mencakup margin dan markup terpisah, target nol, diskon/biaya opsional,
pajak input, pembagi tidak mungkin, laba negatif, dan pembulatan harga.
Pembanding fixture adalah perhitungan persamaan matematika, tanpa sumber tarif
eksternal.

**Batas status:** kalkulator dan fixture tersedia, tetapi fixture belum
ditinjau manusia kedua. Sesuai gerbang adendum Fase 1, jangan menyebut subfase
ini lulus review independen formal sampai pemeriksaan kedua dicatat.
