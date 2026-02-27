import baseLibraryConfig from '../../eslint.config.library.mjs';

export default [
  ...baseLibraryConfig,
  {
    ignores: ['**/src/extend.ts', '**/src/**/*.spec.ts'] // extend.ts is specially crafted for the build and should not be linted
  }
];
