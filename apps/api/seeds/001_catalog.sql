INSERT INTO categories (slug, name, summary, sort_order) VALUES
  ('pajak-gaji', 'Pajak & Gaji', 'Kalkulator pajak dan penghasilan.', 1),
  ('keuangan', 'Keuangan', 'Simulasi cicilan dan pembiayaan.', 2),
  ('usaha', 'Usaha', 'Perhitungan biaya, harga, dan kelayakan usaha.', 3),
  ('marketplace', 'Marketplace', 'Perkiraan biaya berjualan online.', 4),
  ('teks', 'Teks', 'Alat bantu angka dan dokumen.', 5),
  ('berkas', 'Berkas', 'Pemrosesan foto dan PDF di perangkat.', 6),
  ('kalender', 'Kalender', 'Tanggal libur dan cuti bersama.', 7)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order;

INSERT INTO tools (category_id, slug, name, summary, engine_key, sort_order)
SELECT c.id, v.slug, v.name, v.summary, v.engine_key, v.sort_order
FROM (VALUES
  ('pajak-gaji', 'gaji-bersih', 'Gaji Bersih', 'Estimasi gaji setelah pajak dan iuran yang berlaku.', 'gaji-bersih', 1),
  ('pajak-gaji', 'pph21-freelancer', 'PPh 21 Freelancer', 'Estimasi PPh 21 sesuai klasifikasi penerima.', 'pph21-freelancer', 2),
  ('keuangan', 'simulasi-kpr', 'Simulasi KPR', 'Bandingkan anuitas, flat, efektif, dan bunga berjenjang.', 'simulasi-kpr', 1),
  ('usaha', 'kalkulator-hpp', 'Kalkulator HPP', 'Hitung biaya pokok berdasarkan biaya produksi.', 'kalkulator-hpp', 1),
  ('usaha', 'harga-jual-margin', 'Harga Jual & Margin', 'Hitung harga jual dari biaya dan target margin.', 'harga-jual-margin', 2),
  ('usaha', 'break-even-point', 'Break-even Point', 'Hitung titik impas berdasarkan biaya tetap dan kontribusi.', 'break-even-point', 3),
  ('marketplace', 'biaya-marketplace', 'Biaya Marketplace', 'Rinci komponen biaya menurut kebijakan platform.', 'biaya-marketplace', 1),
  ('keuangan', 'cicilan-kendaraan', 'Cicilan Kendaraan', 'Simulasikan angsuran dan biaya kendaraan.', 'cicilan-kendaraan', 2),
  ('teks', 'terbilang', 'Terbilang', 'Ubah angka rupiah menjadi kata-kata.', 'terbilang', 1),
  ('berkas', 'kompres-foto-pdf', 'Kompres Foto & PDF', 'Proses berkas di browser tanpa mengunggahnya ke server.', 'kompres-foto-pdf', 1),
  ('usaha', 'invoice-kwitansi', 'Invoice & Kwitansi', 'Buat dokumen transaksi dan unduh hasilnya.', 'invoice-kwitansi', 4),
  ('kalender', 'kalender-libur', 'Kalender Libur', 'Lihat libur nasional dan cuti bersama.', 'kalender-libur', 1)
) AS v(category_slug, slug, name, summary, engine_key, sort_order)
JOIN categories c ON c.slug = v.category_slug
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  summary = EXCLUDED.summary,
  engine_key = EXCLUDED.engine_key,
  sort_order = EXCLUDED.sort_order;
