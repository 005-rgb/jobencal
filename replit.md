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

## Search indexing and Google Search Console

- The canonical production origin is `https://jobenapp.cloud`. Keep generated
  canonical links, `robots.txt`, and sitemap locations on this origin.
- `apps/web/public/robots.txt` allows crawling and points to `/sitemap.xml`.
  The generated sitemap contains the home page, the interactive core demo, and
  only tool pages whose calculators are implemented. Do not block placeholder
  pages in `robots.txt`: Google must be able to crawl them to read their
  `noindex` directive.
- The indexed-tool allowlist lives beside the tool catalogue. When a planned
  tool passes its release gate, update that allowlist and verify its page before
  adding it to the sitemap.
- Search Console is not connected to this Replit workspace. Add a **Domain**
  property for `jobenapp.cloud` in Google Search Console and verify it by adding
  Google's TXT record at the DNS provider. Do not put verification records or
  account credentials in the repository.
- After building and deploying the site to cPanel, submit `sitemap.xml` in
  Search Console and inspect the homepage plus each active module URL. Review
  the Search results report by query and page; export clicks, impressions,
  CTR, and position for a consistent date range to establish a baseline.
- The live host was observed to serve HTTP and `www` variants as separate
  successful responses. Canonical tags signal the preferred HTTPS non-`www`
  URLs, but they do not replace server redirects. Normalize these variants to
  `https://jobenapp.cloud` in the cPanel/Apache host configuration. The
  deployment script preserves the server-owned `.htaccess`, so this redirect
  cannot be safely applied from the Replit source alone.

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

## Production release to cPanel

The production Passenger app serves both the built Astro site and the Express
API from the domain root. The cPanel app uses Node.js 22, Production mode,
application root `public_html/jobenapp`, and startup file `app.js`.

1. In Replit, run `npm run build`. This creates the deployable site and API
   outputs in `apps/web/dist/` and `apps/api/dist/`.
2. Commit and push those build outputs to the GitHub branch used by cPanel.
   They are intentionally allowed by `.gitignore`; cPanel does not build.
3. In cPanel's Node.js App settings, set `NODE_ENV=production`,
   `DATABASE_URL` and `BASE_PATH=/api`. Keep credentials in cPanel's
   environment-variable settings, not in Git or a `.env` file under
   `public_html`. `ADS_ENABLED` can remain `false`.
4. Run **NPM Install** in cPanel on first setup and after dependency changes.
   Then, from the application root, run `bash deploy.sh` (or
   `bash deploy.sh main` for the `main` branch).
5. Check `https://jobenapp.cloud/` and
   `https://jobenapp.cloud/api/v1/health` after Passenger restarts.

`deploy.sh` pulls the selected GitHub branch, checks for committed build
outputs and runtime dependencies, and requests a Passenger restart. It does
not build, install packages, migrate, or seed. Review and back up the cPanel
PostgreSQL database before running any schema migration separately. The
script preserves server `.env` and `.htaccess` files and does not run
`git clean`.

See [`doc/FASE1_0_CORE_SYSTEM.md`](doc/FASE1_0_CORE_SYSTEM.md) for the
implemented calculation contract and the boundary between the core demo and
the 12 calculator modules that remain unverified.
See [`doc/FASE1_1_PAYROLL_ENGINE.md`](doc/FASE1_1_PAYROLL_ENGINE.md) for the
payroll engine, gated input/report flow, and evidence required for publication.
See [`doc/FASE1_5_HARGA_JUAL_MARGIN.md`](doc/FASE1_5_HARGA_JUAL_MARGIN.md) for
the local-only price/margin calculator, formulas, rounding, fixture coverage,
and independent-review limitation.
