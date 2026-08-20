import { type FirestoreCollectionGroup, type FirestoreCollectionLike, type FirestoreDocument, type FirestoreModelKey, type FirestoreModelType, makeFirestoreCollectionGroup } from '@dereekb/firebase';
import { type CliFirestoreQueryScope } from '../manifest/types';
import { CliError } from '../util/output';
import { type CliFirestoreModels } from './firestore.models';

/**
 * Input for {@link cliFirestoreCollectionForQuery}.
 */
export interface CliFirestoreCollectionForQueryInput {
  readonly models: CliFirestoreModels;
  readonly modelType: FirestoreModelType;
  /**
   * The entry's declared scope. Together with {@link isNested} it decides whether `--parent` is
   * optional, required, or rejected.
   */
  readonly scope: CliFirestoreQueryScope;
  /**
   * Whether the model is a subcollection of some parent.
   */
  readonly isNested: boolean;
  /**
   * The parent document key to narrow to, from `--parent`.
   */
  readonly parentKey?: FirestoreModelKey;
}

/**
 * Resolves the collection a catalog entry should execute against, applying `--parent` scoping.
 *
 * The `--parent` rules, and why:
 *
 * | entry | `--parent` |
 * | --- | --- |
 * | `COLLECTION_GROUP` + nested | optional — narrows the group to one parent |
 * | `COLLECTION` + nested | **required** — the COLLECTION-scope composite index may not exist at group scope, so silently widening would turn a working query into a `FAILED_PRECONDITION` |
 * | not nested | rejected — a root collection has no parent to scope to |
 *
 * Narrowing is derived generically rather than per-model: `FirestoreCollectionGroup.config` is
 * public and `makeFirestoreCollectionGroup` accepts any `queryLike`, so re-pointing the group's
 * `queryLike` at `firestoreContext.subcollection(parentRef, collectionName)` scopes it to one
 * parent. `docAtPath` needs no parent modelType — the parent key IS the path.
 *
 * @param input - The models view, the entry's model/scope/nesting, and the optional parent key.
 * @returns The collection to query.
 * @throws {CliError} When `--parent` is missing where required, supplied where rejected, or the registered collection cannot be scoped.
 */
export function cliFirestoreCollectionForQuery(input: CliFirestoreCollectionForQueryInput): FirestoreCollectionLike<unknown> {
  const { models, modelType, scope, isNested, parentKey } = input;

  if (parentKey != null && !isNested) {
    throw new CliError({
      message: `Model "${modelType}" is not a subcollection, so --parent does not apply.`,
      code: 'INVALID_ARGUMENT',
      suggestion: 'Drop --parent.'
    });
  }

  if (parentKey == null && isNested && scope === 'COLLECTION') {
    throw new CliError({
      message: `Query for "${modelType}" is declared at COLLECTION scope, so it must be scoped to one parent.`,
      code: 'INVALID_ARGUMENT',
      suggestion: 'Pass --parent <parentKey>. Running a COLLECTION-scope query across the collection group is not equivalent — the composite index it needs is only built at COLLECTION scope.'
    });
  }

  const override = models.binding.collectionForModel?.({ collections: models.collections, modelType, parentKey });
  let result: FirestoreCollectionLike<unknown>;

  if (override == null) {
    const registered = models.serviceFor(modelType).getFirestoreCollection();
    result = parentKey == null ? registered : scopeCollectionToParent({ registered, modelType, parentKey });
  } else {
    result = override;
  }

  return result;
}

interface ScopeCollectionToParentInput {
  readonly registered: FirestoreCollectionLike<unknown>;
  readonly modelType: FirestoreModelType;
  readonly parentKey: FirestoreModelKey;
}

/**
 * Re-points a registered collection group at a single parent document's subcollection.
 *
 * @param input - The registered collection, its model type, and the parent key.
 * @returns A collection group scoped to that parent.
 * @throws {CliError} When the registered collection exposes no `config` to derive from.
 */
function scopeCollectionToParent(input: ScopeCollectionToParentInput): FirestoreCollectionLike<unknown> {
  const { registered, modelType, parentKey } = input;

  // `FirestoreCollectionLike` does not declare `config`; only `FirestoreCollectionGroup` does. An app
  // that registered a plain root collection for a nested model cannot be scoped this way.
  if ('config' in registered) {
    return scopeCollectionGroupToParent(registered as FirestoreCollectionGroup<unknown, FirestoreDocument<unknown>>, parentKey);
  }

  throw new CliError({
    message: `The registered collection for "${modelType}" cannot be scoped to a parent.`,
    code: 'INVALID_ARGUMENT',
    suggestion: 'Supply `collectionForModel` on the CLI firestore binding to scope this model explicitly.'
  });
}

/**
 * Re-points a collection group's `queryLike` at one parent document's subcollection.
 *
 * @param group - The registered collection group.
 * @param parentKey - The parent document key.
 * @returns A group scoped to that parent.
 */
function scopeCollectionGroupToParent(group: FirestoreCollectionGroup<unknown, FirestoreDocument<unknown>>, parentKey: FirestoreModelKey): FirestoreCollectionLike<unknown> {
  const registered = group;
  const collectionName = registered.modelIdentity.collectionName;
  const firestoreContext = registered.firestoreContext;
  const parentRef = firestoreContext.drivers.firestoreAccessorDriver.docAtPath(firestoreContext.firestore, parentKey);

  // The spread is REQUIRED, not stylistic: `makeFirestoreCollectionGroup` mutates `config.cache`, so
  // reusing the object would rewrite the registered group's cache in place.
  return makeFirestoreCollectionGroup({
    ...group.config,
    queryLike: firestoreContext.subcollection(parentRef, collectionName) as never
  }) as FirestoreCollectionLike<unknown>;
}
