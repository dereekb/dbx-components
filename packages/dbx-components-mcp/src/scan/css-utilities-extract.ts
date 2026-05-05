/**
 * SCSS extractor for the `scan-css-utilities` pipeline.
 *
 * Scans a flat `.scss` source string for top-level utility-class rules
 * annotated with `/// @dbx-utility …`. Returns one
 * {@link ExtractedCssUtilityEntry} per annotated selector plus
 * {@link ExtractWarning}s for malformed annotation blocks.
 *
 * Supported annotation tags (each on its own `///` line, immediately
 * preceding the selector):
 *
 * - `@dbx-utility <slug>` — required curation gate; defaults the slug to
 *   `<host-class minus leading dot>` when the value is omitted.
 * - `@intent <plain-english>` — short description used by intent search.
 * - `@role <role>` — one of `layout`, `flex`, `text`, `spacing`, `state`,
 *   `interaction`, `misc`. Drives role filters and structural-property
 *   weighting in the equivalency engine.
 * - `@see-also <slug>[, <slug>, …]` — comma-separated related slugs.
 * - `@anti-use <plain-english>` — when NOT to use this utility.
 * - `@since <version>` — version tag.
 * - `@parent <slug>` — group this utility as a child of another utility.
 *   Children (entries with a `parent` field) are filtered out of bulk
 *   browse / search / intent results in the runtime registry by default;
 *   callers can opt in with `parent="<slug>"` (scope to that parent's
 *   children) or `includeChildren=true`. Use this for helper classes that
 *   compose around a parent class (e.g. `dbx-list-two-line-item-icon`
 *   carries `@parent dbx-list-two-line-item`). The leading dot on a parent
 *   value is stripped, so `@parent .dbx-foo` and `@parent dbx-foo` are
 *   equivalent. Parent slugs are NOT validated against the registry at
 *   extract time — cross-source references and forward references both
 *   work.
 * - `@component <ClassName>` — names the Angular component class that
 *   owns this rule (e.g. `@component DbxIconTileComponent`). Surfaces in
 *   the lookup output so consumers know which component to use instead
 *   of applying the class by hand.
 * - `@scope <utility|component-class>` — defaults to `utility` when
 *   omitted. Set to `component-class` when the rule ships as part of a
 *   component template and should not be applied to arbitrary elements.
 *   The lookup tool renders a "use the component, not the class" hint in
 *   that case while still surfacing tokens.
 *
 * Two arrays are derived automatically from the rule's body during
 * extraction (no annotation needed):
 *
 * - `tokensRead` — every CSS custom property referenced via `var(--name,
 *   …)` inside any declaration value (including nested `var()` calls in
 *   fallbacks). Sorted, deduped.
 * - `tokensSet` — every CSS custom property declared by the rule (a
 *   declaration whose property starts with `--`). Sorted, deduped.
 *
 * Curation gate: only selectors whose preceding comment block contains
 * `/// @dbx-utility` make it into the output.
 *
 * Selector shapes accepted:
 *
 * - **Flat single-class** (`.dbx-foo`) — the canonical case. Slug defaults
 *   to `dbx-foo`; `selectorContext` is omitted.
 * - **Flat comma-list** (`.text-center, .dbx-text-center`) — picks the
 *   `.dbx-*` variant as canonical; the chosen class is the host. Each
 *   comma-separated part must be a flat single-class selector.
 * - **Compound descendant chain** (`.dbx-list-no-item-padding .dbx-list >
 *   .dbx-list-content …`) — the FIRST flat class in the chain becomes the
 *   host (canonical) selector; the full original text is preserved on the
 *   entry as `selectorContext` so consumers see the usage context. The
 *   first segment must be a flat single class (no compound `.foo.bar`,
 *   pseudo-classes, or attribute selectors as the host); everything after
 *   the first whitespace combinator can be arbitrary CSS. This lets a
 *   curator annotate a rule like `.dbx-list-no-item-padding .dbx-list …
 *   { padding: 0 }` directly without rewriting it as nested SCSS.
 *
 * Nested SCSS rules inside an annotated block (e.g. `.item-icon` inside a
 * `.dbx-list-two-line-item` rule) are NOT cataloged; lift them to flat
 * top-level classes if they should be discoverable as utilities, then
 * carry `@parent` to group them under their conceptual parent.
 *
 * Implementation: a lightweight line-based scanner. The SCSS family this
 * package targets uses flat top-level rules (or rules nested one level deep
 * inside a `@mixin core()` block); brace-counting is sufficient for both.
 * No PostCSS dependency.
 */

