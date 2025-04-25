import nx from '@nx/eslint-plugin';
import baseLibraryConfig from './eslint.config.library.mjs';

export default [
  ...baseLibraryConfig,
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'dbx',
          style: 'camelCase'
        }
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'dbx',
          style: 'kebab-case'
        }
      ]
    }
  },
  {
    files: ['*.spec.ts', '*.spec.tsx'],
    rules: {
      '@angular-eslint/component-selector': 'off',
      '@angular-eslint/component-class-suffix': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off'
    }
  }
];
