import { resolve as resolvePath } from 'node:path';

// Internal workspace imports are aliased to their TypeScript sources so they are inlined into the
// published bundle. `node_modules/@dereekb/*` is not populated for these workspace packages, so a
// left-external `@dereekb/...` import would be unresolvable when the root `eslint.config.mjs` loads
// the plugin from `dist/`. `@dereekb/dbx-cli` resolves to the pure, dependency-free route-model-tag
// grammar module (NOT the package barrel) so the ESLint bundle never pulls in ts-morph / yargs / etc.
const INTERNAL_ALIASES: Record<string, string> = {
  '@dereekb/util/eslint': resolvePath(__dirname, '../../util/eslint/src/index.ts'),
  '@dereekb/util': resolvePath(__dirname, '../../util/src/index.ts'),
  '@dereekb/dbx-cli': resolvePath(__dirname, '../src/lib/route/route-model-tag.ts')
};

// Dependencies that must be inlined into the published bundle rather than left external. They are
// aliased to TS sources above; they must also be dropped from the external set so @nx/rollup's
// `external: "all"` callback doesn't short-circuit before our resolveId hook can redirect the import.
const BUNDLED_DEPENDENCIES = ['@dereekb/util/eslint', '@dereekb/util', '@dereekb/dbx-cli'];

/**
 * Whether a module id should be inlined into the bundle rather than left external.
 *
 * @param id - Module id rollup is resolving.
 * @returns True when the id matches one of the bundled dependencies (or a subpath of one).
 */
function shouldBundle(id: string): boolean {
  return BUNDLED_DEPENDENCIES.some((name) => id === name || id.startsWith(`${name}/`));
}

/**
 * @param config - The rollup config @nx/rollup hands to the hook.
 * @param _options - The @nx/rollup options (unused).
 * @returns The mutated rollup config.
 *
 * @nx /rollup `rollupConfig` hook that inlines the workspace's internal `@dereekb/*` imports into
 * the published ESLint plugin bundle. Prepends an alias plugin redirecting {@link INTERNAL_ALIASES}
 * to their TS sources and wraps the `external: "all"` callback so {@link BUNDLED_DEPENDENCIES} are
 * treated as internal.
 */
export default async function applyInternalAliases(config: any, _options: any) {
  const aliasPlugin = {
    name: 'dbx-cli-eslint-internal-aliases',
    resolveId(source: string) {
      if (Object.hasOwn(INTERNAL_ALIASES, source)) {
        return INTERNAL_ALIASES[source];
      }
      return null;
    }
  };

  // @nx/rollup sets `external` to a function (from `external: "all"`) that pulls deps from the
  // project graph. Wrap it so the bundled deps are always treated as internal.
  const nxExternal = config.external;
  config.external = (id: string, ...rest: unknown[]) => {
    if (shouldBundle(id)) {
      return false;
    }
    if (typeof nxExternal === 'function') {
      return nxExternal(id, ...rest);
    }
    if (Array.isArray(nxExternal)) {
      return nxExternal.includes(id);
    }
    return Boolean(nxExternal);
  };

  config.plugins = [aliasPlugin, ...(Array.isArray(config.plugins) ? config.plugins : [])];
  return config;
}