import type { CssUtilityRoleValue, CssUtilityScopeValue } from '../manifest/css-utilities-schema.js';
import { CSS_UTILITY_ROLES, CSS_UTILITY_SCOPES } from '../manifest/css-utilities-schema.js';

// MARK: Public types
/**
 * One declaration captured from the annotated rule.
 */
export interface ExtractedCssDeclaration {
  readonly property: string;
  readonly value: string;
}

/**
 * One annotated-utility entry produced by {@link extractCssUtilityEntries}.
 * `file` is the relative file path supplied by the caller; `line` is the
 * 1-based line number where the selector begins.
 */
export interface ExtractedCssUtilityEntry {
  readonly slug: string;
  readonly selector: string;
  readonly file: string;
  readonly line: number;
  readonly declarations: readonly ExtractedCssDeclaration[];
  readonly role?: CssUtilityRoleValue;
  readonly intent?: string;
  readonly seeAlso?: readonly string[];
  readonly antiUse?: string;
  readonly since?: string;
  readonly parent?: string;
  readonly selectorContext?: string;
  readonly component?: string;
  readonly scope?: CssUtilityScopeValue;
  readonly tokensRead?: readonly string[];
  readonly tokensSet?: readonly string[];
}

/**
 * Discriminated union of warning kinds produced by the extractor. Strict
 * curation errors (like a `/// @dbx-utility` block followed by a non-class
 * selector) are surfaced as warnings rather than thrown so a single bad
 * annotation does not break the whole scan.
 */
export type ExtractWarning = { readonly kind: 'unsupported-selector'; readonly file: string; readonly line: number; readonly selector: string } | { readonly kind: 'unknown-role'; readonly file: string; readonly line: number; readonly slug: string; readonly role: string } | { readonly kind: 'unknown-scope'; readonly file: string; readonly line: number; readonly slug: string; readonly scope: string } | { readonly kind: 'orphan-annotation'; readonly file: string; readonly line: number };

/**
 * Input to {@link extractCssUtilityEntries}.
 */
export interface ExtractCssUtilityEntriesInput {
  readonly file: string;
  readonly source: string;
}

/**
 * Result of one extraction run.
 */
export interface ExtractCssUtilityEntriesResult {
  readonly entries: readonly ExtractedCssUtilityEntry[];
  readonly warnings: readonly ExtractWarning[];
}

// MARK: Annotation parsing
interface ParsedAnnotation {
  readonly utilitySlug: string | null;
  readonly intent?: string;
  readonly role?: string;
  readonly seeAlso?: readonly string[];
  readonly antiUse?: string;
  readonly since?: string;
  readonly parent?: string;
  readonly component?: string;
  readonly scope?: string;
}

/**
 * Parses a buffer of `///` annotation lines (each already stripped of the
 * leading `/// `) into a structured shape. Lines without a recognised tag
 * are ignored — the curation marker itself is the only required line.
 *
 * @param lines - the annotation lines belonging to one block
 * @returns the parsed annotation; `utilitySlug` is `null` when no
 *          `@dbx-utility` line appears
 */
