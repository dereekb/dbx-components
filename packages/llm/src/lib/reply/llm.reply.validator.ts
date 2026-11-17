/**
 * The lever validator — the synchronous, deterministic "is this reply well-formed?" check a request opts into for a
 * bounded retry. A schema-backed builder (over the capability's arktype schema) joins this module later.
 */

/**
 * The opaque retry-decider the dispatcher calls on an already-unwrapped lever — `true` ⇒ accept the reply,
 * `{ error }` ⇒ reprompt with that error text (capped at the request's `maxAttempts`). The dispatcher never
 * inspects WHAT a verdict checks — it stays capability-agnostic.
 *
 * Synchronous and deterministic: it answers "is this well-formed?", never "is this good?" (that is the billed
 * critic's question, `LlmCritic`).
 */
export type LlmLeverValidator = (lever: unknown) => true | { readonly error: string };
