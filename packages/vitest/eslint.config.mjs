import baseLibraryConfig from '../../eslint.config.library.mjs';

export default [
  ...baseLibraryConfig,
  {
    ignores: ['**/src/extend.ts', '**/src/**/*.spec.ts'] // extend.ts is specially crafted for the build and should not be linted
  },
  {
    // setup-angular.ts intentionally uses `let window; window ??= global;` to shadow the DOM window type while patching jsdom globals.
    files: ['**/src/setup-angular.ts'],
    rules: {
      'prefer-const': 'off'
    }
  }
];
