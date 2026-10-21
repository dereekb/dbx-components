import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

/**
 * Loads an in-repo ESLint plugin from its built `dist` bundle and stamps it with `meta.name` / `meta.version`,
 * where the version is a hash of the bundle content.
 *
 * ESLint's lint cache (`.cache/eslint`) keys on a hash of the resolved config, and a plugin without `meta` contributes
 * only its namespace to that hash -- so a rebuilt plugin with changed rule code would otherwise keep serving cached
 * results produced by the old rules. Hashing the bundle makes every plugin rebuild invalidate the cache.
 *
 * @param {string} exportName - The plugin constant exported by the bundle, e.g. `DBX_WEB_ESLINT_PLUGIN`.
 * @param {string} name - The plugin package name used for `meta.name`.
 * @param {string} bundlePath - The bundle path relative to the workspace root.
 * @returns {Promise<object>} The plugin with `meta` set.
 */
async function loadInRepoEslintPlugin(exportName, name, bundlePath) {
  const bundleUrl = new URL(bundlePath, import.meta.url);

  if (!existsSync(bundleUrl)) {
    throw new Error(`ESLint plugin bundle "${bundlePath}" is missing. Build the in-repo ESLint plugins first: npx nx run workspace:build-eslint-plugins`);
  }

  const bundle = await import(bundleUrl.href);
  const version = createHash('sha256').update(readFileSync(bundleUrl)).digest('hex').slice(0, 16);
  return { ...bundle[exportName], meta: { name, version } };
}

// Shared by eslint.config.mjs and eslint.config.angular.mjs so both register the same plugin object -- flat config rejects two different objects under one plugin namespace.
export const NESTJS_ESLINT_PLUGIN = await loadInRepoEslintPlugin('NESTJS_ESLINT_PLUGIN', '@dereekb/nestjs/eslint', './dist/packages/nestjs/eslint/index.esm.js');
export const DBX_WEB_ESLINT_PLUGIN = await loadInRepoEslintPlugin('DBX_WEB_ESLINT_PLUGIN', '@dereekb/dbx-web/eslint', './dist/packages/dbx-web/eslint/index.esm.js');
export const UTIL_ESLINT_PLUGIN = await loadInRepoEslintPlugin('UTIL_ESLINT_PLUGIN', '@dereekb/util/eslint', './dist/packages/util/eslint/index.esm.js');
export const FIREBASE_ESLINT_PLUGIN = await loadInRepoEslintPlugin('FIREBASE_ESLINT_PLUGIN', '@dereekb/firebase/eslint', './dist/packages/firebase/eslint/index.esm.js');
export const DBX_CLI_ESLINT_PLUGIN = await loadInRepoEslintPlugin('DBX_CLI_ESLINT_PLUGIN', '@dereekb/dbx-cli/eslint', './dist/packages/dbx-cli/eslint/index.esm.js');
