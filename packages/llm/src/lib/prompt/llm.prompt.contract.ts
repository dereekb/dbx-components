/**
 * The OUTPUT CONTRACT — the prompt section that tells the model which JSON fields to return, generated from the
 * enforced schema's DESCRIBED projection (a descriptor's `contractSchemaHint()`), so it cannot drift from what the
 * reply is validated against.
 *
 * The schema's authored sentences ride the PROMPT (the cache prefix, provider-independent and cached by construction)
 * rather than `response_format`, an API parameter outside the cache split that a grammar-constrained backend discards.
 * The described and the stripped projections are shape-identical; only the described one carries prose, and the
 * renderer reads deeper exactly where that prose waits:
 *
 * - A nested field's optionality travels with it (`about?: number`). Without the marker every inner field of a nested
 *   object reads as mandatory, and a model asked for an object it can only partly fill supplies PLACEHOLDER values (an
 *   empty string, a zero id) for the rest.
 * - A top-level array of objects always expands into an indented per-field block. A NESTED one expands only when the
 *   expansion delivers prose (some item field is described, or is itself an array of objects that carries prose), so a
 *   capability that merely nests an undescribed per-item value keeps its one-line label and its bytes.
 * - A nested plain object never expands — it keeps its `object { k: type, … }` label.
 * - An undescribed node renders byte-identically to its plain bullet, so a schema that describes nothing sends the
 *   same contract it always did.
 */

import { type Maybe } from '@dereekb/util';

/**
 * The heading every output contract opens with.
 */
export const LLM_OUTPUT_CONTRACT_HEADING = '## Output contract';

/**
 * The library's default intro line, between the heading and the field bullets. A host passes its own exact text.
 */
export const DEFAULT_LLM_OUTPUT_CONTRACT_INTRO = 'Return a JSON object with these fields:';

/**
 * The library's default closing sentence, after the field bullets. A host passes its own exact text; one call passes
 * its own through the request's `contractFooter`.
 */
export const DEFAULT_LLM_OUTPUT_CONTRACT_FOOTER = 'Use these field names exactly, and leave out an optional field rather than invent a value for it.';

/**
 * The indent one nesting level adds to a contract bullet — a top-level field's bullet is unindented, the fields of its
 * expanded array of objects are indented once, theirs twice.
 */
const LLM_OUTPUT_CONTRACT_INDENT = '    ';

/**
 * One JSON-Schema node as the renderer reads it.
 */
type LlmJsonSchemaNode = Readonly<Record<string, unknown>>;

/**
 * The node a JSON-Schema value is read as — the value itself when it is an object, else an empty node (which labels
 * `unknown`, carries no description and never expands), so a `false` or `null` node renders instead of throwing.
 *
 * @param value - The JSON-Schema value.
 * @returns The node.
 */
function llmJsonSchemaNodeOf(value: unknown): LlmJsonSchemaNode {
  return value != null && typeof value === 'object' ? (value as LlmJsonSchemaNode) : {};
}

/**
 * A node's properties, in insertion order — none when `properties` is absent or not an object.
 *
 * @param node - The JSON-Schema node.
 * @returns The `[key, child node]` pairs.
 */
function llmJsonSchemaPropertiesOf(node: LlmJsonSchemaNode): ReadonlyArray<readonly [string, LlmJsonSchemaNode]> {
  const properties = node['properties'];
  return properties != null && typeof properties === 'object' ? Object.entries(properties).map(([key, child]) => [key, llmJsonSchemaNodeOf(child)] as const) : [];
}

/**
 * A node's `required` keys — read only when `required` is an array.
 *
 * @param node - The JSON-Schema node.
 * @returns The required keys.
 */
function llmJsonSchemaRequiredOf(node: LlmJsonSchemaNode): ReadonlyArray<unknown> {
  const required = node['required'];
  return Array.isArray(required) ? required : [];
}

/**
 * A human-readable type label for a JSON-Schema node — a union (`anyOf` / `oneOf`, a literal `enum`, or a `type`
 * array) joined with `' | '`, one `const` literal, `<item>[]` for an array, `object { k: type, k2?: type }` for an
 * object (recursing, `?` marking an optional key), else the `type` word or `unknown`.
 *
 * @param node - The JSON-Schema node.
 * @returns The label.
 */
