import { type Maybe } from '@dereekb/util';
import { type CliFirestoreQueryManifestEntry, type CliFirestoreQueryReachability, type CliFirestoreQueryRulesAccess, type CliFirestoreQueryScope, type CliFirestoreQueryUnreachableReason } from '../manifest/types';
import { CliError } from '../util/output';

// MARK: Rule
/**
 * Input for {@link cliFirestoreQueryReachability}.
 *
 * Takes the rules facts as PLAIN values rather than a `FirestoreRulesCollectionEntry`, so the rule
 * lives in the shipped package while the scanner stays in the in-repo source-only
 * `@dereekb/dbx-cli/firestore-rules`. The generator is the one place that owns both.
 */
export interface CliFirestoreQueryReachabilityInput {
  readonly scope: CliFirestoreQueryScope;
  readonly isNested: boolean;
  /**
   * `FirestoreRulesCollectionEntry.collectionGroup` — whether a `/{path=**}/<collection>/{id}` block exists.
   */
  readonly collectionGroup: boolean;
  /**
   * `FirestoreRulesCollectionEntry.list` — the merged `list` posture for the collection.
   */
  readonly list: CliFirestoreQueryRulesAccess;
  /**
   * Parent-document path templates read off the collection's non-recursive rules match paths.
   */
  readonly parentPaths?: readonly string[];
}

/**
 * Resolves whether a client can run a catalog entry as declared, from the rules facts about its
 * collection.
 *
 * The rule, in the order it is applied:
 *
 * 1. `list` is not `allowed` — no block anywhere grants a list, so the entry is dead at EVERY
 *    scope. This is checked first because no amount of `--parent` scoping rescues it.
 * 2. `scope: 'COLLECTION_GROUP'` with no `/{path=**}/<collection>/{id}` block — the group shape is
 *    dead. A NESTED model degrades to `parent-only` (the path-scoped grant that satisfied step 1
 *    is what `--parent` runs against); a root collection has no parent to scope to, so
 *    `cliFirestoreCollectionForQuery` rejects `--parent` outright and the verdict is `unreachable`.
 * 3. Otherwise reachable. A `COLLECTION`-scope entry needs nothing more: `--parent` is already
 *    mandatory for a nested one, and the `list` grant from step 1 is exactly what it runs under.
 *
 * The verdict is a deliberate UNDER-approximation of unreachability. `list` is merged across every
 * match block that reaches the collection, so a recursive block that denies `list` while a nested
 * block allows it reads as `allowed` and the entry is called reachable. That direction is the safe
 * one — the scanner can never make this CLI refuse a query that actually works, only miss one that
 * does not.
 *
 * @param input - The entry's scope/nesting and the rules facts for its collection.
 * @returns The reachability verdict, with the reason attached whenever it is not `reachable`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function cliFirestoreQueryReachability(input: CliFirestoreQueryReachabilityInput): CliFirestoreQueryReachability {
  const { scope, isNested, collectionGroup, list, parentPaths } = input;
  const base = { list, collectionGroup, ...(parentPaths && parentPaths.length > 0 ? { parentPaths } : {}) };
  let result: CliFirestoreQueryReachability;

  if (list !== 'allowed') {
    const reason: CliFirestoreQueryUnreachableReason = list === 'denied' ? 'list-denied' : 'list-unmatched';
    result = { ...base, verdict: 'unreachable', reason };
  } else if (scope === 'COLLECTION_GROUP' && !collectionGroup) {
    result = { ...base, verdict: isNested ? 'parent-only' : 'unreachable', reason: 'no-collection-group-rule' };
  } else {
    result = { ...base, verdict: 'reachable' };
  }

  return result;
}

// MARK: Runtime gate
/**
 * Error code used when a query is refused because `firestore.rules` can never authorize it.
 */
export const FIRESTORE_QUERY_RULES_UNREACHABLE_CODE = 'FIRESTORE_QUERY_RULES_UNREACHABLE';

/**
 * Error code used when a query is runnable ONLY against a single parent and no `--parent` was given.
 */
export const FIRESTORE_QUERY_PARENT_REQUIRED_CODE = 'FIRESTORE_QUERY_PARENT_REQUIRED';

/**
 * Refuses a catalog entry the rules can never authorize, BEFORE a transport is chosen.
 *
 * Mirrors `assertCliModelIsNotServerOnly`, one level finer: that flag is per-MODEL and cannot say
 * "readable under its parent, dead as a collection group", which is exactly the shape this catches.
 * Answering locally makes the reason legible and free instead of surfacing as a bare
 * `Missing or insufficient permissions.` from the rules engine.
 *
 * An entry with no {@link CliFirestoreQueryManifestEntry.reachability} passes: the manifest was
 * generated without a `--rules` file, so nothing is known and a guess would be worse than a round trip.
 *
 * @param input - The catalog entry and the `--parent` key, when one was supplied.
 * @param input.entry - The catalog entry about to run.
 * @param input.parent - The `--parent` key, when supplied.
 * @throws {CliError} `FIRESTORE_QUERY_RULES_UNREACHABLE` when no client can run it, or `FIRESTORE_QUERY_PARENT_REQUIRED` when it needs a `--parent` that was not given.
 */
