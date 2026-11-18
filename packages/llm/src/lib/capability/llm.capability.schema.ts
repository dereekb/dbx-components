/**
 * Schema projection — the ONE post-`toJsonSchema()` hardening pass every consumer of an arktype schema projection runs
 * ({@link normalizeLlmGeneratedSchema}), and the two projections a capability descriptor carries: the hardened,
 * description-stripped `response_format` payload ({@link projectLlmResponseSchema}) and the hardened, DESCRIBED shape
 * the output contract renders from ({@link projectLlmContractSchema}).
 *
 * The walk descends only REAL child positions, so a field literally NAMED `properties` never gets
 * `additionalProperties: false` stamped inside its property map (a phantom, never-satisfiable property).
 *
 * `toJsonSchema()` throws on a `.narrow` predicate, so a capability whose schema is narrowed projects its hints from an
 * un-narrowed base — `defineLlmCapability`'s `hintSchema`.
 */

import { type Maybe } from '@dereekb/util';
import { type Type } from 'arktype';

/**
 * Options for {@link normalizeLlmGeneratedSchema}.
 */
export interface NormalizeLlmGeneratedSchemaOptions {
  /**
   * Strip every `description` at every depth. An LLM `response_format` payload wants the STRUCTURE only — the prose a
   * model reads is rendered separately into the prompt's output contract, and shipping the same sentences twice pays
   * for them twice. Defaults to `false` (a tool-listing surface, where the prose IS the point).
   */
  readonly stripDescriptions?: Maybe<boolean>;
}

/**
 * One arm of a `const`-union candidate — the shape the {@link foldConstUnion} fold accepts.
 */
interface ConstArm {
  readonly const: unknown;
  readonly description?: string;
}

/**
 * Whether a union arm is a bare `const` (optionally described) — the fold's per-arm gate. A heterogeneous arm
 * (`{ type: 'string' }`, an object arm) fails it, so a genuine union is never damaged.
 *
 * @param arm - The candidate arm.
 * @returns True when the arm carries only `const` (and optionally `description`).
 */
function isConstArm(arm: unknown): arm is ConstArm {
  return arm != null && typeof arm === 'object' && 'const' in arm && Object.keys(arm).every((key) => key === 'const' || key === 'description');
}

/**
 * The union key a node carries (`anyOf` before `oneOf`), if any.
 *
 * @param schema - The schema node.
 * @returns The union key, or `undefined`.
 */
function unionKeyOf(schema: Record<string, unknown>): Maybe<'anyOf' | 'oneOf'> {
  let key: Maybe<'anyOf' | 'oneOf'>;

  if (Array.isArray(schema['anyOf'])) {
    key = 'anyOf';
  } else if (Array.isArray(schema['oneOf'])) {
    key = 'oneOf';
  }

  return key;
}

/**
 * Fold an all-`const` `anyOf` / `oneOf` back to the `enum` node arktype emits when the union carries NO description —
 * in place, dropping the arm list.
 *
 * **This is the reason the pass exists.** arktype emits an undescribed string-literal union as `{ enum: [...] }`, but a
 * DESCRIBED one as `anyOf`-of-`const` with the description stamped onto every arm. Measured on a described 21-member
 * literal union, that is about 20 times its undescribed bytes on one field. Describing a field must not cost twenty
 * times its own prose, so the fold restores arktype's own undescribed shape and the description rides once on the
 * node.
 *
 * It is a REMOVAL of a describe-induced artefact, not the invention of a shape: the folded node is deep-equal to the
 * undescribed emission plus one `description` key.
 *
 * **The MIXED case folds too, into one `enum` ARM rather than onto the node.** A single-or-array selector
 * (`enumerated(...) | enumerated(...)[]`) is flattened by arktype into ONE union whose arms are the array plus one
 * `const` per member. Collapsing the const RUN in place restores the two-arm shape it means:
 * `anyOf: [ {type:'array', items:{enum}}, {enum:[…]} ]`. The non-const arms keep their order and the collapsed arm
 * takes the position of the first const it replaces.
 *
 * @param schema - The schema node to fold in place.
 */