function llmJsonSchemaTypeLabel(node: LlmJsonSchemaNode): string {
  const nodeType = node['type'];
  const union = node['anyOf'] ?? node['oneOf'];
  const enumValues = node['enum'];
  let label: string;

  if (Array.isArray(union)) {
    label = union.map((branch) => (branch != null && typeof branch === 'object' ? llmJsonSchemaTypeLabel(branch as LlmJsonSchemaNode) : 'unknown')).join(' | ');
  } else if (Array.isArray(enumValues)) {
    label = enumValues.map((value) => JSON.stringify(value)).join(' | ');
  } else if (Object.prototype.hasOwnProperty.call(node, 'const')) {
    label = JSON.stringify(node['const']);
  } else if (Array.isArray(nodeType)) {
    label = nodeType.filter((entry): entry is string => typeof entry === 'string').join(' | ') || 'unknown';
  } else if (nodeType === 'array') {
    const items = node['items'];
    label = `${items != null && typeof items === 'object' ? llmJsonSchemaTypeLabel(items as LlmJsonSchemaNode) : 'unknown'}[]`;
  } else if (nodeType === 'object' || node['properties'] != null) {
    const required = llmJsonSchemaRequiredOf(node);
    const fields = llmJsonSchemaPropertiesOf(node)
      .map(([key, child]) => `${key}${required.includes(key) ? '' : '?'}: ${llmJsonSchemaTypeLabel(child)}`)
      .join(', ');
    label = `object { ${fields} }`;
  } else {
    label = typeof nodeType === 'string' ? nodeType : 'unknown';
  }

  return label;
}

/**
 * Whether a node is an array whose `items` are an object — the shape that may expand into a per-field block.
 *
 * @param node - The JSON-Schema node.
 * @returns Whether the node is an array of objects.
 */
function isLlmJsonSchemaArrayOfObjects(node: LlmJsonSchemaNode): boolean {
  const items = node['items'];
  return node['type'] === 'array' && items != null && typeof items === 'object' && ((items as LlmJsonSchemaNode)['type'] === 'object' || (items as LlmJsonSchemaNode)['properties'] != null);
}

/**
 * A node's authored `description`, whitespace-collapsed to ONE line (an authored newline would break the bullet list
 * the model reads). An absent, blank or non-string description yields `undefined`.
 *
 * @param node - The JSON-Schema node.
 * @returns The one-line description, or `undefined`.
 */
function llmOutputContractDescriptionOf(node: LlmJsonSchemaNode): Maybe<string> {
  const description = node['description'];
  const collapsed = typeof description === 'string' ? description.replaceAll(/\s+/g, ' ').trim() : '';
  return collapsed === '' ? undefined : collapsed;
}

/**
 * A node's description as the tail of its own bullet — `': <sentence>'`, or `''` when it carries none (which keeps an
 * undescribed bullet byte-identical to its plain form).
 *
 * @param node - The JSON-Schema node.
 * @returns The bullet tail.
 */
function llmOutputContractDescriptionTail(node: LlmJsonSchemaNode): string {
  const description = llmOutputContractDescriptionOf(node);
  return description == null ? '' : `: ${description}`;
}

/**
 * Whether expanding an array-of-objects node shows the model PROSE its one-line label cannot — some item field carries
 * a description, or is itself an array of objects that does. The node's OWN sentence does not count: it renders as the
 * bullet's tail either way. The gate on descending BELOW the top level.
 *
 * @param node - The array-of-objects node.
 * @returns Whether expanding the node delivers prose.
 */
function llmOutputContractExpansionCarriesProse(node: LlmJsonSchemaNode): boolean {
  const items = llmJsonSchemaNodeOf(node['items']);
  return llmJsonSchemaPropertiesOf(items).some(([, child]) => llmOutputContractDescriptionOf(child) != null || (isLlmJsonSchemaArrayOfObjects(child) && llmOutputContractExpansionCarriesProse(child)));
}

/**
 * The inputs one output-contract field renders from.
 */
interface RenderLlmOutputContractFieldConfig {
  /**
   * The property name.
   */
  readonly key: string;
  /**
   * The property's JSON-Schema node.
   */
  readonly node: LlmJsonSchemaNode;
  /**
   * Whether the property is in its object's `required` set.
   */
  readonly isRequired: boolean;
  /**
   * The indent of the field's own bullet. Omitted ⇒ `''`, the top level, where an array of objects always expands.
   */
  readonly indent?: string;
}

