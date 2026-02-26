import baseLibraryConfig from '../../eslint.config.library.mjs';

export default [
  ...baseLibraryConfig,
  {
    ignores: ['**/test/**/*'] // ignore the test folder
  }
];
