import { isEnvFlagEnabled, type Maybe } from '@dereekb/util';

/**
 * The environment a flag is read from: `process.env`, or an injected record in a spec.
 */
export type EnvFlagSource = Readonly<Record<string, Maybe<string>>>;

/**
 * A `describe`-shaped function: registers the suite `name`, whose tests `fn` declares.
 */
export type EnvFlagDescribeFunction = (name: string, fn: () => void) => void;

/**
 * Returns `describe` when the environment flag `name` is on (`1` / `true`, trimmed, any case — see `isEnvFlagEnabled`
 * from `@dereekb/util`), else `describe.skip`: the gate for specs that make real (billed) calls, so a suite only runs
 * them when asked to deliberately.
 *
 * Uses the vitest globals (`describe`), like the rest of `@dereekb/util/test`.
 *
 * @param name - The environment variable name, e.g. `'OPENROUTER_LIVE_SPECS'`.
 * @param env - The environment to read. Defaults to `process.env`.
 * @returns `describe`, or `describe.skip` when the flag is off.
 *
 * @example
 * ```ts
 * describeIfEnvFlag('OPENROUTER_LIVE_SPECS')('live probes', () => {
 *   it('should answer', async () => {
 *     // a real, billed call
 *   });
 * });
 * ```
 */
export function describeIfEnvFlag(name: string, env: EnvFlagSource = process.env): EnvFlagDescribeFunction {
  return describe.skipIf(!isEnvFlagEnabled(env[name]));
}
