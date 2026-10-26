import { useState } from "preact/hooks";
import type { TargetedSubmitEvent } from "preact";

interface Props {
  recipient: string;
}

export default function AdReportForm({ recipient }: Props) {
  const [pageUrl, setPageUrl] = useState("");
  const [category, setCategory] = useState("lainnya");
  const [description, setDescription] = useState("");
  const [reportText, setReportText] = useState("");
  const [status, setStatus] = useState("");

  function handleSubmit(event: TargetedSubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const report = [
      "Laporan iklan tidak pantas — JOBENAPP",
      `Halaman: ${pageUrl.trim()}`,
      `Kategori: ${category}`,
      "",
      description.trim(),
    ].join("\n");
    setReportText(report);

    if (!recipient.trim()) {
      setStatus(
        "Alamat pelaporan belum dikonfigurasi. Salin laporan ini dan kirim melalui saluran internal.",
      );
      return;
    }

    const subject = encodeURIComponent("Laporan iklan tidak pantas — JOBENAPP");
    const body = encodeURIComponent(report);
    window.location.href = `mailto:${encodeURIComponent(recipient.trim())}?subject=${subject}&body=${body}`;
    setStatus("Draf email laporan telah disiapkan.");
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText);
      setStatus("Laporan berhasil disalin.");
    } catch {
      setStatus("Clipboard tidak tersedia. Pilih dan salin laporan secara manual.");
    }
  }

  return (
    <form class="ad-report-form" onSubmit={handleSubmit}>
      <label>
        <span>Alamat halaman yang menampilkan iklan</span>
        <input
          required
          type="url"
          inputMode="url"
          placeholder="https://"
          value={pageUrl}
          onInput={(event) =>
            setPageUrl((event.currentTarget as HTMLInputElement).value)
          }
        />
      </label>
      <label>
        <span>Jenis masalah</span>
        <select
          value={category}
          onChange={(event) =>
            setCategory((event.currentTarget as HTMLSelectElement).value)
          }
        >
          <option value="konten dewasa">Konten dewasa</option>
          <option value="perjudian">Perjudian</option>
          <option value="menyesatkan">Menyesatkan atau berbahaya</option>
          <option value="lainnya">Lainnya</option>
        </select>
      </label>
      <label>
        <span>Jelaskan iklan yang terlihat</span>
        <textarea
          required
          rows={5}
          maxLength={2000}
          value={description}
          onInput={(event) =>
            setDescription((event.currentTarget as HTMLTextAreaElement).value)
          }
        />
        <small>Jangan sertakan data keuangan atau informasi pribadi.</small>
      </label>
      <button class="ad-report-submit" type="submit">
        Buat laporan
      </button>
      {status && (
        <p class="ad-report-status" role="status">
          {status}
        </p>
      )}
      {reportText && (
        <button class="ad-report-copy" type="button" onClick={copyReport}>
          Salin laporan
        </button>
      )}
    </form>
  );
}
