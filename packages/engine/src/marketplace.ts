import { roundRatio } from "./money.js";
import policyData from "./data/marketplace-policy-1-7.json" with {
  type: "json",
};

const MAX_RUPIAH = 999_999_999_999_999_999n;
const MAX_QUANTITY = 1_000_000n;
const BASIS_POINTS = 10_000n;
const METHOD_KEY = "marketplace.fee-estimate";
const METHOD_VERSION = "1.7.0";

type DynamicPolicyData = typeof policyData.dynamicCommission;
type ShopeePolicyData = typeof policyData.shopeeOrderProcessing;

export interface DynamicCommissionInput {
  readonly platform: "tokopedia" | "tiktok_shop";
  readonly asOfDate: string;
  readonly categoryId: string;
  readonly itemPriceRupiah: bigint;
  readonly sellerDiscountRupiah: bigint;
  readonly quantity: bigint;
  readonly orderStatus:
    | "delivered"
    | "returned_after_delivery"
    | "undelivered_refunded";
}

export interface ShopeeOrderProcessingInput {
  readonly platform: "shopee";
  readonly orderDate: string;
  readonly sellerType: "non_star" | "star" | "star_plus" | "mall";
  readonly firstProductListedDate: string;
  /** Number of successful orders completed before this order. */
  readonly previousCompletedOrders: bigint;
  readonly orderStatus: "completed" | "cancelled" | "not_delivered";
}

export type MarketplaceFeeInput =
  | DynamicCommissionInput
  | ShopeeOrderProcessingInput;

export interface MarketplaceFeeLine {
  readonly key: string;
  readonly label: string;
  readonly basisRupiah: bigint;
  readonly rateBasisPoints: bigint | null;
  readonly feePerUnitRupiah: bigint;
  readonly quantity: bigint;
  readonly amountRupiah: bigint;
  readonly capRupiah: bigint | null;
  readonly capApplied: boolean;
  readonly taxInclusive: boolean;
  readonly explanation: string;
}

export interface MarketplaceFeeCalculation {
  readonly method: {
    readonly key: typeof METHOD_KEY;
    readonly version: typeof METHOD_VERSION;
    readonly rounding: string;
  };
  readonly input: MarketplaceFeeInput;
  readonly policy: {
    readonly ruleKey: string;
    readonly version: string;
    readonly status: "provisional";
    readonly effectiveFrom: string;
    readonly effectiveTo: string | null;
    readonly checkedAt: string;
    readonly source: {
      readonly title: string;
      readonly url: string;
      readonly reference: string;
    };
    readonly secondReviewNeeded: true;
  };
  readonly lines: readonly MarketplaceFeeLine[];
  readonly subtotalRupiah: bigint;
  readonly assumptions: readonly string[];
  readonly exclusions: readonly string[];
  readonly warnings: readonly string[];
}

export type MarketplaceFeeErrorCode =
  | "invalid_date"
  | "policy_not_effective"
  | "policy_not_verified_for_date"
  | "invalid_money"
  | "invalid_quantity"
  | "invalid_discount"
  | "invalid_order_status"
  | "invalid_seller_type"
  | "invalid_order_count"
  | "invalid_product_date"
  | "unsupported_category"
  | "calculation_overflow";

export class MarketplaceFeeCalculationError extends Error {
  constructor(readonly code: MarketplaceFeeErrorCode, message: string) {
    super(message);
    this.name = "MarketplaceFeeCalculationError";
  }
}

export const MARKETPLACE_DYNAMIC_CATEGORIES = policyData.dynamicCommission
  .categories.map((category) => ({
    id: category.id,
    label: category.label,
    rateBasisPoints: BigInt(category.rateBasisPoints),
  }));

function isISODate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= daysInMonth[month - 1]!;
}

function validatePolicyDate(
  value: string,
  policy: { readonly effectiveFrom: string; readonly checkedAt: string },
): void {
  if (!isISODate(value)) {
    throw new MarketplaceFeeCalculationError(
      "invalid_date",
      "Tanggal transaksi harus berupa tanggal ISO yang valid.",
    );
  }
  if (value < policy.effectiveFrom) {
    throw new MarketplaceFeeCalculationError(
      "policy_not_effective",
      `Kebijakan ini belum berlaku pada ${value}.`,
    );
  }
  if (value > policy.checkedAt) {
    throw new MarketplaceFeeCalculationError(
      "policy_not_verified_for_date",
      `Tarif belum diperiksa untuk tanggal setelah ${policy.checkedAt}.`,
    );
  }
}

function assertMoney(value: bigint, label: string): void {
  if (typeof value !== "bigint" || value < 0n) {
    throw new MarketplaceFeeCalculationError(
      "invalid_money",
      `${label} harus berupa Rupiah utuh dan tidak negatif.`,
    );
  }
  if (value > MAX_RUPIAH) {
    throw new MarketplaceFeeCalculationError(
      "calculation_overflow",
      `${label} melampaui batas Rupiah 18 digit.`,
    );
  }
}

