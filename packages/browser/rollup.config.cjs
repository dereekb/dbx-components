const { withNx } = require('@nx/rollup/with-nx');
const applyVisualizer = require('../../rollup.visualizer.config.cjs');

const options = {
  importPath: '@dereekb/browser',
  main: './src/index.ts',
  outputPath: '../../dist/packages/browser',
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
  assets: [
    { glob: 'packages/browser/README.md', input: '.', output: '.' },
    { glob: 'LICENSE', input: '.', output: '.' }
  ]
};

module.exports = (async () => {
  let config = withNx(options, {});
  config = await applyVisualizer(config, options);
  return config;
})();
