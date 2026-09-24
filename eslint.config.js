import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  // Typed linting for the TypeScript source. parserOptions.project is scoped to
  // TS files only — the tsconfig `include` is `src/**/*`, so pointing the typed
  // parser at .mjs test files would error ("file not included in project").
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': ['warn', { ignoreRestArgs: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  // Tests are ESM `.mjs` run under node:test. They are NOT part of the TS project,
  // so they get an untyped config with Node globals. Previously test/** and *.mjs
  // were ignored entirely, so no test file was ever linted (WS-D4).
  {
    files: ['test/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // The TS-specific variants come from tseslint.configs.recommended, which
      // applies globally; they are redundant on plain JS and double-report.
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
  {
    // Build output, deps, the docs site (own toolchain), and root JS config files
    // (eslint.config.js). tsup.config.ts is TS and IS linted by the block above.
    ignores: ['dist/**', 'node_modules/**', 'website/**', 'coverage/**', '*.js'],
  }
);
