import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Hackathon project — `any` is pervasive in API routes and acceptable
      "@typescript-eslint/no-explicit-any": "off",
      // React 19 strict hooks rules — these patterns are intentional and safe
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      // Unused vars — demote to warning (pre-existing across codebase)
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
]);

export default eslintConfig;
