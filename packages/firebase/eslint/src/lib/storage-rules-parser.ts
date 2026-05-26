import type { Maybe } from '@dereekb/util';
import { evaluatePredicate, type PredicateBranch, type HelperFunctionTable } from './predicate-evaluator';

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
 * One `match /<path>` block in `storage.rules` paired with a `// Mirrors ...` marker.
 * `branches` carries the disjunction of (size, MIME) tuples extracted from the block's
 * `allow write` predicate; `unsupported` is set when the parser cannot reduce the
 * predicate to >=1 valid branch.
 */
export interface ParsedStorageRulesBlock {
  readonly mirrorsPolicyKey: string;
  readonly matchPath: string;
  readonly branches: readonly ParsedRuleBranch[];
  readonly sourceLine: number;
  readonly sourceColumn: number;
  readonly unsupported?: string;
}

interface RawBlock {
  readonly header: string;
  readonly body: string;
  readonly headerStart: number;
  readonly bodyStart: number;
}

const PATH_VARIABLE_RE: RegExp = /\{([A-Za-z_][A-Za-z0-9_]*(?:=\*\*)?)\}/g;
const MASK_OPEN_CHAR: string = '';
const MASK_CLOSE_CHAR: string = '';
const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ALLOW_WRITE_RE = /allow\s+(?:write|create|update)(?:\s*,\s*(?:write|create|update))*\s*:\s*if\s+([\s\S]+?);/g;

/**
 * Strips `//`-style line comments from a `storage.rules` source string so the brace
 * walker doesn't trip on braces / semicolons embedded in comments.
 *
 * @param source - Raw rules source.
 * @returns The source with line comments replaced by equal-length whitespace (so offsets are preserved).
 */
function stripLineComments(source: string): string {
  return source.replace(/\/\/[^\n]*/g, (match) => ' '.repeat(match.length));
}

/**
 * Masks `{name}` and `{name=**}` path-variable braces with `` and `` so the
 * brace walker never confuses them with block braces. Same-length substitution preserves
 * offsets. Catch-all deny patterns retain a recognizable shape because the inner text
 * (e.g. `allPaths=**`) is untouched.
 *
 * @param source - The (comment-stripped) source.
 * @returns The source with path-variable braces masked.
 */
function maskPathVariables(source: string): string {
  return source.replace(PATH_VARIABLE_RE, (_match, inner: string) => `${MASK_OPEN_CHAR}${inner}${MASK_CLOSE_CHAR}`);
}

/**
 * Reverses {@link maskPathVariables} so header / path text reported to callers shows the
 * original `{name}` form.
 *
 * @param text - Text containing masked path variables.
 * @returns The text with `{name}` braces restored.
 */
function unmaskPathVariables(text: string): string {
  return text.replace(/([^]+)/g, (_match, inner: string) => `{${inner}}`);
}

/**
 * Resolves the 1-based line and 1-based column of a character offset in the source string.
 *
 * @param source - The original source.
 * @param index - Zero-based character offset.
 * @returns The line/column pair.
 */
function indexToLineColumn(source: string, index: number): { line: number; column: number } {
  let line: number = 1;
  let column: number = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source.charCodeAt(i) === 10) {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

/**
 * Finds the matching closing brace for the opening brace at `openIndex` in `source`,
 * respecting nesting. Returns the index of the closing brace, or -1 when unbalanced.
 * `source` must be the masked version so path-variable braces don't pollute the count.
 *
 * @param source - The masked source string.
 * @param openIndex - Index of an opening brace.
 * @returns Index of the matching closing brace, or -1.
 */
function findMatchingBrace(source: string, openIndex: number): number {
  let depth: number = 0;
  let result: number = -1;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source.charCodeAt(i);
    if (ch === 123) {
      depth += 1;
    } else if (ch === 125) {
      depth -= 1;
      if (depth === 0) {
        result = i;
        break;
      }
    }
  }
  return result;
}

/**
 * Extracts top-level brace-delimited blocks inside `body` (path-variable-masked). Each
 * block carries its header text (with masking still applied — callers unmask when
 * reporting) and the inner body. Function definitions, match blocks, and `service` /
 * bucket-root wrappers are all returned as raw blocks.
 *
 * @param body - The masked source slice to scan.
 * @returns The list of top-level child blocks.
 */
