import { type FirestoreModelKey, type FirestoreQueryConstraint, addOrReplaceLimitInConstraints } from '@dereekb/firebase';
import { type CliFirestoreQueryManifestEntry } from '../manifest/types';
import { CliError } from '../util/output';
import { cliFirestoreCollectionForQuery } from './firestore.collection';
import { type CliFirestoreModels } from './firestore.models';
import { resolveCliFirestoreQueryArgs } from './firestore.query-params';

/**
 * One row returned by {@link runCliFirestoreQuery}.
 */
export interface CliFirestoreQueryRow {
  readonly key: FirestoreModelKey;
  readonly id: string;
  readonly data: unknown;
}

/**
 * The result envelope of a `firestore-query` run.
 */
export interface CliFirestoreQueryResult {
  readonly slug: string;
  readonly model: string;
  readonly collection: string;
  readonly scope: string;
  readonly parent?: FirestoreModelKey;
  /**
   * Present unless `--count` was passed.
   */
  readonly rows?: readonly CliFirestoreQueryRow[];
  /**
   * Row count — the length of {@link rows}, or the `countDocs()` result under `--count`.
   */
  readonly count: number;
  readonly source: 'firestore';
}

/**
 * Input for {@link runCliFirestoreQuery}.
 */
export interface RunCliFirestoreQueryInput {
  readonly models: CliFirestoreModels;
  readonly entry: CliFirestoreQueryManifestEntry;
  readonly params?: string;
  readonly rawParams?: boolean;
  readonly parent?: FirestoreModelKey;
  readonly limit?: number;
  /**
   * Return only the count, with no rows.
   */
  readonly count?: boolean;
}

/**
 * Resolves the constraint list a catalog entry produces for the supplied `--params`.
 *
 * Split out from {@link runCliFirestoreQuery} so the constraints can be inspected (or executed
 * against a different sink, e.g. a future `--watch`) without running the query.
 *
 * @param input - The constraint inputs.
 * @param input.entry - The catalog entry whose factory is called.
 * @param input.params - The raw `--params` string, if supplied.
 * @param input.rawParams - When true, disables date coercion on the params.
 * @param input.limit - Replaces the factory's own `limit()` when supplied.
 * @returns The resolved constraints.
 * @throws {CliError} When the entry is not invocable, or the params do not fit its signature.
 */
export function cliFirestoreQueryConstraints(input: { readonly entry: CliFirestoreQueryManifestEntry; readonly params?: string; readonly rawParams?: boolean; readonly limit?: number }): FirestoreQueryConstraint[] {
  const { entry, params, rawParams, limit } = input;
  const factory = entry.factory;

  if (factory == null) {
    throw new CliError({
      message: `Query "${entry.slug}" is listed but not invocable: \`${entry.name}\` is not exported from "${entry.module}".`,
      code: 'FIRESTORE_QUERY_NOT_INVOCABLE',
      suggestion: `Export \`${entry.name}\` from the "${entry.module}" barrel, then regenerate the query manifest.`
    });
  }

  const args = resolveCliFirestoreQueryArgs({ entry, params, rawParams });
  const constraints = [...factory(...args)];

  // `addOrReplaceLimitInConstraints` REPLACES a factory-baked `limit()` rather than appending a
  // second one — two limits in one query is a Firestore error, not a narrowing.
  return limit == null ? constraints : addOrReplaceLimitInConstraints(limit)(constraints);
}

/**
 * Executes a catalog entry against Firestore over the direct session.
 *
 * Rows come from `getDocSnapshotDataPairs()` + the per-document converter, which costs ONE read per
 * row. `getDocs()` would cost two: `queryLike` is converter-less on both root collections and
 * groups, so it re-loads every matched document from its ref purely to apply the converter. Going
 * through `pair.document.converter` (rather than `collection.queryLike.withConverter(...)`) also
 * honours per-ref converters, such as a stored-data map keyed by document id.
 *
 * @param input - The models view, the entry, and the run options.
 * @returns The query result envelope.
 * @throws {CliError} On an argument, scoping, or invocability failure. Firestore's own errors (rules, missing index) surface via `cliFirestoreErrorMapper`.
 */
export async function runCliFirestoreQuery(input: RunCliFirestoreQueryInput): Promise<CliFirestoreQueryResult> {
  const { models, entry, params, rawParams, parent, limit, count = false } = input;

  const constraints = cliFirestoreQueryConstraints({ entry, params, rawParams, limit });
  const collection = cliFirestoreCollectionForQuery({
    models,
    modelType: entry.collection,
    scope: entry.scope,
    isNested: entry.isNested,
    parentKey: parent
  });

  const executable = collection.queryDocument(...constraints);
  const base = {
    slug: entry.slug,
    model: entry.model,
    collection: entry.collection,
    scope: entry.scope,
    ...(parent ? { parent } : {}),
    source: 'firestore' as const
  };

  let result: CliFirestoreQueryResult;

  if (count) {
    result = { ...base, count: await executable.countDocs() };
  } else {
    const pairs = await executable.getDocSnapshotDataPairs();
    const rows: CliFirestoreQueryRow[] = pairs.map((pair) => ({
      key: pair.document.key,
      id: pair.document.id,
      // the pair's own `data` is the RAW snapshot data — `queryLike` is converter-less, so decoding
      // has to go through the document's converter explicitly
      data: pair.document.converter.fromFirestore(pair.snapshot as never)
    }));

    result = { ...base, rows, count: rows.length };
  }

  return result;
}
