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

The Phase 1.1 payroll calculation engine is implemented with synthetic
arithmetic regression vectors and a detailed result contract. It is not ready
to calculate real salaries: reviewed, effective PPh 21 and BPJS rule datasets
are intentionally not included. See
[`doc/FASE1_1_PAYROLL_ENGINE.md`](doc/FASE1_1_PAYROLL_ENGINE.md).

The Phase 1.5 price and margin calculator is available at
`/modul/harga-jual-margin`. It keeps margin separate from markup and uses
user-entered discounts and fees. Its arithmetic fixtures still need a second
human review before this subphase can be called independently verified. See
[`doc/FASE1_5_HARGA_JUAL_MARGIN.md`](doc/FASE1_5_HARGA_JUAL_MARGIN.md).

The Phase 1.8 vehicle-installment simulator is available at
`/modul/cicilan-kendaraan`. It supports an annuity, flat, or effective schedule,
separates down payment and individually entered costs, and permits each cost to
be paid upfront or included in the financed principal. Rates and product costs
are user assumptions, not lender quotes. Ten schedules are compared against an
independent exact-rational reference; an independent human review is still
required before calling the phase fully verified. See
[`doc/FASE1_8_CICILAN_KENDARAAN.md`](doc/FASE1_8_CICILAN_KENDARAAN.md).

The Phase 1.9 Indonesian number-to-words tool is available at `/modul/terbilang`.
It supports negative values, exact decimal digit reading, Rupiah wording, and a
fixed 18-digit integer limit. Its 57 static gold vectors are checked in, but an
independent language review is still required before the phase can be declared
fully verified. See [`doc/FASE1_9_TERBILANG.md`](doc/FASE1_9_TERBILANG.md).

The Phase 1.11 invoice and receipt builder is available at
`/modul/invoice-kwitansi`. It calculates line totals locally using integer
arithmetic and offers browser print-to-PDF. It does not apply taxes or claim to
be a tax invoice. Chromium PDF output is checked; independent fixture review and
cross-browser print review are still required for formal phase acceptance. See
[`doc/FASE1_11_INVOICE_KWITANSI.md`](doc/FASE1_11_INVOICE_KWITANSI.md).
