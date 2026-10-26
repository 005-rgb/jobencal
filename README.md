# JOBENAPP

JOBENAPP is an Indonesian calculator and tools project. The product and
deployment specification lives in
[`doc/JOBENAPP_Rencana_Teknis_joben.cloud_1793015363469.md`](doc/JOBENAPP_Rencana_Teknis_joben.cloud_1793015363469.md).

## Run in Replit

See [`replit.md`](replit.md) for the development workflow, database setup,
migrations, tests, and production database boundary.

## Current implementation phase

The Phase 1.0 shared calculation core is implemented and locally tested; the
interactive percentage demo uses exact integer arithmetic and does not send
inputs to the API. This does **not** mean the 12 production calculator flows
(Phase 1.1–1.12) are complete. No unverified tax, insurance, bank, or
marketplace rates are published. The homepage is a tool catalogue; each of the
12 tools has a separate status page, and the Phase 1.0 demo is available at
`/demo-mesin-hitung`. Status pages do not count as completed calculators. See
[`doc/FASE1_0_CORE_SYSTEM.md`](doc/FASE1_0_CORE_SYSTEM.md) for scope and
evidence, and [`doc/FASE0_VERIFICATION.md`](doc/FASE0_VERIFICATION.md) for
staging blockers.
