import { resolve as resolvePath } from 'node:path';

const INTERNAL_ALIASES: Record<string, string> = {
  '@dereekb/util/eslint': resolvePath(__dirname, '../../util/eslint/src/index.ts')
};

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

  config.plugins = [aliasPlugin, ...(Array.isArray(config.plugins) ? config.plugins : [])];
  return config;
}