/**
 * Render one field to its bullet line(s) — one inline bullet (name, type label, required / optional, description
 * tail), or, for an array of objects at the top level or one whose expansion carries prose, a header bullet plus one
 * sub-bullet per item field, one indent deeper.
 *
 * @param config - The property, its node, whether it is required and its indent.
 * @returns The field's lines.
 */
function renderLlmOutputContractField(config: RenderLlmOutputContractFieldConfig): ReadonlyArray<string> {
  const { key, node, isRequired } = config;
  const indent = config.indent ?? '';
  const requiredLabel = isRequired ? 'required' : 'optional';
  const description = llmOutputContractDescriptionOf(node);
  let lines: ReadonlyArray<string>;

  if (isLlmJsonSchemaArrayOfObjects(node) && (indent === '' || llmOutputContractExpansionCarriesProse(node))) {
    const items = llmJsonSchemaNodeOf(node['items']);
    const itemRequired = llmJsonSchemaRequiredOf(items);
    const subBullets = llmJsonSchemaPropertiesOf(items).flatMap(([itemKey, child]) => renderLlmOutputContractField({ key: itemKey, node: child, isRequired: itemRequired.includes(itemKey), indent: `${indent}${LLM_OUTPUT_CONTRACT_INDENT}` }));
    // The array's own sentence leads the per-item intro, so the header reads as one sentence.
    const intro = description == null ? 'an array where each item is an object with:' : `${description} Each item is an object with:`;
    lines = [`${indent}- \`${key}\` (object[], ${requiredLabel}): ${intro}`, ...subBullets];
  } else {
    lines = [`${indent}- \`${key}\` (${llmJsonSchemaTypeLabel(node)}, ${requiredLabel})${llmOutputContractDescriptionTail(node)}`];
  }

  return lines;
}

/**
 * Config for {@link renderLlmOutputContract}.
 */
export interface RenderLlmOutputContractConfig {
  /**
   * The projected JSON-Schema object — a descriptor's `contractSchemaHint()` (the DESCRIBED projection), or a per-call
   * override. A non-object schema renders no field lines.
   */
  readonly schema: unknown;
  /**
   * The intro line under the heading. Nullish ⇒ {@link DEFAULT_LLM_OUTPUT_CONTRACT_INTRO}; `''` ⇒ no intro line.
   */
  readonly intro?: Maybe<string>;
  /**
   * The closing sentence. Nullish ⇒ {@link DEFAULT_LLM_OUTPUT_CONTRACT_FOOTER}; `''` ⇒ no footer and no blank line
   * before it.
   */
  readonly footer?: Maybe<string>;
}

/**
 * Render the output contract — {@link LLM_OUTPUT_CONTRACT_HEADING}, a blank line, the intro, one bullet per top-level
 * property in insertion order (name, type label, `required` / `optional`, the node's description; an array of objects
 * expanded into an indented per-field block at the top level, and below it wherever the expansion delivers prose), a
 * blank line and the footer.
 *
 * Labels: `anyOf` / `oneOf` → branch labels joined `' | '`; a literal `enum` → JSON literals joined `' | '`; a `const`
 * → its JSON literal; a `type` array → its type words joined `' | '`; an array → `<item>[]`; an object →
 * `object { k: type, k2?: type }`; else the `type` word or `unknown`. A non-object schema renders no bullets, and a
 * `false` / `null` property node labels `unknown`.
 *
 * @param config - The schema, and optionally the intro and footer texts.
 * @returns The rendered section (no trailing newline).
 *
 * @example
 * ```ts
 * renderLlmOutputContract({ schema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] } });
 * // ## Output contract
 * //
 * // Return a JSON object with these fields:
 * // - `title` (string, required)
 * //
 * // Use these field names exactly, and leave out an optional field rather than invent a value for it.
 * ```
 */
export function renderLlmOutputContract(config: RenderLlmOutputContractConfig): string {
  const schema = llmJsonSchemaNodeOf(config.schema);
  const intro = config.intro ?? DEFAULT_LLM_OUTPUT_CONTRACT_INTRO;
  const footer = config.footer ?? DEFAULT_LLM_OUTPUT_CONTRACT_FOOTER;
  const required = llmJsonSchemaRequiredOf(schema);
  const fields = llmJsonSchemaPropertiesOf(schema).flatMap(([key, node]) => renderLlmOutputContractField({ key, node, isRequired: required.includes(key) }));
  return [LLM_OUTPUT_CONTRACT_HEADING, '', ...(intro === '' ? [] : [intro]), ...fields, ...(footer === '' ? [] : ['', footer])].join('\n');
}
