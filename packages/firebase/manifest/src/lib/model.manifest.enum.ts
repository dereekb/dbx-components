import { type Maybe } from '@dereekb/util';
import { type ModelManifestField } from './model.manifest';

// MARK: Types
/**
 * One enum value with its persisted literal and the leading JSDoc paragraph.
 *
 * Mirrors the dbx-components MCP `FirebaseEnumValue` shape so the generated manifests carry the
 * same value→label tables the design-time catalog builds.
 */
export interface ModelManifestEnumValue {
  /**
   * Enum member name (e.g. `ACTIVE`).
   */
  readonly name: string;
  /**
   * Raw persisted literal stored in Firestore (e.g. `1`, `'a'`).
   */
  readonly value: number | string;
  /**
   * First paragraph of the member's JSDoc, when present.
   */
  readonly description?: string;
}

/**
 * One TypeScript enum referenced by some model field's `enumRef`, captured so consumers can decode
 * raw integer/string values without dropping into source.
 */
export interface ModelManifestEnum {
  /**
   * Enum declaration name (e.g. `NotificationSendState`).
   */
  readonly name: string;
  /**
   * Value table in source order.
   */
  readonly values: readonly ModelManifestEnumValue[];
  /**
   * First paragraph of the enum declaration's JSDoc, when present.
   */
  readonly description?: string;
}

/**
 * Generated map of {@link ModelManifestEnum} keyed by enum name, scoped to enums referenced by some
 * emitted model field's `enumRef`.
 */
export type ModelManifestEnums = { readonly [enumName: string]: ModelManifestEnum };

/**
 * Lookup output of {@link resolveModelManifestEnumLookup}: the resolved value tables, with any
 * unmatched names in `notFound`.
 */
export interface ModelManifestEnumLookupOutput {
  readonly enums: readonly ModelManifestEnum[];
  readonly notFound?: readonly string[];
  /**
   * How to find the right name. Present when {@link notFound} is non-empty.
   */
  readonly hint?: string;
}

/**
 * List output of {@link resolveModelManifestEnumList}.
 */
export interface ModelManifestEnumListOutput {
  /**
   * The registered enum declaration names, sorted.
   */
  readonly names: readonly string[];
  readonly total: number;
}

/**
 * Input to {@link resolveModelManifestEnumLookup}.
 */
export interface ResolveModelManifestEnumLookupInput {
  /**
   * The requested enum declaration names, already trimmed.
   */
  readonly names: readonly string[];
  readonly enums: ModelManifestEnums;
  /**
   * Hint attached when some names miss. Each surface passes its own wording.
   */
  readonly notFoundHint?: Maybe<string>;
}

/**
 * Input to {@link findReferencedModelManifestEnums}.
 */
export interface FindReferencedModelManifestEnumsInput {
  readonly fields: readonly ModelManifestField[];
  readonly enums: ModelManifestEnums;
}

// MARK: Lookup
/**
 * Finds one enum by exact declaration name. Only the map's own keys match, so `constructor` /
 * `toString` / `__proto__` are misses rather than `Object.prototype` members.
 *
 * @param enums - The enum value tables keyed by name.
 * @param name - The enum declaration name.
 * @returns The matching value table, or `undefined`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findModelManifestEnum(enums: ModelManifestEnums, name: string): Maybe<ModelManifestEnum> {
  // own keys only: a generated literal inherits from Object.prototype, so `enums['constructor']` is `Object`
  return Object.hasOwn(enums, name) ? enums[name] : undefined;
}

/**
 * Resolves each requested enum name against the tables by exact declaration name. Keeps request
 * order and duplicates; misses land in `notFound` together with the caller's hint.
 *
 * @param input - The names, the enum tables, and the optional not-found hint.
 * @returns The matched tables, with any unmatched names in `notFound`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function resolveModelManifestEnumLookup(input: ResolveModelManifestEnumLookupInput): ModelManifestEnumLookupOutput {
  const found: ModelManifestEnum[] = [];
  const notFound: string[] = [];

  for (const name of input.names) {
    const table = findModelManifestEnum(input.enums, name);

    if (table == null) {
      notFound.push(name);
    } else {
      found.push(table);
    }
  }

  let result: ModelManifestEnumLookupOutput;

  if (notFound.length > 0) {
    result = input.notFoundHint == null ? { enums: found, notFound } : { enums: found, notFound, hint: input.notFoundHint };
  } else {
    result = { enums: found };
  }

  return result;
}

/**
 * Lists the registered enum names, sorted.
 *
 * @param enums - The enum value tables keyed by name.
 * @returns The sorted names and their count.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function resolveModelManifestEnumList(enums: ModelManifestEnums): ModelManifestEnumListOutput {
  const names = Object.keys(enums).sort((a, b) => a.localeCompare(b));
  return { names, total: names.length };
}

/**
 * Collects the value tables of the enums the given fields reference by `enumRef`, recursing through
 * `nestedFields`. Deduped, in first-reference order; names missing from the tables are skipped.
 *
 * @param input - The fields to scan and the enum tables to resolve against.
 * @returns The referenced value tables.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findReferencedModelManifestEnums(input: FindReferencedModelManifestEnumsInput): ModelManifestEnum[] {
  const referenced = new Set<string>();

  function collect(fields: readonly ModelManifestField[]): void {
    for (const field of fields) {
      if (field.enumRef) referenced.add(field.enumRef);
      if (field.nestedFields) collect(field.nestedFields);
    }
  }

  collect(input.fields);

  const tables: ModelManifestEnum[] = [];

  for (const name of referenced) {
    const table = findModelManifestEnum(input.enums, name);
    if (table != null) tables.push(table);
  }

  return tables;
}
