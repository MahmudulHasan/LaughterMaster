import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    ".data/**",
    "drizzle/**",
    "next-env.d.ts",
  ]),
  // Must stay last: turns off rules that conflict with Prettier.
  prettier,
]);

export default eslintConfig;
