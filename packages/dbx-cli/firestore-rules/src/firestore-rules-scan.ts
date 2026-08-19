/**
 * A deliberately small `firestore.rules` reader.
 *
 * This is NOT a CEL implementation and must not become one. It answers exactly one question per
 * collection — "could a client read this at all?" — which needs only three things from the grammar:
 *
 *   - `match /<segments> { … }` with brace nesting, `{var}` and `{path=**}` wildcards
 *   - `allow <ops>: if <expr>;`, where the only thing that matters about `<expr>` is whether it is
 *     literally `false`
 *   - everything else (functions, `let`, real conditions) ignored
 *
 * Keeping it to match-nesting plus constant-`false` detection is what makes it tractable and keeps
 * it from rotting. `apps/demo-api/src/test/tests/firestore.rules.spec.ts` remains the DYNAMIC oracle
 * (it drives the real rules engine via `@firebase/rules-unit-testing`); this scanner is the static
 * routing source, cross-checked against it.
 */

// MARK: Types
/**
 * How a client read of one operation on one collection resolves under the rules.
 *
 * - `allowed` — some `allow` covering the op has a condition that is not constant-`false`.
 * - `denied` — the op is covered only by `allow`s whose condition is literally `false`.
 * - `unmatched` — no `allow` covers the op at all, so Firestore's implicit default-deny applies.
 *
 * `denied` and `unmatched` are both refusals; they are kept distinct because they mean different
 * things to a reviewer — `denied` is a deliberate written-down "no", `unmatched` is an absence.
 */
export type FirestoreRulesAccess = 'allowed' | 'denied' | 'unmatched';

/**
 * The read posture of one collection, as written in the rules file.
 */
export interface FirestoreRulesCollectionEntry {
  /**
   * Short collection name — the same token `firestoreModelIdentity('guestbook', 'gb')` produces,
   * which the CLI model manifest already carries as `collectionPrefix`.
   */
  readonly collection: string;
  /**
   * Every fully-qualified match path that reached this collection.
   */
  readonly paths: readonly string[];
  readonly get: FirestoreRulesAccess;
  readonly list: FirestoreRulesAccess;
  /**
   * True when a `/{path=**}/<collection>/{id}` block exists — the collection is reachable as a
   * collection group, not only under its parent.
   */
  readonly collectionGroup: boolean;
  /**
   * True when neither {@link get} nor {@link list} is `allowed` — no client can read this model, so
   * it is server-only.
   */
  readonly serverOnly: boolean;
}

/**
 * The result of scanning one rules file.
 */
export interface FirestoreRulesScan {
  readonly collections: readonly FirestoreRulesCollectionEntry[];
}

// MARK: Scan
interface AccumulatedCollection {
  readonly paths: Set<string>;
  get: FirestoreRulesAccess;
  list: FirestoreRulesAccess;
  collectionGroup: boolean;
}

const RULES_ROOT_PREFIX = /^\/?databases\/\{[^}]*\}\/documents/;

/**
 * Scans `firestore.rules` source and reports the read posture of every collection it names.
 *
 * A collection with no match block does not appear in the result at all — absence IS the answer,
 * and {@link firestoreRulesAccessForCollection} synthesizes the `unmatched` entry for it.
 *
 * @param source - The full text of a `firestore.rules` file.
 * @returns The per-collection read posture, in collection-name order.
 */
export function scanFirestoreRules(source: string): FirestoreRulesScan {
  const text = stripComments(source);
  const accumulated = new Map<string, AccumulatedCollection>();

  walkMatchBlocks(text, (block) => {
    const collection = collectionForPathSegments(block.segments);

    if (collection == null) return;

    const current =
      accumulated.get(collection) ??
      (() => {
        const created: AccumulatedCollection = { paths: new Set(), get: 'unmatched', list: 'unmatched', collectionGroup: false };
        accumulated.set(collection, created);
        return created;
      })();

    current.paths.add('/' + block.segments.join('/'));
    current.collectionGroup = current.collectionGroup || block.segments.some(isRecursiveWildcard);

    for (const allow of block.allows) {
      if (allow.ops.has('get') || allow.ops.has('read')) current.get = mergeAccess(current.get, allow.access);
      if (allow.ops.has('list') || allow.ops.has('read')) current.list = mergeAccess(current.list, allow.access);
    }
  });

  const collections = [...accumulated.entries()]
    .map(([collection, value]) => ({
      collection,
      paths: [...value.paths].sort(),
      get: value.get,
      list: value.list,
      collectionGroup: value.collectionGroup,
      serverOnly: value.get !== 'allowed' && value.list !== 'allowed'
    }))
    .sort((a, b) => a.collection.localeCompare(b.collection));

  return { collections };
}