export function parseAnnotation(lines: readonly string[]): ParsedAnnotation {
  let utilitySlug: string | null = null;
  let intent: string | undefined;
  let role: string | undefined;
  const seeAlsoCollected: string[] = [];
  let antiUse: string | undefined;
  let since: string | undefined;
  let parent: string | undefined;
  let component: string | undefined;
  let scope: string | undefined;

  for (const line of lines) {
    if (line.startsWith('@dbx-utility')) {
      const value = line.slice('@dbx-utility'.length).trim();
      utilitySlug = value.length > 0 ? value : '';
    } else if (line.startsWith('@intent ')) {
      intent = line.slice('@intent '.length).trim();
    } else if (line.startsWith('@role ')) {
      role = line.slice('@role '.length).trim();
    } else if (line.startsWith('@see-also ')) {
      const value = line.slice('@see-also '.length).trim();
      for (const item of value.split(',')) {
        const trimmed = item.trim();
        if (trimmed.length > 0) seeAlsoCollected.push(trimmed);
      }
    } else if (line.startsWith('@anti-use ')) {
      antiUse = line.slice('@anti-use '.length).trim();
    } else if (line.startsWith('@since ')) {
      since = line.slice('@since '.length).trim();
    } else if (line.startsWith('@parent ')) {
      const value = line.slice('@parent '.length).trim();
      // Normalise away an accidental leading `.` so consumers can write
      // either `@parent dbx-foo` or `@parent .dbx-foo` and get the same slug.
      parent = value.length > 0 ? value.replace(/^\./, '') : undefined;
    } else if (line.startsWith('@component ')) {
      const value = line.slice('@component '.length).trim();
      component = value.length > 0 ? value : undefined;
    } else if (line.startsWith('@scope ')) {
      const value = line.slice('@scope '.length).trim();
      scope = value.length > 0 ? value : undefined;
    }
  }

  const result: ParsedAnnotation = {
    utilitySlug,
    intent,
    role,
    seeAlso: seeAlsoCollected.length > 0 ? seeAlsoCollected : undefined,
    antiUse,
    since,
    parent,
    component,
    scope
  };
  return result;
}

// MARK: Extraction
/**
 * Walks the supplied SCSS source and extracts every `/// @dbx-utility`
 * annotated rule. Only flat single-class selectors are supported in v1 —
 * compound or descendant selectors are reported via the
 * `unsupported-selector` warning.
 *
 * @param input - the file label (relative path) and the SCSS source string
 * @returns the extracted entries plus deterministic warnings
 */