function assertOutput(value: bigint, label: string): bigint {
  if (value < 0n || value > MAX_RUPIAH) {
    throw new MarketplaceFeeCalculationError(
      "calculation_overflow",
      `${label} melampaui batas Rupiah yang didukung.`,
    );
  }
  return value;
}

function policyResult(
  policy: DynamicPolicyData | ShopeePolicyData,
): MarketplaceFeeCalculation["policy"] {
  return {
    ruleKey: policy.ruleKey,
    version: policy.version,
    status: "provisional",
    effectiveFrom: policy.effectiveFrom,
    effectiveTo: policy.effectiveTo,
    checkedAt: policy.checkedAt,
    source: policy.source,
    secondReviewNeeded: true,
  };
}

function result(
  input: MarketplaceFeeInput,
  policy: DynamicPolicyData | ShopeePolicyData,
  lines: readonly MarketplaceFeeLine[],
  assumptions: readonly string[],
  exclusions: readonly string[],
  warnings: readonly string[],
): MarketplaceFeeCalculation {
  const subtotal = lines.reduce((sum, line) => sum + line.amountRupiah, 0n);
  return {
    method: {
      key: METHOD_KEY,
      version: METHOD_VERSION,
      rounding:
        "Estimasi dibulatkan half-away-from-zero per item; cap diterapkan per item sebelum jumlah dikalikan. Aturan pembulatan invoice marketplace tidak dipublikasikan dalam sumber ini.",
    },
    input,
    policy: policyResult(policy),
    lines,
    subtotalRupiah: assertOutput(subtotal, "Subtotal komponen"),
    assumptions,
    exclusions,
    warnings: [
      "Subtotal ini hanya mencakup komponen yang disebutkan; bukan total seluruh biaya marketplace atau nilai akhir settlement.",
      "Dataset belum ditinjau pemeriksa kedua. Angka bersifat perkiraan dan harus dibandingkan dengan Seller Centre sebelum dipakai untuk keputusan harga.",
      ...warnings,
    ],
  };
}

function calculateDynamicCommission(
  input: DynamicCommissionInput,
): MarketplaceFeeCalculation {
  const policy = policyData.dynamicCommission;
  validatePolicyDate(input.asOfDate, policy);
  assertMoney(input.itemPriceRupiah, "Harga item");
  assertMoney(input.sellerDiscountRupiah, "Diskon penjual");
  if (input.sellerDiscountRupiah > input.itemPriceRupiah) {
    throw new MarketplaceFeeCalculationError(
      "invalid_discount",
      "Diskon penjual tidak boleh melebihi harga item.",
    );
  }
  if (
    typeof input.quantity !== "bigint" ||
    input.quantity < 1n ||
    input.quantity > MAX_QUANTITY
  ) {
    throw new MarketplaceFeeCalculationError(
      "invalid_quantity",
      "Jumlah item harus bilangan bulat antara 1 dan 1.000.000.",
    );
  }
  if (
    input.orderStatus !== "delivered" &&
    input.orderStatus !== "returned_after_delivery" &&
    input.orderStatus !== "undelivered_refunded"
  ) {
    throw new MarketplaceFeeCalculationError(
      "invalid_order_status",
      "Status pesanan tidak didukung.",
    );
  }
  const category = MARKETPLACE_DYNAMIC_CATEGORIES.find(
    (entry) => entry.id === input.categoryId,
  );
  if (!category) {
    throw new MarketplaceFeeCalculationError(
      "unsupported_category",
      "Kategori ini belum memiliki tarif komisi dinamis yang didukung.",
    );
  }

  const itemBase = input.itemPriceRupiah - input.sellerDiscountRupiah;
  const cap = BigInt(policy.feeCapPerItemRupiah);
  const uncappedNumerator = itemBase * category.rateBasisPoints;
  const capApplied = uncappedNumerator > cap * BASIS_POINTS;
  const feeNumerator = capApplied ? cap : uncappedNumerator;
  const feeDenominator = capApplied ? 1n : BASIS_POINTS;
  const feePerUnit = roundRatio(
    feeNumerator,
    feeDenominator,
    "half-away-from-zero",
  );
  const chargeable =
    input.orderStatus === "delivered" ||
    input.orderStatus === "returned_after_delivery";
  const amount = assertOutput(
    chargeable ? feePerUnit * input.quantity : 0n,
    "Total komisi dinamis",
  );
  const lines: MarketplaceFeeLine[] = [
    {
      key: "dynamic-commission",
      label: "Komisi dinamis",
      basisRupiah: itemBase,
      rateBasisPoints: category.rateBasisPoints,
      feePerUnitRupiah: chargeable ? feePerUnit : 0n,
      quantity: input.quantity,
      amountRupiah: amount,
      capRupiah: cap,
      capApplied,
      taxInclusive: true,
      explanation: chargeable
        ? input.orderStatus === "returned_after_delivery"
          ? "Pesanan berhasil dikirim; biaya tetap dikenakan meski kemudian dikembalikan atau direfund."
          : "Pesanan berhasil dikirim."
        : "Pesanan belum berhasil dikirim dan direfund; komisi dinamis tidak dikenakan.",
    },
  ];

  return result(
    input,
    policy,
    lines,
    [
      "Dasar per item = harga item − diskon penjual. Diskon platform dan biaya kirim tidak termasuk.",
      "Tarif berlaku untuk seller Tokopedia yang sudah terintegrasi dan seller TikTok Shop by Tokopedia di Indonesia.",
      "Tarif yang dikutip sudah termasuk pajak; pajak tidak ditambahkan lagi.",
      "Harga dan diskon dianggap sama untuk setiap unit dalam jumlah item ini.",
    ],
    [
      "Komisi platform, biaya proses pesanan, biaya logistik, program berbayar, voucher platform, dan biaya lain tidak dihitung.",
    ],
    input.orderStatus === "undelivered_refunded"
      ? []
      : [
          "Pembulatan half-away-from-zero dipakai sebagai metode estimasi karena aturan pembulatan per invoice tidak dirinci pada sumber.",
        ],
  );
}