/**
 * Looks a collection up in a scan, synthesizing the `unmatched` (and therefore server-only) entry
 * for a collection the rules file never names.
 *
 * @param scan - The scan result.
 * @param collection - The short collection name to look up.
 * @returns The collection's read posture, never `undefined`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function firestoreRulesAccessForCollection(scan: FirestoreRulesScan, collection: string): FirestoreRulesCollectionEntry {
  return scan.collections.find((x) => x.collection === collection) ?? { collection, paths: [], get: 'unmatched', list: 'unmatched', collectionGroup: false, serverOnly: true };
}

/**
 * The collections a scan reports as server-only — no client read grant of any kind.
 *
 * @param scan - The scan result.
 * @returns The server-only collection names, in scan order.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function serverOnlyCollections(scan: FirestoreRulesScan): readonly string[] {
  return scan.collections.filter((x) => x.serverOnly).map((x) => x.collection);
}

// MARK: Internals
/**
 * `allowed` wins over everything: one non-false grant is enough to make the op reachable. `denied`
 * beats `unmatched` because a written-down `if false` is more informative than an absence.
 *
 * @param current - The access resolved so far.
 * @param incoming - The access contributed by another `allow`.
 * @returns The merged access.
 */
function mergeAccess(current: FirestoreRulesAccess, incoming: FirestoreRulesAccess): FirestoreRulesAccess {
  let result: FirestoreRulesAccess;

  if (current === 'allowed' || incoming === 'allowed') {
    result = 'allowed';
  } else if (current === 'denied' || incoming === 'denied') {
    result = 'denied';
  } else {
    result = 'unmatched';
  }

  return result;
}

interface ParsedAllow {
  readonly ops: ReadonlySet<string>;
  readonly access: FirestoreRulesAccess;
}

interface MatchBlock {
  /**
   * The full path segments of this block, with the `databases/{db}/documents` root stripped.
   */
  readonly segments: readonly string[];
  /**
   * The `allow` statements declared DIRECTLY in this block (not in a nested one).
   */
  readonly allows: readonly ParsedAllow[];
}

/**
 * Resolves the collection a match path addresses.
 *
 * The collection is always the second-to-last segment: `/gb/{guestbook}` → `gb`,
 * `/gb/{g}/gbe/{e}` → `gbe`, `/{path=**}/gbe/{e}` → `gbe`, `/sys/myflags` → `sys`.
 *
 * @param segments - The block's path segments.
 * @returns The collection name, or `undefined` when the path cannot name one.
 */
function collectionForPathSegments(segments: readonly string[]): string | undefined {
  const candidate = segments.length >= 2 ? segments[segments.length - 2] : undefined;
  return candidate != null && !isWildcard(candidate) ? candidate : undefined;
}

function isWildcard(segment: string): boolean {
  return segment.startsWith('{') && segment.endsWith('}');
}

function isRecursiveWildcard(segment: string): boolean {
  return isWildcard(segment) && segment.includes('=**');
}

/**
 * Removes `//` line comments and block comments, preserving string literals so a `//` inside a
 * quoted path (e.g. `'pr/' + request.auth.uid`) is not mistaken for a comment.
 *
 * @param source - The raw rules source.
 * @returns The source with comments blanked out.
 */
function stripComments(source: string): string {
  let result = '';
  let index = 0;
  let quote: string | undefined;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (quote != null) {
      result += char;
      if (char === '\\' && index + 1 < source.length) {
        result += next;
        index += 2;
        continue;
      }
      if (char === quote) quote = undefined;
      index += 1;
    } else if (char === "'" || char === '"') {
      quote = char;
      result += char;
      index += 1;
    } else if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
    } else if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
      index += 2;
    } else {
      result += char;
      index += 1;
    }
  }

  return result;
}

/**
 * Walks every `match` block in the (comment-stripped) source, maintaining the enclosing path stack,
 * and invokes `visit` once per block with its fully-qualified segments and its own `allow`s.
 *
 * @param text - Comment-stripped rules source.
 * @param visit - Called once per match block.
 */
