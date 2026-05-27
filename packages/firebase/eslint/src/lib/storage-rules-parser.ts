import type { Maybe } from '@dereekb/util';
import { evaluatePredicate, type PredicateBranch, type HelperFunctionTable } from './predicate-evaluator';
import { extractTopLevelBlocks, functionHeaderName, functionReturnExpression, indexToLineColumn, isCatchAllSegment, joinMatchPath, maskPathVariables, matchHeaderPath, stripLineComments, type RawBlock } from './firebase-rules-text';
import type { FoldedPathSegment } from './storagefile-path-fold';

/**
 * Marker comment that pairs a `storage.rules` match block with a TypeScript policy key
 * in `STORAGE_FILE_PURPOSE_UPLOAD_POLICIES`. The capture group is the policy key constant
 * name, e.g. `USER_AVATAR_PURPOSE`.
 */
export const MIRRORS_POLICY_KEY_MARKER_REGEX = /\/\/\s*Mirrors\s+STORAGE_FILE_PURPOSE_UPLOAD_POLICIES\[(\w+)\]/g;

/**
 * One disjunct of an `allow write: if ...` predicate after helper-function expansion.
 * Always carries a numeric byte cap plus at least one MIME constraint (literal or regex).
 *
 * Structurally identical to the evaluator's {@link PredicateBranch}; the alias keeps the
 * existing public type name stable for downstream consumers.
 */
export type ParsedRuleBranch = PredicateBranch;

/**
 * One leaf `match /<path>` block in `storage.rules` that carries an `allow write|create|update`
 * predicate. `branches` carries the disjunction of (size, MIME) tuples extracted from the
 * predicate; `unsupported` is set when the parser cannot reduce the predicate to >=1 valid
 * branch. `matchPath` is the full accumulated path stack used to pair the block with a folded
 * upload-policy path. `mirrorsPolicyKey` is the legacy `// Mirrors ...` marker key when present
 * — purely informational now that pairing is by path, retained for backward compatibility.
 */
export interface ParsedStorageRulesBlock {
  readonly mirrorsPolicyKey?: Maybe<string>;
  readonly matchPath: string;
  readonly branches: readonly ParsedRuleBranch[];
  readonly sourceLine: number;
  readonly sourceColumn: number;
  readonly unsupported?: string;
}

/**
 * Converts a parsed leaf block's `matchPath` (e.g. `/uploads/u/{uid}/jr/{shortKey}`) into a
 * structural segment list for comparison against a folded upload-policy path. Empty segments
 * (leading/trailing/duplicate slashes) are dropped; `{var}` / `{var=**}` path variables become
 * wildcards; every other segment is a literal.
 *
 * @param matchPath - The accumulated match-path string.
 * @returns The structural segment list.
 */
export function rulesMatchPathToSegments(matchPath: string): FoldedPathSegment[] {
  const segments: FoldedPathSegment[] = [];
  for (const raw of matchPath.split('/')) {
    if (raw.length > 0) {
      segments.push(/^\{[^}]*\}$/.test(raw) ? { kind: 'wildcard', value: '' } : { kind: 'literal', value: raw });
    }
  }
  return segments;
}

const ALLOW_WRITE_RE = /allow\s+(?:write|create|update)(?:\s*,\s*(?:write|create|update))*\s*:\s*if\s+([\s\S]+?);/g;

interface WalkContext {
  readonly source: string;
  readonly results: ParsedStorageRulesBlock[];
  readonly pendingMarkers: PendingMarker[];
}

interface PendingMarker {
  readonly key: string;
  readonly index: number;
  consumed: boolean;
}

/**
 * Collects every `// Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[<KEY>]` marker in the
 * original source along with its character offset. Walked alongside the brace tree so each
 * marker pairs with the match block whose opening brace immediately follows it.
 *
 * @param source - The original (un-stripped) source.
 * @returns The list of pending markers in source order.
 */
function collectPendingMarkers(source: string): PendingMarker[] {
  const markers: PendingMarker[] = [];
  MIRRORS_POLICY_KEY_MARKER_REGEX.lastIndex = 0;
  let m: Maybe<RegExpExecArray> = MIRRORS_POLICY_KEY_MARKER_REGEX.exec(source);
  while (m) {
    markers.push({ key: m[1], index: m.index, consumed: false });
    m = MIRRORS_POLICY_KEY_MARKER_REGEX.exec(source);
  }
  return markers;
}

