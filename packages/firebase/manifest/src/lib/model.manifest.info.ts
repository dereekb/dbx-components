import { type CodedError, type Maybe } from '@dereekb/util';
import { BaseError } from 'make-error';
import { findModelManifestEntry, groupModelManifestEntries, type ModelManifestEntry } from './model.manifest';
import { findModelManifestEnum, findReferencedModelManifestEnums, type ModelManifestEnum } from './model.manifest.enum';
import { MODEL_MANIFEST_CATALOG_HIT_KINDS, searchModelManifestCatalog, type ModelManifestCatalog, type ModelManifestCatalogHit, type ModelManifestCatalogHitKind } from './model.manifest.catalog';
import { type ModelManifestEnumUsage } from './model.manifest.usage';

// MARK: Constants
/**
 * Maximum number of names one `model` / `enum` lookup accepts.
 */
export const MAX_MODEL_MANIFEST_INFO_LOOKUP_NAMES = 20;

/**
 * Error code carried by {@link ModelManifestInfoInputError}.
 */
export const MODEL_MANIFEST_INFO_INVALID_INPUT_ERROR_CODE = 'MODEL_MANIFEST_INFO_INVALID_INPUT';

// MARK: Input
/**
 * Input of the catalog info lookup shared by the MCP `<prefix>_api_info` tool and the dbx-cli
 * `info` command. Pass at most one of `query`, `model`, `enum`; pass none for the overview.
 */
export interface ModelManifestInfoInput {
  /**
   * One to three keywords. Returns one-line model, field, and enum hits.
   */
  readonly query?: Maybe<string>;
  /**
   * Restricts `query` hits to one kind. Without a query, lists every entry of that kind.
   */
  readonly kind?: Maybe<ModelManifestCatalogHitKind>;
  /**
   * Models to return in full, each matched by modelType, identity const, or collection prefix.
   */
  readonly model?: Maybe<string | readonly string[]>;
  /**
   * Enums to return, each matched exactly by declaration name.
   */
  readonly enum?: Maybe<string | readonly string[]>;
  readonly limit?: Maybe<number>;
  readonly offset?: Maybe<number>;
}

/**
 * {@link ModelManifestInfoInput} validated by {@link normalizeModelManifestInfoInput}.
 */
export type NormalizedModelManifestInfoInput =
  | { readonly mode: 'overview' }
  | { readonly mode: 'search'; readonly query: string; readonly kind?: ModelManifestCatalogHitKind; readonly limit?: number; readonly offset?: number }
  | { readonly mode: 'model'; readonly names: readonly string[] }
  | { readonly mode: 'enum'; readonly names: readonly string[] };

/**
 * Thrown by {@link normalizeModelManifestInfoInput} for an invalid argument combination.
 */
export class ModelManifestInfoInputError extends BaseError implements CodedError {
  readonly code = MODEL_MANIFEST_INFO_INVALID_INPUT_ERROR_CODE;
}

/**
 * Validates the info input and decides its mode.
 *
 * Rules: at most one of `query` / `model` / `enum`; `kind` / `limit` / `offset` only with `query`
 * or `kind`, never with a lookup; lookup names must be non-empty, at most
 * {@link MAX_MODEL_MANIFEST_INFO_LOOKUP_NAMES}, and are deduped in request order. A blank `query`
 * counts as absent.
 *
 * @param input - The raw input.
 * @returns The normalized input.
 * @throws {ModelManifestInfoInputError} When the input is invalid.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function normalizeModelManifestInfoInput(input: ModelManifestInfoInput): NormalizedModelManifestInfoInput {
  const rawQuery = input.query;

  if (rawQuery != null && typeof rawQuery !== 'string') {
    throw new ModelManifestInfoInputError('"query" must be a string.');
  }

  const query = rawQuery?.trim() ?? '';
  const kind = input.kind ?? undefined;

  if (kind != null && !MODEL_MANIFEST_CATALOG_HIT_KINDS.includes(kind)) {
    throw new ModelManifestInfoInputError(`"kind" must be one of ${MODEL_MANIFEST_CATALOG_HIT_KINDS.join(', ')}.`);
  }

  const limit = readOptionalNumber(input.limit, 'limit');
  const offset = readOptionalNumber(input.offset, 'offset');
  const hasQuery = query.length > 0;
  const hasModel = input.model != null;
  const hasEnum = input.enum != null;
  const hasSearchOptions = kind != null || limit != null || offset != null;

  if ([hasQuery, hasModel, hasEnum].filter(Boolean).length > 1) {
    throw new ModelManifestInfoInputError('Pass at most one of "query", "model", or "enum".');
  }

  let result: NormalizedModelManifestInfoInput;

  if (hasModel || hasEnum) {
    const label = hasModel ? 'model' : 'enum';

    if (hasSearchOptions) {
      throw new ModelManifestInfoInputError(`"kind", "limit", and "offset" only apply to "query"; they cannot be passed with "${label}".`);
    }

    result = { mode: label, names: readLookupNames(hasModel ? input.model : input.enum, label) };
  } else if (hasQuery || kind != null) {
    result = { mode: 'search', query, ...(kind == null ? {} : { kind }), ...(limit == null ? {} : { limit }), ...(offset == null ? {} : { offset }) };
  } else if (limit != null || offset != null) {
    throw new ModelManifestInfoInputError('"limit" and "offset" need a "query" or a "kind".');
  } else {
    result = { mode: 'overview' };
  }

  return result;
}

// MARK: Output
/**
 * Hint texts each surface supplies, naming its own arguments (MCP parameters or CLI flags).
 */