function foldConstUnion(schema: Record<string, unknown>): void {
  const key = unionKeyOf(schema);
  const arms = key == null ? undefined : (schema[key] as ReadonlyArray<unknown>);
  const constArms = (arms ?? []).filter(isConstArm);
  // Arms that disagree about their prose are NOT folded: an `enum` node has one description, so folding them would
  // silently pick a winner. (arktype stamps ONE description onto every arm, so this only guards a hand-assembled
  // union.)
  const described = Array.from(new Set(constArms.map((arm) => arm.description).filter((text): text is string => text != null)));

  if (arms != null && key != null && constArms.length >= 2 && described.length <= 1) {
    if (constArms.length === arms.length) {
      const description = schema['description'] ?? described[0];
      delete schema[key];
      schema['enum'] = constArms.map((arm) => arm.const);
      if (description !== undefined) {
        schema['description'] = description;
      }
    } else {
      const folded: Record<string, unknown> = { enum: constArms.map((arm) => arm.const) };
      if (described[0] !== undefined && schema['description'] === undefined) {
        folded['description'] = described[0];
      }
      const firstConst = arms.findIndex(isConstArm);
      schema[key] = arms.flatMap((arm, index) => {
        let kept: unknown[] = [arm];

        if (isConstArm(arm)) {
          kept = index === firstConst ? [folded] : [];
        }

        return kept;
      });
    }
  }
}

/**
 * HOIST one description off every arm of a union onto the union node itself — the {@link foldConstUnion} repair
 * generalized to a union the fold cannot flatten.
 *
 * arktype stamps a `.describe()` onto EVERY arm, not just the node, so describing a heterogeneous union like
 * `number.integer | string` multiplies the sentence by the arm count and changes the emitted shape for no reader
 * benefit. Hoisting restores the undescribed emission plus one `description`, exactly as the const fold does.
 *
 * Applies only when every arm that CARRIES prose carries the SAME text and the node either agrees or is silent, so a
 * genuinely per-arm documented union keeps its arm prose.
 *
 * **An UNDESCRIBED arm does not block the hoist**, and that tolerance is load-bearing rather than lax. arktype renders
 * a `boolean` arm as one collapsed `true | false` node and hands back a shared instance that `.describe()` never
 * reaches, so `number | string | boolean | null` emits described arms and one bare one. Requiring unanimity there would
 * leave the multiplied prose on the wire. A single `.describe()` is the only way arms come to agree at all, so
 * agreement-among-the-described is the honest signal that this is a describe-induced artefact.
 *
 * @param schema - The schema node to hoist in place.
 */
function hoistArmDescriptions(schema: Record<string, unknown>): void {
  ['anyOf', 'oneOf'].forEach((key) => {
    const arms = schema[key];

    if (Array.isArray(arms) && arms.length > 0) {
      const texts = arms.map((arm) => (arm != null && typeof arm === 'object' ? (arm as Record<string, unknown>)['description'] : undefined));
      const own = schema['description'];
      const described = Array.from(new Set(texts.filter((text): text is string => typeof text === 'string')));
      const shared = described[0];

      if (described.length === 1 && (own === undefined || own === shared)) {
        arms.forEach((arm) => delete (arm as Record<string, unknown>)['description']);
        schema['description'] = shared;
      }
    }
  });
}

/**
 * Normalize one already-cloned schema node in place, then recurse into its real child positions (`properties` values,
 * array `items`, and the `anyOf` / `oneOf` / `allOf` arms) — deliberately NOT every object value, so a field NAMED
 * `properties` / `items` / `anyOf` is never mistaken for schema structure.
 *
 * @param node - The schema node.
 * @param stripDescriptions - Whether to drop `description` at this node.
 */
