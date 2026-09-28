import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // House style: separate metadata with layout (tags, spacing, line breaks), never middot characters.
    files: ["src/**", "e2e/**", "tests/**", "scripts/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...["Literal[value=/\\u00b7/]", "TemplateElement[value.raw=/\\u00b7/]", "JSXText[value=/\\u00b7/]"].map(
          (selector) => ({ selector, message: "Don't use middots; separate items with layout instead." }),
        ),
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // WoW addons (Lua) ship as-is from here.
    "addons/**",
    // The Electron companion is its own project with its own ESLint config (same middot rule).
    "companion/**",
    // Playwright output and scratch configs.
    "test-results/**",
    "playwright-report/**",
    ".tmp-*",
  ]),
]);

export default eslintConfig;
