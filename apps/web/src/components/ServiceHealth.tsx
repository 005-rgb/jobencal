import { useEffect, useState } from "preact/hooks";

type HealthState = "checking" | "ready" | "unavailable";

export function ServiceHealth() {
  const [state, setState] = useState<HealthState>("checking");

  useEffect(() => {
    let active = true;
    void fetch("/api/v1/health")
      .then(async (response) => {
        if (!response.ok) throw new Error("Health check failed");
        const result: unknown = await response.json();
        if (
          typeof result === "object" &&
          result !== null &&
          "db" in result &&
          result.db === "ok" &&
          active
        ) {
          setState("ready");
        } else if (active) {
          setState("unavailable");
        }
      })
      .catch(() => {
        if (active) setState("unavailable");
      });

    return () => {
      active = false;
    };
  }, []);

  const message = {
    checking: "Memeriksa layanan dan koneksi database…",
    ready: "Layanan pengembangan siap; koneksi PostgreSQL terverifikasi.",
    unavailable: "Layanan atau database belum tersedia. Periksa konfigurasi sebelum memakai aplikasi.",
  }[state];

  return (
    <div class="health-card" role="status" aria-live="polite">
      <p>{message}</p>
    </div>
  );
}