export function assertCliFirestoreQueryIsReachable(input: { readonly entry: CliFirestoreQueryManifestEntry; readonly parent?: Maybe<string> }): void {
  const { entry, parent } = input;
  const reachability = entry.reachability;

  if (reachability != null && reachability.verdict !== 'reachable') {
    if (reachability.verdict === 'unreachable') {
      throw new CliError({
        message: `Query "${entry.slug}" is catalogued but not reachable: ${reachabilityCause(entry)}`,
        code: FIRESTORE_QUERY_RULES_UNREACHABLE_CODE,
        suggestion: unreachableSuggestion(entry)
      });
    } else if (parent == null) {
      throw new CliError({
        message: `Query "${entry.slug}" cannot run at COLLECTION_GROUP scope: ${reachabilityCause(entry)}`,
        code: FIRESTORE_QUERY_PARENT_REQUIRED_CODE,
        suggestion: parentRequiredSuggestion(entry)
      });
    }
  }
}

// MARK: Rendering
/**
 * The one-word reachability verdict for the `firestore-queries` table's `REACHABLE` column.
 *
 * `?` means the manifest carries no verdict at all — the generator ran without a `--rules` file.
 *
 * @param entry - The catalog entry.
 * @returns `yes`, `parent`, `no`, or `?`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function cliFirestoreQueryReachabilityLabel(entry: CliFirestoreQueryManifestEntry): string {
  const verdict = entry.reachability?.verdict;
  let result: string;

  switch (verdict) {
    case 'reachable':
      result = 'yes';
      break;
    case 'parent-only':
      result = 'parent';
      break;
    case 'unreachable':
      result = 'no';
      break;
    default:
      result = '?';
      break;
  }

  return result;
}

/**
 * True when this CLI could actually run the entry — the factory bound AND the rules do not refuse
 * it at every scope. Backs `firestore-queries --invocable-only`.
 *
 * A `parent-only` entry counts as invocable: `--parent` runs it.
 *
 * @param entry - The catalog entry.
 * @returns Whether the entry is worth offering.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isCliFirestoreQueryInvocable(entry: CliFirestoreQueryManifestEntry): boolean {
  return entry.factory != null && entry.reachability?.verdict !== 'unreachable';
}

/**
 * Renders the `Reachable:` line of the `firestore-queries <query>` detail view.
 *
 * @param entry - The catalog entry.
 * @returns The rendered line body, without a trailing newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function describeCliFirestoreQueryReachability(entry: CliFirestoreQueryManifestEntry): string {
  const reachability = entry.reachability;
  let result: string;

  if (reachability == null) {
    result = 'unknown — the query manifest was generated without a `--rules` file, so no rules verdict is recorded.';
  } else if (reachability.verdict === 'reachable') {
    result = 'yes';
  } else if (reachability.verdict === 'parent-only') {
    result = `only with --parent — ${reachabilityCause(entry)} ${parentRequiredSuggestion(entry)}`;
  } else {
    result = `no — ${reachabilityCause(entry)} ${unreachableSuggestion(entry)}`;
  }

  return result;
}

// MARK: Internals
/**
 * The rules fact behind a non-`reachable` verdict, phrased as a sentence.
 *
 * @param entry - The catalog entry.
 * @returns The cause sentence.
 */
function reachabilityCause(entry: CliFirestoreQueryManifestEntry): string {
  const collection = entry.collection;
  let result: string;

  switch (entry.reachability?.reason) {
    case 'no-collection-group-rule':
      result = `\`firestore.rules\` declares no \`match /{path=**}/${collection}/{id}\` block, and a collection-group query is authorized by that block alone — a path-scoped block does not cover it.`;
      break;
    case 'list-denied':
      result = `\`firestore.rules\` denies \`list\` on \`${collection}\` (every grant is \`if false\`).`;
      break;
    case 'list-unmatched':
      result = `\`firestore.rules\` grants no \`list\` on \`${collection}\` at all, so the implicit default-deny applies.`;
      break;
    default:
      result = `\`firestore.rules\` does not authorize a client read of \`${collection}\` at ${entry.scope} scope.`;
      break;
  }

  return result;
}

/**
 * What to do about an entry no client can run at any scope.
 *
 * @param entry - The catalog entry.
 * @returns The suggestion sentence.
 */
function unreachableSuggestion(entry: CliFirestoreQueryManifestEntry): string {
  const collection = entry.collection;
  const rule = entry.reachability?.reason === 'no-collection-group-rule' ? `Add a \`match /{path=**}/${collection}/{id}\` block with a \`list\` grant to make the collection group queryable` : `Grant \`list\` on \`${collection}\` in \`firestore.rules\``;

  return `${rule}, or run this from server code (a Cloud Function or a server action) where the Admin SDK bypasses rules. No \`--via\` or \`--parent\` changes this.`;
}

/**
 * What to do about an entry that only runs when scoped to one parent.
 *
 * The COLLECTION-scope index caveat is called out because it is the very next wall an operator hits:
 * the catalog emits a COLLECTION_GROUP-scope composite index for this factory, and Firestore does
 * not serve a path-scoped query from it.
 *
 * @param entry - The catalog entry.
 * @returns The suggestion sentence.
 */
function parentRequiredSuggestion(entry: CliFirestoreQueryManifestEntry): string {
  const parentPaths = entry.reachability?.parentPaths ?? [];
  const shape = parentPaths.length > 0 ? parentPaths.map((x) => `\`${x}\``).join(' or ') : 'the parent document key';

  return `The path-scoped read IS granted, so pass \`--parent\` to run it against one parent's subcollection: ${shape}. If the factory uses more than one field, a COLLECTION-scope composite index may also be needed — the group-scope index this factory emits does not serve a path-scoped query.`;
}