function walkMatchBlocks(text: string, visit: (block: MatchBlock) => void): void {
  const pathStack: string[][] = [];
  // one frame per open brace: the match path it introduced (or `undefined` for a non-match brace)
  const braceFrames: { readonly isMatch: boolean; readonly allows: ParsedAllow[] }[] = [];
  let index = 0;

  while (index < text.length) {
    const matchStart = findKeyword(text, index, 'match');
    const braceIndex = text.indexOf('{', index);
    const closeIndex = text.indexOf('}', index);
    const allowStart = findKeyword(text, index, 'allow');

    const next = Math.min(...[matchStart, braceIndex, closeIndex, allowStart].filter((x) => x >= 0).concat([text.length]));

    if (next >= text.length) break;

    if (next === matchStart) {
      const parsed = parseMatchHeader(text, matchStart);
      pathStack.push(parsed.segments);
      braceFrames.push({ isMatch: true, allows: [] });
      index = parsed.bodyStart;
    } else if (next === allowStart) {
      const parsed = parseAllow(text, allowStart);
      const frame = braceFrames[braceFrames.length - 1];
      if (frame?.isMatch && parsed) frame.allows.push(parsed.allow);
      index = parsed ? parsed.end : allowStart + 'allow'.length;
    } else if (next === braceIndex) {
      // a brace not introduced by `match` — a function body, or a nested object literal
      braceFrames.push({ isMatch: false, allows: [] });
      index = braceIndex + 1;
    } else {
      const frame = braceFrames.pop();

      if (frame?.isMatch) {
        const segments = stripRootPrefix(pathStack.flat());
        visit({ segments, allows: frame.allows });
        pathStack.pop();
      }

      index = closeIndex + 1;
    }
  }
}

/**
 * Drops the `databases/{database}/documents` root that every `service cloud.firestore` file opens
 * with, so the remaining segments are real collection path segments.
 *
 * @param segments - The accumulated path segments, root included.
 * @returns The segments with the root prefix removed.
 */
function stripRootPrefix(segments: readonly string[]): string[] {
  const joined = segments.join('/');
  const stripped = joined.replace(RULES_ROOT_PREFIX, '');
  return stripped.split('/').filter((x) => x.length > 0);
}

/**
 * Parses `match /a/{b}/c/{d} {` starting at the `match` keyword.
 *
 * @param text - Comment-stripped source.
 * @param start - Index of the `match` keyword.
 * @returns The path segments and the index just past the opening brace.
 */
function parseMatchHeader(text: string, start: number): { readonly segments: string[]; readonly bodyStart: number } {
  const braceIndex = text.indexOf('{', start + 'match'.length);
  // a path segment can itself be `{var}`, so the block's opening brace is the first `{` that is
  // NOT part of a wildcard segment — i.e. the first one preceded by whitespace after a path char
  let cursor = start + 'match'.length;
  let path = '';

  while (cursor < text.length) {
    const char = text[cursor];

    if (char === '{') {
      const close = text.indexOf('}', cursor);
      const inner = text.slice(cursor, close + 1);

      // a wildcard segment is `{name}` / `{name=**}` with no whitespace; the body brace has none of that
      if (close > cursor && /^\{[A-Za-z_][\w]*(=\*\*)?\}$/.test(inner)) {
        path += inner;
        cursor = close + 1;
        continue;
      }

      break;
    }

    if (char === '\n' && path.trim().length > 0) break;

    path += char;
    cursor += 1;
  }

  const bodyBrace = text.includes('{', cursor - 1) ? text.indexOf('{', cursor) : braceIndex;
  const segments = path
    .trim()
    .split('/')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);

  return { segments, bodyStart: (bodyBrace >= 0 ? bodyBrace : cursor) + 1 };
}

/**
 * Parses `allow read, write: if <expr>;` starting at the `allow` keyword.
 *
 * @param text - Comment-stripped source.
 * @param start - Index of the `allow` keyword.
 * @returns The parsed grant and the index just past its terminating `;`, or `undefined` when malformed.
 */
function parseAllow(text: string, start: number): { readonly allow: ParsedAllow; readonly end: number } | undefined {
  const colonIndex = text.indexOf(':', start);
  const semiIndex = text.indexOf(';', start);
  let result: { readonly allow: ParsedAllow; readonly end: number } | undefined;

  if (colonIndex >= 0 && semiIndex > colonIndex) {
    const ops = new Set(
      text
        .slice(start + 'allow'.length, colonIndex)
        .split(',')
        .map((x) => x.trim())
        .filter((x) => x.length > 0)
    );

    const condition = text
      .slice(colonIndex + 1, semiIndex)
      .replace(/^\s*if\s*/, '')
      .trim();

    result = { allow: { ops, access: condition === 'false' ? 'denied' : 'allowed' }, end: semiIndex + 1 };
  }

  return result;
}

/**
 * Finds the next occurrence of `keyword` at a word boundary, so `allowance` does not match `allow`.
 *
 * @param text - The text to search.
 * @param from - Index to start from.
 * @param keyword - The keyword to find.
 * @returns The index of the keyword, or `-1`.
 */
function findKeyword(text: string, from: number, keyword: string): number {
  let index = text.indexOf(keyword, from);

  while (index >= 0) {
    const before = index === 0 ? ' ' : text[index - 1];
    const after = text[index + keyword.length] ?? ' ';

    if (!/[\w$]/.test(before) && !/[\w$]/.test(after)) break;

    index = text.indexOf(keyword, index + keyword.length);
  }

  return index;
}
