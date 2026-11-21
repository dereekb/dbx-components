import { type Maybe } from '@dereekb/util';
import { type Type } from 'arktype';

/**
 * Config for {@link arktypeToJsonSchemaForExport}.
 */
export interface ArktypeToJsonSchemaForExportConfig {
  /**
   * Fail loud on a type with no JSON form.
   *
   * Narrowed predicates and morphs still export their JSON base, but there is no `default` fallback, so a `Date`,
   * `symbol`, `bigint` or an `undefined` union arm (e.g. `clearable()`) throws arktype's error instead of exporting
   * `false`. Choose it for a strict structured-output wire, where a `false` subschema would make a required field
   * unsatisfiable. Defaults to `false`.
   */
  readonly strict?: Maybe<boolean>;
}

/**
 * JSON Schema export helper that compensates for arktype's lossy export of narrow predicates,
 * morphs, and `undefined`. Without it, two cases go wrong.
 *
 *   - narrowed strings like `type('string > 0').narrow(...)` export as the empty schema `{}`
 *     because arktype drops the narrow predicate and has no JSON-shaped base to fall back on.
 *   - `clearable()` (a `T | null | undefined` union) exports as `anyOf: [<T>, {}, {type:"null"}]`
 *     because `undefined` has no JSON Schema equivalent.
 *
 * The fallback config:
 *   - `predicate` / `morph` — drop the lossy wrapper, keep the JSON-shaped base (e.g. a narrowed
 *     `string > 0` becomes `{type:"string", minLength:1}`).
 *   - `default` — emit `false` (matches nothing). This is a no-op inside `anyOf`, and
 *     {@link pruneFalseUnionBranches} strips it so `T | null | undefined` reads as `T | null`.
 *     Omitted when `strict` is set, so a type with no JSON form throws.
 *
 * The result is round-tripped through `JSON.parse(JSON.stringify(...))` to invoke arktype's
 * boxed-node `toJSON()` callbacks before pruning; `structuredClone` would not call them.
 *
 * @param t - The arktype Type to export.
 * @param config - Whether to throw on a type with no JSON form.
 * @returns The pruned JSON Schema fragment as a plain object.
 * @throws {Error} When `strict` is set and the type has no JSON form.
 */
export function arktypeToJsonSchemaForExport(t: Type<unknown>, config?: Maybe<ArktypeToJsonSchemaForExportConfig>): unknown {
  const raw =
    config?.strict === true
      ? t.toJsonSchema({
          fallback: {
            predicate: (ctx) => ctx.base,
            morph: (ctx) => ctx.base
          }
        })
      : t.toJsonSchema({
          fallback: {
            predicate: (ctx) => ctx.base,
            morph: (ctx) => ctx.base,
            // `false` is a valid JSON Schema value ("matches nothing"), but arktype's TS types
            // reject `false` as the fallback return — cast through `unknown` to keep runtime behavior.
            default: (() => false) as unknown as (ctx: unknown) => never
          }
        });
  // eslint-disable-next-line unicorn/prefer-structured-clone -- structuredClone would skip arktype's boxed-node toJSON() callbacks, so the JSON round trip is required here
  return pruneFalseUnionBranches(JSON.parse(JSON.stringify(raw))); // NOSONAR typescript:S7784
}

/**
 * Walks a JSON Schema and removes `false` entries from `anyOf` / `oneOf` arrays. `false`
 * schemas match nothing, so dropping them does not change what the schema accepts — it
 * just keeps the rendered output clean when {@link arktypeToJsonSchemaForExport}'s
 * `() => false` fallback emitted no-op branches for unjsonifiable types like `undefined`.
 *
 * @param value - JSON Schema fragment to clean.
 * @returns A structurally equivalent fragment with `false` branches dropped from any
 *   `anyOf` / `oneOf` arrays.
 */
