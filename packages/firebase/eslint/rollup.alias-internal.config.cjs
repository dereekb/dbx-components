const { resolve: resolvePath } = require('node:path');

// CommonJS form of rollup.alias-internal.config.ts so the `@nx/rollup/plugin` inferred
// `rollup.config.cjs` can `require()` it (Node cannot `require()` a `.ts` file).
const INTERNAL_ALIASES = {
  '@dereekb/util/eslint': resolvePath(__dirname, '../../util/eslint/src/index.ts'),
  '@dereekb/util': resolvePath(__dirname, '../../util/src/index.ts')
};

// Dependencies that must be inlined into the published bundle rather than left external.
// `@marcbachmann/cel-js` powers the storage-rules CEL evaluator and is imported eagerly, so
// consumers that have not installed it would otherwise fail to load the entire plugin. Bundling
// it removes that runtime requirement.
// `@dereekb/util/eslint` and `@dereekb/util` are aliased to their TS sources above; they must
// also be dropped from the external set so @nx/rollup's `external: "all"` callback doesn't
// short-circuit before our resolveId hook can redirect the import. `@dereekb/util` is included
// so the rules consuming `classifySpecFile` / `buildCanonicalFilename` from the package root
// resolve to source at build time and get tree-shaken into the eslint bundle.
const BUNDLED_DEPENDENCIES = ['@marcbachmann/cel-js', '@dereekb/util/eslint', '@dereekb/util'];

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
    name: 'firebase-eslint-internal-aliases',
    resolveId(source) {
      if (Object.hasOwn(INTERNAL_ALIASES, source)) {
        return INTERNAL_ALIASES[source];
      }
      return null;
    }
  };

  // @nx/rollup sets `external` to a function (from `external: "all"`) that pulls deps from the
  // project graph, which re-externalizes cel-js even after it is dropped from peerDependencies.
  // Wrap it so the bundled deps are always treated as internal.
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