/**
 * Finds the marker (if any) that immediately precedes the given header start offset, with
 * no other match block intervening. Marks the chosen marker consumed.
 *
 * @param markers - The pending marker list.
 * @param sourceOffset - The header start offset in the original source.
 * @returns The marker key, or null when no preceding marker is unmatched.
 */
function consumePrecedingMarker(markers: PendingMarker[], sourceOffset: number): Maybe<string> {
  let chosen: Maybe<PendingMarker> = null;
  for (const marker of markers) {
    if (marker.index >= sourceOffset) break;
    if (!marker.consumed) chosen = marker;
  }
  let result: Maybe<string> = null;
  if (chosen) {
    chosen.consumed = true;
    result = chosen.key;
  }
  return result;
}

interface WalkBlockInput {
  readonly body: string;
  readonly bodyOffset: number;
  readonly parentPath: string;
  readonly inheritedFunctions: Map<string, string>;
  readonly ctx: WalkContext;
}

interface HandleMatchBlockInput {
  readonly block: RawBlock;
  readonly matchSegment: string;
  readonly bodyOffset: number;
  readonly parentPath: string;
  readonly scopeFunctions: Map<string, string>;
  readonly ctx: WalkContext;
}

interface RecordLeafBlockInput {
  readonly fullPath: string;
  readonly headerSourceOffset: number;
  readonly scopeFunctions: Map<string, string>;
  readonly markerKey: Maybe<string>;
  readonly predicate: string;
  readonly ctx: WalkContext;
}

/**
 * Recursively walks the brace tree of the rules source, accumulating match paths and
 * helper-function definitions in scope so each `allow write` block can be reduced.
 *
 * @param input - The walk inputs: current body slice, source offset, parent path,
 *   inherited helper functions, and the walk context.
 */
function walkBlock(input: WalkBlockInput): void {
  const { body, bodyOffset, parentPath, inheritedFunctions, ctx } = input;
  const localFunctions: Map<string, string> = new Map(inheritedFunctions);
  const blocks: RawBlock[] = extractTopLevelBlocks(body);

  for (const block of blocks) {
    const fnName: Maybe<string> = functionHeaderName(block.header);
    if (fnName) {
      const expr: Maybe<string> = functionReturnExpression(block.body);
      if (expr) {
        localFunctions.set(fnName, expr);
      }
    }
  }

  for (const block of blocks) {
    if (isTransparentBlockHeader(block.header)) {
      walkBlock({ body: block.body, bodyOffset: bodyOffset + block.bodyStart, parentPath, inheritedFunctions: localFunctions, ctx });
      continue;
    }
    const matchSegment: Maybe<string> = matchHeaderPath(block.header);
    if (matchSegment) {
      handleMatchBlock({ block, matchSegment, bodyOffset, parentPath, scopeFunctions: localFunctions, ctx });
    }
  }
}

/**
 * Returns true when the block header is a `service ...` wrapper or the `/b/{bucket}/o`
 * bucket-root match. These contribute neither to the accumulated path nor to the result
 * set; the walker descends through them transparently.
 *
 * @param header - The (masked) block header text.
 * @returns True for transparent wrappers.
 */
function isTransparentBlockHeader(header: string): boolean {
  const trimmed: string = header.trim();
  return trimmed.startsWith('service ') || /^match\s+\/b\/[^]+\/o\s*$/.test(trimmed);
}

/**
 * Processes a single `match /<segment> { ... }` block: skips catch-all deny blocks, records
 * the block as a leaf when it carries an `allow write|create|update` predicate (reducing the
 * predicate to `ParsedRuleBranch[]`), and always descends into nested matches so deeper leaf
 * blocks are collected too.
 *
 * @param input - The match-block inputs: block descriptor, unmasked path segment,
 *   enclosing body offset, parent path, scope functions, and walk context.
 */
