/**
 * Schema projection — the two projections a capability descriptor carries: the hardened, description-stripped
 * `response_format` payload ({@link projectLlmResponseSchema}) and the hardened, DESCRIBED shape the output contract
 * renders from ({@link projectLlmContractSchema}).
 *
 * Both export through `@dereekb/model`: `arktypeToJsonSchemaForExport(schema, { strict: true })`, then
 * `toStrictJsonSchema` (every object closed, per-arm prose hoisted, const runs folded, descriptions stripped when
 * asked). A `.narrow`ed or morphed schema projects its JSON base; a type with no JSON form (`Date`, `symbol`, `bigint`,
 * an `undefined` union arm) throws on first projection.
 */

import { arktypeToJsonSchemaForExport, toStrictJsonSchema } from '@dereekb/model';
import { type Maybe } from '@dereekb/util';
import { type Type } from 'arktype';

/**
 * Options for {@link hardenLlmResponseSchemaHint}.
 */
export interface HardenLlmResponseSchemaHintConfig {
  /**
   * `true` keeps the `description` prose; default `false` (strip).
   */
  readonly describe?: Maybe<boolean>;
}

/**
 * Harden an ALREADY-GENERATED JSON-Schema hint into the wire shape a strict structured-output backend needs —
 * `@dereekb/model`'s `toStrictJsonSchema` with descriptions STRIPPED unless `describe` is `true`. There is no
 * environment default: a host with a switch reads it itself and passes the value.
 *
 * **Why the strip.** `response_format` wants the STRUCTURE; the prose a model reads already rides the output contract
 * (rendered off the described sibling projection, {@link projectLlmContractSchema}), inside the cache prefix, while
 * `response_format` is an API parameter outside it. A grammar-constrained structured-output backend may discard a
 * schema's `description` anyway. A billed A/B found the prose helps in the contract and not in the payload.
 *
 * IDEMPOTENT (re-hardening an already-hardened hint is a no-op), so a dispatcher can harden a request-supplied hint
 * without knowing whether the caller already did. The source object is untouched, so the result is safely memoizable.
 *
 * @param generated - The generated JSON-Schema object (arktype's `toJsonSchema()` output, or a request hint).
 * @param config - Whether to keep the description prose.
 * @returns The hardened JSON-Schema object.
 */
export function hardenLlmResponseSchemaHint(generated: unknown, config?: Maybe<HardenLlmResponseSchemaHintConfig>): Record<string, unknown> {
  return toStrictJsonSchema(generated, { stripDescriptions: config?.describe !== true });
}

/**
 * Project an arktype schema to a hardened JSON-Schema object — {@link hardenLlmResponseSchemaHint} over its strict
 * `@dereekb/model` export. What `response_format` carries. A `.narrow`ed or morphed schema projects its JSON base.
 *
 * @param schema - The arktype wire schema.
 * @param config - Whether to keep the description prose (default strip).
 * @returns The hardened JSON-Schema object.
 * @throws {Error} When the schema holds a type with no JSON form (`Date`, `symbol`, `bigint`, an `undefined` union arm).
 */
export function projectLlmResponseSchema(schema: Type, config?: Maybe<HardenLlmResponseSchemaHintConfig>): Record<string, unknown> {
  return hardenLlmResponseSchemaHint(arktypeToJsonSchemaForExport(schema, { strict: true }), config);
}

/**
 * Project an arktype schema to the hardened JSON-Schema object the output-contract prose renders from —
 * {@link projectLlmResponseSchema}'s shape with the authored `description` prose KEPT.
 *
 * @param schema - The arktype wire schema.
 * @returns The hardened, DESCRIBED JSON-Schema object.
 * @throws {Error} When the schema holds a type with no JSON form (`Date`, `symbol`, `bigint`, an `undefined` union arm).
 */
export function projectLlmContractSchema(schema: Type): Record<string, unknown> {
  return hardenLlmResponseSchemaHint(arktypeToJsonSchemaForExport(schema, { strict: true }), { describe: true });
}
