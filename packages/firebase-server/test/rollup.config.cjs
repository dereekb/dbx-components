const { withNx } = require('@nx/rollup/with-nx');

// This project had no "rollupConfig" hook under the executor, so there is no config modifier
// to chain. Options reflect the executor's effective `production` configuration plus the options that
// previously came from the `@nx/rollup:rollup` targetDefault in nx.json.
const options = {
  importPath: '@dereekb/firebase-server/test',
  main: './src/index.ts',
  outputPath: '../../../dist/packages/firebase-server/test',
  tsConfig: './tsconfig.lib.json',
  project: './package.json',
  compiler: 'swc',
  format: ['esm', 'cjs'],
  external: 'all',
  buildLibsFromSource: false,
  generateExportsField: true,
  optimization: true,
  sourceMap: false,
  extractLicenses: true,
  assets: []
};

module.exports = withNx(options, {});
