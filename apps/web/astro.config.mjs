import tailwindcss from "@tailwindcss/vite";
import preact from "@astrojs/preact";
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  integrations: [preact()],
  vite: {
    resolve: {
      alias: {
        "@jobenapp/engine": fileURLToPath(
          new URL("../../packages/engine/src/index.ts", import.meta.url),
        ),
        "@jobenapp/data": fileURLToPath(new URL("../../data", import.meta.url)),
      },
    },
    plugins: [tailwindcss()],
    environments: {
      ssr: {
        resolve: {
          noExternal: ["@astrojs/preact"],
        },
      },
      prerender: {
        resolve: {
          noExternal: ["@astrojs/preact"],
        },
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5000,
      strictPort: true,
      allowedHosts: true,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:3001",
        },
      },
    },
  },
});
