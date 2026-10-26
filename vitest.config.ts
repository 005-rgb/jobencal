import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@jobenapp/engine": fileURLToPath(
        new URL("./packages/engine/src/index.ts", import.meta.url),
      ),
      "@jobenapp/data": fileURLToPath(new URL("./data", import.meta.url)),
    },
  },
  test: {
    include: ["apps/**/*.test.{ts,tsx}", "packages/**/*.test.{ts,tsx}"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["packages/engine/src/money.ts", "packages/engine/src/rules.ts"],
      reporter: ["text"],
      thresholds: {
        lines: 95,
        branches: 90,
      },
    },
  },
});
