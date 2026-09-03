import nx from '@nx/eslint-plugin';
import baseLibraryConfig from './eslint.config.library.mjs';
import { DBX_WEB_ESLINT_PLUGIN } from './dist/packages/dbx-web/eslint/index.esm.js';

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
    files: ['**/*.html'],
    plugins: {
      'dereekb-dbx-web': DBX_WEB_ESLINT_PLUGIN
    },
    rules: {
      '@angular-eslint/template/alt-text': 'warn',
      '@angular-eslint/template/click-events-have-key-events': 'warn',
      '@angular-eslint/template/no-positive-tabindex': 'error',
      '@angular-eslint/template/role-has-required-aria': 'error',
      '@angular-eslint/template/valid-aria': 'error',
      '@angular-eslint/template/label-has-associated-control': 'warn',
      'dereekb-dbx-web/require-action-value-source': 'error',
      'dereekb-dbx-web/require-action-error-handler': 'error'
    }
  },
  {
    // Inline templates of spec files. The angular-template processor extracts each one into a
    // virtual file nested UNDER its source path (`…/foo.spec.ts/inline-template-…component.html`),
    // which is why this globs a `*.spec.ts` path SEGMENT rather than a filename suffix.
    //
    // A test fixture has no user to surface an action failure to, so the error-handler rule is
    // noise there. It is also unsatisfiable in some of them: dbx-core sits below dbx-web and so
    // cannot use `dbxActionSnackbarError` / `dbxActionError` / `dbxActionSnackbar`, and the one
    // error directive it does own (`dbxActionErrorHandler`) needs a bound handler, which no
    // autofix can invent.
    //
    // NOTE when changing anything in this file: the `lint` target runs ESLint with its own
    // content-addressed cache (`.cache/eslint`) and nx only tracks `eslint.config.mjs` as an input,
    // so edits HERE do not invalidate either cache. A run can replay results computed under the old
    // config and look like the change had no effect. Clear `.cache/eslint` before trusting a result.
    files: ['**/*.spec.ts/**/*.html'],
    rules: {
      'dereekb-dbx-web/require-action-error-handler': 'off'
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