export interface ModelManifestInfoHints {
  /**
   * Attached to the overview: how to search and look up.
   */
  readonly overview: string;
  /**
   * Attached to a search whose hits match only some of the query words.
   */
  readonly partial: string;
  /**
   * Attached to a non-empty search that matched nothing.
   */
  readonly noMatch: string;
  /**
   * Attached to a model lookup with misses.
   */
  readonly modelNotFound: string;
  /**
   * Attached to an enum lookup with misses.
   */
  readonly enumNotFound: string;
}

/**
 * The models of one group in the overview.
 */
export interface ModelManifestInfoOverviewGroup {
  readonly modelGroup: string;
  readonly modelTypes: readonly string[];
}

/**
 * Output with no arguments: the model types by group and the enum names.
 */
export interface ModelManifestInfoOverviewOutput {
  readonly mode: 'overview';
  readonly totalModels: number;
  readonly totalEnums: number;
  readonly groups: readonly ModelManifestInfoOverviewGroup[];
  readonly enumNames: readonly string[];
  readonly hint: string;
}

/**
 * Output of a `query` (or `kind`-only) search.
 */
export interface ModelManifestInfoSearchOutput {
  readonly mode: 'search';
  readonly total: number;
  /**
   * The `offset` of the next page. Present when more hits remain.
   */
  readonly nextOffset?: number;
  readonly partial?: true;
  readonly hint?: string;
  readonly hits: readonly ModelManifestCatalogHit[];
}

/**
 * Output of a `model` lookup: the catalog entries as stored, plus the enum tables their fields use.
 */
export interface ModelManifestInfoModelOutput {
  readonly mode: 'model';
  readonly models: readonly ModelManifestEntry[];
  readonly enums?: readonly ModelManifestEnum[];
  readonly notFound?: readonly string[];
  readonly hint?: string;
}

/**
 * An enum value table with the fields that store it.
 */
export interface ModelManifestInfoEnumDetail extends ModelManifestEnum {
  readonly usedBy: readonly ModelManifestEnumUsage[];
}

/**
 * Output of an `enum` lookup: the value tables, each with the fields that use it.
 */
export interface ModelManifestInfoEnumOutput {
  readonly mode: 'enum';
  readonly enums: readonly ModelManifestInfoEnumDetail[];
  readonly notFound?: readonly string[];
  readonly hint?: string;
}

/**
 * Output of the catalog info lookup. Every variant carries `mode`.
 */
export type ModelManifestInfoOutput = ModelManifestInfoOverviewOutput | ModelManifestInfoSearchOutput | ModelManifestInfoModelOutput | ModelManifestInfoEnumOutput;

/**
 * Input to {@link resolveModelManifestInfoOutput}.
 */
export interface ResolveModelManifestInfoOutputInput {
  readonly catalog: ModelManifestCatalog;
  readonly input: ModelManifestInfoInput;
  readonly hints: ModelManifestInfoHints;
}

