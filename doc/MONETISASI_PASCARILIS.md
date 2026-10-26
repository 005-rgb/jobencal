# Monetisasi JOBENAPP — Pekerjaan pascarilis

Fase 0-M hanya memasang kerangka aman. Jangan mengaktifkan monetisasi sampai
domain final, kebijakan jaringan, dan persetujuan pengguna ditinjau.

| Pekerjaan | Kapan |
| --- | --- |
| Uji satu jaringan iklan di staging dan ukur Lighthouse/CLS | Fase 3 |
| Pendaftaran provider, publisher ID, `ads.txt` final, dan CMP/TCF | Setelah go-live dan domain final |
| Matikan kategori dewasa/pornografi dan perjudian pada dashboard jaringan; verifikasi iklan aktual | Setiap jaringan sebelum aktif |
| Merchant afiliasi nyata dan disclosure final, mulai dari satu alat | Setelah go-live |
| Evaluasi RPM per kategori dan pergantian jaringan | Fase 6 |
| Media kit dari analytics yang telah disetujui, serta BuySellAds | Setelah trafik nyata mencapai sasaran |

## Pemantauan mutu iklan bulanan

Mulai setelah jaringan aktif; lakukan lebih sering pada bulan pertama:

1. Buka halaman utama dan tiap halaman alat di ponsel dan desktop dengan consent
   iklan diberikan; muat ulang beberapa kali.
2. Catat kategori, halaman, jaringan, waktu, dan bukti tangkapan layar untuk
   iklan yang melanggar kebijakan.
3. Laporkan ke jaringan dan blokir URL/domain pengiklan di Blocking Controls.
4. Pastikan setelan kategori terlarang masih dinonaktifkan di dashboard provider.
5. Tinjau peringatan kebijakan provider.
6. Matikan format yang terus bocor, termasuk pop-under atau push notification.

Catat jumlah iklan terlarang yang ditemukan, waktu hingga diblokir (target
48 jam), RPM, keluhan, dan skor Lighthouse/CLS. Jika iklan terlarang muncul
selama dua bulan berturut-turut setelah pemblokiran, evaluasi pergantian provider
atau matikan format yang bocor.
