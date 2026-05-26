import type { Maybe } from '@dereekb/util';
import { extractTopLevelBlocks, indexToLineColumn, maskPathVariables, matchHeaderPath, stripLineComments, type RawBlock } from './firebase-rules-text';

/**
 * One `match /<segment>` block in `firestore.rules`. Nested matches appear as `children`.
 * `collectionName` is the first bare-identifier segment of the match path (e.g. `pr`,
 * `gbe`, `sys`); it is `null` only when the match path is purely a `{path=**}` wildcard
 * with no following collection segment.
 */
export interface ParsedFirestoreMatchBlock {
  /**
   * Raw unmasked path segment from `match /<segment>` (e.g. `/pr/{profile}`,
   * `/{path=**}/gbe/{guestbookEntry}`, `/sys/hellosubscheckhqcompany`).
   */
  readonly pathSegment: string;
  /**
   * First bare-identifier collection token in the path, or `null` when none. Used to pair
   * a model identity's `collectionName` (e.g. `gb`, `gbe`) against a rules block.
   */
  readonly collectionName: Maybe<string>;
  /**
   * True when the match path starts with `/{path=**}/` — a collection-group rule that
   * matches the collection at any depth.
   */
  readonly isCollectionGroup: boolean;
  /**
   * Children nested inside this block's body, in source order.
   */
  readonly children: readonly ParsedFirestoreMatchBlock[];
  /**
   * Raw allow directive names declared on this block (e.g. `get`, `list`, `read`, `write`,
   * `create`, `update`, `delete`). Empty when the block declares no `allow` statements at
   * its own scope (children may still declare their own).
   */
  readonly allowDirectives: readonly string[];
  readonly sourceLine: number;
  readonly sourceColumn: number;
}

const ALLOW_RE: RegExp = /\ballow\s+([A-Za-z, \t]+?)\s*:\s*if\b/g;
const COLLECTION_GROUP_PREFIX: RegExp = /^\/\{[A-Za-z_][A-Za-z0-9_]*=\*\*\}\//;
const BARE_IDENTIFIER_RE: RegExp = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Extracts every `allow <op>[,<op>...]: if ...;` directive header from a match block's
 * body. Returns the flat list of operator names (lowercased, deduped) across all allow
 * statements at this scope.
 *
 * Nested match blocks' allow directives are not included — those belong to children.
 *
 * @param body - The (masked) inner body of a match block.
 * @returns The list of allow directive operator names.
 */
function extractAllowDirectives(body: string): string[] {
  const seen: Set<string> = new Set();
  ALLOW_RE.lastIndex = 0;
  let match: RegExpExecArray | null = ALLOW_RE.exec(body);
  while (match) {
    const ops: string[] = match[1]
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    for (const op of ops) {
      seen.add(op);
    }
    match = ALLOW_RE.exec(body);
  }
  return [...seen];
}

/**
 * Pulls the first bare-identifier collection token from a match path. Skips an optional
 * leading `/{path=**}/` collection-group wildcard. Returns `null` when the path's first
 * segment after the wildcard is not a plain identifier (e.g. a `{var}` placeholder).
 *
 * @param pathSegment - The (unmasked) match path including leading `/`.
 * @returns The first collection name, or null when none is identifiable.
 */
function extractCollectionName(pathSegment: string): Maybe<string> {
  let trimmed: string = pathSegment;
  if (COLLECTION_GROUP_PREFIX.test(trimmed)) {
    trimmed = trimmed.replace(COLLECTION_GROUP_PREFIX, '/');
  }
  let result: Maybe<string> = null;
  const segments: string[] = trimmed.split('/').filter(Boolean);
  for (const segment of segments) {
    if (BARE_IDENTIFIER_RE.test(segment)) {
      result = segment;
      break;
    }
  }
  return result;
}

/**
 * Returns true when the (unmasked) match path begins with the `/{path=**}/` collection-
 * group wildcard.
 *
 * @param pathSegment - The unmasked match path.
 * @returns True for collection-group matches.
 */
function isCollectionGroupPath(pathSegment: string): boolean {
  return COLLECTION_GROUP_PREFIX.test(pathSegment);
}

/**
 * Returns true when the block header is a transparent wrapper that contributes neither a
 * match step nor an emitted block — `service ...` and the top-level
 * `match /databases/{database}/documents` envelope.
 *
 * @param header - The (masked) block header text.
 * @returns True for transparent wrappers.
 */
function isTransparentBlockHeader(header: string): boolean {
  const trimmed: string = header.trim();
  return trimmed.startsWith('service ') || /^match\s+\/databases\/[^]+\/documents\s*$/.test(trimmed);
}

/**
 * Recursively walks the brace tree of the rules source, emitting one
 * `ParsedFirestoreMatchBlock` per `match /<segment>` declaration encountered (children
 * nest under their parent).
 *
 * @param body - The current slice to walk (path-variable-masked).
 * @param bodyOffset - Offset of `body` within the original source.
 * @param source - The original (un-stripped) source for line/column resolution.
 * @returns The list of child match blocks discovered at this scope.
 */
function walkBlock(body: string, bodyOffset: number, source: string): ParsedFirestoreMatchBlock[] {
  const result: ParsedFirestoreMatchBlock[] = [];
  const blocks: RawBlock[] = extractTopLevelBlocks(body);

  for (const block of blocks) {
    if (isTransparentBlockHeader(block.header)) {
      const inner: ParsedFirestoreMatchBlock[] = walkBlock(block.body, bodyOffset + block.bodyStart, source);
      for (const child of inner) {
        result.push(child);
      }
      continue;
    }
    const matchPath: Maybe<string> = matchHeaderPath(block.header);
    if (matchPath) {
      const headerSourceOffset: number = bodyOffset + block.headerStart;
      const { line, column } = indexToLineColumn(source, headerSourceOffset);
      const children: ParsedFirestoreMatchBlock[] = walkBlock(block.body, bodyOffset + block.bodyStart, source);
      result.push({
        pathSegment: matchPath,
        collectionName: extractCollectionName(matchPath),
        isCollectionGroup: isCollectionGroupPath(matchPath),
        children,
        allowDirectives: extractAllowDirectives(block.body),
        sourceLine: line,
        sourceColumn: column
      });
    }
  }

  return result;
}

/**
 * Parses a `firestore.rules` source string and returns the tree of `match` blocks rooted
 * at the implicit `match /databases/{database}/documents` envelope. Each block's
 * `collectionName` is the first bare-identifier segment of its match path; nested
 * subcollection matches appear as `children`.
 *
 * @param source - The raw rules source text.
 * @returns The list of top-level match blocks in source order.
 *
 * @example
 * ```ts
 * const blocks = parseFirestoreRules(`
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /gb/{guestbook} {
 *         match /gbe/{guestbookEntry} { allow get: if false; }
 *       }
 *     }
 *   }
 * `);
 * // blocks[0].collectionName === 'gb'
 * // blocks[0].children[0].collectionName === 'gbe'
 * ```
 */
export function parseFirestoreRules(source: string): ParsedFirestoreMatchBlock[] {
  const stripped: string = stripLineComments(source);
  const masked: string = maskPathVariables(stripped);
  return walkBlock(masked, 0, source);
}