function calculateShopeeOrderProcessing(
  input: ShopeeOrderProcessingInput,
): MarketplaceFeeCalculation {
  const policy = policyData.shopeeOrderProcessing;
  validatePolicyDate(input.orderDate, policy);
  if (
    !isISODate(input.firstProductListedDate) ||
    input.firstProductListedDate > input.orderDate
  ) {
    throw new MarketplaceFeeCalculationError(
      "invalid_product_date",
      "Tanggal unggah produk pertama harus valid dan tidak setelah tanggal pesanan.",
    );
  }
  if (
    input.sellerType !== "non_star" &&
    input.sellerType !== "star" &&
    input.sellerType !== "star_plus" &&
    input.sellerType !== "mall"
  ) {
    throw new MarketplaceFeeCalculationError(
      "invalid_seller_type",
      "Tipe penjual Shopee tidak didukung.",
    );
  }
  if (
    typeof input.previousCompletedOrders !== "bigint" ||
    input.previousCompletedOrders < 0n ||
    input.previousCompletedOrders > MAX_RUPIAH
  ) {
    throw new MarketplaceFeeCalculationError(
      "invalid_order_count",
      "Jumlah pesanan selesai sebelumnya harus berupa bilangan bulat tidak negatif.",
    );
  }
  if (
    input.orderStatus !== "completed" &&
    input.orderStatus !== "cancelled" &&
    input.orderStatus !== "not_delivered"
  ) {
    throw new MarketplaceFeeCalculationError(
      "invalid_order_status",
      "Status pesanan Shopee tidak didukung.",
    );
  }

  const exempt =
    input.sellerType === "non_star" &&
    input.firstProductListedDate <
      policy.nonStarExemptionProductUploadBefore &&
    input.previousCompletedOrders <
      BigInt(policy.nonStarExemptionCompletedOrderCount);
  const chargeable = input.orderStatus === "completed" && !exempt;
  const feePerOrder = chargeable
    ? BigInt(policy.feePerCompletedOrderRupiah)
    : 0n;
  const explanation =
    input.orderStatus !== "completed"
      ? "Biaya proses hanya dihitung untuk pesanan terselesaikan."
      : exempt
        ? "Non-Star yang mengunggah produk pertama sebelum 1 Agustus 2026 masih dalam 50 pesanan selesai pertama."
        : "Biaya proses pesanan terselesaikan.";

  return result(
    input,
    policy,
    [
      {
        key: "order-processing",
        label: "Biaya proses pesanan",
        basisRupiah: 0n,
        rateBasisPoints: null,
        feePerUnitRupiah: feePerOrder,
        quantity: 1n,
        amountRupiah: feePerOrder,
        capRupiah: null,
        capApplied: false,
        taxInclusive: true,
        explanation,
      },
    ],
    [
      "Biaya Rp1.250 berlaku per pesanan terselesaikan, bukan per produk.",
      "Pengecualian 50 pesanan pertama hanya berlaku bagi Non-Star dengan produk pertama diunggah sebelum 1 Agustus 2026.",
      "Biaya sudah termasuk PPN; pajak tidak ditambahkan lagi.",
    ],
    [
      "Biaya administrasi per kategori, gratis ongkir, biaya program, Shopee Mall, dan alokasi biaya untuk pengembalian sebagian tidak dihitung.",
    ],
    [],
  );
}

export function calculateMarketplaceFee(
  input: MarketplaceFeeInput,
): MarketplaceFeeCalculation {
  if (input.platform === "shopee") {
    return calculateShopeeOrderProcessing(input);
  }
  if (input.platform === "tokopedia" || input.platform === "tiktok_shop") {
    return calculateDynamicCommission(input);
  }
  throw new MarketplaceFeeCalculationError(
    "invalid_order_status",
    "Platform marketplace tidak didukung.",
  );
}
