import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';
import typescriptParser from '@typescript-eslint/parser';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import { DBX_WEB_ESLINT_PLUGIN } from '@dereekb/dbx-web/eslint';

export default [
  ...baseConfig,
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
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: ['./ANGULAR_COMPONENTS_FOLDER/tsconfig.lib.json', './ANGULAR_COMPONENTS_FOLDER/tsconfig.spec.json']
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
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'APP_CODE_PREFIX_LOWER',
          style: 'camelCase'
        }
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'APP_CODE_PREFIX_LOWER',
          style: 'kebab-case'
        }
      ]
    }
  },
  {
    files: ['**/*.html'],
    plugins: {
      'dereekb-dbx-web': DBX_WEB_ESLINT_PLUGIN
    },
    // Override or add rules here
    rules: {
      // Catch a dbxAction that has a trigger but no value source (it would hang in the TRIGGERED state).
      'dereekb-dbx-web/require-action-value-source': 'error',
      // Require an error-presentation directive on actions that run a handler, so a failed action is
      // not silently swallowed. Autofixable: it appends `dbxActionSnackbarError` to the action host.
      // NOTE the fix only completes the template half — also add `DbxActionSnackbarErrorDirective`
      // from `@dereekb/dbx-web` to the component's `imports`, or the bare attribute matches no
      // directive and silently does nothing.
      'dereekb-dbx-web/require-action-error-handler': 'error'
    }
  },
  {
    // Inline templates of spec files, which the angular-template processor extracts to a virtual
    // `<spec>.ts/inline-template-*.component.html`. A test fixture has no user to surface an action
    // failure to, so the error-handler rule is noise there.
    files: ['**/*.spec.ts/**/*.html'],
    rules: {
      'dereekb-dbx-web/require-action-error-handler': 'off'
    }
  }
];
