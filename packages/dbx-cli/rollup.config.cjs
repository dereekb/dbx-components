const { withNx } = require('@nx/rollup/with-nx');
const applyVisualizer = require('../../rollup.visualizer.config.cjs');

// Migrated from the `@nx/rollup:rollup` executor to the `@nx/rollup/plugin` inferred `build-base`
// target. Options reflect the executor's effective `production` configuration plus the options that
// previously came from the `@nx/rollup:rollup` targetDefault in nx.json (`external`,
// `buildLibsFromSource`).
//
// `@dereekb/dbx-cli` deliberately does NOT declare `"type": "module"`. `withNx` forces
// `format: ['esm']` for a `type: module` package, which publishes an ESM-only root export. Every
// sibling `@dereekb/*` package resolves the `import` condition to its `index.cjs.mjs` shim, so an
// ESM-only `dbx-cli` loaded a second copy of `@firebase/firestore` and the `Firestore` instances it
// created failed `collection()`'s brand check inside `@dereekb/firebase`. Keep this package
// dual-build so Node consumers stay on one copy.
const options = {
  importPath: '@dereekb/dbx-cli',
  main: './src/index.ts',
  outputPath: '../../dist/packages/dbx-cli',
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
  assets: [{ glob: 'LICENSE', input: '.', output: '.' }]
};

module.exports = (async () => {
  let config = withNx(options, {});
  config = await applyVisualizer(config, options);
  return config;
})();
