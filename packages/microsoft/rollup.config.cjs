const { withNx } = require('@nx/rollup/with-nx');
const applyVisualizer = require('../../rollup.visualizer.config.cjs');

const options = {
  importPath: '@dereekb/microsoft',
  main: './src/index.ts',
  outputPath: '../../dist/packages/microsoft',
  tsConfig: './tsconfig.lib.json',
  project: './package.json',
  compiler: 'swc',
  format: ['esm'],
  external: 'all',
  buildLibsFromSource: false,
  generateExportsField: true,
  optimization: true,
  sourceMap: false,
  namedChunks: false,
  vendorChunk: false,
  extractLicenses: true,
  assets: [
    { glob: 'packages/microsoft/README.md', input: '.', output: '.' },
    { glob: 'packages/microsoft/SETUP.md', input: '.', output: '.' },
    // the agent docs (dbx-claude refs) this package ships; msgraph-cli also embeds them for `msgraph-cli docs`
    { glob: '**/*.md', input: 'packages/microsoft/refs', output: 'refs' },
    { glob: 'LICENSE', input: '.', output: '.' }
  ]
};

module.exports = (async () => {
  let config = withNx(options, {});
  config = await applyVisualizer(config, options);
  return config;
})();
