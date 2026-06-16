import baseConfig from '../../eslint.config.mjs';
import typescriptParser from '@typescript-eslint/parser';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: ["./FIREBASE_COMPONENTS_FOLDER/tsconfig.lib.json", "./FIREBASE_COMPONENTS_FOLDER/tsconfig.spec.json"]
      }
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }]
    }
  },
  {
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js', '**/*.spec.jsx', '!{projectRoot}/test/**'],
    rules: {
      '@nx/enforce-module-boundaries': 'off'
    }
  }
];
