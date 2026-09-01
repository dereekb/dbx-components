const { withNx } = require('@nx/rollup/with-nx');
const applyVisualizer = require('../../../rollup.visualizer.config.cjs');

// Migrated from the `@nx/rollup:rollup` executor to the `@nx/rollup/plugin` inferred `build-base`
// target. Options reflect the executor's effective `production` configuration plus the options that
// previously came from the `@nx/rollup:rollup` targetDefault in nx.json.
//
// `tsconfig.lib.json` deliberately declares an EMPTY `"paths": {}`, and that empty map is
// load-bearing. It blanks the workspace `paths` inherited from `tsconfig.base.json` so no
// `@dereekb/*` import can resolve to another package's SOURCE — which is exactly what
// `buildLibsFromSource: false` exists to prevent (reaching across package roots fails the
// declaration emit with TS6059). `withNx` then re-adds ONLY this project's graph dependencies,
// mapped to their `dist/` outputs.
//
// It must stay EMPTY rather than naming `dist/...` targets explicitly: `@nx/js`'s
// `resolvePathsBaseUrl` anchors path values to the first tsconfig in the extends chain that
// declares a NON-EMPTY `paths`. Any entry here would re-anchor Nx's own workspace-root-relative
// `dist/...` values to THIS directory and break them, now that the root config no longer sets the
// `baseUrl` that TypeScript 6 deprecates and TypeScript 7 removes.
const options = {
  importPath: '@dereekb/dbx-cli/manifest-extract',
  main: './src/index.ts',
  outputPath: '../../../dist/packages/dbx-cli/manifest-extract',
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