function extractTopLevelBlocks(body: string): RawBlock[] {
  const blocks: RawBlock[] = [];
  let cursor: number = 0;
  while (cursor < body.length) {
    const openIndex = body.indexOf('{', cursor);
    if (openIndex === -1) break;
    const closeIndex = findMatchingBrace(body, openIndex);
    if (closeIndex === -1) break;
    const headerStart: number = findHeaderStart(body, cursor, openIndex);
    const header: string = body.slice(headerStart, openIndex).trim();
    const inner: string = body.slice(openIndex + 1, closeIndex);
    blocks.push({ header, body: inner, headerStart, bodyStart: openIndex + 1 });
    cursor = closeIndex + 1;
  }
  return blocks;
}

/**
 * Walks backward from `openIndex` to find where this block's header starts: just past the
 * previous `;` or `}` (now always a true block-sibling close, since path-variable braces
 * are masked), then forward through whitespace to the first significant char.
 *
 * @param body - The masked source slice being scanned.
 * @param cursor - The search start position (right after the previous sibling's `}`).
 * @param openIndex - Index of this block's opening brace.
 * @returns Start index of the header.
 */
function findHeaderStart(body: string, cursor: number, openIndex: number): number {
  let result: number = cursor;
  for (let i = openIndex - 1; i >= cursor; i--) {
    const ch: string = body[i];
    if (ch === ';' || ch === '}') {
      result = i + 1;
      break;
    }
  }
  while (result < openIndex) {
    const ch: string = body[result];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      result += 1;
    } else {
      break;
    }
  }
  return result;
}

/**
 * Pulls the match-path segment out of a `match /<segment> { ... }` header. The segment is
 * unmasked before being returned so callers see original `{name}` braces.
 *
 * @param header - The (still-masked) header text.
 * @returns The path segment with the leading `/`, or null when the header is not a match.
 */
function matchHeaderPath(header: string): Maybe<string> {
  let result: Maybe<string> = null;
  const trimmed: string = header.trim();
  if (trimmed.startsWith('match ')) {
    const segment: string = trimmed.slice('match '.length).trim();
    if (segment.length > 0) {
      result = unmaskPathVariables(segment);
    }
  }
  return result;
}

/**
 * Pulls the function name out of a `function <name>() { ... }` header.
 *
 * @param header - The header text.
 * @returns The function name, or null when the header is not a function definition.
 */
function functionHeaderName(header: string): Maybe<string> {
  let result: Maybe<string> = null;
  const trimmed: string = header.trim();
  if (trimmed.startsWith('function ')) {
    const after: string = trimmed.slice('function '.length).trim();
    const parenIndex: number = after.indexOf('(');
    if (parenIndex > 0) {
      const name: string = after.slice(0, parenIndex).trim();
      if (IDENTIFIER_RE.test(name)) {
        result = name;
      }
    }
  }
  return result;
}

/**
 * Pulls the `return <expression>` body out of a function definition's inner block. The
 * body may span multiple lines (CEL expressions wrap freely across newlines); we capture
 * everything from after `return ` to the closing `}`-relative end of `body`, then strip
 * an optional trailing `;` and surrounding whitespace.
 *
 * @param body - The inner body of a function block (already line-comment-stripped).
 * @returns The expression text after `return`, or null when no `return` is present.
 */
function functionReturnExpression(body: string): Maybe<string> {
  let result: Maybe<string> = null;
  const match: RegExpMatchArray | null = body.match(/return\s+/);
  if (match && typeof match.index === 'number') {
    let rest: string = body.slice(match.index + match[0].length);
    rest = rest.trim();
    if (rest.endsWith(';')) {
      rest = rest.slice(0, -1).trim();
    }
    if (rest.length > 0) {
      result = rest;
    }
  }
  return result;
}

/**
 * Joins a child match segment onto a parent path so nested matches resolve to absolute paths.
 *
 * @param parentPath - The accumulated parent path (e.g. `/uploads/u/{uid}`).
 * @param childSegment - The child match's segment (e.g. `/avatar.img`).
 * @returns The combined path.
 */
function joinMatchPath(parentPath: string, childSegment: string): string {
  let result: string;
  if (parentPath.length === 0) {
    result = childSegment;
  } else if (childSegment.startsWith('/')) {
    result = `${parentPath}${childSegment}`;
  } else {
    result = `${parentPath}/${childSegment}`;
  }
  return result;
}

/**
 * Returns true when the unmasked segment is the catch-all `{var=**}` wildcard that means
 * "any path" (used for deny rules like `match /{allPaths=**} { allow read, write: if false; }`).
 *
 * @param segment - The unmasked match segment to test.
 * @returns True for catch-all wildcards.
 */
