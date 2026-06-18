const { withNx } = require('@nx/rollup/with-nx');
const applyVisualizer = require('../../../rollup.visualizer.config.cjs');

// Migrated from the `@nx/rollup:rollup` executor to the `@nx/rollup/plugin` inferred `build-base`
// target. Options reflect the executor's effective `production` configuration plus the options that
// previously came from the `@nx/rollup:rollup` targetDefault in nx.json.
const options = {
  importPath: '@dereekb/util/test',
  main: './src/index.ts',
  outputPath: '../../../dist/packages/util/test',
  tsConfig: './tsconfig.lib.json',
  project: './package.json',
  compiler: 'swc',
  format: ['esm', 'cjs'],
  external: 'all',
  buildLibsFromSource: false,
  generateExportsField: true,
  optimization: true,
  sourceMap: false,
  namedChunks: false,
  vendorChunk: false,
  extractLicenses: true,
  assets: [{ glob: 'LICENSE', input: '.', output: '.' }]
};

module.exports = (async () => {
  let config = withNx(options, {});
  config = await applyVisualizer(config, options);
  return config;
})();
