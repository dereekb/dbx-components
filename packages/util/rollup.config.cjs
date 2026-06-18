const { withNx } = require('@nx/rollup/with-nx');
const applyVisualizer = require('../../rollup.visualizer.config.cjs');

// Migrated from the `@nx/rollup:rollup` executor to the `@nx/rollup/plugin` inferred `build-base`
// target. The option set below is the executor's effective `production` configuration (the old
// target used `defaultConfiguration: "production"`), merged with the options that previously came
// from the `@nx/rollup:rollup` targetDefault in nx.json (`external`, `buildLibsFromSource`).
const options = {
  importPath: '@dereekb/util',
  main: './src/index.ts',
  outputPath: '../../dist/packages/util',
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
  assets: [
    { glob: 'packages/util/README.md', input: '.', output: '.' },
    { glob: 'LICENSE', input: '.', output: '.' }
  ]
};

module.exports = (async () => {
  let config = withNx(options, {});
  config = await applyVisualizer(config, options);
  return config;
})();
