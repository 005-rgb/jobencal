# JOBENAPP on Replit

## Development

- Runtime: Node.js 22 LTS (22.23.4 target).
- Run the Replit **Start application** workflow, or run `npm run dev`.
- Astro preview: port 5000. Express API: port 3001; Astro proxies `/api` to it.
- The Fase 1.0 percentage playground calculates in the browser and does not
  require the API or database. The API still requires a development
  `DATABASE_URL` before its health endpoint can report `db: "ok"`.
- The Phase 1.8 vehicle-installment simulator is at
  `/modul/cicilan-kendaraan`. It runs locally in the browser, uses Node 22 as
  declared by the project, and does not need the API or database to calculate.
  It uses user-entered rates and costs only; its ten rational-reference
  fixtures still need independent human review. See
  `doc/FASE1_8_CICILAN_KENDARAAN.md`.
- The Phase 1.9 Indonesian number-to-words tool is at `/modul/terbilang`.
  It runs locally in the browser, supports number and Rupiah wording, uses
  Indonesian dot/comma input, preserves decimal digits without rounding, and
  rejects integer values above 999,999,999,999,999,999. Static golden vectors
  and implementation checks are included; an independent language review is
  still required for formal phase acceptance. See
  `doc/FASE1_9_TERBILANG.md`.
- The Phase 1.11 invoice/receipt builder is at `/modul/invoice-kwitansi`.
  Document math stays in the browser, rounds each item line to whole Rupiah,
  and offers copy, WhatsApp sharing, and browser print-to-PDF. It does not add
  tax, VAT, withholding, or stamp duty and is not a tax invoice. See
  `doc/FASE1_11_INVOICE_KWITANSI.md`; Chromium PDF output is checked, while
  independent fixture and cross-browser print review remain open for formal
  phase acceptance.
- Phase 1.1 includes a browser-local payroll form and reports that can be
  printed or downloaded as CSV after the release gate opens. The gate currently
  stays closed: reviewed effective PPh 21/BPJS datasets and 30 PPh 21/TER plus
  20 BPJS sourced, independently checked fixtures are not present. Synthetic
  math vectors and gate tests are not payroll fixtures.
- Results must not be used for production until they have also been compared
  with anonymized real payslips. Inputs remain in the user's browser.
- Configure `DATABASE_URL` as a Replit development PostgreSQL connection string.
  Never put database credentials in the repository or frontend.
- The Replit database is development-only. Production remains the PostgreSQL
  database on cPanel described in the technical plan.

## Database

1. Configure `DATABASE_URL` in Replit Secrets for the development environment.
2. Run `npm run db:migrate` to apply the checked-in forward migration.
3. Run `npm run db:seed` to add the initial catalog. Seeds do not publish tools
   or create unverified tax, BPJS, bank, or marketplace rates.
4. `GET /api/v1/health` returns HTTP 200 and `db: "ok"` only after a real
   database query succeeds. Startup fails explicitly when configuration or
   connectivity is invalid.

Production cPanel uses its own `DATABASE_URL`; do not point development
migrations at production. Review and take a backup before any production
schema operation.

## Checks

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run check` runs all four checks.

See [`doc/FASE1_0_CORE_SYSTEM.md`](doc/FASE1_0_CORE_SYSTEM.md) for the
implemented calculation contract and the boundary between the core demo and
the 12 calculator modules that remain unverified.
See [`doc/FASE1_1_PAYROLL_ENGINE.md`](doc/FASE1_1_PAYROLL_ENGINE.md) for the
payroll engine, gated input/report flow, and evidence required for publication.
See [`doc/FASE1_5_HARGA_JUAL_MARGIN.md`](doc/FASE1_5_HARGA_JUAL_MARGIN.md) for
the local-only price/margin calculator, formulas, rounding, fixture coverage,
and independent-review limitation.
