/**
 * esbuild config for the `staging` build configuration of `<api-app>:build-base`.
 *
 * Swaps `environment.ts` for `environment.staging.ts` through the fail-closed replacement
 * plugin in `./esbuild.file-replacements`.
 *
 * Without this file the `staging` configuration would have no environment selection at
 * all, and `<api-app>:ci-deploy-staging` would publish the unreplaced `environment.ts` —
 * localhost URLs, and a live developer-functions map — to a deployed project.
 */
const baseConfig = require('./esbuild.config');
const { buildLaneEsbuildConfig } = require('./esbuild.file-replacements');

module.exports = buildLaneEsbuildConfig({ baseConfig, appDir: __dirname, environmentFile: 'environment.staging.ts' });
