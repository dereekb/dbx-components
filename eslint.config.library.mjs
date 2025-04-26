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
      project: ['{projectRoot}/tsconfig.lib.json', '{projectRoot}/tsconfig.spec.json']
    }
  },
  {
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js', '**/*.spec.jsx', '!{projectRoot}/test/**'],
    rules: {
      '@nx/enforce-module-boundaries': 'off'
    }
  }
];
