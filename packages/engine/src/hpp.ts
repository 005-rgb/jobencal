import { roundRatio } from "./money.js";

const MAX_RUPIAH = 999_999_999_999_999_999n;
const MAX_QUANTITY = 1_000_000_000n;
const BASIS_POINTS_PER_WHOLE = 10_000n;
const METHOD_KEY = "cost-of-goods.hpp";
const METHOD_VERSION = "1.0.0";

export type HppCostCategory = "overhead" | "depreciation";
export type HppAllocationMethod = "batch" | "per_unit" | "driver";

export interface HppAllocationInput {
  readonly label: string;
  readonly category: HppCostCategory;
  readonly method: HppAllocationMethod;
  /** Batch amount, per-unit amount, or the full cost pool, depending on method. */
  readonly amountRupiah: bigint;
  readonly driverName?: string;
  readonly batchDriverUnits?: bigint;
  readonly totalDriverUnits?: bigint;
}

export interface HppCalculationInput {
  readonly productionUnits: bigint;
  readonly materialCostRupiah: bigint;
  readonly materialWasteBasisPoints: bigint;
  readonly directLaborRupiah: bigint;
  readonly otherDirectCostRupiah: bigint;
  readonly allocations: readonly HppAllocationInput[];
  /** True only when the user has checked that all relevant costs are recorded. */
  readonly costsComplete: boolean;
}

export interface HppCostLine {
  readonly label: string;
  readonly category: "material" | "labor" | "direct" | HppCostCategory;
  readonly method: string;
  readonly amountRupiah: bigint;
}

export interface HppCalculation {
  readonly method: {
    readonly key: typeof METHOD_KEY;
    readonly version: typeof METHOD_VERSION;
    readonly rounding: "Rupiah utuh, half-away-from-zero";
  };
  readonly input: HppCalculationInput;
  readonly lines: readonly HppCostLine[];
  readonly totals: {
    readonly materialRupiah: bigint;
    readonly directCostRupiah: bigint;
    readonly overheadRupiah: bigint;
    readonly depreciationRupiah: bigint;
    readonly batchRupiah: bigint;
    readonly perUnitRupiah: bigint;
  };
  readonly status: "complete" | "provisional";
  readonly assumptions: readonly string[];
  readonly warnings: readonly string[];
}

export type HppCalculationErrorCode =
  | "invalid_production_quantity"
  | "invalid_cost"
  | "invalid_waste_rate"
  | "invalid_allocation"
  | "calculation_overflow";

export class HppCalculationError extends Error {
  constructor(readonly code: HppCalculationErrorCode, message: string) {
    super(message);
    this.name = "HppCalculationError";
  }
}

function assertCost(value: bigint, label: string): void {
  if (typeof value !== "bigint" || value < 0n) {
    throw new HppCalculationError("invalid_cost", `${label} harus berupa Rupiah utuh dan tidak negatif.`);
  }
  if (value > MAX_RUPIAH) {
    throw new HppCalculationError("calculation_overflow", `${label} melebihi batas Rupiah.`);
  }
}

function checkedSum(values: readonly bigint[], label: string): bigint {
  const value = values.reduce((sum, amount) => sum + amount, 0n);
  assertCost(value, label);
  return value;
}

function resolveAllocation(input: HppAllocationInput, productionUnits: bigint): bigint {
  if (!input.label.trim()) {
    throw new HppCalculationError("invalid_allocation", "Setiap biaya tidak langsung harus memiliki nama.");
  }
  assertCost(input.amountRupiah, `Biaya ${input.label}`);

  if (input.category !== "overhead" && input.category !== "depreciation") {
    throw new HppCalculationError("invalid_allocation", `Jenis biaya ${input.label} tidak dikenal.`);
  }

  if (input.method === "batch") return input.amountRupiah;
  if (input.method === "per_unit") {
    return checkedSum(
      [input.amountRupiah * productionUnits],
      `Alokasi ${input.label}`,
    );
  }
  if (input.method !== "driver") {
    throw new HppCalculationError("invalid_allocation", `Metode alokasi ${input.label} tidak dikenal.`);
  }
  if (
    !input.driverName?.trim() ||
    typeof input.batchDriverUnits !== "bigint" ||
    typeof input.totalDriverUnits !== "bigint" ||
    input.batchDriverUnits <= 0n ||
    input.totalDriverUnits <= 0n ||
    input.batchDriverUnits > input.totalDriverUnits
  ) {
    throw new HppCalculationError(
      "invalid_allocation",
      `Alokasi ${input.label} memerlukan nama penggerak, pemakaian batch yang positif, dan total penggerak yang mencakup batch ini.`,
    );
  }
  return roundRatio(
    input.amountRupiah * input.batchDriverUnits,
    input.totalDriverUnits,
    "half-away-from-zero",
  );
}

