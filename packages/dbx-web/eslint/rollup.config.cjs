const { withNx } = require('@nx/rollup/with-nx');
const applyVisualizer = require('../../../rollup.visualizer.config.cjs');

const options = {
  importPath: '@dereekb/dbx-web/eslint',
  main: './src/index.ts',
  outputPath: '../../../dist/packages/dbx-web/eslint',
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
  config = await applyVisualizer(config, options);
  return config;
})();
