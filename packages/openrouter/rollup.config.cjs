const { withNx } = require('@nx/rollup/with-nx');
const applyVisualizer = require('../../rollup.visualizer.config.cjs');

const options = {
  importPath: '@dereekb/openrouter',
  main: './src/index.ts',
  // `@dereekb/openrouter/decision`: the decision layer without the SDK (see src/decision.ts). A second
  // input of THIS build rather than a child project, because the root entry re-exports the same modules —
  // rollup emits them once, as a chunk both entries import, so there is one copy and one class identity.
  additionalEntryPoints: ['./src/decision.ts'],
  outputPath: '../../dist/packages/openrouter',
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
    { glob: 'packages/openrouter/README.md', input: '.', output: '.' },
    { glob: 'LICENSE', input: '.', output: '.' }
  ]
};

module.exports = (async () => {
  let config = withNx(options, {});
  config = await applyVisualizer(config, options);
  return config;
})();
