import { describe, expect, it } from "vitest";
import vectors from "./fixtures/marketplace-phase-1-7-vectors.json" with {
  type: "json",
};
import {
  calculateMarketplaceFee,
  MARKETPLACE_DYNAMIC_CATEGORIES,
  MarketplaceFeeCalculationError,
  type MarketplaceFeeInput,
} from "./marketplace.js";

interface MarketplaceFixture {
  readonly id: string;
  readonly input: Record<string, string>;
  readonly expected?: {
    readonly policyVersion: string;
    readonly feePerUnitRupiah: string;
    readonly subtotalRupiah: string;
    readonly capApplied: boolean;
  };
  readonly expectedError?: string;
}

function hydrate(fixture: MarketplaceFixture): MarketplaceFeeInput {
  const input = fixture.input;
  if (input.platform === "shopee") {
    return {
      platform: "shopee",
      orderDate: input.orderDate!,
      sellerType: input.sellerType as
        | "non_star"
        | "star"
        | "star_plus"
        | "mall",
      firstProductListedDate: input.firstProductListedDate!,
      previousCompletedOrders: BigInt(input.previousCompletedOrders!),
      orderStatus: input.orderStatus as
        | "completed"
        | "cancelled"
        | "not_delivered",
    };
  }
  return {
    platform: input.platform as "tokopedia" | "tiktok_shop",
    asOfDate: input.asOfDate!,
    categoryId: input.categoryId!,
    itemPriceRupiah: BigInt(input.itemPriceRupiah!),
    sellerDiscountRupiah: BigInt(input.sellerDiscountRupiah!),
    quantity: BigInt(input.quantity!),
    orderStatus: input.orderStatus as
      | "delivered"
      | "returned_after_delivery"
      | "undelivered_refunded",
  };
}

describe("calculateMarketplaceFee", () => {
  it("matches at least 20 independently calculated platform fee fixtures", () => {
    const cases = vectors.cases as readonly MarketplaceFixture[];
    expect(cases.length).toBeGreaterThanOrEqual(20);

    for (const fixture of cases) {
      if (fixture.expectedError) {
        expect(
          () => calculateMarketplaceFee(hydrate(fixture)),
          fixture.id,
        ).toThrowError(
          expect.objectContaining({ code: fixture.expectedError }),
        );
        continue;
      }

      const calculation = calculateMarketplaceFee(hydrate(fixture));
      expect(calculation.method.version, fixture.id).toBe("1.7.0");
      expect(calculation.policy.version, fixture.id).toBe(
        fixture.expected!.policyVersion,
      );
      expect(calculation.policy.status, fixture.id).toBe("provisional");
      expect(calculation.policy.secondReviewNeeded, fixture.id).toBe(true);
      expect(calculation.subtotalRupiah.toString(), fixture.id).toBe(
        fixture.expected!.subtotalRupiah,
      );
      expect(
        calculation.lines[0]!.feePerUnitRupiah.toString(),
        fixture.id,
      ).toBe(fixture.expected!.feePerUnitRupiah);
      expect(calculation.lines[0]!.capApplied, fixture.id).toBe(
        fixture.expected!.capApplied,
      );
      expect(calculation.warnings.join(" "), fixture.id).toMatch(
        /bukan total seluruh biaya marketplace/i,
      );
    }
  });

  it("provides exactly the policy-backed dynamic commission categories", () => {
    expect(MARKETPLACE_DYNAMIC_CATEGORIES).toHaveLength(30);
    expect(
      MARKETPLACE_DYNAMIC_CATEGORIES.every(
        (category) => category.rateBasisPoints > 0n,
      ),
    ).toBe(true);
  });

  it("rejects an unrecognized transaction status and out-of-range money", () => {
    const base = hydrate(vectors.cases[0] as MarketplaceFixture);
    expect(() =>
      calculateMarketplaceFee({
        ...base,
        orderStatus: "pending" as "delivered",
      }),
    ).toThrowError(MarketplaceFeeCalculationError);
    expect(() =>
      calculateMarketplaceFee({
        ...base,
        itemPriceRupiah: 1_000_000_000_000_000_000n,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "calculation_overflow" }),
    );
  });
});
