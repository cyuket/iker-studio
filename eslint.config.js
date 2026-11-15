import js from "@eslint/js";
import remotion from "@remotion/eslint-plugin";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Layers may only import from themselves and the layers listed here (the dependency rule). */
const layerRule = (forbidden) => ({
  "no-restricted-imports": [
    "error",
    {
      patterns: forbidden.map((layer) => ({
        group: [`**/${layer}/**`, `**/${layer}`],
        message: `This layer must not depend on ${layer}; dependencies point inward only.`,
      })),
    },
  ],
});

export default tseslint.config(
  {
    ignores: [
      "dist",
      "node_modules",
      "output",
      ".cache",
      "coverage",
      "fixtures/**/*.js",
      ".agents",
      ".claude/skills/remotion-*",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
      "no-console": "error",
    },
  },
  {
    files: ["src/domain/**"],
    rules: layerRule(["application", "infrastructure", "cli", "remotion"]),
  },
  { files: ["src/application/**"], rules: layerRule(["infrastructure", "cli", "remotion"]) },
  { files: ["src/infrastructure/**"], rules: layerRule(["cli", "remotion"]) },
  {
    files: ["src/remotion/**"],
    plugins: { "react-hooks": reactHooks, "@remotion": remotion },
    languageOptions: { globals: globals.browser },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...remotion.configs.recommended.rules,
      ...layerRule(["application", "infrastructure", "cli"]),
    },
  },
  { files: ["**/*.js"], ...tseslint.configs.disableTypeChecked },
  prettier,
);
