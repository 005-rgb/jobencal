# Fase 1.6 — Break-even point (BEP)

## Cakupan dan rumus

Versi metode `business.break-even-point` `1.6.0` menghitung:

- Kontribusi per unit = harga jual per unit − biaya variabel per unit.
- BEP unit matematis = biaya tetap ÷ kontribusi per unit.
- Nilai penjualan pada BEP matematis = BEP unit × harga jual per unit.
- Unit utuh minimum = pembulatan ke atas BEP matematis karena produk dijual
  per unit.
- Nilai penjualan pada unit utuh minimum, serta laba/rugi satu unit sebelum,
  pada, dan satu unit sesudah ambang unit utuh.

Nominal Rupiah divalidasi sebagai bilangan bulat non-negatif maksimal 18 digit
dan dihitung dengan `bigint`; rasio BEP disimpan sebagai pecahan eksak yang
disederhanakan. Tampilan desimal unit hanya untuk keterbacaan dan dibulatkan
half-away-from-zero pada enam angka desimal. Nilai penjualan rasional dibulatkan
half-away-from-zero hanya saat ditampilkan sebagai Rupiah bulat. Unit utuh
dibulatkan ke atas. Luapan hasil ditolak secara eksplisit.

Kontribusi nol atau negatif menghasilkan galat domain `unreachable_break_even`;
engine tidak membagi dengan nol atau memberikan BEP seolah-olah valid. Biaya
tetap nol diterima dan berarti titik impas sudah tercapai pada nol unit.

## Privasi, asumsi, dan UI

Formulir, hasil, salin, bagikan, dan cetak/PDF berjalan di browser. Nilai input
dan hasil tidak dikirim ke API. Pengguna memasukkan biaya tetap satu periode,
harga jual, dan biaya variabel per unit. Metode mengasumsikan seluruh unit
memiliki harga serta biaya variabel yang sama dan tidak memasukkan biaya lain
yang tidak dicatat. Kalkulator tidak memakai tarif eksternal.

Halaman `/modul/break-even-point` menampilkan pecahan eksak beserta desimal
pendek, jumlah unit utuh minimum, nilai penjualan, rincian kontribusi,
laba/rugi sekitar ambang, asumsi, pembulatan, dan versi metode. Layout
menyesuaikan layar kecil dan menyembunyikan formulir ketika dicetak.

## Bukti dan status gerbang

Tujuh fixture aritmetika versi `1.6.0` berada di
`packages/engine/src/fixtures/bep-phase-1-6-math-vectors.json`. Fixture
mencakup kontribusi positif, nol, negatif; biaya tetap nol; BEP integral dan
pecahan; unit minimum hasil pembulatan; pembulatan nilai penjualan; serta
laba/rugi di sekitar ambang. Hasil harapan dihitung terpisah dari implementasi
dengan rumus pembanding manual, bukan tarif eksternal. Fixture diperiksa pada
2026-10-27.

**Batas status:** implementasi, UI, dan fixture tersedia. Tinjauan manusia
kedua belum ditetapkan; jangan klaim gerbang Fase 1.6 telah lulus tinjauan
independen formal sebelum orang lain memeriksa rumus dan seluruh vektor.
