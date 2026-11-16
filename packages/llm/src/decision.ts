/**
 * `@dereekb/llm/decision` — the decision (System One) vocabulary and strategy contract, loadable without any SDK.
 *
 * Everything here is ALSO exported from the root entry from the same modules (one chunk, one class identity).
 * Children of this family import decision symbols from `@dereekb/llm`, never this subpath.
 */
export * from './lib/decision';
