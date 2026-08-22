import { type Maybe } from '@dereekb/util';
import { type CliFirestoreQueryManifestEntry, type CliFirestoreQueryMode, type CliFirestoreQueryModeReason, type CliFirestoreQueryRules, type CliFirestoreQueryRulesAccess, type CliFirestoreQueryScope } from '../manifest/types';
import { CliError } from '../util/output';

// MARK: Rule
/**
 * Input for {@link cliFirestoreQueryModeForRules}.
 *
 * Takes the rules facts as PLAIN values rather than a `FirestoreRulesCollectionEntry`, so the rule
 * lives in the shipped package while the scanner stays in the in-repo source-only
 * `@dereekb/dbx-cli/firestore-rules`. The generator is the one place that owns both.
 */
export interface CliFirestoreQueryModeForRulesInput {
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
 * The mode an entry resolves to, paired with the rules evidence behind it.
 */
export interface CliFirestoreQueryModeResult {
  readonly mode: CliFirestoreQueryMode;
  readonly rules: CliFirestoreQueryRules;
}

/**
 * Resolves how a catalog entry must be invoked, from the rules facts about its collection.
 *
 * The rule, in the order it is applied:
 *
 * 1. `list` is not `allowed` — no block anywhere grants a list, so the entry is dead at EVERY
 *    scope. Checked first because no amount of `--parent` scoping rescues it.
 * 2. `scope: 'COLLECTION_GROUP'` with no `/{path=**}/<collection>/{id}` block — the group shape is
 *    dead. A NESTED model degrades to `parent-child` (the path-scoped grant that satisfied step 1
 *    is what `--parent` runs against); a root collection has no parent to scope to, so
 *    `cliFirestoreCollectionForQuery` rejects `--parent` outright and the mode is `unavailable`.
 * 3. `scope: 'COLLECTION'` over a subcollection — `--parent` is required by construction, whatever
 *    the rules say, so the mode is `parent-child` rather than `model`. This step is why the mode is
 *    NOT a pure permission verdict: the rules permit the read, and it still cannot be run
 *    unscoped.
 * 4. Otherwise `model`.
 *
 * `unavailable` is a deliberate UNDER-approximation. `list` is merged across every match block that
 * reaches the collection, so a recursive block that denies `list` while a nested block allows it
 * reads as `allowed` and the entry is not marked dead. That direction is the safe one — the scanner
 * can never make this CLI refuse a query that actually works, only miss one that does not.
 *
 * @param input - The entry's scope/nesting and the rules facts for its collection.
 * @returns The mode plus the evidence, with a reason attached whenever the mode is not `model`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function cliFirestoreQueryModeForRules(input: CliFirestoreQueryModeForRulesInput): CliFirestoreQueryModeResult {
  const { scope, isNested, collectionGroup, list, parentPaths } = input;
  const base = { list, collectionGroup, ...(parentPaths && parentPaths.length > 0 ? { parentPaths } : {}) };
  let result: CliFirestoreQueryModeResult;

  if (list !== 'allowed') {
    const reason: CliFirestoreQueryModeReason = list === 'denied' ? 'list-denied' : 'list-unmatched';
    result = { mode: 'unavailable', rules: { ...base, reason } };
  } else if (scope === 'COLLECTION_GROUP' && !collectionGroup) {
    result = { mode: isNested ? 'parent-child' : 'unavailable', rules: { ...base, reason: 'no-collection-group-rule' } };
  } else if (scope === 'COLLECTION' && isNested) {
    result = { mode: 'parent-child', rules: { ...base, reason: 'nested-collection-scope' } };
  } else {
    result = { mode: 'model', rules: base };
  }

  return result;
}

// MARK: Read
/**
 * The mode an entry carries, normalized so an absent field reads as `unknown` rather than
 * `undefined` — a consumer switching over {@link CliFirestoreQueryMode} stays total.
 *
 * @param entry - The catalog entry.
 * @returns The entry's mode, or `unknown` when the manifest was generated without `--rules`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function cliFirestoreQueryMode(entry: CliFirestoreQueryManifestEntry): CliFirestoreQueryMode {
  return entry.queryMode ?? 'unknown';
}

/**
 * True when this CLI could actually run the entry — the factory bound AND the rules do not refuse
 * it outright. Backs `firestore-queries --invocable-only`.
 *
 * A `parent-child` entry counts as invocable: `--parent` runs it. An `unknown` one counts too;
 * nothing is known against it.
 *
 * @param entry - The catalog entry.
 * @returns Whether the entry is worth offering.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isCliFirestoreQueryInvocable(entry: CliFirestoreQueryManifestEntry): boolean {
  return entry.factory != null && cliFirestoreQueryMode(entry) !== 'unavailable';
}

// MARK: Runtime gate
/**
 * Error code used when a query is refused because `firestore.rules` can never authorize it.
 */
export const FIRESTORE_QUERY_UNAVAILABLE_CODE = 'FIRESTORE_QUERY_UNAVAILABLE';

/**
 * Error code used when a `parent-child` query was run without a `--parent`.
 */
export const FIRESTORE_QUERY_PARENT_REQUIRED_CODE = 'FIRESTORE_QUERY_PARENT_REQUIRED';

/**
 * Refuses a catalog entry that cannot run as invoked, BEFORE a transport is chosen.
 *
 * Mirrors `assertCliModelIsNotServerOnly`, one level finer: that flag is per-MODEL and cannot say
 * "readable under its parent, dead as a collection group", which is exactly the shape this catches.
 * Answering locally makes the reason legible and free instead of surfacing as a bare
 * `Missing or insufficient permissions.` from the rules engine.
 *
 * An `unknown` entry passes: the manifest was generated without a `--rules` file, so nothing is
 * known and a guess would be worse than a round trip.
 *
 * @param input - The catalog entry and the `--parent` key, when one was supplied.
 * @param input.entry - The catalog entry about to run.
 * @param input.parent - The `--parent` key, when supplied.
 * @throws {CliError} `FIRESTORE_QUERY_UNAVAILABLE` when no client can run it, or `FIRESTORE_QUERY_PARENT_REQUIRED` when it needs a `--parent` that was not given.
 */
export function assertCliFirestoreQueryCanRun(input: { readonly entry: CliFirestoreQueryManifestEntry; readonly parent?: Maybe<string> }): void {
  const { entry, parent } = input;
  const mode = cliFirestoreQueryMode(entry);

  if (mode === 'unavailable') {
    throw new CliError({
      message: `Query "${entry.slug}" is catalogued but unavailable to a client: ${modeCause(entry)}`,
      code: FIRESTORE_QUERY_UNAVAILABLE_CODE,
      suggestion: unavailableSuggestion(entry)
    });
  } else if (mode === 'parent-child' && parent == null) {
    throw new CliError({
      message: `Query "${entry.slug}" is a parent-child query — it addresses one parent document's \`${entry.collection}\` subcollection: ${modeCause(entry)}`,
      code: FIRESTORE_QUERY_PARENT_REQUIRED_CODE,
      suggestion: parentRequiredSuggestion(entry)
    });
  }
}

// MARK: Rendering
/**
 * Renders the `Mode:` line of the `firestore-queries <query>` detail view.
 *
 * @param entry - The catalog entry.
 * @returns The rendered line body, without a trailing newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function describeCliFirestoreQueryMode(entry: CliFirestoreQueryManifestEntry): string {
  const mode = cliFirestoreQueryMode(entry);
  let result: string;

  switch (mode) {
    case 'model':
      result = 'model — run it directly against the collection.';
      break;
    case 'parent-child':
      result = `parent-child — ${modeCause(entry)} ${parentRequiredSuggestion(entry)}`;
      break;
    case 'unavailable':
      result = `unavailable — ${modeCause(entry)} ${unavailableSuggestion(entry)}`;
      break;
    default:
      result = 'unknown — the query manifest was generated without a `--rules` file, so no mode was resolved.';
      break;
  }

  return result;
}

// MARK: Internals
/**
 * The rules fact behind a non-`model` mode, phrased as a sentence.
 *
 * @param entry - The catalog entry.
 * @returns The cause sentence.
 */
function modeCause(entry: CliFirestoreQueryManifestEntry): string {
  const collection = entry.collection;
  let result: string;

  switch (entry.rules?.reason) {
    case 'no-collection-group-rule':
      result = `\`firestore.rules\` declares no \`match /{path=**}/${collection}/{id}\` block, and a collection-group query is authorized by that block alone — a path-scoped block does not cover it.`;
      break;
    case 'nested-collection-scope':
      result = `it is declared at COLLECTION scope over the \`${collection}\` subcollection, so it addresses one parent by construction.`;
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
function unavailableSuggestion(entry: CliFirestoreQueryManifestEntry): string {
  const collection = entry.collection;
  const rule = entry.rules?.reason === 'no-collection-group-rule' ? `Add a \`match /{path=**}/${collection}/{id}\` block with a \`list\` grant to make the collection group queryable` : `Grant \`list\` on \`${collection}\` in \`firestore.rules\``;

  return `${rule}, or run this from server code (a Cloud Function or a server action) where the Admin SDK bypasses rules. No \`--via\` or \`--parent\` changes this.`;
}

/**
 * What to do about an entry that only runs when scoped to one parent.
 *
 * The COLLECTION-scope index caveat is called out only for the collection-group case, because it is
 * the very next wall an operator hits there: the catalog emits a COLLECTION_GROUP-scope composite
 * index for that factory, and Firestore does not serve a path-scoped query from it. An entry that
 * is already COLLECTION-scope emits the right index by definition.
 *
 * @param entry - The catalog entry.
 * @returns The suggestion sentence.
 */
function parentRequiredSuggestion(entry: CliFirestoreQueryManifestEntry): string {
  const parentPaths = entry.rules?.parentPaths ?? [];
  const shape = parentPaths.length > 0 ? parentPaths.map((x) => `\`${x}\``).join(' or ') : 'the parent document key';
  const indexNote = entry.rules?.reason === 'no-collection-group-rule' ? ' If the factory uses more than one field, a COLLECTION-scope composite index may also be needed — the group-scope index this factory emits does not serve a path-scoped query.' : '';

  return `Pass \`--parent\` to run it against one parent's subcollection: ${shape}.${indexNote}`;
}