function isCatchAllSegment(segment: string): boolean {
  return /^\/\{[A-Za-z_][A-Za-z0-9_]*=\*\*\}$/.test(segment.trim());
}

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
  let m: RegExpExecArray | null = MIRRORS_POLICY_KEY_MARKER_REGEX.exec(source);
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

/**
 * Recursively walks the brace tree of the rules source, accumulating match paths and
 * helper-function definitions in scope so each `allow write` block can be reduced.
 *
 * @param body - The current slice to walk (path-variable-masked).
 * @param bodyOffset - Offset of `body` within the original source.
 * @param parentPath - Accumulated parent match path (unmasked).
 * @param inheritedFunctions - Helper functions inherited from outer scopes.
 * @param ctx - The walk context.
 */
function walkBlock(body: string, bodyOffset: number, parentPath: string, inheritedFunctions: Map<string, string>, ctx: WalkContext): void {
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
      walkBlock(block.body, bodyOffset + block.bodyStart, parentPath, localFunctions, ctx);
      continue;
    }
    const matchSegment: Maybe<string> = matchHeaderPath(block.header);
    if (matchSegment) {
      handleMatchBlock(block, matchSegment, bodyOffset, parentPath, localFunctions, ctx);
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
 * Processes a single `match /<segment> { ... }` block: descends into nested matches,
 * skips catch-all deny blocks, and (when a `Mirrors ...` marker precedes the block)
 * reduces the `allow write` predicate to `ParsedRuleBranch[]`.
 *
 * @param block - The raw block descriptor.
 * @param matchSegment - The header's unmasked path segment.
 * @param bodyOffset - Offset of the enclosing body within the original source.
 * @param parentPath - Accumulated parent path.
 * @param scopeFunctions - Helper functions in scope at this block.
 * @param ctx - The walk context.
 */
function handleMatchBlock(block: RawBlock, matchSegment: string, bodyOffset: number, parentPath: string, scopeFunctions: Map<string, string>, ctx: WalkContext): void {
  const fullPath: string = joinMatchPath(parentPath, matchSegment);
  const headerSourceOffset: number = bodyOffset + block.headerStart;
  const markerKey: Maybe<string> = consumePrecedingMarker(ctx.pendingMarkers, headerSourceOffset);

  if (!isCatchAllSegment(matchSegment)) {
    if (markerKey) {
      recordMirroredBlock(block, fullPath, headerSourceOffset, scopeFunctions, markerKey, ctx);
    }
    walkBlock(block.body, bodyOffset + block.bodyStart, fullPath, scopeFunctions, ctx);
  }
}

/**
 * Reduces a match block paired with a `// Mirrors ...` marker and pushes a
 * `ParsedStorageRulesBlock` onto the results.
 *
 * @param block - The raw block descriptor.
 * @param fullPath - The accumulated match path (unmasked).
 * @param headerSourceOffset - Offset of the block's header in the original source.
 * @param scopeFunctions - Helper functions in scope.
 * @param markerKey - The policy key from the `Mirrors ...` marker.
 * @param ctx - The walk context.
 */
function recordMirroredBlock(block: RawBlock, fullPath: string, headerSourceOffset: number, scopeFunctions: Map<string, string>, markerKey: string, ctx: WalkContext): void {
  const predicate: Maybe<string> = extractAllowWritePredicate(block.body);
  const { line, column } = indexToLineColumn(ctx.source, headerSourceOffset);
  if (!predicate) {
    ctx.results.push({
      mirrorsPolicyKey: markerKey,
      matchPath: fullPath,
      branches: [],
      sourceLine: line,
      sourceColumn: column,
      unsupported: 'no allow write/create/update predicate found in match block'
    });
  } else {
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
  const match: RegExpExecArray | null = ALLOW_WRITE_RE.exec(body);
  if (match) {
    result = match[1].trim();
  }
  return result;
}

/**
 * Parses a `storage.rules` source string and returns every match block paired with a
 * `// Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[<KEY>]` marker. Catch-all deny blocks
 * are skipped; the rest of the tree is walked normally.
 *
 * @param source - The raw rules source text.
 * @returns Parsed mirrored blocks in source order.
 */
export function parseStorageRules(source: string): ParsedStorageRulesBlock[] {
  const stripped: string = stripLineComments(source);
  const masked: string = maskPathVariables(stripped);
  const ctx: WalkContext = {
    source,
    results: [],
    pendingMarkers: collectPendingMarkers(source)
  };
  walkBlock(masked, 0, '', new Map(), ctx);
  return ctx.results;
}
