const { withNx } = require('@nx/rollup/with-nx');
const applyInternalAliases = require('./rollup.alias-internal.config.cjs');
const applyVisualizer = require('../../../rollup.visualizer.config.cjs');

// Migrated from the `@nx/rollup:rollup` executor to the `@nx/rollup/plugin` inferred `build-base`
// target. Options reflect the executor's effective `production` configuration plus the options that
// previously came from the `@nx/rollup:rollup` targetDefault in nx.json.
//
// The two config modifiers are applied in the same order as the executor's "rollupConfig" array:
// the internal-alias hook first (so `@dereekb/util*` and `@marcbachmann/cel-js` are inlined into
// the published ESLint plugin bundle), then the visualizer.
const options = {
  importPath: '@dereekb/firebase/eslint',
  main: './src/index.ts',
  outputPath: '../../../dist/packages/firebase/eslint',
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

module.exports = (async () => {
  let config = withNx(options, {});
  config = await applyInternalAliases(config, options);
  config = await applyVisualizer(config, options);
  return config;
})();
