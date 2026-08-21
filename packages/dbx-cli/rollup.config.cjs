const { withNx } = require('@nx/rollup/with-nx');
const applyVisualizer = require('../../rollup.visualizer.config.cjs');

// Migrated from the `@nx/rollup:rollup` executor to the `@nx/rollup/plugin` inferred `build-base`
// target. Options reflect the executor's effective `production` configuration plus the options that
// previously came from the `@nx/rollup:rollup` targetDefault in nx.json (`external`,
// `buildLibsFromSource`).
//
// `format: ['esm']` is what `withNx` forces anyway for a `"type": "module"` package; stating it
// here keeps the config honest and silences the mismatch warning. Every publishable `@dereekb/*`
// package builds ESM-only, so there is exactly one copy of each of them and of their transitive
// dependencies — which is what keeps `Firestore` instances passing `collection()`'s brand check
// inside `@dereekb/firebase`.
//
// The `"type": "module"` in this package's `package.json` also sets the PARSE GOAL for its
// TypeScript SOURCE: `packages/dbx-components-mcp/scripts/generate-manifests.mjs` registers the
// `ts-node/esm` loader and `import()`s `src/lib/mcp-scan/scan/*.ts` directly, and ts-node picks a
// file's module type from the nearest `package.json` `type`. Without it those sources parse as
// CommonJS and an import cycle in `mcp-scan/scan` that ESM tolerates fails the build with
// `ERR_REQUIRE_CYCLE_MODULE`.
const options = {
  importPath: '@dereekb/dbx-cli',
  main: './src/index.ts',
  outputPath: '../../dist/packages/dbx-cli',
  tsConfig: './tsconfig.lib.json',
  project: './package.json',
  compiler: 'swc',
  format: ['esm'],
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