/**
 * Resolves the catalog info lookup — the single source of the output both the MCP
 * `<prefix>_api_info` tool and the dbx-cli `info` command return. Returns catalog details only:
 * no value decoding and no computed answers. Lookup misses go to `notFound` and never throw.
 *
 * @param config - The catalog, the raw input, and the surface's hint texts.
 * @returns The output for the input's mode.
 * @throws {ModelManifestInfoInputError} When the input is invalid.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function resolveModelManifestInfoOutput(config: ResolveModelManifestInfoOutputInput): ModelManifestInfoOutput {
  const { catalog, hints } = config;
  const input = normalizeModelManifestInfoInput(config.input);
  let result: ModelManifestInfoOutput;

  switch (input.mode) {
    case 'overview':
      result = {
        mode: 'overview',
        totalModels: catalog.models.length,
        totalEnums: catalog.enumNames.length,
        groups: groupModelManifestEntries(catalog.models).map((group) => ({ modelGroup: group.modelGroup, modelTypes: group.entries.map((entry) => entry.modelType) })),
        enumNames: catalog.enumNames,
        hint: hints.overview
      };
      break;
    case 'search': {
      const found = searchModelManifestCatalog({ catalog, query: input.query, kind: input.kind, limit: input.limit, offset: input.offset });
      const nextOffset = found.offset + found.hits.length;
      let hint: Maybe<string>;

      if (found.partial) {
        hint = hints.partial;
      } else if (found.total === 0 && input.query.length > 0) {
        hint = hints.noMatch;
      }

      result = {
        mode: 'search',
        total: found.total,
        ...(nextOffset < found.total && found.hits.length > 0 ? { nextOffset } : {}),
        ...(found.partial ? { partial: true as const } : {}),
        ...(hint == null ? {} : { hint }),
        hits: found.hits
      };
      break;
    }
    case 'model': {
      const models: ModelManifestEntry[] = [];
      const notFound: string[] = [];

      for (const name of input.names) {
        const entry = findModelManifestEntry(name, catalog.models);

        if (entry == null) {
          notFound.push(name);
        } else if (!models.includes(entry)) {
          models.push(entry);
        }
      }

      const enums = findReferencedModelManifestEnums({ fields: models.flatMap((entry) => entry.fields), enums: catalog.enums });

      result = {
        mode: 'model',
        models,
        ...(enums.length > 0 ? { enums } : {}),
        ...(notFound.length > 0 ? { notFound, hint: hints.modelNotFound } : {})
      };
      break;
    }
    case 'enum': {
      const enums: ModelManifestInfoEnumDetail[] = [];
      const notFound: string[] = [];

      for (const name of input.names) {
        const table = findModelManifestEnum(catalog.enums, name);

        if (table == null) {
          notFound.push(name);
        } else {
          enums.push({ ...table, usedBy: catalog.enumUsage.get(table.name) ?? [] });
        }
      }

      result = {
        mode: 'enum',
        enums,
        ...(notFound.length > 0 ? { notFound, hint: hints.enumNotFound } : {})
      };
      break;
    }
  }

  return result;
}

// MARK: Internal
function readOptionalNumber(value: unknown, label: string): Maybe<number> {
  if (value != null && (typeof value !== 'number' || !Number.isFinite(value))) {
    throw new ModelManifestInfoInputError(`"${label}" must be a number.`);
  }

  return value == null ? undefined : (value as number);
}

function readLookupNames(value: unknown, label: string): string[] {
  const raw: unknown[] = Array.isArray(value) ? value : [value];

  if (raw.length === 0) {
    throw new ModelManifestInfoInputError(`"${label}" must list at least one name.`);
  } else if (raw.length > MAX_MODEL_MANIFEST_INFO_LOOKUP_NAMES) {
    throw new ModelManifestInfoInputError(`"${label}" accepts at most ${MAX_MODEL_MANIFEST_INFO_LOOKUP_NAMES} names; got ${raw.length}.`);
  }

  const names: string[] = [];

  for (const item of raw) {
    const name = typeof item === 'string' ? item.trim() : '';

    if (name.length === 0) {
      throw new ModelManifestInfoInputError(`"${label}" names must be non-empty strings.`);
    }

    if (!names.includes(name)) {
      names.push(name);
    }
  }

  return names;
}