export function calculateHpp(input: HppCalculationInput): HppCalculation {
  if (
    typeof input.productionUnits !== "bigint" ||
    input.productionUnits <= 0n ||
    input.productionUnits > MAX_QUANTITY
  ) {
    throw new HppCalculationError(
      "invalid_production_quantity",
      "Jumlah hasil produksi harus berupa bilangan bulat antara 1 dan 1.000.000.000 unit.",
    );
  }
  assertCost(input.materialCostRupiah, "Biaya bahan");
  assertCost(input.directLaborRupiah, "Biaya tenaga kerja langsung");
  assertCost(input.otherDirectCostRupiah, "Biaya langsung lainnya");

  if (
    typeof input.materialWasteBasisPoints !== "bigint" ||
    input.materialWasteBasisPoints < 0n ||
    input.materialWasteBasisPoints >= BASIS_POINTS_PER_WHOLE
  ) {
    throw new HppCalculationError("invalid_waste_rate", "Susut bahan harus berada di antara 0% dan kurang dari 100%.");
  }

  const materialRupiah =
    input.materialWasteBasisPoints === 0n
      ? input.materialCostRupiah
      : roundRatio(
          input.materialCostRupiah * BASIS_POINTS_PER_WHOLE,
          BASIS_POINTS_PER_WHOLE - input.materialWasteBasisPoints,
          "half-away-from-zero",
        );
  assertCost(materialRupiah, "Biaya bahan setelah susut");

  const lines: HppCostLine[] = [
    {
      label: "Bahan setelah susut",
      category: "material",
      method:
        input.materialWasteBasisPoints === 0n
          ? "Biaya bahan yang dimasukkan"
          : `Penyesuaian susut ${input.materialWasteBasisPoints} basis poin`,
      amountRupiah: materialRupiah,
    },
    {
      label: "Tenaga kerja langsung",
      category: "labor",
      method: "Biaya per batch",
      amountRupiah: input.directLaborRupiah,
    },
  ];
  if (input.otherDirectCostRupiah > 0n) {
    lines.push({
      label: "Biaya langsung lainnya",
      category: "direct",
      method: "Biaya per batch",
      amountRupiah: input.otherDirectCostRupiah,
    });
  }

  let overheadRupiah = 0n;
  let depreciationRupiah = 0n;
  for (const allocation of input.allocations) {
    const amountRupiah = resolveAllocation(allocation, input.productionUnits);
    assertCost(amountRupiah, `Alokasi ${allocation.label}`);
    if (allocation.category === "overhead") overheadRupiah += amountRupiah;
    else depreciationRupiah += amountRupiah;
    lines.push({
      label: allocation.label,
      category: allocation.category,
      method:
        allocation.method === "driver"
          ? `Alokasi ${allocation.driverName!.trim()}: ${allocation.batchDriverUnits} ÷ ${allocation.totalDriverUnits}`
          : allocation.method === "per_unit"
            ? "Biaya per unit × hasil produksi"
            : "Biaya langsung per batch",
      amountRupiah,
    });
  }

  assertCost(overheadRupiah, "Total overhead");
  assertCost(depreciationRupiah, "Total penyusutan");
  const directCostRupiah = checkedSum(
    [materialRupiah, input.directLaborRupiah, input.otherDirectCostRupiah],
    "Total biaya langsung",
  );
  const batchRupiah = checkedSum(
    [directCostRupiah, overheadRupiah, depreciationRupiah],
    "Total HPP batch",
  );
  const perUnitRupiah = roundRatio(
    batchRupiah,
    input.productionUnits,
    "half-away-from-zero",
  );
  assertCost(perUnitRupiah, "HPP per unit");

  return {
    method: {
      key: METHOD_KEY,
      version: METHOD_VERSION,
      rounding: "Rupiah utuh, half-away-from-zero",
    },
    input,
    lines,
    totals: {
      materialRupiah,
      directCostRupiah,
      overheadRupiah,
      depreciationRupiah,
      batchRupiah,
      perUnitRupiah,
    },
    status: input.costsComplete ? "complete" : "provisional",
    assumptions: [
      "Jumlah produksi adalah unit jadi yang dapat dijual; biaya batch dibagi rata ke unit tersebut.",
      "Biaya yang dialokasikan memakai metode dan penggerak yang ditentukan pengguna.",
      "Susut bahan dihitung sebagai biaya bahan ÷ (1 − persentase susut).",
      "Semua hasil dibulatkan ke Rupiah utuh dengan metode half-away-from-zero.",
    ],
    warnings: input.costsComplete
      ? []
      : ["Hasil sementara: konfirmasi semua biaya langsung, overhead, penyusutan, dan biaya susut sudah dimasukkan sebelum memakai HPP sebagai angka final."],
  };
}
