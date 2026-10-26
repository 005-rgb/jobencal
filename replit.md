# JOBENAPP on Replit

## Development

- Runtime: Node.js 22 LTS (22.23.4 target).
- Run the Replit **Start application** workflow, or run `npm run dev`.
- Astro preview: port 5000. Express API: port 3001; Astro proxies `/api` to it.
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
