import tailwindcss from "@tailwindcss/vite";
import preact from "@astrojs/preact";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [preact()],
  vite: {
    plugins: [tailwindcss()],
    environments: {
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