export function pruneFalseUnionBranches(value: unknown): unknown {
  let result: unknown = value;

  if (Array.isArray(value)) {
    result = value.map(pruneFalseUnionBranches);
  } else if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};

    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if ((key === 'anyOf' || key === 'oneOf') && Array.isArray(raw)) {
        const filtered = raw.filter((v) => v !== false).map(pruneFalseUnionBranches);

        if (filtered.length > 0) {
          out[key] = filtered;
        }
      } else {
        out[key] = pruneFalseUnionBranches(raw);
      }
    }

    result = out;
  }

  return result;
}

// MARK: Node readers
/**
 * One JSON Schema node, read-only.
 */
export type JsonSchemaNode = Readonly<Record<string, unknown>>;

/**
 * The node a JSON Schema value is read as — the value itself when it is an object, else an empty node, so a
 * boolean `false` / `true` subschema or a `null` reads as `{}` instead of throwing.
 *
 * @param value - The JSON Schema value.
 * @returns The node.
 */
export function asJsonSchemaNode(value: unknown): JsonSchemaNode {
  return value != null && typeof value === 'object' ? (value as JsonSchemaNode) : {};
}

/**
 * A node's `properties`, in insertion order — none when `properties` is absent or not an object.
 *
 * @param node - The JSON Schema node.
 * @returns The `[key, child node]` pairs.
 */
export function readJsonSchemaProperties(node: JsonSchemaNode): ReadonlyArray<readonly [string, JsonSchemaNode]> {
  const properties = node['properties'];
  return properties != null && typeof properties === 'object' ? Object.entries(properties).map(([key, child]) => [key, asJsonSchemaNode(child)] as const) : [];
}

/**
 * A node's `required` keys — the string entries of `required` when it is an array, else none.
 *
 * @param node - The JSON Schema node.
 * @returns The required keys.
 */
export function readJsonSchemaRequired(node: JsonSchemaNode): ReadonlyArray<string> {
  const required = node['required'];
  return Array.isArray(required) ? required.filter((key): key is string => typeof key === 'string') : [];
}

/**
 * The keywords whose value maps names to subschemas.
 */
const JSON_SCHEMA_SUBSCHEMA_MAP_KEYWORDS: ReadonlyArray<string> = ['properties', 'patternProperties', '$defs', 'definitions'];

/**
 * The keywords whose value is one subschema.
 */
const JSON_SCHEMA_SUBSCHEMA_KEYWORDS: ReadonlyArray<string> = ['additionalProperties', 'items'];

/**
 * The keywords whose value is a list of subschemas.
 */
const JSON_SCHEMA_SUBSCHEMA_LIST_KEYWORDS: ReadonlyArray<string> = ['items', 'prefixItems', 'anyOf', 'oneOf', 'allOf'];

/**
 * Whether a JSON Schema value is an object node. A boolean subschema, `null` and a list are not.
 *
 * @param value - The JSON Schema value.
 * @returns True when the value is a non-list object.
 */
