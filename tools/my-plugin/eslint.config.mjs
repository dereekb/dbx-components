import baseConfig from '../../eslint.config.mjs';
import * as jsoncParser from 'jsonc-eslint-parser';

export default [
  ...baseConfig,
  {
    // @nx/dependency-checks is configured for {package,project}.json by the workspace base config above.
    // This plugin project additionally validates its generators/executors metadata.
    files: ['package.json', 'generators.json'],
    languageOptions: {
      parser: jsoncParser
    },
    rules: {
      '@nx/nx-plugin-checks': 'error'
    }
  }
];
