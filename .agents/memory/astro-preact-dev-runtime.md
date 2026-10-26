---
name: Astro and Preact dev runtime
description: Runtime compatibility note for the Astro 7, Vite 8, and Preact integration in this project.
---

Bundle `@astrojs/preact` through Vite's `ssr` and `prerender` environment resolvers. Without both, `astro dev` can report ready while failing to render because the default Node ESM loader receives an `astro:` virtual module. A successful static build alone does not prove the dev server works.

**Why:** the project failed to serve the home page even though Astro reported a ready port and production build passed. Bundling the Preact integration in both environments resolved the `astro:` loader failure.

**How to apply:** preserve both environment rules when editing the Astro config. If Astro, Vite, or the Preact integration versions change, verify both `astro dev` and `astro build` before changing this compatibility setting.