function isJsonSchemaNode(value: unknown): value is JsonSchemaNode {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * A node's object-valued subschemas, at the positions that describe an instance value or hold a `$ref` target.
 *
 * These are the `properties` and `patternProperties` values, a schema-valued `additionalProperties`, `items` (one
 * object, or each element of the list form), the `prefixItems` elements, the `anyOf` / `oneOf` / `allOf` arms, and the
 * `$defs` / `definitions` values.
 *
 * `not`, `if` / `then` / `else`, `propertyNames`, `dependentSchemas` and the data keywords (`const`, `default`, `enum`,
 * `examples`) are not read, so a value inside them is never mistaken for structure. A boolean subschema
 * (`items: false`, `additionalProperties: false`) is not a node and is skipped.
 *
 * @param node - The JSON Schema node.
 * @returns The child nodes.
 *
 * @example
 * ```ts
 * readJsonSchemaSubschemas({ type: 'array', prefixItems: [{ type: 'string' }, { type: 'object' }], items: false });
 * // [{ type: 'string' }, { type: 'object' }]
 * ```
 */
export function readJsonSchemaSubschemas(node: JsonSchemaNode): ReadonlyArray<JsonSchemaNode> {
  const candidates: ReadonlyArray<unknown> = [
    ...JSON_SCHEMA_SUBSCHEMA_MAP_KEYWORDS.flatMap((key) => {
      const map = node[key];
      return isJsonSchemaNode(map) ? Object.values(map) : [];
    }),
    ...JSON_SCHEMA_SUBSCHEMA_KEYWORDS.map((key) => node[key]),
    ...JSON_SCHEMA_SUBSCHEMA_LIST_KEYWORDS.flatMap((key) => {
      const list = node[key];
      return Array.isArray(list) ? list : [];
    })
  ];

  return candidates.filter(isJsonSchemaNode);
}

// MARK: Strict JSON Schema
/**
 * Config for {@link toStrictJsonSchema}.
 */
export interface ToStrictJsonSchemaConfig {
  /**
   * Strip every `description` at every depth. A structured-output payload (an LLM `response_format`) wants the
   * STRUCTURE only — when the prose a model reads is rendered separately into the prompt, shipping the same sentences
   * twice pays for them twice. Defaults to `false` (a tool-listing surface, where the prose IS the point).
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
 * Normalize one already-cloned schema node in place, children first.
 *
 * An open `type: 'object'` node is stamped `additionalProperties: false`, then every child
 * {@link readJsonSchemaSubschemas} returns is normalized, then the node's arm prose is hoisted, its const runs folded
 * and, when asked, its description stripped. The stamp writes a boolean, which is not a node, so it never adds a child.
 * Children are read from the schema positions only, so a field NAMED `properties` / `items` / `anyOf` is never
 * mistaken for schema structure.
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

    readJsonSchemaSubschemas(schema).forEach((child) => normalizeNode(child, stripDescriptions));
    hoistArmDescriptions(schema);
    foldConstUnion(schema);

    if (stripDescriptions) {
      delete schema['description'];
    }
  }
}

/**
 * Normalize an already-generated JSON Schema (arktype's `toJsonSchema()` / {@link arktypeToJsonSchemaForExport} output,
 * a request-supplied hint, or a tool's input schema) into the wire shape a strict structured-output backend accepts:
 * arktype's `$schema` marker stripped, every object node stamped `additionalProperties: false`, every union's repeated
 * per-arm description hoisted onto the union node, every `const` run in an `anyOf` / `oneOf` folded back to `enum` —
 * onto the node when every arm is a const, into a single arm when only some are — and, when asked, every `description`
 * removed.
 *
 * Every node {@link readJsonSchemaSubschemas} reaches is normalized, so objects inside tuples (`prefixItems`, list-form
 * `items`), `$defs` / `definitions` and records (a schema-valued `additionalProperties`, `patternProperties`) are
 * closed, hoisted, folded and stripped too: a strict structured-output backend rejects a schema with any open object.
 *
 * The source object is untouched (a JSON round-trip deep clone; the result is pure JSON). IDEMPOTENT, so a caller may
 * normalize a schema without knowing whether it was normalized already.
 *
 * @param schema - The generated JSON Schema object.
 * @param config - Whether to strip descriptions.
 * @returns The normalized JSON Schema object.
 *
 * @example
 * ```ts
 * toStrictJsonSchema(arktypeToJsonSchemaForExport(type({ k: 'string' }), { strict: true }));
 * // { type: 'object', properties: { k: { type: 'string' } }, required: ['k'], additionalProperties: false }
 * ```
 */
export function toStrictJsonSchema(schema: unknown, config?: Maybe<ToStrictJsonSchemaConfig>): Record<string, unknown> {
  // eslint-disable-next-line unicorn/prefer-structured-clone -- the JSON round trip normalizes to pure JSON (undefined members dropped), which the projection is by contract
  const cloned = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
  delete cloned['$schema'];
  normalizeNode(cloned, config?.stripDescriptions === true);
  return cloned;
}
