// ESLint 9 flat config. Lints the TypeScript extension-host sources in src/.
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      // The webview/markdown-it boundaries are untyped at runtime; allow the
      // narrow, commented `any` usage there rather than fighting it everywhere.
      "@typescript-eslint/no-explicit-any": "off",
      // Unused args are common in VS Code callback signatures; allow the
      // leading-underscore convention.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
