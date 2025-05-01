import nx from '@nx/eslint-plugin';
import unusedImports from 'eslint-plugin-unused-imports';
import importPlugin from 'eslint-plugin-import';

export default [
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist']
  },
  {
    plugins: {
      'unused-imports': unusedImports
    },
    rules: {
      'no-unused-vars': 'off', // or "@typescript-eslint/no-unused-vars": "off",
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_'
        }
      ]
    }
  },
  {
    files: ['**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'],
    rules: {
      'import/no-unresolved': 'off',
      'import/namespace': 'off',
      'import/no-duplicates': ['warn', { considerQueryString: true, 'prefer-inline': true }]
    }
  },
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
      ]
    }
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts', '**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
    // Override or add rules here
    rules: {
      '@typescript-eslint/no-inferrable-types': 'off'
    }
  },
  {
    files: ['**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      'unused-imports/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      'no-unused-vars': 'off',
      'no-extra-semi': 'error'
    }
  },
  {
    files: ['{package,project}.json'],
    parser: 'jsonc-eslint-parser',
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          buildTargets: ['build', 'build-base'],
          checkMissingDependencies: true,
          checkObsoleteDependencies: true,
          checkVersionMismatches: true,
          ignoredDependencies: []
        }
      ]
    }
  }
];