export function extractCssUtilityEntries(input: ExtractCssUtilityEntriesInput): ExtractCssUtilityEntriesResult {
  const { file, source } = input;
  const lines = source.split(/\r?\n/);

  const entries: ExtractedCssUtilityEntry[] = [];
  const warnings: ExtractWarning[] = [];

  let annotationBuffer: string[] = [];
  let annotationStartLine = 0;

  let index = 0;
  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('///')) {
      if (annotationBuffer.length === 0) {
        annotationStartLine = index + 1;
      }
      annotationBuffer.push(trimmed.replace(/^\/{3}\s?/, ''));
      index += 1;
      continue;
    }

    if (annotationBuffer.length > 0) {
      const annotation = parseAnnotation(annotationBuffer);
      if (annotation.utilitySlug !== null) {
        const ruleStart = findNextRuleStart(lines, index);
        if (ruleStart === null) {
          warnings.push({ kind: 'orphan-annotation', file, line: annotationStartLine });
          annotationBuffer = [];
          index += 1;
          continue;
        }

        const headerLines = lines.slice(ruleStart.line, ruleStart.line + 1);
        // Selector header may span multiple lines if commas split across newlines.
        // Walk forward until we hit `{`.
        let header = headerLines[0];
        let headerEnd = ruleStart.line;
        while (!header.includes('{') && headerEnd + 1 < lines.length) {
          headerEnd += 1;
          header += `\n${lines[headerEnd]}`;
        }
        const selectorListText = header.slice(0, header.indexOf('{')).trim();
        const canonicalSelector = pickCanonicalSelector(selectorListText);
        if (canonicalSelector === null) {
          warnings.push({ kind: 'unsupported-selector', file, line: ruleStart.line + 1, selector: selectorListText });
          annotationBuffer = [];
          index = ruleStart.endLine + 1;
          continue;
        }
        const selectorText = canonicalSelector.host;
        const selectorContext = canonicalSelector.fullChain !== canonicalSelector.host ? canonicalSelector.fullChain : undefined;

        const ruleBody = readRuleBody(lines, ruleStart.line);
        const declarations = parseDeclarations(ruleBody);

        const slug = annotation.utilitySlug.length > 0 ? annotation.utilitySlug : selectorText.replace(/^\./, '');
        const roleValue = resolveRole(annotation.role);
        if (annotation.role !== undefined && roleValue === undefined) {
          warnings.push({ kind: 'unknown-role', file, line: ruleStart.line + 1, slug, role: annotation.role });
        }
        const scopeValue = resolveScope(annotation.scope);
        if (annotation.scope !== undefined && scopeValue === undefined) {
          warnings.push({ kind: 'unknown-scope', file, line: ruleStart.line + 1, slug, scope: annotation.scope });
        }
        // Token reads scan the full rule body — including nested rules — so
        // that `var()` references inside descendants (e.g. the inner
        // `.mat-icon` block of `.dbx-icon-tile`) still surface as tokens
        // consumers can override on the outer entry. Token writes only
        // count direct outer-rule declarations.
        const tokensRead = collectTokensReadFromBody(ruleBody);
        const tokensSet = collectTokensSet(declarations);

        const entry: ExtractedCssUtilityEntry = {
          slug,
          selector: selectorText,
          file,
          line: ruleStart.line + 1,
          declarations,
          role: roleValue,
          intent: annotation.intent,
          seeAlso: annotation.seeAlso,
          antiUse: annotation.antiUse,
          since: annotation.since,
          parent: annotation.parent,
          selectorContext,
          component: annotation.component,
          scope: scopeValue,
          tokensRead: tokensRead.length > 0 ? tokensRead : undefined,
          tokensSet: tokensSet.length > 0 ? tokensSet : undefined
        };
        entries.push(entry);

        annotationBuffer = [];
        index = ruleStart.endLine + 1;
        continue;
      }
      annotationBuffer = [];
    }

    index += 1;
  }

  return { entries, warnings };
}

// MARK: Internals
const FLAT_CLASS_RE = /^\.[A-Za-z_][\w-]*$/;
const COMPOUND_HOST_RE = /^(\.[A-Za-z_][\w-]*)(\s.*)$/;

/**
 * Splits a selector segment into a host class (the first flat class) and
 * the descendant chain that follows. Returns `null` when the segment does
 * not start with a flat single-class selector — compound hosts like
 * `.foo.bar`, pseudo-class hosts like `.foo:hover`, and attribute hosts are
 * intentionally rejected so the host stays unambiguous.
 *
 * @param part - one comma-separated selector part (already whitespace-collapsed)
 * @returns `{ host, fullChain }` when accepted; `fullChain === host` for
 *          flat selectors. `null` for unsupported shapes.
 */
function splitHostAndChain(part: string): { readonly host: string; readonly fullChain: string } | null {
  let result: { readonly host: string; readonly fullChain: string } | null = null;
  if (FLAT_CLASS_RE.test(part)) {
    result = { host: part, fullChain: part };
  } else {
    const compound = COMPOUND_HOST_RE.exec(part);
    if (compound !== null) {
      result = { host: compound[1], fullChain: part };
    }
  }
  return result;
}

interface PickedSelector {
  readonly host: string;
  readonly fullChain: string;
}

/**
 * Picks the canonical host selector + full chain from a (possibly
 * comma-separated) selector list. Each comma-delimited part must start
 * with a flat single class — that first class becomes the host. The rest
 * of the part (descendant combinator + whatever) is preserved verbatim as
 * the `fullChain` so callers can distinguish flat utilities (host equals
 * fullChain) from compound utilities (`fullChain` includes the descendant
 * context).
 *
 * Prefers a `.dbx-*` host when present; falls back to the first part
 * otherwise. Returns `null` when any part fails the host shape — those
 * rules surface as `unsupported-selector` warnings upstream so a single
 * malformed annotation can't break a whole scan.
 *
 * @param raw - the trimmed selector text up to the opening `{`
 * @returns the chosen host + fullChain, or `null` when unsupported
 */
