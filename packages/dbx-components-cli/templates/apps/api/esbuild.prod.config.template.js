/**
 * esbuild config for the `production` build configuration of `<api-app>:build-base`.
 *
 * Swaps `environment.ts` for `environment.prod.ts` through the fail-closed replacement
 * plugin in `./esbuild.file-replacements`. See that file for why a plugin is required
 * rather than a `fileReplacements` entry in `project.json`.
 */
const baseConfig = require('./esbuild.config');
const { buildLaneEsbuildConfig } = require('./esbuild.file-replacements');

module.exports = buildLaneEsbuildConfig({ baseConfig, appDir: __dirname, environmentFile: 'environment.prod.ts' });
