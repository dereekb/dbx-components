import nx from '@nx/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import { nestjsEslintPlugin } from '@dereekb/nestjs/eslint';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  // ignore dist folder linting
  {
    ignores: ['**/dist']
  },
  // import plugin
  {
    files: ['**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'],
    rules: {
      'import/no-unresolved': 'off',
      'import/namespace': 'off',
      'import/no-duplicates': ['warn', { considerQueryString: true, 'prefer-inline': true }]
    }
  },
  // module boundaries and imports
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?js$'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*']
            }
          ]
        }
      ],
      'no-restricted-imports': [
        2,
        {
          paths: [
            {
              name: 'rxjs/operators',
              message: 'Use top level `rxjs` directly instead.'
            }
          ]
        }
      ]
    }
  },
  // other rules
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts', '**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
    // Override or add rules here
    rules: {}
  },
  // nestjs: require @Inject() on constructor params (emitDecoratorMetadata is disabled)
  {
    files: ['**/*.ts'],
    plugins: {
      'dereekb-nestjs': nestjsEslintPlugin
    },
    rules: {
      'dereekb-nestjs/require-nest-inject': 'error'
    }
  }
];