function pickCanonicalSelector(raw: string): PickedSelector | null {
  const parts = raw
    .split(',')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0);
  let picked: PickedSelector | null = null;
  if (parts.length > 0) {
    const split = parts.map(splitHostAndChain);
    if (!split.some((s) => s === null)) {
      const valid = split as readonly PickedSelector[];
      // Prefer a `.dbx-*` host when available; otherwise the first part.
      let chosen: PickedSelector = valid[0];
      for (const candidate of valid) {
        if (candidate.host.startsWith('.dbx-')) {
          chosen = candidate;
          break;
        }
      }
      picked = chosen;
    }
  }
  return picked;
}

interface RuleStart {
  readonly line: number;
  readonly endLine: number;
}

function findNextRuleStart(lines: readonly string[], from: number): RuleStart | null {
  let result: RuleStart | null = null;
  let cursor = from;
  let bail = false;
  let selectorStart: number | null = null;
  while (cursor < lines.length && result === null && !bail) {
    const line = lines[cursor];
    const trimmed = line.trim();
    if (selectorStart === null) {
      if (trimmed.length === 0 || trimmed.startsWith('//')) {
        cursor += 1;
        continue;
      }
      if (line.includes('{')) {
        const endLine = findRuleEnd(lines, cursor);
        result = { line: cursor, endLine };
      } else if (trimmed.endsWith(',')) {
        // Multi-line selector list — keep walking until we find `{`.
        selectorStart = cursor;
        cursor += 1;
      } else {
        // Non-blank, non-comment, non-selector, non-rule line — annotation is orphan.
        bail = true;
      }
    } else {
      if (line.includes('{')) {
        const endLine = findRuleEnd(lines, cursor);
        result = { line: selectorStart, endLine };
      } else if (trimmed.length === 0 || trimmed.startsWith('//') || trimmed.endsWith(',') || /^\.[A-Za-z_]/.test(trimmed)) {
        cursor += 1;
      } else {
        bail = true;
      }
    }
  }
  return result;
}

function findRuleEnd(lines: readonly string[], startLine: number): number {
  let depth = 0;
  let cursor = startLine;
  let endLine = startLine;
  let done = false;
  while (cursor < lines.length && !done) {
    const line = lines[cursor];
    for (const char of line) {
      if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          endLine = cursor;
          done = true;
          break;
        }
      }
    }
    if (!done) cursor += 1;
  }
  if (!done) endLine = lines.length - 1;
  return endLine;
}

function readRuleBody(lines: readonly string[], startLine: number): string {
  const endLine = findRuleEnd(lines, startLine);
  let openLine = startLine;
  while (openLine <= endLine && !lines[openLine].includes('{')) {
    openLine += 1;
  }
  if (openLine > endLine) return '';
  const openIndex = lines[openLine].indexOf('{');
  const head = lines[openLine].slice(openIndex + 1);
  const middle = lines.slice(openLine + 1, endLine).join('\n');
  const tail = endLine === openLine ? '' : lines[endLine].slice(0, lines[endLine].lastIndexOf('}'));
  // When the opening and closing braces are on the same line, head includes `}` — strip it.
  const cleanedHead = endLine === openLine ? head.slice(0, head.lastIndexOf('}')) : head;
  return [cleanedHead, middle, tail].filter((s) => s.length > 0).join('\n');
}

