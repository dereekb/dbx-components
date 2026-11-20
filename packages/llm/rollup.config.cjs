const { withNx } = require('@nx/rollup/with-nx');
const applyVisualizer = require('../../rollup.visualizer.config.cjs');

const options = {
  importPath: '@dereekb/llm',
  main: './src/index.ts',
  // Two more inputs of THIS build rather than child projects: `@dereekb/llm/decision` (the decision vocabulary without
  // any SDK; the root re-exports the same modules, see src/decision.ts) and `@dereekb/llm/craft` (craft notes; opt-in,
  // NOT re-exported by the root, see src/craft.ts). Rollup emits every module once, so modules several entries import
  // become shared chunks: one copy, one class identity.
  additionalEntryPoints: ['./src/decision.ts', './src/craft.ts'],
  outputPath: '../../dist/packages/llm',
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
    { glob: 'packages/llm/README.md', input: '.', output: '.' },
    { glob: 'LICENSE', input: '.', output: '.' }
  ]
};

module.exports = (async () => {
  let config = withNx(options, {});
  config = await applyVisualizer(config, options);
  return config;
})();
