import { type FirestoreCollectionGroup, type FirestoreCollectionLike, type FirestoreDocument, type FirestoreModelKey, type FirestoreModelType, makeFirestoreCollectionGroup } from '@dereekb/firebase';
import { type CliFirestoreQueryScope } from '../manifest/types';
import { CliError } from '../util/output';
import { type CliFirestoreModels } from './firestore.models';
import { cliFirestoreWiringError } from './firestore.sdk-identity';

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
  /**
   * The parent-document path templates the rules declare for this collection, from
   * `CliFirestoreQueryReachability.parentPaths` (e.g. `jl/{jobLocation}/jlj/{job}`). When supplied,
   * a `--parent` whose collection chain does not match one of them is rejected locally.
   */
  readonly parentPaths?: readonly string[];
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
  const { models, modelType, scope, isNested, parentKey, parentPaths } = input;

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

  if (parentKey != null) {
    assertCliFirestoreQueryParentKey({ modelType, parentKey, ...(parentPaths === undefined ? {} : { parentPaths }) });
  }

  let result: FirestoreCollectionLike<unknown>;

  // the SDK rejects a bad handle or path with a message naming none of `modelType` / `parentKey` /
  // the collection — all of which are known right here. `cliFirestoreWiringError` passes an
  // already-named `CliError` (unknown model type, malformed `--parent`) through untouched.
  try {
    const override = models.binding.collectionForModel?.({ collections: models.collections, modelType, parentKey });

    if (override == null) {
      const registered = models.serviceFor(modelType).getFirestoreCollection();
      result = parentKey == null ? registered : scopeCollectionToParent({ registered, modelType, parentKey });
    } else {
      result = override;
    }
  } catch (e) {
    throw cliFirestoreWiringError({
      error: e,
      operation: 'resolve the Firestore collection for this query',
      modelType,
      ...(parentKey === undefined ? {} : { parentKey }),
      firestoreContext: models.session.firestoreContext
    });
  }

  return result;
}

/**
 * Validates a `--parent` value before it is turned into a document reference.
 *
 * Both checks exist because the failure they prevent is otherwise unreadable. An odd-segment
 * `--parent` (a COLLECTION path, e.g. `jl/abc/jlj`) reaches `docAtPath` and comes back as a raw
 * Firestore path assertion; a well-formed key for the WRONG ancestor chain (e.g. `gb/abc` for a
 * collection that lives under `jl/{loc}/jlj/{job}`) silently produces an empty result set, which is
 * indistinguishable from "no matching documents".
 *
 * The chain comparison is on COLLECTION NAMES only — document ids are the caller's data, and the
 * rules templates carry `{wildcard}` placeholders there.
 *
 * @param input - The model type, the supplied parent key, and the rules-declared parent templates.
 * @param input.modelType - The model being queried, for the message.
 * @param input.parentKey - The raw `--parent` value.
 * @param input.parentPaths - The rules-declared parent path templates, when known.
 * @throws {CliError} `INVALID_ARGUMENT` when the key is not a document path, or names a chain the rules do not declare.
 */
export function assertCliFirestoreQueryParentKey(input: { readonly modelType: FirestoreModelType; readonly parentKey: FirestoreModelKey; readonly parentPaths?: readonly string[] }): void {
  const { modelType, parentKey, parentPaths = [] } = input;
  const segments = parentKey.split('/').filter((x) => x.length > 0);
  const quotedPaths = parentPaths.map((x) => `\`${x}\``).join(' or ');

  if (segments.length === 0 || segments.length % 2 !== 0) {
    const shape = quotedPaths.length > 0 ? `, matching ${quotedPaths}` : ' (e.g. `gb/abc123`)';

    throw new CliError({
      message: `--parent "${parentKey}" is not a document key.`,
      code: 'INVALID_ARGUMENT',
      suggestion: `A parent key is an EVEN number of path segments — collection/id pairs down to the parent document${shape}.`
    });
  }

  const chain = collectionChain(segments);
  const expected = parentPaths.map((path) => collectionChain(path.split('/').filter((x) => x.length > 0)));

  if (expected.length > 0 && !expected.some((x) => x.join('/') === chain.join('/'))) {
    throw new CliError({
      message: `--parent "${parentKey}" does not name a parent of "${modelType}": it walks ${chain.join(' → ')}.`,
      code: 'INVALID_ARGUMENT',
      suggestion: `\`firestore.rules\` places this collection under ${quotedPaths}. Pass a document key with that collection chain.`
    });
  }
}

/**
 * The collection names of a document path, i.e. every even-indexed segment.
 *
 * @param segments - The path segments.
 * @returns The collection names, in order.
 */
function collectionChain(segments: readonly string[]): string[] {
  return segments.filter((_, index) => index % 2 === 0);
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
 * @throws {CliError} When the SDK refuses the parent reference or the scoped subcollection.
 */
function scopeCollectionGroupToParent(group: FirestoreCollectionGroup<unknown, FirestoreDocument<unknown>>, parentKey: FirestoreModelKey): FirestoreCollectionLike<unknown> {
  const registered = group;
  const collectionName = registered.modelIdentity.collectionName;
  const firestoreContext = registered.firestoreContext;
  let result: FirestoreCollectionLike<unknown>;

  // `docAtPath` and `subcollection` are the two calls in the direct-Firestore path that hand a raw
  // Firestore handle / parent ref to the SDK, so they are where a bad handle first surfaces — and
  // this is the only frame that knows the collection name it was building.
  try {
    const parentRef = firestoreContext.drivers.firestoreAccessorDriver.docAtPath(firestoreContext.firestore, parentKey);

    // The spread is REQUIRED, not stylistic: `makeFirestoreCollectionGroup` mutates `config.cache`, so
    // reusing the object would rewrite the registered group's cache in place.
    result = makeFirestoreCollectionGroup({
      ...group.config,
      queryLike: firestoreContext.subcollection(parentRef, collectionName) as never
    }) as FirestoreCollectionLike<unknown>;
  } catch (e) {
    throw cliFirestoreWiringError({
      error: e,
      operation: 'scope the collection group to one parent document',
      modelType: registered.modelIdentity.modelType,
      collectionName,
      parentKey,
      firestoreContext
    });
  }

  return result;
}
