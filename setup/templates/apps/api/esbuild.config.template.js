/**
 * Base esbuild build options for the API app's Firebase Functions bundle.
 *
 * Loaded through the `esbuildConfig` option on `<api-app>:build-base`. `@nx/esbuild`
 * hands whatever this exports to esbuild as `userDefinedBuildOptions`, then overwrites
 * the keys it owns (`bundle`, `external`, `minify`, `platform`, `target`, `format`,
 * `tsconfig`, `sourcemap`, `outExtension`) from `project.json`.
 *
 * `outExtension` is the one exception worth setting here. The emitted file has to stay
 * `main.js`, because the generated `package.json`'s `main` is the whole firebase-tools
 * entry contract — `deploy/functions/runtimes/node/validate.js` resolves the entry as
 * `path.join(sourceDir, data.main || 'index.js')`.
 *
 * Under the current `format: ["esm"]` this override is a no-op: `getOutExtension()` in
 * `@nx/esbuild/dist/src/executors/esbuild/lib/build-esbuild-options.js` only honors a
 * user `.js` for `cjs` (and a user `.mjs` for `esm`), and its `ESM_FILE_EXTENSION` is
 * already `.js`. It is kept as the guard for the `cjs` case, where the executor would
 * otherwise emit `main.cjs` and break the entry contract.
 *
 * The ESM bundle is still named `.js`, so it is only ESM by virtue of the `"type":
 * "module"` that `@nx/js` writes into the generated `package.json` for an esm-only
 * build (`update-package-json.js`, the `hasEsmFormat && !hasCjsFormat` branch). Both
 * halves have to stay in agreement — dropping the generated `type` would silently make
 * Node parse this bundle as CommonJS.
 */
module.exports = {
  outExtension: { '.js': '.js' }
};
