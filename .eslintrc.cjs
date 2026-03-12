module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true
  },
  ignorePatterns: ["coverage/", "dist/", "node_modules/"],
  extends: ["eslint:recommended"],
  overrides: [
    {
      files: ["**/*.ts"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: __dirname
      },
      plugins: ["@typescript-eslint"],
      extends: ["plugin:@typescript-eslint/recommended-type-checked"],
      rules: {
        "@typescript-eslint/consistent-type-imports": "error",
        "@typescript-eslint/no-confusing-void-expression": "error",
        "@typescript-eslint/no-misused-promises": [
          "error",
          {
            checksVoidReturn: false
          }
        ],
        "@typescript-eslint/no-unnecessary-condition": "error"
      }
    }
  ]
};
