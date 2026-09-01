/**
 * Base esbuild build options for the demo-api Firebase Functions bundle.
 *
 * Loaded through the `esbuildConfig` option on `demo-api:build-base`. `@nx/esbuild`
 * hands whatever this exports to esbuild as `userDefinedBuildOptions`, then overwrites
 * the keys it owns (`bundle`, `external`, `minify`, `platform`, `target`, `format`,
 * `tsconfig`, `sourcemap`, `outExtension`) from `project.json`.
 *
 * `outExtension` is the one exception worth setting here: with `format: ["cjs"]` the
 * executor emits `main.cjs` unless the user config asks for `.js`
 * (`getOutExtension()` in `@nx/esbuild/dist/src/executors/esbuild/lib/build-esbuild-options.js`
 * only honors this override). The generated `package.json`'s `main` is the whole
 * firebase-tools entry contract — `deploy/functions/runtimes/node/validate.js` resolves
 * the entry as `path.join(sourceDir, data.main || 'index.js')` — so the emitted file has
 * to stay `main.js`.
 */
module.exports = {
  outExtension: { '.js': '.js' }
};
