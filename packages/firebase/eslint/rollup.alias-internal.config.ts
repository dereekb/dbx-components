import { resolve as resolvePath } from 'node:path';

const INTERNAL_ALIASES: Record<string, string> = {
  '@dereekb/util/eslint': resolvePath(__dirname, '../../util/eslint/src/index.ts')
};

// Dependencies that must be inlined into the published bundle rather than left external.
// `@marcbachmann/cel-js` powers the storage-rules CEL evaluator and is imported eagerly, so
// consumers that have not installed it would otherwise fail to load the entire plugin. Bundling
// it removes that runtime requirement.
const BUNDLED_DEPENDENCIES = ['@marcbachmann/cel-js'];

/**
 * Whether a module id should be inlined into the bundle rather than left external.
 *
 * @param id - Module id rollup is resolving.
 * @returns True when the id matches one of the bundled dependencies (or a subpath of one).
 */
function shouldBundle(id: string): boolean {
  return BUNDLED_DEPENDENCIES.some((name) => id === name || id.startsWith(`${name}/`));
}

export default async function applyInternalAliases(config: any, _options: any) {
  const aliasPlugin = {
    name: 'firebase-eslint-internal-aliases',
    resolveId(source: string) {
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
