import baseConfig from './eslint.config.mjs';
import typescriptParser from '@typescript-eslint/parser';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        projectService: {}
      }
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/max-params': ['warn', { max: 3, countVoidThis: false }],
      '@typescript-eslint/no-deprecated': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/await-thenable': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/switch-exhaustiveness-check': 'warn',
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'variable',
          modifiers: ['exported', 'const'],
          types: ['boolean', 'string', 'number', 'array'],
          format: ['UPPER_CASE'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'allow'
        }
      ]
    }
  },
  {
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js', '**/*.spec.jsx', '!{projectRoot}/test/**'],
    rules: {
      '@nx/enforce-module-boundaries': 'off',
      'sonarjs/no-duplicate-string': 'off' // test descriptions and fixture values naturally repeat across describe blocks
    }
  }
];
