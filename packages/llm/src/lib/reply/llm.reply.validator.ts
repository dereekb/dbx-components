/**
 * The value validator — the synchronous, deterministic "is this reply well-formed?" check a request opts into for a
 * bounded retry — and its schema-backed builder, {@link makeLlmSchemaValueValidator}.
 */

import { type Type, type } from 'arktype';

/**
 * A verdict on one reply value — `true` ⇒ accept the reply; `{ error }` ⇒ reprompt with that error text. Returned by
 * both the synchronous {@link LlmValueValidator} and the billed async critic (`LlmCritic`).
 */
export type LlmReplyVerdict = true | { readonly error: string };

/**
 * The opaque retry-decider the dispatcher calls on an already-unwrapped value — `true` ⇒ accept the reply,
 * `{ error }` ⇒ reprompt with that error text (capped at the request's `maxAttempts`). The dispatcher never
 * inspects WHAT a verdict checks — it stays capability-agnostic.
 *
 * Synchronous and deterministic: it answers "is this well-formed?", never "is this good?" (that is the billed
 * critic's question, `LlmCritic`).
 */
export type LlmValueValidator = (value: unknown) => LlmReplyVerdict;

/**
 * Build an {@link LlmValueValidator} that validates an already-unwrapped value against an arktype wire schema: a schema
 * miss yields `{ error: <ArkErrors.summary> }` (the dispatcher reprompts with it), a pass yields `true`.
 *
 * A PURE schema check — deliberately NOT the capability's `parseValue`, which may also enforce non-schema "usable"
 * conditions. Only a schema-invalid value is a malformed reply worth re-asking; a schema-valid but unusable value is a
 * legitimate "no decision".
 *
 * @param schema - The capability's arktype wire schema to validate the unwrapped value against.
 * @returns The value validator a request hands the dispatcher as its `validate`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmSchemaValueValidator(schema: Type): LlmValueValidator {
  return (value) => {
    const out = schema(value);
    return out instanceof type.errors ? { error: out.summary } : true;
  };
}