function normalizeNode(node: unknown, stripDescriptions: boolean): void {
  if (node != null && typeof node === 'object') {
    const schema = node as Record<string, unknown>;

    if (schema['type'] === 'object' && schema['additionalProperties'] === undefined) {
      schema['additionalProperties'] = false;
    }

    const properties = schema['properties'];
    if (properties != null && typeof properties === 'object') {
      Object.values(properties as Record<string, unknown>).forEach((child) => normalizeNode(child, stripDescriptions));
    }

    if (schema['items'] != null) {
      normalizeNode(schema['items'], stripDescriptions);
    }

    ['anyOf', 'oneOf', 'allOf'].forEach((branch) => {
      const arms = schema[branch];
      if (Array.isArray(arms)) {
        arms.forEach((arm) => normalizeNode(arm, stripDescriptions));
      }
    });

    hoistArmDescriptions(schema);
    foldConstUnion(schema);

    if (stripDescriptions) {
      delete schema['description'];
    }
  }
}

/**
 * Normalize an already-generated JSON Schema (arktype's `toJsonSchema()` output, a request-supplied hint, or a tool's
 * input schema) into the wire shape a projection ships: arktype's `$schema` marker stripped, every object node stamped
 * `additionalProperties: false`, every union's repeated per-arm description hoisted onto the union node, every `const`
 * run in an `anyOf` / `oneOf` folded back to `enum` — onto the node when every arm is a const, into a single arm when
 * only some are — and, when asked, every `description` removed.
 *
 * The source object is untouched (a JSON round-trip deep clone; the projection is pure JSON). IDEMPOTENT, so a caller
 * may normalize a hint without knowing whether it was normalized already.
 *
 * @param generated - The generated JSON-Schema object.
 * @param options - The normalization options.
 * @returns The normalized JSON-Schema object.
 */
export function normalizeLlmGeneratedSchema(generated: unknown, options?: Maybe<NormalizeLlmGeneratedSchemaOptions>): Record<string, unknown> {
  // eslint-disable-next-line unicorn/prefer-structured-clone -- the JSON round trip normalizes to pure JSON (undefined members dropped), which the projection is by contract
  const cloned = JSON.parse(JSON.stringify(generated)) as Record<string, unknown>;
  delete cloned['$schema'];
  normalizeNode(cloned, options?.stripDescriptions === true);
  return cloned;
}

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
 * Harden an ALREADY-GENERATED JSON-Schema hint into the wire shape a strict structured-output backend needs — the
 * {@link normalizeLlmGeneratedSchema} pass with descriptions STRIPPED unless `describe` is `true`. There is no
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
  return normalizeLlmGeneratedSchema(generated, { stripDescriptions: config?.describe !== true });
}

/**
 * Project an arktype schema to a hardened JSON-Schema object — {@link hardenLlmResponseSchemaHint} over its
 * `toJsonSchema()` output. What `response_format` carries. Throws on a `.narrow`ed schema.
 *
 * @param schema - The arktype wire schema.
 * @param config - Whether to keep the description prose (default strip).
 * @returns The hardened JSON-Schema object.
 */
export function projectLlmResponseSchema(schema: Type, config?: Maybe<HardenLlmResponseSchemaHintConfig>): Record<string, unknown> {
  return hardenLlmResponseSchemaHint(schema.toJsonSchema(), config);
}

/**
 * Project an arktype schema to the hardened JSON-Schema object the output-contract prose renders from —
 * {@link projectLlmResponseSchema}'s shape with the authored `description` prose KEPT. Throws on a `.narrow`ed schema.
 *
 * @param schema - The arktype wire schema.
 * @returns The hardened, DESCRIBED JSON-Schema object.
 */
export function projectLlmContractSchema(schema: Type): Record<string, unknown> {
  return hardenLlmResponseSchemaHint(schema.toJsonSchema(), { describe: true });
}
