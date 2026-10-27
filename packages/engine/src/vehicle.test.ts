import { describe, expect, it } from "vitest";
import vectors from "./fixtures/vehicle-phase-1-8-math-vectors.json" with {
  type: "json",
};
import {
  calculateVehicleInstallment,
  VehicleInstallmentCalculationError,
  type VehicleInstallmentInput,
} from "./vehicle.js";

interface Fixture {
  readonly id: string;
  readonly input: {
    readonly price: string;
    readonly down: string;
    readonly months: number;
    readonly model: "annuity" | "flat" | "effective";
    readonly rate: string;
    readonly costs?: Record<
      string,
      { readonly amount: string; readonly payment: "upfront" | "financed" }
    >;
  };
  readonly expected: Record<string, string>;
}

function hydrate(fixture: Fixture): VehicleInstallmentInput {
  return {
    vehiclePriceRupiah: BigInt(fixture.input.price),
    downPaymentRupiah: BigInt(fixture.input.down),
    termMonths: fixture.input.months,
    model: fixture.input.model,
    annualRateBasisPoints: BigInt(fixture.input.rate),
    ...(fixture.input.costs
      ? {
          costs: Object.fromEntries(
            Object.entries(fixture.input.costs).map(([key, value]) => [
              key,
              {
                amountRupiah: BigInt(value.amount),
                payment: value.payment,
              },
            ]),
          ),
        }
      : {}),
  };
}

describe("Phase 1.8 vehicle-installment independent math fixtures", () => {
  const fixtures = vectors.cases as readonly Fixture[];

  it("matches ten independent rational-reference scenarios", () => {
    expect(fixtures).toHaveLength(10);
    expect(vectors.reference.reviewStatus).toContain(
      "human review still required",
    );

    for (const fixture of fixtures) {
      const result = calculateVehicleInstallment(hydrate(fixture));
      expect(result.method.key, fixture.id).toBe(
        "vehicle.installment-simulation",
      );
      expect(result.method.version, fixture.id).toBe("1.0.0");
      expect(result.totals.principalRupiah.toString(), fixture.id).toBe(
        fixture.expected.principal,
      );
      expect(result.totals.interestRupiah.toString(), fixture.id).toBe(
        fixture.expected.interest,
      );
      expect(result.totals.installmentsRupiah.toString(), fixture.id).toBe(
        fixture.expected.installments,
      );
      expect(result.totals.firstInstallmentRupiah.toString(), fixture.id).toBe(
        fixture.expected.first,
      );
      expect(result.totals.lastInstallmentRupiah.toString(), fixture.id).toBe(
        fixture.expected.last,
      );
      expect(result.totals.cashAtSigningRupiah.toString(), fixture.id).toBe(
        fixture.expected.cashAtSigning,
      );
      expect(result.totals.totalCashOutflowRupiah.toString(), fixture.id).toBe(
        fixture.expected.totalOutflow,
      );
      expect(result.schedule.at(-1)?.closingBalanceRupiah).toBe(0n);
      expect(
        result.schedule.reduce((sum, row) => sum + row.principalRupiah, 0n),
      ).toBe(result.financedPrincipalRupiah);
      expect(
        result.schedule.reduce((sum, row) => sum + row.interestRupiah, 0n),
      ).toBe(result.totals.interestRupiah);
    }
  });

  it("shows the three selected amortization methods as distinct schedules", () => {
    const base = {
      vehiclePriceRupiah: 1_200_000n,
      downPaymentRupiah: 0n,
      termMonths: 4,
      annualRateBasisPoints: 1_200n,
    };
    const totals = (["annuity", "flat", "effective"] as const).map((model) =>
      calculateVehicleInstallment({ ...base, model }).totals.interestRupiah,
    );
    expect(totals).toEqual([30_150n, 48_000n, 30_000n]);
  });
});

describe("Vehicle installment input boundaries", () => {
  const valid: VehicleInstallmentInput = {
    vehiclePriceRupiah: 12_000_000n,
    downPaymentRupiah: 2_000_000n,
    termMonths: 12,
    model: "annuity",
    annualRateBasisPoints: 1_200n,
  };

  it("rejects a down payment above vehicle price and a zero financed principal", () => {
    expect(() =>
      calculateVehicleInstallment({
        ...valid,
        downPaymentRupiah: valid.vehiclePriceRupiah + 1n,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "invalid_down_payment" }),
    );
    expect(() =>
      calculateVehicleInstallment({
        ...valid,
        downPaymentRupiah: valid.vehiclePriceRupiah,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "invalid_financed_principal" }),
    );
  });

  it("rejects invalid tenor, rate, cost, and overflow explicitly", () => {
    expect(() =>
      calculateVehicleInstallment({ ...valid, termMonths: 0 }),
    ).toThrowError(expect.objectContaining({ code: "invalid_tenor" }));
    expect(() =>
      calculateVehicleInstallment({
        ...valid,
        annualRateBasisPoints: 10_001n,
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_rate" }));
    expect(() =>
      calculateVehicleInstallment({
        ...valid,
        costs: { insurance: { amountRupiah: -1n, payment: "upfront" } },
      }),
    ).toThrowError(VehicleInstallmentCalculationError);
    expect(() =>
      calculateVehicleInstallment({
        ...valid,
        vehiclePriceRupiah: 1_000_000_000_000_000_000n,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "invalid_vehicle_price" }),
    );
  });
});