function parseDeclarations(body: string): readonly ExtractedCssDeclaration[] {
  const declarations: ExtractedCssDeclaration[] = [];
  // Walk the body character-by-character so we can ignore content inside
  // nested rules and balance parentheses for things like `calc(100% - 8px)`.
  let depth = 0;
  let parenDepth = 0;
  let buffer = '';
  let inLineComment = false;
  let inBlockComment = false;

  let index = 0;
  while (index < body.length) {
    const char = body[index];
    const next = body[index + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      index += 1;
      continue;
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }
    if (char === '/' && next === '/') {
      inLineComment = true;
      index += 2;
      continue;
    }
    if (char === '/' && next === '*') {
      inBlockComment = true;
      index += 2;
      continue;
    }

    if (char === '(') parenDepth += 1;
    else if (char === ')' && parenDepth > 0) parenDepth -= 1;

    if (parenDepth === 0 && char === '{') {
      // Entering a nested rule — skip until matching `}` at depth-0.
      depth = 1;
      index += 1;
      while (index < body.length && depth > 0) {
        const inner = body[index];
        if (inner === '{') depth += 1;
        else if (inner === '}') depth -= 1;
        index += 1;
      }
      buffer = '';
      continue;
    }

    if (parenDepth === 0 && char === ';') {
      const decl = parseSingleDeclaration(buffer);
      if (decl !== null) declarations.push(decl);
      buffer = '';
      index += 1;
      continue;
    }

    buffer += char;
    index += 1;
  }

  // Trailing declaration without semicolon
  const trailing = parseSingleDeclaration(buffer);
  if (trailing !== null) declarations.push(trailing);

  return declarations;
}

function parseSingleDeclaration(raw: string): ExtractedCssDeclaration | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith('@')) return null; // @include / @use / etc.
  const colonIndex = trimmed.indexOf(':');
  if (colonIndex <= 0) return null;
  const property = trimmed.slice(0, colonIndex).trim().toLowerCase();
  const value = trimmed.slice(colonIndex + 1).trim();
  if (property.length === 0 || value.length === 0) return null;
  // Skip `&.modifier`-style nested-pattern junk if it sneaks in.
  if (property.includes('&') || property.includes(' ')) return null;
  // Skip CSS custom properties (we only catalog "real" declarations); we
  // intentionally still allow them in the parsed output because some utility
  // classes set `--mat-…-…` overrides as part of their effect.
  return { property, value };
}

function resolveRole(raw: string | undefined): CssUtilityRoleValue | undefined {
  if (raw === undefined) return undefined;
  return (CSS_UTILITY_ROLES as readonly string[]).includes(raw) ? (raw as CssUtilityRoleValue) : undefined;
}

function resolveScope(raw: string | undefined): CssUtilityScopeValue | undefined {
  if (raw === undefined) return undefined;
  return (CSS_UTILITY_SCOPES as readonly string[]).includes(raw) ? (raw as CssUtilityScopeValue) : undefined;
}

const CSS_VAR_REFERENCE_RE = /var\(\s*(--[A-Za-z_][\w-]*)/g;

/**
 * Scans the raw rule body (including nested-rule contents) for every
 * `var(--name, …)` reference. Walking the raw body — not the parsed flat
 * declarations — means var() references inside nested rules (e.g. the
 * inner `.mat-icon` block of `.dbx-icon-tile`) still surface as tokens
 * consumers can override on the outer entry. Recurses into nested `var()`
 * calls in fallbacks naturally because the regex matches every
 * `var(--name` occurrence regardless of nesting depth.
 *
 * @param body - the raw rule body extracted by `readRuleBody`
 * @returns the sorted, deduped list of `--name` strings (leading `--` kept)
 */
function collectTokensReadFromBody(body: string): readonly string[] {
  const set = new Set<string>();
  let match: RegExpExecArray | null;
  CSS_VAR_REFERENCE_RE.lastIndex = 0;
  while ((match = CSS_VAR_REFERENCE_RE.exec(body)) !== null) {
    set.add(match[1]);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Pulls the `--name` declarations out of the parsed body. Sorted and
 * deduped so output order is deterministic.
 *
 * @param declarations - the parsed declarations from one rule body
 * @returns the sorted, deduped list of `--name` strings (leading `--` kept)
 */
function collectTokensSet(declarations: readonly ExtractedCssDeclaration[]): readonly string[] {
  const set = new Set<string>();
  for (const decl of declarations) {
    if (decl.property.startsWith('--')) {
      set.add(decl.property);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
