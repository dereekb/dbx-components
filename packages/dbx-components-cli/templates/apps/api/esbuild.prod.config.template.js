const { existsSync } = require('node:fs');
const { join, parse } = require('node:path');
const baseConfig = require('./esbuild.config');

/**
 * `@nx/webpack`'s `fileReplacements` has no `@nx/esbuild` equivalent, and the esbuild
 * executor schema is `additionalProperties: true` — so leaving it in `project.json`
 * would be *silently ignored* and ship the development environment to production. This
 * config replaces it with a fail-closed esbuild plugin.
 *
 * Whole-module substitution rather than `define`: `environment.prod.ts` deliberately
 * *omits* `appOAuthUrl` and `appMcpUrl` so the framework falls back to `appUrl` (see the
 * comments in `src/environments/environment.ts`). A `define` cannot express key-absence,
 * and esbuild's `alias` rejects relative specifiers outright.
 *
 * Paths are resolved from `__dirname`, so this file is token-free and copies into a
 * scaffolded app unchanged.
 */
const FILE_REPLACEMENTS = [
  {
    replace: join(__dirname, 'src/environments/environment.ts'),
    with: join(__dirname, 'src/environments/environment.prod.ts')
  }
];

const FILE_REPLACEMENTS_PLUGIN_NAME = 'dbx-file-replacements';

/**
 * Marker set on the `pluginData` of the nested `build.resolve()` call so the plugin's own
 * `onResolve` hook can recognize — and ignore — its re-entrant invocation.
 */
const RESOLVE_GUARD_KEY = 'dbxFileReplacementResolved';

/**
 * Optional source extension, so a specifier written as `./environments/environment`,
 * `…/environment.ts` or `…/environment.js` all reach the resolver.
 */
const SOURCE_EXTENSION_PATTERN = '(?:\\.[cm]?[jt]sx?)?';

/**
 * Escapes a string for literal use inside a regular expression.
 *
 * @param value - The raw string.
 * @returns The escaped string.
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds the narrowest `onResolve` filter that can still reach every replaced module.
 *
 * esbuild has no "resolved path" filter — `onResolve` fires on the raw specifier — and a
 * match-everything filter would route every import in the graph through an extra
 * `build.resolve()`.
 * Matching the replaced files' base names keeps the hook off the hot path; the real
 * decision is still made against the fully resolved absolute path.
 *
 * @param replacements - The configured replacements.
 * @returns The filter regex.
 */
function buildReplacementFilter(replacements) {
  const names = replacements.map((replacement) => escapeRegExp(parse(replacement.replace).name));
  return new RegExp(`(?:^|[\\\\/])(?:${names.join('|')})${SOURCE_EXTENSION_PATTERN}$`);
}

/**
 * Creates an esbuild plugin that swaps whole modules, the way `@nx/webpack`'s
 * `fileReplacements` does.
 *
 * Fail-closed in both directions: a replacement naming a file that does not exist aborts
 * the build at plugin setup, and a replacement that never fires — because nothing in the
 * bundle imported it — fails the build from `onEnd`. Silence is the one outcome that is
 * never allowed, because a silently skipped replacement ships development configuration.
 *
 * @param replacements - The replacements to apply, as absolute `{ replace, with }` paths.
 * @returns The esbuild plugin.
 */
function fileReplacementsPlugin(replacements) {
  const filter = buildReplacementFilter(replacements);
  const replacementsByPath = new Map(replacements.map((replacement) => [replacement.replace, replacement.with]));

  return {
    name: FILE_REPLACEMENTS_PLUGIN_NAME,
    setup(build) {
      const applied = new Set();

      replacements.forEach((replacement) => {
        if (!existsSync(replacement.replace)) {
          throw new Error(`${FILE_REPLACEMENTS_PLUGIN_NAME}: file does not exist: "${replacement.replace}" (the "replace" side of a file replacement).`);
        }

        if (!existsSync(replacement.with)) {
          throw new Error(`${FILE_REPLACEMENTS_PLUGIN_NAME}: file does not exist: "${replacement.with}" (the "with" side of a file replacement).`);
        }
      });

      build.onStart(() => {
        applied.clear();
      });

      build.onResolve({ filter }, async (args) => {
        let result;

        if (args.pluginData?.[RESOLVE_GUARD_KEY]) {
          result = undefined; // re-entrant call from the build.resolve() below; let esbuild resolve it normally.
        } else {
          const resolved = await build.resolve(args.path, {
            importer: args.importer,
            kind: args.kind,
            namespace: args.namespace,
            resolveDir: args.resolveDir,
            pluginData: { ...args.pluginData, [RESOLVE_GUARD_KEY]: true }
          });

          const replacement = resolved.errors.length > 0 ? undefined : replacementsByPath.get(resolved.path);

          if (resolved.errors.length > 0) {
            result = resolved;
          } else if (replacement != null) {
            applied.add(resolved.path);
            result = { ...resolved, path: replacement, pluginData: args.pluginData };
          } else {
            result = undefined; // a base-name match that resolved elsewhere; not ours.
          }
        }

        return result;
      });

      build.onEnd(() => {
        const missing = replacements.filter((replacement) => !applied.has(replacement.replace));
        return missing.length === 0
          ? undefined
          : {
              errors: missing.map((replacement) => ({
                pluginName: FILE_REPLACEMENTS_PLUGIN_NAME,
                text: `replacement never applied: nothing in the bundle resolved to "${replacement.replace}", so "${replacement.with}" was never substituted. Either the import moved or the replacement is stale — failing rather than shipping the unreplaced module.`
              }))
            };
      });
    }
  };
}

module.exports = {
  ...baseConfig,
  plugins: [...(baseConfig.plugins ?? []), fileReplacementsPlugin(FILE_REPLACEMENTS)]
};
