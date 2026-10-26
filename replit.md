# JOBENAPP on Replit

## Development

- Runtime: Node.js 22 LTS (22.23.4 target).
- Run the Replit **Start application** workflow, or run `npm run dev`.
- Astro preview: port 5000. Express API: port 3001; Astro proxies `/api` to it.
- The Fase 1.0 percentage playground calculates in the browser and does not
  require the API or database. The API still requires a development
  `DATABASE_URL` before its health endpoint can report `db: "ok"`.
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
