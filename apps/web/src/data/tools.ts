export interface JobenTool {
  readonly slug: string;
  readonly phase: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly icon: string;
  readonly tone: string;
}

export const tools: readonly JobenTool[] = [
  {
    slug: "gaji-bersih",
    phase: "1.1",
    name: "Gaji Bersih",
    category: "Pajak & gaji",
    description: "Estimasi gaji setelah PPh 21 TER dan iuran BPJS yang berlaku.",
    icon: "M12 2v20m5-15H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
    tone: "violet",
  },
  {
    slug: "pph-21-freelancer",
    phase: "1.2",
    name: "PPh 21 Freelancer",
    category: "Pajak & gaji",
    description: "Perhitungan pajak tenaga ahli sesuai klasifikasi dan cara pembayaran.",
    icon: "M8 7V3m8 4V3M5 11h14M6 5h12a2 2 0 0 1 2 2v12H4V7a2 2 0 0 1 2-2Z",
    tone: "blue",
  },
  {
    slug: "simulasi-kpr",
    phase: "1.3",
    name: "Simulasi KPR",
    category: "Keuangan",
    description: "Simulasikan anuitas, flat, dan efektif, termasuk bunga berjenjang, biaya, serta pelunasan tambahan.",
    icon: "M3 10.5 12 3l9 7.5M5 9v11h14V9M9 20v-6h6v6",
    tone: "indigo",
  },
  {
    slug: "kalkulator-hpp",
    phase: "1.4",
    name: "Kalkulator HPP",
    category: "Usaha",
    description: "Hitung total biaya batch dan HPP per unit, termasuk susut bahan serta alokasi overhead dan penyusutan.",
    icon: "M4 5h16M4 12h16M4 19h16M8 2v6m8 4v6m-8 1v6",
    tone: "green",
  },
  {
    slug: "harga-jual-margin",
    phase: "1.5",
    name: "Harga Jual & Margin",
    category: "Usaha",
    description: "Tentukan harga jual dengan membedakan margin dan markup.",
    icon: "M20 13 11 4H4v7l9 9a2 2 0 0 0 3 0l4-4a2 2 0 0 0 0-3ZM7.5 7.5h.01",
    tone: "teal",
  },
  {
    slug: "break-even-point",
    phase: "1.6",
    name: "Break-even Point",
    category: "Usaha",
    description: "Cari titik impas dari biaya tetap dan kontribusi per unit.",
    icon: "M3 3v18h18M7 14l4-4 3 3 6-7",
    tone: "orange",
  },
  {
    slug: "biaya-marketplace",
    phase: "1.7",
    name: "Biaya Marketplace",
    category: "Marketplace",
    description: "Rinci biaya berdasarkan platform, kategori, dan program penjual.",
    icon: "M3 8h18l-2 12H5L3 8Zm4 0a5 5 0 0 1 10 0M8 12v.01M16 12v.01",
    tone: "amber",
  },
  {
    slug: "cicilan-kendaraan",
    phase: "1.8",
    name: "Cicilan Kendaraan",
    category: "Keuangan",
    description: "Simulasikan angsuran dengan asumsi bunga dan biaya yang jelas.",
    icon: "M5 17h14l1-7-2-5H6l-2 5 1 7Zm-1-7h16M7 17v2m10-2v2M7 14h.01M17 14h.01",
    tone: "cyan",
  },
  {
    slug: "terbilang",
    phase: "1.9",
    name: "Terbilang",
    category: "Teks",
    description: "Ubah angka menjadi tulisan terbilang untuk kebutuhan dokumen.",
    icon: "M5 4h14M5 10h14M5 16h8M5 22h14",
    tone: "purple",
  },
  {
    slug: "kompres-resize-foto-pdf",
    phase: "1.10",
    name: "Kompres & Resize Foto/PDF",
    category: "Berkas",
    description: "Proses foto dan PDF langsung di browser tanpa unggah berkas.",
    icon: "M4 4h16v16H4zM8 9h.01M20 15l-5-5L5 20",
    tone: "pink",
  },
  {
    slug: "invoice-kwitansi",
    phase: "1.11",
    name: "Invoice & Kwitansi",
    category: "Usaha",
    description: "Buat invoice atau kwitansi umum dengan rincian item dan total Rupiah.",
    icon: "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3",
    tone: "rose",
  },
  {
    slug: "kalender-libur",
    phase: "1.12",
    name: "Kalender Libur",
    category: "Kalender",
    description: "Lihat libur nasional dan cuti bersama berdasarkan keputusan resmi.",
    icon: "M7 3v4m10-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm3 8h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01",
    tone: "slate",
  },
];

export function getToolBySlug(slug: string | null | undefined): JobenTool | undefined {
  return tools.find((tool) => tool.slug === slug);
}
