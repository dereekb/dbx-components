import baseConfig from './eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['*.ts', '*.tsx'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/consistent-type-exports': ['error', { fixMixedExportsWithInlineTypeSpecifier: true }]
    },
    parserOptions: {
      project: ['./packages/util/tsconfig.lib.json', './packages/util/tsconfig.spec.json']
    }
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}']
        }
      ]
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser')
    }
  },
  {
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js', '**/*.spec.jsx', '!{projectRoot}/test/**'],
    rules: {
      '@nx/enforce-module-boundaries': 'off'
    }
  }
];