function handleMatchBlock(input: HandleMatchBlockInput): void {
  const { block, matchSegment, bodyOffset, parentPath, scopeFunctions, ctx } = input;
  const fullPath: string = joinMatchPath(parentPath, matchSegment);
  const headerSourceOffset: number = bodyOffset + block.headerStart;
  const markerKey: Maybe<string> = consumePrecedingMarker(ctx.pendingMarkers, headerSourceOffset);

  if (!isCatchAllSegment(matchSegment)) {
    const predicate: Maybe<string> = extractAllowWritePredicate(topLevelBlockText(block.body));
    if (predicate) {
      recordLeafBlock({ fullPath, headerSourceOffset, scopeFunctions, markerKey, predicate, ctx });
    }
    walkBlock({ body: block.body, bodyOffset: bodyOffset + block.bodyStart, parentPath: fullPath, inheritedFunctions: scopeFunctions, ctx });
  }
}

/**
 * Reduces a leaf match block's `allow write` predicate and pushes a `ParsedStorageRulesBlock`
 * onto the results. Pairing with a TypeScript upload policy is by `matchPath`; any legacy
 * `// Mirrors ...` marker key is recorded for backward compatibility only.
 *
 * @param input - The record inputs: accumulated unmasked path, header source offset, scope
 *   functions, optional marker key, the allow-write predicate text, and walk context.
 */
function recordLeafBlock(input: RecordLeafBlockInput): void {
  const { fullPath, headerSourceOffset, scopeFunctions, markerKey, predicate, ctx } = input;
  const { line, column } = indexToLineColumn(ctx.source, headerSourceOffset);
  const helpers: HelperFunctionTable = { definitions: scopeFunctions };
  const reduced = evaluatePredicate(predicate, helpers);
  const entry: ParsedStorageRulesBlock = {
    mirrorsPolicyKey: markerKey,
    matchPath: fullPath,
    branches: reduced.branches,
    sourceLine: line,
    sourceColumn: column,
    ...(reduced.unsupported ? { unsupported: reduced.unsupported } : {})
  };
  ctx.results.push(entry);
}

/**
 * Blanks out everything nested inside braces, leaving only this block's own top-level text.
 * Used so a block's `allow write` predicate is detected only when it belongs to the block
 * itself — not when it appears inside a nested `match` / `function` block (whose predicates
 * belong to those deeper leaf blocks instead).
 *
 * @param body - The (masked) block body.
 * @returns The body with nested-brace content replaced by spaces (offsets preserved).
 */
function topLevelBlockText(body: string): string {
  let depth: number = 0;
  let result: string = '';
  for (const char of body) {
    if (char === '{') {
      depth += 1;
      result += ' ';
    } else if (char === '}') {
      depth -= 1;
      result += ' ';
    } else {
      result += depth === 0 ? char : ' ';
    }
  }
  return result;
}

/**
 * Pulls the first `allow write|create|update: if <predicate>;` predicate from a match
 * block body. Stops at the first match — most blocks have a single allow statement.
 *
 * @param body - The match block's inner body (still masked).
 * @returns The predicate text, or null when none is found.
 */
function extractAllowWritePredicate(body: string): Maybe<string> {
  let result: Maybe<string> = null;
  ALLOW_WRITE_RE.lastIndex = 0;
  const match: Maybe<RegExpExecArray> = ALLOW_WRITE_RE.exec(body);
  if (match) {
    result = match[1].trim();
  }
  return result;
}

/**
 * Parses a `storage.rules` source string and returns every leaf `match` block that carries an
 * `allow write|create|update` predicate, each with its full accumulated `matchPath`. Catch-all
 * deny blocks are skipped; the rest of the tree is walked normally. Pairing with TypeScript
 * upload policies is by path (see {@link rulesMatchPathToSegments}); the `// Mirrors ...` marker
 * is no longer required.
 *
 * @param source - The raw rules source text.
 * @returns Parsed leaf blocks in source order.
 */
export function parseStorageRules(source: string): ParsedStorageRulesBlock[] {
  const stripped: string = stripLineComments(source);
  const masked: string = maskPathVariables(stripped);
  const ctx: WalkContext = {
    source,
    results: [],
    pendingMarkers: collectPendingMarkers(source)
  };
  walkBlock({ body: masked, bodyOffset: 0, parentPath: '', inheritedFunctions: new Map(), ctx });
  return ctx.results;
}
