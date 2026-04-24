/**
 * Registry barrel for dbx-components domains.
 *
 * Each domain exports typed metadata constants (plain TypeScript, no state)
 * plus pure getter functions. Domains are populated incrementally — see the
 * implementation plan in the feat/dbx-components-mcp branch.
 *
 * Planned domains:
 *   - forge-fields       field factories, composite builders, and layout primitives
 *   - firebase-models    model identity, data interfaces, converters, collection patterns
 *   - model-pointers     lightweight source-file pointers used by the decode tool
 *   - server-actions     callable / on-call / scheduled / event pipeline patterns
 *   - component-patterns action, list, and store patterns
 *   - conventions        TypeScript coding standards and semantic type catalog
 */

export interface PropertyInfo {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly required: boolean;
  readonly default?: unknown;
}

// MARK: Forge Fields
import { FORGE_FIELDS, type ForgeFieldInfo, type ForgeTier, type ForgeArrayOutput } from './forge-fields.js';

export { FORGE_FIELDS, FORGE_TIER_ORDER } from './forge-fields.js';
export type { ForgeFieldInfo, ForgeFieldFactoryInfo, ForgeCompositeBuilderInfo, ForgePrimitiveInfo, ForgeTier, ForgeFieldWrapperPattern, ForgeCompositeSuffix, ForgeLayoutPrimitive, ForgeArrayOutput } from './forge-fields.js';

/**
 * Returns every registered forge entry (factories, composites, primitives).
 */
export function getForgeFields(): readonly ForgeFieldInfo[] {
  return FORGE_FIELDS;
}

/**
 * Looks up a forge entry by its registry slug (e.g. `'text'`) or by factory
 * name (e.g. `'dbxForgeTextField'`). Factory-name lookup is case insensitive;
 * slug lookup is exact.
 */
export function getForgeField(key: string): ForgeFieldInfo | undefined {
  let result = FORGE_FIELDS.find((f) => f.slug === key);
  if (!result) {
    const lowered = key.toLowerCase();
    result = FORGE_FIELDS.find((f) => f.factoryName.toLowerCase() === lowered);
  }
  return result;
}

/**
 * PRIMARY index. Returns every forge entry whose `produces` matches `value`.
 *
 * Examples:
 *   `getForgeFieldsByProduces('string')` → text, text-area, searchable-text, ...
 *   `getForgeFieldsByProduces('Date')`   → date, date-time
 *   `getForgeFieldsByProduces('RowField')` → row (primitive) + date-range-row (composite)
 */
export function getForgeFieldsByProduces(value: string): readonly ForgeFieldInfo[] {
  return FORGE_FIELDS.filter((f) => f.produces === value);
}

/**
 * Returns every distinct `produces` value present in the registry. Useful for
 * listing available output primitives to callers that want to pick one before
 * querying.
 */
export function getForgeProducesCatalog(): readonly string[] {
  const set = new Set<string>();
  for (const field of FORGE_FIELDS) {
    set.add(field.produces);
  }
  const result = Array.from(set).sort();
  return result;
}

/**
 * Filters forge entries by {@link ForgeTier}.
 */
export function getForgeFieldsByTier(tier: ForgeTier): readonly ForgeFieldInfo[] {
  return FORGE_FIELDS.filter((f) => f.tier === tier);
}

/**
 * Filters forge entries by whether their output is an array (`'yes'`),
 * single value (`'no'`), or configurable (`'optional'`).
 */
export function getForgeFieldsByArrayOutput(arrayOutput: ForgeArrayOutput): readonly ForgeFieldInfo[] {
  return FORGE_FIELDS.filter((f) => f.arrayOutput === arrayOutput);
}
