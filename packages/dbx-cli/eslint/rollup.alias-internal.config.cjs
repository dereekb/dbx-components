const { resolve: resolvePath } = require('node:path');

// CommonJS form of rollup.alias-internal.config.ts so the `@nx/rollup/plugin` inferred
// `rollup.config.cjs` can `require()` it (Node cannot `require()` a `.ts` file).
//
// Internal workspace imports are aliased to their TypeScript sources so they are inlined into the
// published bundle. `node_modules/@dereekb/*` is not populated for these workspace packages, so a
// left-external `@dereekb/...` import would be unresolvable when the root `eslint.config.mjs` loads
// the plugin from `dist/`. `@dereekb/dbx-cli` resolves to the pure, dependency-free route-model-tag
// grammar module (NOT the package barrel) so the ESLint bundle never pulls in ts-morph / yargs / etc.
const INTERNAL_ALIASES = {
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
function shouldBundle(id) {
  return BUNDLED_DEPENDENCIES.some((name) => id === name || id.startsWith(`${name}/`));
}

module.exports = async function applyInternalAliases(config, _options) {
  const aliasPlugin = {
    name: 'dbx-cli-eslint-internal-aliases',
    resolveId(source) {
      if (Object.hasOwn(INTERNAL_ALIASES, source)) {
        return INTERNAL_ALIASES[source];
      }
      return null;
    }
  };

  // @nx/rollup sets `external` to a function (from `external: "all"`) that pulls deps from the
  // project graph. Wrap it so the bundled deps are always treated as internal.
  const nxExternal = config.external;
  config.external = (id, ...rest) => {
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
};
