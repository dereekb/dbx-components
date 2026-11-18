/**
 * The lever validator — the synchronous, deterministic "is this reply well-formed?" check a request opts into for a
 * bounded retry — and its schema-backed builder, {@link llmSchemaLeverValidator}.
 */

import { type Type, type } from 'arktype';

/**
 * The opaque retry-decider the dispatcher calls on an already-unwrapped lever — `true` ⇒ accept the reply,
 * `{ error }` ⇒ reprompt with that error text (capped at the request's `maxAttempts`). The dispatcher never
 * inspects WHAT a verdict checks — it stays capability-agnostic.
 *
 * Synchronous and deterministic: it answers "is this well-formed?", never "is this good?" (that is the billed
 * critic's question, `LlmCritic`).
 */
export type LlmLeverValidator = (lever: unknown) => true | { readonly error: string };

/**
 * Build an {@link LlmLeverValidator} that validates an already-unwrapped lever against an arktype wire schema: a schema
 * miss yields `{ error: <ArkErrors.summary> }` (the dispatcher reprompts with it), a pass yields `true`.
 *
 * A PURE schema check — deliberately NOT the capability's `parseLever`, which may also enforce non-schema "usable"
 * conditions. Only a schema-invalid lever is a malformed reply worth re-asking; a schema-valid but unusable lever is a
 * legitimate "no decision".
 *
 * @param schema - The capability's arktype wire schema to validate the unwrapped lever against.
 * @returns The lever validator a request hands the dispatcher as its `validate`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function llmSchemaLeverValidator(schema: Type): LlmLeverValidator {
  return (lever) => {
    const out = schema(lever);
    return out instanceof type.errors ? { error: out.summary } : true;
  };
}
