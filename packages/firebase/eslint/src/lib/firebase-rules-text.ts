import type { Maybe } from '@dereekb/util';

/**
 * One brace-delimited block extracted by {@link extractTopLevelBlocks}: a `match`, a
 * `function`, a `service`, or any other `<header> { ... }` shape in a Firebase rules
 * source. Offsets are relative to the body that was scanned.
 */
export interface RawBlock {
  readonly header: string;
  readonly body: string;
  readonly headerStart: number;
  readonly bodyStart: number;
}

const PATH_VARIABLE_RE: RegExp = /\{([A-Za-z_]\w*(?:=\*\*)?)\}/g;
const MASK_OPEN_CHAR: string = '';
const MASK_CLOSE_CHAR: string = '';
const UNMASK_RE: RegExp = /([^]+)/g;
const IDENTIFIER_RE = /^[A-Za-z_]\w*$/;

/**
 * Strips `//`-style line comments from a Firebase rules source string so the brace
 * walker doesn't trip on braces / semicolons embedded in comments.
 *
 * @param source - Raw rules source.
 * @returns The source with line comments replaced by equal-length whitespace (so offsets are preserved).
 */
export function stripLineComments(source: string): string {
  return source.replace(/\/\/[^\n]*/g, (match) => ' '.repeat(match.length));
}

/**
 * Masks `{name}` and `{name=**}` path-variable braces with private-use characters so the
 * brace walker never confuses them with block braces. Same-length substitution preserves
 * offsets. Catch-all deny patterns retain a recognizable shape because the inner text
 * (e.g. `allPaths=**`) is untouched.
 *
 * @param source - The (comment-stripped) source.
 * @returns The source with path-variable braces masked.
 */
export function maskPathVariables(source: string): string {
  return source.replace(PATH_VARIABLE_RE, (_match, inner: string) => `${MASK_OPEN_CHAR}${inner}${MASK_CLOSE_CHAR}`);
}

/**
 * Reverses {@link maskPathVariables} so header / path text reported to callers shows the
 * original `{name}` form.
 *
 * @param text - Text containing masked path variables.
 * @returns The text with `{name}` braces restored.
 */
export function unmaskPathVariables(text: string): string {
  return text.replace(UNMASK_RE, (_match, inner: string) => `{${inner}}`);
}

/**
 * Resolves the 1-based line and 1-based column of a character offset in the source string.
 *
 * @param source - The original source.
 * @param index - Zero-based character offset.
 * @returns The line/column pair.
 */
export function indexToLineColumn(source: string, index: number): { line: number; column: number } {
  let line: number = 1;
  let lastNewlineIndex: number = -1;
  const end = Math.min(index, source.length);
  for (let i = 0; i < end; i++) {
    if (source.codePointAt(i) === 10) {
      line += 1;
      lastNewlineIndex = i;
    }
  }
  return { line, column: end - lastNewlineIndex };
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
export function findMatchingBrace(source: string, openIndex: number): number {
  let depth: number = 0;
  let result: number = -1;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source.codePointAt(i);
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
 * Walks backward from `openIndex` to find where this block's header starts: just past the
 * previous `;` or `}` (now always a true block-sibling close, since path-variable braces
 * are masked), then forward through whitespace to the first significant char.
 *
 * @param body - The masked source slice being scanned.
 * @param cursor - The search start position (right after the previous sibling's `}`).
 * @param openIndex - Index of this block's opening brace.
 * @returns Start index of the header.
 */
export function findHeaderStart(body: string, cursor: number, openIndex: number): number {
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
 * Extracts top-level brace-delimited blocks inside `body` (path-variable-masked). Each
 * block carries its header text (with masking still applied — callers unmask when
 * reporting) and the inner body. Function definitions, match blocks, and `service` /
 * bucket-root wrappers are all returned as raw blocks.
 *
 * @param body - The masked source slice to scan.
 * @returns The list of top-level child blocks.
 */
export function extractTopLevelBlocks(body: string): RawBlock[] {
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
 * Pulls the match-path segment out of a `match /<segment> { ... }` header. The segment is
 * unmasked before being returned so callers see original `{name}` braces.
 *
 * @param header - The (still-masked) header text.
 * @returns The path segment with the leading `/`, or null when the header is not a match.
 */
export function matchHeaderPath(header: string): Maybe<string> {
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
export function functionHeaderName(header: string): Maybe<string> {
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
 * Matches the `return` keyword followed by whitespace, used to locate the start of a Firebase
 * rules function's `return <expression>` body.
 */
const RETURN_KEYWORD_RE = /return\s+/;

/**
 * Pulls the `return <expression>` body out of a function definition's inner block. The
 * body may span multiple lines (CEL expressions wrap freely across newlines); we capture
 * everything from after `return ` to the closing `}`-relative end of `body`, then strip
 * an optional trailing `;` and surrounding whitespace.
 *
 * @param body - The inner body of a function block (already line-comment-stripped).
 * @returns The expression text after `return`, or null when no `return` is present.
 */
export function functionReturnExpression(body: string): Maybe<string> {
  let result: Maybe<string> = null;
  const match: Maybe<RegExpExecArray> = RETURN_KEYWORD_RE.exec(body);
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
export function joinMatchPath(parentPath: string, childSegment: string): string {
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
export function isCatchAllSegment(segment: string): boolean {
  return /^\/\{[A-Za-z_]\w*=\*\*\}$/.test(segment.trim());
}
