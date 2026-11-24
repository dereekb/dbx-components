/**
 * The fetch seam every llm network read goes through: `@dereekb/util/fetch`'s {@link ConfiguredFetch}.
 */

import { type Maybe } from '@dereekb/util';
import { type ConfiguredFetch } from '@dereekb/util/fetch';

/**
 * Resolves the fetch seam a read goes through: the injected one (a spec's fake), else the global `fetch`.
 *
 * The global is read at CALL time, never at import or construction, so the browser entries stay import-safe and a spec
 * may stub the global after building a reader.
 *
 * @param fetch - The injected seam, if any.
 * @returns The fetch to call.
 */
export function resolveLlmFetch(fetch: Maybe<ConfiguredFetch>): ConfiguredFetch {
  return fetch ?? ((input, init) => globalThis.fetch(input, init));
}
