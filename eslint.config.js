import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.astro/**", "coverage/**"],
  },
  ...tseslint.configs.recommended,
);
