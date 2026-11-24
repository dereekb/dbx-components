import { type ArrayOrValue, asArray, type Maybe, type Milliseconds } from '@dereekb/util';

/**
 * The default cold-import budget of {@link itShouldLoadWithoutEvaluating}.
 *
 * The probe loads a whole entry graph from source after a module-registry reset, so the import transforms every module
 * again; under a loaded machine (a parallel workspace run) that outruns vitest's 5s default by far.
 */
export const DEFAULT_LOAD_WITHOUT_EVALUATING_TIMEOUT: Milliseconds = 120_000;

/**
 * Configuration for {@link readModulesEvaluatedOnLoad}.
 */
export interface ReadModulesEvaluatedOnLoadConfig {
  /**
   * Imports the module(s) under test, e.g. `() => import('./index')`.
   */
  readonly load: () => Promise<unknown>;
  /**
   * Module ids that must stay unevaluated while `load` runs: bare specifiers (`'openai'`, `'@dereekb/llm'`) or ABSOLUTE
   * file paths (`join(import.meta.dirname, 'lib', 'sdk.ts')`).
   *
   * Relative ids are refused: they would resolve against this helper's file, not the caller's.
   */
  readonly modules: ArrayOrValue<string>;
}

/**
 * Loads a module graph from a fresh module registry and returns which of the watched module ids it evaluated.
 *
 * Each watched id is mocked with a passthrough factory (the original module is still returned, so nothing breaks), and a
 * factory call records the hit. The registry is reset before the load, so modules this worker imported earlier are
 * evaluated again (in CI vitest runs with `isolate: false`), and reset again afterwards, so nothing probed leaks into
 * later tests of the same worker.
 *
 * Only imports that pass through vitest's module runner are seen: source modules and the packages they import. An
 * import made from inside an externalized package (one `node_modules` package importing another) is invisible.
 *
 * Uses the vitest globals (`vi`), like the rest of `@dereekb/util/test`.
 *
 * @param config - The load to run and the module ids to watch.
 * @returns The watched ids the load evaluated, in the order they were given; empty when the graph stayed clear.
 * @throws {Error} When a watched id is relative.
 *
 * @example
 * ```ts
 * const evaluated = await readModulesEvaluatedOnLoad({ modules: ['openai', '@openrouter/sdk'], load: () => import('./index') });
 * expect(evaluated).toEqual([]);
 * ```
 */
export async function readModulesEvaluatedOnLoad(config: ReadModulesEvaluatedOnLoadConfig): Promise<string[]> {
  const ids = asArray(config.modules);
  const relativeId = ids.find((id) => id.startsWith('.'));

  if (relativeId != null) {
    throw new Error(`readModulesEvaluatedOnLoad() needs bare specifiers or absolute paths; "${relativeId}" would resolve against @dereekb/util/test, not the calling spec.`);
  }

  const evaluated = new Set<string>();
  vi.resetModules();

  ids.forEach((id) => {
    vi.doMock(id, async (importOriginal) => {
      evaluated.add(id);
      return importOriginal();
    });
  });

  try {
    await config.load();
  } finally {
    ids.forEach((id) => vi.doUnmock(id));
    vi.resetModules();
  }

  return ids.filter((id) => evaluated.has(id));
}

/**
 * Configuration for {@link itShouldLoadWithoutEvaluating}.
 */
export interface ItShouldLoadWithoutEvaluatingConfig extends ReadModulesEvaluatedOnLoadConfig {
  /**
   * The test title. Defaults to `should load without evaluating <ids>`.
   */
  readonly title?: Maybe<string>;
  /**
   * The test timeout. Defaults to {@link DEFAULT_LOAD_WITHOUT_EVALUATING_TIMEOUT}.
   */
  readonly timeout?: Maybe<Milliseconds>;
}

/**
 * Declares an `it` that loads a module graph and expects none of the watched module ids to be evaluated — the runtime
 * half of an entry-boundary guard (lint is the static half): e.g. "importing this entry never evaluates an optional SDK
 * peer".
 *
 * Uses the vitest globals (`it`, `expect`), like the rest of `@dereekb/util/test`. See {@link readModulesEvaluatedOnLoad}
 * for what the probe can and cannot see.
 *
 * @param config - The load, the watched ids and the optional title / timeout.
 *
 * @example
 * ```ts
 * describe('@dereekb/llm/openai entry', () => {
 *   itShouldLoadWithoutEvaluating({ modules: ['openai', '@openrouter/sdk'], load: () => import('./index') });
 * });
 * ```
 */
export function itShouldLoadWithoutEvaluating(config: ItShouldLoadWithoutEvaluatingConfig): void {
  const ids = asArray(config.modules);
  const title = config.title ?? `should load without evaluating ${ids.join(', ')}`;

  it(title, { timeout: config.timeout ?? DEFAULT_LOAD_WITHOUT_EVALUATING_TIMEOUT }, async () => {
    expect(await readModulesEvaluatedOnLoad(config)).toEqual([]);
  });
}
