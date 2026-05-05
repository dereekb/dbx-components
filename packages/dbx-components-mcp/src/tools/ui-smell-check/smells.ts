/**
 * Smell catalog for `dbx_ui_smell_check`.
 *
 * Each smell exports a detector function plus a fix-text builder. Detectors
 * are intentionally regex-based — full Angular template / SCSS parsing is
 * overkill for the patterns we want to flag. Adding a new smell means
 * appending one entry to {@link UI_SMELLS}.
 */

import type { TokenEntry } from '../../manifest/tokens-schema.js';
import type { TokenRegistry } from '../../registry/tokens-runtime.js';
import type { UiComponentRegistry } from '../../registry/ui-components-runtime.js';

// MARK: Public types
/**
 * One detected smell — captured snippet plus the fix markdown the formatter
 * splices into the response.
 */
export interface SmellMatch {
  readonly id: string;
  readonly severity: 'warn' | 'info';
  readonly title: string;
  readonly snippet: string;
  readonly fix: string;
  readonly seeAlsoSlugs: readonly string[];
  readonly seeAlsoTokens: readonly string[];
  /**
   * Which source string this match came from. Determines which line numbers
   * and ignore-directive scope apply.
   */
  readonly source: 'html' | 'scss';
  /**
   * Character offset of the match start within `source`. Used for cascade
   * suppression and dedup keys.
   */
  readonly index: number;
  /**
   * Length of the matched region within `source`.
   */
  readonly length: number;
  /**
   * 1-based line number of the first matched line.
   */
  readonly line: number;
  /**
   * 1-based line number of the last matched line. Equals `line` for single-line
   * matches.
   */
  readonly endLine: number;
  /**
   * Normalized text used for de-duplication — e.g. for hardcoded-radius this is
   * the value `12px`. The formatter groups matches that share `(id, dedupKey)`.
   */
  readonly dedupKey: string;
}

/**
 * Project-local convention overrides supplied via the tool input or
 * `dbx-mcp.config.json`.
 */
export interface ProjectConventions {
  readonly cardWrapperClasses?: readonly string[];
}

/**
 * Inputs to all smell detectors.
 */
export interface SmellInput {
  readonly html: string;
  readonly scss: string;
  readonly conventions: ProjectConventions;
  readonly tokenRegistry: TokenRegistry;
  readonly uiComponentRegistry: UiComponentRegistry;
  /**
   * Optional source paths. Used to derive a project-local SCSS variable
   * prefix in the `hardcoded-hex-brand-color` fix-text — e.g. a file under
   * `apps/hellosubs/...` produces `$hellosubs-…` rather than the generic
   * `$myapp-…` placeholder.
   */
  readonly scssPath?: string;
  readonly htmlPath?: string;
}

/**
 * Returns a project-local SCSS variable prefix derived from `apps/<name>` or
 * `packages/<name>` segments in the supplied path(s). Returns undefined when
 * neither convention applies — callers should fall back to a generic name.
 *
 * @param scssPath - Optional SCSS source path used as the primary prefix source.
 * @param htmlPath - Optional HTML source path consulted as a fallback.
 * @returns The matched project name, or `undefined` when neither path matches the convention.
 */
export function deriveProjectPrefix(scssPath: string | undefined, htmlPath: string | undefined): string | undefined {
  let result: string | undefined;
  for (const path of [scssPath, htmlPath]) {
    if (path === undefined) continue;
    const match = /(?:^|[/\\])(?:apps|packages|libs)[/\\]([\w-]+)/.exec(path);
    if (match !== null) {
      result = match[1];
      break;
    }
  }
  return result;
}

// MARK: Detector signature
/**
 * One detector. `detect` returns zero or more matches; the dispatcher
 * concatenates them into the final response.
 */
export type SmellDetector = (input: SmellInput) => readonly SmellMatch[];

// MARK: Helpers
function captureSnippet(haystack: string, index: number, length: number): string {
  const start = Math.max(0, haystack.lastIndexOf('\n', index) + 1);
  const end = haystack.indexOf('\n', index + length);
  let stop: number;
  if (end < 0) {
    stop = Math.min(haystack.length, index + length + 80);
  } else {
    stop = end;
  }
  return haystack.slice(start, stop).trimEnd();
}

/**
 * Returns the 1-based line number that contains the given offset in `text`.
 *
 * @param text - The text to scan.
 * @param offset - Zero-based character offset whose line is requested.
 * @returns The 1-based line number, clamped to the bounds of `text`.
 */
function lineNumberOf(text: string, offset: number): number {
  const clamped = Math.min(Math.max(offset, 0), text.length);
  let line = 1;
  for (let i = 0; i < clamped; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
}

/**
 * Returns the registry's spacing entry whose default value exactly equals
 * `raw` (e.g. `12px` → `--dbx-padding-3`). Returns undefined when no exact
 * match exists — substring matches are intentionally rejected because
 * `findByValue('4px')` would otherwise pick up `--dbx-padding-5` (24px).
 *
 * @param exact - The token entry whose default may match `raw`.
 * @param raw - The raw radius value being classified.
 * @returns A formatted suffix describing whether the token is an exact-match or idiomatic-radius case.
 */
function matchKindForRadius(exact: TokenEntry | undefined, raw: string): string {
  if (exact === undefined) return '';
  if (exact.defaults.light === raw || exact.defaults.dark === raw) return '(exact-match design-system corner token).';
  return '(idiomatic full / pill radius — design system token).';
}

function findExactRoleToken(registry: TokenRegistry, raw: string, role: string): TokenEntry | undefined {
  const candidates = registry.byRole.get(role) ?? [];
  let result: TokenEntry | undefined;
  for (const entry of candidates) {
    if (entry.defaults.light === raw || entry.defaults.dark === raw) {
      result = entry;
      break;
    }
  }
  return result;
}

/**
 * Returns true when `colonIndex` points at the colon inside an SCSS variable
 * declaration (e.g. `$foo: #abc`). Used to suppress hex/value-level smells
 * fired against the canonical declaration line, which is exactly the place
 * the smell's own fix-text recommends putting the literal.
 *
 * @param scss - The full SCSS text being scanned.
 * @param colonIndex - Offset of the colon under inspection.
 * @returns `true` when the colon belongs to an SCSS variable declaration.
 */
function isInsideScssVarDeclaration(scss: string, colonIndex: number): boolean {
  const lineStart = scss.lastIndexOf('\n', colonIndex - 1) + 1;
  const prefix = scss.slice(lineStart, colonIndex);
  return /^\s*\$[\w-]+\s*$/.test(prefix);
}

interface CardSurfaceHit {
  /**
   * Offset of the rule's selector start within `scss`. Used as the match index.
   */
  readonly index: number;
  /**
   * Distance from `index` to the closing `}`.
   */
  readonly length: number;
  /**
   * Trimmed snippet showing only the selector + surface-defining declarations.
   */
  readonly snippet: string;
  /**
   * Offsets of the rule's body (between `{` and `}`) — used for cascade suppression.
   */
  readonly bodyStart: number;
  readonly bodyEnd: number;
}

function findCardSurface(scss: string): CardSurfaceHit | null {
  let result: CardSurfaceHit | null = null;
  // Walk SCSS rule blocks: anything between `{` and matching `}`. Then look
  // for the conjunction of `padding`, `background:` (white-ish), and a
  // `border-radius`.
  let depth = 0;
  let blockStart = -1;
  let blockHeaderStart = -1;
  let lastBoundary = 0;
  for (let i = 0; i < scss.length; i += 1) {
    const ch = scss[i];
    if (ch === '{') {
      if (depth === 0) {
        blockStart = i + 1;
        blockHeaderStart = lastBoundary;
      }
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && blockStart >= 0) {
        const block = scss.slice(blockStart, i);
        if (looksLikeCardSurface(block)) {
          const selector = scss.slice(blockHeaderStart, blockStart - 1).trim();
          const snippet = trimCardSurfaceSnippet(selector, block);
          result = { index: blockHeaderStart, length: i - blockHeaderStart, snippet, bodyStart: blockStart, bodyEnd: i };
          break;
        }
        blockStart = -1;
        lastBoundary = i + 1;
      }
    } else if (depth === 0 && (ch === ';' || ch === '}')) {
      lastBoundary = i + 1;
    }
  }
  return result;
}

function looksLikeCardSurface(block: string): boolean {
  const hasPadding = /\bpadding\s*:\s*\d/i.test(block);
  const hasWhiteBg = /background\s*:\s*(#fff|#ffffff|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))/i.test(block);
  const hasRadius = /\bborder-radius\s*:\s*\d/i.test(block);
  return hasPadding && hasWhiteBg && hasRadius;
}

/**
 * Returns the lines of `block` that sit at brace-depth 0 — i.e. declarations
 * directly inside the rule, not nested inside `&__player { ... }` or any
 * other child selector. Lines that open or close a brace are dropped along
 * with the entire nested block they wrap.
 *
 * @param block - The SCSS rule body text whose top-level lines are needed.
 * @returns Source lines that sit at brace-depth zero.
 */
function topLevelLines(block: string): readonly string[] {
  const lines = block.split('\n');
  const out: string[] = [];
  let depth = 0;
  for (const line of lines) {
    const startedAtZero = depth === 0;
    let openedHere = false;
    for (const ch of line) {
      if (ch === '{') {
        depth += 1;
        openedHere = true;
      } else if (ch === '}') {
        depth -= 1;
      }
    }
    if (startedAtZero && !openedHere) out.push(line);
  }
  return out;
}

/**
 * Returns a snippet that shows only the selector header plus the
 * surface-defining declarations (padding / background / border-radius /
 * box-shadow) at the top level of the rule — enough for the reader to
 * confirm the smell without dumping nested child-rule content.
 *
 * @param selector - The matched rule's selector header text.
 * @param block - The rule body whose top-level surface declarations should be summarized.
 * @returns A trimmed snippet containing the selector and a few representative declarations.
 */
function trimCardSurfaceSnippet(selector: string, block: string): string {
  const interesting = /^\s*(padding(?:-(?:top|right|bottom|left))?|margin(?:-(?:top|right|bottom|left))?|background(?:-color)?|border-radius|box-shadow)\s*:/i;
  const topLevel = topLevelLines(block);
  const kept: string[] = [];
  for (const line of topLevel) {
    if (interesting.test(line)) kept.push(line.trimEnd());
  }
  if (kept.length === 0) {
    for (const line of topLevel) {
      if (line.trim().length > 0) {
        kept.push(line.trimEnd());
        if (kept.length >= 4) break;
      }
    }
  }
  return [`${selector} {`, ...kept.map((l) => l.replace(/^\s*/, '  ')), '  …', '}'].join('\n');
}

// MARK: SCSS smells
/**
 * Detects hand-rolled card surfaces — element with padding + white background
 * + border-radius. Recommends `<dbx-content-box>` + `<dbx-section>`.
 *
 * @param input - The smell detection input (HTML, SCSS, conventions, registries).
 * @returns Zero or one match describing the offending rule.
 */
const cardSurfaceHandrolled: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  const hit = findCardSurface(input.scss);
  if (hit !== null) {
    const wrapperHint = input.conventions.cardWrapperClasses && input.conventions.cardWrapperClasses.length > 0 ? ` Or wrap the projection in your project-local class: \`${input.conventions.cardWrapperClasses.join('`, `')}\`.` : '';
    const startLine = lineNumberOf(input.scss, hit.index);
    const endLine = lineNumberOf(input.scss, hit.index + hit.length);
    matches.push({
      id: 'card-surface-handrolled',
      severity: 'warn',
      title: 'Hand-rolled card surface',
      snippet: hit.snippet,
      fix: [
        'This block re-implements `<dbx-content-box>`. Replace the wrapper element with `<dbx-content-box>` (it provides padding, surface color, and corner radius automatically) and project the section content via `<dbx-section header="..." hint="...">` for the title/subtitle stack.' + wrapperHint,
        '',
        'Replacing this block with `<dbx-content-box>` also resolves any `hardcoded-padding`, `hardcoded-radius`, `hardcoded-shadow`, `hardcoded-hint-color`, `hardcoded-hex-brand-color`, and `flex-column-with-gap-as-card-stack` findings inside the same rule — those are suppressed here.',
        '',
        'Replacement HTML:',
        '```html',
        '<dbx-content-box>',
        '  <dbx-section header="…" hint="…">',
        '    <!-- projected content -->',
        '  </dbx-section>',
        '</dbx-content-box>',
        '```'
      ].join('\n'),
      seeAlsoSlugs: ['content-box', 'section'],
      seeAlsoTokens: ['--mat-sys-surface-container', '--dbx-padding-3'],
      source: 'scss',
      index: hit.index,
      length: hit.length,
      line: startLine,
      endLine,
      dedupKey: `card-surface@L${startLine}`
    });
  }
  return matches;
};

const HARDCODED_RADIUS_RE = /border-radius\s*:\s*(\d+(?:\.\d+)?(?:px|rem|em|%))(?!\s*\))/gi;

/**
 * Idiomatic values that mean "fully rounded" (pill / circle). The token
 * registry only records `9999px` for `--mat-sys-corner-full`, but authors
 * commonly write `999px`, `50%`, or `100%` for the same intent — map them.
 */
const FULL_RADIUS_SYNONYMS: ReadonlySet<string> = new Set(['999px', '9999px', '50%', '100%']);

/**
 * Flags hardcoded `border-radius: <N>px|rem` not wrapped in a `var()`.
 *
 * @param input - The smell detection input.
 * @returns Matches for each hardcoded radius declaration.
 */
const hardcodedRadius: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.scss.matchAll(HARDCODED_RADIUS_RE)) {
    if (match.index === undefined) continue;
    const colonIndex = input.scss.indexOf(':', match.index);
    if (colonIndex !== -1 && isInsideScssVarDeclaration(input.scss, colonIndex)) continue;
    const raw = match[1];
    let exact = findExactRoleToken(input.tokenRegistry, raw, 'radius');
    if (exact === undefined && FULL_RADIUS_SYNONYMS.has(raw)) {
      exact = input.tokenRegistry.findByCssVariable('--mat-sys-corner-full');
    }
    const matchKind = matchKindForRadius(exact, raw);
    const fix = exact !== undefined ? `Replace \`border-radius: ${raw}\` with \`border-radius: var(${exact.cssVariable})\` ${matchKind}` : `Hardcoded radius \`${raw}\` doesn't match any design-system corner token. Either wrap it in a project-local SCSS variable or align it with one of \`--mat-sys-corner-extra-small\` (4px), \`-small\` (8px), \`-medium\` (12px), \`-large\` (16px), \`-extra-large\` (28px), or \`-full\` (pill / circle).`;
    matches.push({
      id: 'hardcoded-radius',
      severity: 'warn',
      title: 'Hardcoded border-radius',
      snippet: captureSnippet(input.scss, match.index, match[0].length),
      fix,
      seeAlsoSlugs: exact?.recommendedPrimitive !== undefined ? [exact.recommendedPrimitive] : [],
      seeAlsoTokens: exact !== undefined ? [exact.cssVariable] : [],
      source: 'scss',
      index: match.index,
      length: match[0].length,
      line: lineNumberOf(input.scss, match.index),
      endLine: lineNumberOf(input.scss, match.index),
      dedupKey: `radius:${raw}`
    });
  }
  return matches;
};

const HARDCODED_SHADOW_RE = /box-shadow\s*:\s*([^;]+);/gi;

/**
 * Flags raw `box-shadow:` declarations and recommends elevation tokens or the
 * `<dbx-content-box [elevate]>` wrapper.
 *
 * @param input - The smell detection input.
 * @returns Matches for each hardcoded shadow declaration.
 */
const hardcodedShadow: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.scss.matchAll(HARDCODED_SHADOW_RE)) {
    if (match.index === undefined) continue;
    const raw = match[1].trim();
    if (raw.startsWith('var(') || raw === 'none') continue;
    const exact = findExactRoleToken(input.tokenRegistry, raw, 'elevation');
    const fix = exact !== undefined ? `Replace this hardcoded shadow with \`box-shadow: var(${exact.cssVariable})\` or use \`<dbx-content-box [elevate]="true">\` to apply the elevation through the wrapper component.` : 'Hardcoded `box-shadow:` declarations should map to one of the `--mat-sys-level0..5` elevation tokens, or wrap the surface in `<dbx-content-box [elevate]="true">` so the shadow comes from the design system.';
    matches.push({
      id: 'hardcoded-shadow',
      severity: 'warn',
      title: 'Hardcoded box-shadow',
      snippet: captureSnippet(input.scss, match.index, match[0].length),
      fix,
      seeAlsoSlugs: ['content-box', 'content-elevate'],
      seeAlsoTokens: exact !== undefined ? [exact.cssVariable] : ['--mat-sys-level1'],
      source: 'scss',
      index: match.index,
      length: match[0].length,
      line: lineNumberOf(input.scss, match.index),
      endLine: lineNumberOf(input.scss, match.index),
      dedupKey: `shadow:${raw.replaceAll(/\s+/g, ' ')}`
    });
  }
  return matches;
};

const HARDCODED_HINT_COLOR_RE = /color\s*:\s*(rgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,/\s]\s*0\.[5-7]\d?\s*\)|rgba?\(\s*255\s*,\s*255\s*,\s*255\s*[,/\s]\s*0\.[6-8]\d?\s*\))/gi;

/**
 * Flags low-emphasis text colors written as raw `rgba(0,0,0,0.6)` etc. and
 * routes them to `--mat-sys-on-surface-variant`.
 *
 * @param input - The smell detection input.
 * @returns Matches for each hardcoded hint color.
 */
const hardcodedHintColor: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.scss.matchAll(HARDCODED_HINT_COLOR_RE)) {
    if (match.index === undefined) continue;
    const raw = match[1];
    matches.push({
      id: 'hardcoded-hint-color',
      severity: 'warn',
      title: 'Hardcoded hint text color',
      snippet: captureSnippet(input.scss, match.index, match[0].length),
      fix: ['Replace this hardcoded hint color with `color: var(--mat-sys-on-surface-variant)` so it adapts to dark mode and matches Material guidance.', '', 'If this `color:` is on text inside a card, prefer `<dbx-section [header]="…" [hint]="…">`, which already styles the hint slot with the right token.'].join('\n'),
      seeAlsoSlugs: ['section'],
      seeAlsoTokens: ['--mat-sys-on-surface-variant'],
      source: 'scss',
      index: match.index,
      length: match[0].length,
      line: lineNumberOf(input.scss, match.index),
      endLine: lineNumberOf(input.scss, match.index),
      dedupKey: `hint-color:${raw.replaceAll(/\s+/g, '')}`
    });
  }
  return matches;
};

const HARDCODED_PADDING_RE = /(?:padding|margin)\s*(?:-(?:top|right|bottom|left))?\s*:\s*(\d+(?:\.\d+)?px)(?!\s*\))/gi;

/**
 * Flags hardcoded `padding: <N>px` / `margin: <N>px` that exactly match one of
 * the spacing tokens (`--dbx-padding-{0..5}`). Values that don't have an
 * exact-match token are deliberately ignored — substring matches such as
 * `4px` → `--dbx-padding-5` (24px) are wrong and undermine confidence in the
 * tool's other suggestions.
 *
 * @param input - The smell detection input.
 * @returns Matches for each exact-match hardcoded spacing declaration.
 */
const hardcodedPadding: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.scss.matchAll(HARDCODED_PADDING_RE)) {
    if (match.index === undefined) continue;
    const raw = match[1];
    const exact = findExactRoleToken(input.tokenRegistry, raw, 'spacing');
    if (exact !== undefined) {
      const utility = exact.utilityClasses?.[0];
      const fix = ['Replace `' + match[0].trim() + '` with `var(' + exact.cssVariable + ')`' + (utility !== undefined ? ` (or use the \`${utility}\` utility class on the host element)` : '') + '.'].join('\n');
      matches.push({
        id: 'hardcoded-padding',
        severity: 'warn',
        title: 'Hardcoded padding/margin',
        snippet: captureSnippet(input.scss, match.index, match[0].length),
        fix,
        seeAlsoSlugs: [],
        seeAlsoTokens: [exact.cssVariable],
        source: 'scss',
        index: match.index,
        length: match[0].length,
        line: lineNumberOf(input.scss, match.index),
        endLine: lineNumberOf(input.scss, match.index),
        dedupKey: `padding:${raw}`
      });
    }
  }
  return matches;
};

const HARDCODED_TYPOGRAPHY_RE = /font-size\s*:\s*(\d+(?:\.\d+)?)(rem|px)/gi;

/**
 * Flags large hardcoded `font-size:` values on what look like heading rules.
 *
 * @param input - The smell detection input.
 * @returns Matches for each oversized font-size declaration.
 */
const hardcodedTypography: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.scss.matchAll(HARDCODED_TYPOGRAPHY_RE)) {
    if (match.index === undefined) continue;
    const value = Number.parseFloat(match[1]);
    const unit = match[2];
    const tooBig = (unit === 'rem' && value > 1) || (unit === 'px' && value >= 18);
    if (tooBig) {
      matches.push({
        id: 'hardcoded-typography',
        severity: 'info',
        title: 'Hardcoded large font-size',
        snippet: captureSnippet(input.scss, match.index, match[0].length),
        fix: 'Use the `<dbx-section [header]>` (or `<dbx-section-page>` for page-level headers) primitive — it carries Material `headline` typography automatically. If you must inline a font-size, reach for one of `--mat-sys-headline-{small|medium|large}` or `--mat-sys-title-large`.',
        seeAlsoSlugs: ['section', 'section-page'],
        seeAlsoTokens: ['--mat-sys-headline-medium', '--mat-sys-title-large'],
        source: 'scss',
        index: match.index,
        length: match[0].length,
        line: lineNumberOf(input.scss, match.index),
        endLine: lineNumberOf(input.scss, match.index),
        dedupKey: `typography:${value}${unit}`
      });
    }
  }
  return matches;
};

const PIT_BACKGROUND_RE = /background\s*:\s*(rgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,/\s]\s*0\.0[2-8]\s*\))/gi;

/**
 * Flags ad-hoc tinted backgrounds intended as a "pit" surface and recommends
 * the `[dbxContentPit]` directive.
 *
 * @param input - The smell detection input.
 * @returns Matches for each ad-hoc pit background.
 */
const pitInsteadOfTintedBg: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.scss.matchAll(PIT_BACKGROUND_RE)) {
    if (match.index === undefined) continue;
    const raw = match[1];
    matches.push({
      id: 'pit-instead-of-tinted-bg',
      severity: 'warn',
      title: 'Hand-rolled tinted "pit" background',
      snippet: captureSnippet(input.scss, match.index, match[0].length),
      fix: 'Apply `[dbxContentPit]` to the host element. The directive paints the right tinted surface color and supports the rounded variant via `[dbxContentPitRounded]`.',
      seeAlsoSlugs: ['content-pit'],
      seeAlsoTokens: ['--mat-sys-surface-container-low'],
      source: 'scss',
      index: match.index,
      length: match[0].length,
      line: lineNumberOf(input.scss, match.index),
      endLine: lineNumberOf(input.scss, match.index),
      dedupKey: `pit-bg:${raw.replaceAll(/\s+/g, '')}`
    });
  }
  return matches;
};

const FLEX_COLUMN_GAP_RE = /display\s*:\s*flex\s*;\s*flex-direction\s*:\s*column\s*;\s*gap\s*:\s*\d+(?:\.\d+)?px\s*;/gi;

const CARD_LIKE_CHILD_RE = /(mat-card|dbx-card|dbx-content-box|dbx-content-pit|\.[\w-]*card[\w-]*|\.[\w-]*content-box[\w-]*)\b/i;

/**
 * Returns the body of the SCSS rule that contains `offset` (between the
 * matching `{` and `}`), or null if the offset isn't inside any rule.
 *
 * @param scss - The full SCSS text.
 * @param offset - Character offset whose enclosing rule body is needed.
 * @returns The substring between the rule's matching braces, or `null` when no rule encloses the offset.
 */
function findEnclosingRuleBody(scss: string, offset: number): string | null {
  let depth = 0;
  let openAt = -1;
  let result: string | null = null;
  for (let i = 0; i <= offset && i < scss.length; i += 1) {
    const ch = scss[i];
    if (ch === '{') {
      if (depth === 0) openAt = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) openAt = -1;
    }
  }
  if (openAt >= 0) {
    let d = 1;
    let close = -1;
    for (let i = openAt + 1; i < scss.length; i += 1) {
      const ch = scss[i];
      if (ch === '{') d += 1;
      else if (ch === '}') {
        d -= 1;
        if (d === 0) {
          close = i;
          break;
        }
      }
    }
    if (close > openAt) result = scss.slice(openAt + 1, close);
  }
  return result;
}

/**
 * Flags flex-column with gap as a stacked card layout — recommends
 * `[dbxFlexGroup]` or relying on `<dbx-content-box>` margins.
 *
 * Only fires when the enclosing rule body contains a card-like child selector
 * (`mat-card`, `dbx-content-box`, `*-card`, etc.). Page-level layouts that
 * happen to use flex-column + gap are common and should not be flagged.
 *
 * @param input - The smell detection input.
 * @returns Matches for each flex-column-gap card-stack pattern.
 */
const flexColumnWithGap: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.scss.matchAll(FLEX_COLUMN_GAP_RE)) {
    if (match.index === undefined) continue;
    const body = findEnclosingRuleBody(input.scss, match.index);
    if (body === null || !CARD_LIKE_CHILD_RE.test(body)) continue;
    matches.push({
      id: 'flex-column-with-gap-as-card-stack',
      severity: 'info',
      title: 'Flex column + gap on a card stack',
      snippet: captureSnippet(input.scss, match.index, match[0].length),
      fix: 'For stacking dbx-web cards/content-boxes, prefer `[dbxFlexGroup]` with `[breakToColumn]` (it handles wrapping, gaps, and responsive flow) or rely on the default sibling margins emitted by `<dbx-content-box>` siblings.',
      seeAlsoSlugs: ['flex-group'],
      seeAlsoTokens: ['--dbx-padding-3'],
      source: 'scss',
      index: match.index,
      length: match[0].length,
      line: lineNumberOf(input.scss, match.index),
      endLine: lineNumberOf(input.scss, match.index + match[0].length),
      dedupKey: `flex-column-stack@L${lineNumberOf(input.scss, match.index)}`
    });
  }
  return matches;
};

const MDC_OVERRIDE_RE = /(--mdc-[a-z0-9-]+)\s*:/gi;

/**
 * Flags direct `--mdc-*` token overrides — the right answer is almost always
 * to set `color="primary"` on the host or wrap in a styled component.
 *
 * @param input - The smell detection input.
 * @returns Matches for each `--mdc-*` override.
 */
const mdcTokenOverride: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  const seen = new Set<string>();
  for (const match of input.scss.matchAll(MDC_OVERRIDE_RE)) {
    if (match.index === undefined) continue;
    const tokenName = match[1];
    if (seen.has(tokenName)) continue;
    seen.add(tokenName);
    const tokenEntry = input.tokenRegistry.findByCssVariable(tokenName);
    const componentScope = tokenEntry?.componentScope;
    const fix = componentScope !== undefined ? `Don't override \`${tokenName}\` directly. Set \`color="primary|accent|warn"\` on the host \`<${componentScope}>\` (or wrap in a thin styled component) so the token resolution flows through Material's theme.` : `Don't override \`${tokenName}\` directly. Material component tokens should be set via the host component's \`color\` attribute or by a parent theme — direct overrides break dark mode and theme switching.`;
    matches.push({
      id: 'mdc-token-override-instead-of-wrapper',
      severity: 'warn',
      title: 'Direct MDC token override',
      snippet: captureSnippet(input.scss, match.index, match[0].length),
      fix,
      seeAlsoSlugs: componentScope === 'mat-button' ? ['button'] : [],
      seeAlsoTokens: [tokenName],
      source: 'scss',
      index: match.index,
      length: match[0].length,
      line: lineNumberOf(input.scss, match.index),
      endLine: lineNumberOf(input.scss, match.index),
      dedupKey: `mdc-override:${tokenName}`
    });
  }
  return matches;
};

const HARDCODED_HEX_RE = /:\s*(#[0-9a-fA-F]{3,8})\b(?!\s*(?:px|rem|em))/g;

/**
 * Flags bare brand-chrome hexes that don't match any known token. Reports
 * once per unique hex.
 *
 * @param input - The smell detection input.
 * @returns Matches for each unique unmapped hex literal.
 */
const hardcodedHexBrand: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  const seen = new Set<string>();
  for (const match of input.scss.matchAll(HARDCODED_HEX_RE)) {
    if (match.index === undefined) continue;
    if (isInsideScssVarDeclaration(input.scss, match.index)) continue;
    const hex = match[1];
    if (seen.has(hex)) continue;
    seen.add(hex);
    const candidates = input.tokenRegistry.findByValue(hex);
    if (candidates.length === 0 || candidates[0].score < 6) {
      const prefix = deriveProjectPrefix(input.scssPath, input.htmlPath) ?? 'myapp';
      matches.push({
        id: 'hardcoded-hex-brand-color',
        severity: 'info',
        title: 'Hardcoded hex with no matching token',
        snippet: captureSnippet(input.scss, match.index, match[0].length),
        fix: `\`${hex}\` doesn't map to a known design-system token. If this is project-local brand chrome, define a project-local SCSS variable in your app's \`styles.scss\` (e.g. \`$${prefix}-onboarding-bg: ${hex};\`) so the value has one source of truth.`,
        seeAlsoSlugs: [],
        seeAlsoTokens: [],
        source: 'scss',
        index: match.index,
        length: match[0].length,
        line: lineNumberOf(input.scss, match.index),
        endLine: lineNumberOf(input.scss, match.index),
        dedupKey: `hex:${hex.toLowerCase()}`
      });
    }
  }
  return matches;
};

const EMPTY_RULESET_RE = /([^{}\n;]+?)\s*\{\s*\}/g;

/**
 * Flags empty SCSS rule blocks (`.foo {}`, `&:hover { }`). They add noise and
 * are usually leftover scaffolding.
 *
 * @param input - The smell detection input.
 * @returns Matches for each empty rule block.
 */
const emptyRuleset: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.scss.matchAll(EMPTY_RULESET_RE)) {
    if (match.index === undefined) continue;
    const selector = match[1].trim();
    if (selector.length === 0) continue;
    if (!/^[.#&*:@\w]/.test(selector)) continue;
    matches.push({
      id: 'empty-ruleset',
      severity: 'info',
      title: 'Empty rule block',
      snippet: captureSnippet(input.scss, match.index, match[0].length),
      fix: 'Empty rule blocks add noise. Either add styles, remove the block, or replace it with a `// TODO:` comment if you want to mark a placeholder.',
      seeAlsoSlugs: [],
      seeAlsoTokens: [],
      source: 'scss',
      index: match.index,
      length: match[0].length,
      line: lineNumberOf(input.scss, match.index),
      endLine: lineNumberOf(input.scss, match.index),
      dedupKey: `empty-ruleset:${selector}`
    });
  }
  return matches;
};

const SCSS_USE_AS_RE = /@use\s+['"][^'"]+['"]\s+as\s+([\w-]+)\s*;/g;

/**
 * Flags `@use 'pkg' as ns;` declarations whose namespace is never referenced
 * (`ns.something`) elsewhere in the file. Skips `as *` (wildcard) imports —
 * those don't expose a namespace, so usage is undetectable by name.
 *
 * @param input - The smell detection input.
 * @returns Matches for each unused `@use ... as ns` import.
 */
const unusedScssUse: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.scss.matchAll(SCSS_USE_AS_RE)) {
    if (match.index === undefined) continue;
    const ns = match[1];
    const usagePattern = new RegExp(String.raw`(?:^|[^\w-])${ns}\.`, 'g');
    let used = false;
    for (const usageMatch of input.scss.matchAll(usagePattern)) {
      if (usageMatch.index === undefined) continue;
      const lineStart = input.scss.lastIndexOf('\n', usageMatch.index) + 1;
      const lineEndRaw = input.scss.indexOf('\n', usageMatch.index);
      const lineEnd = lineEndRaw === -1 ? input.scss.length : lineEndRaw;
      const line = input.scss.slice(lineStart, lineEnd);
      if (/^\s*@use\b/.test(line)) continue;
      used = true;
      break;
    }
    if (!used) {
      matches.push({
        id: 'unused-scss-use',
        severity: 'info',
        title: `Unused @use namespace \`${ns}\``,
        snippet: captureSnippet(input.scss, match.index, match[0].length),
        fix: `\`@use\` declares namespace \`${ns}\` but no \`${ns}.\` reference appears in this file. Remove the import to keep the file lean, or use it.`,
        seeAlsoSlugs: [],
        seeAlsoTokens: [],
        source: 'scss',
        index: match.index,
        length: match[0].length,
        line: lineNumberOf(input.scss, match.index),
        endLine: lineNumberOf(input.scss, match.index),
        dedupKey: `unused-use:${ns}`
      });
    }
  }
  return matches;
};

// MARK: HTML smells
const RAW_MAT_BUTTON_RE = /<button\b([^>]*?)\b(mat-stroked-button|mat-flat-button|mat-raised-button|mat-button)\b/gi;

function matButtonVariantAttr(variant: string): string {
  if (variant === 'mat-stroked-button') return 'stroked';
  if (variant === 'mat-flat-button') return 'flat';
  if (variant === 'mat-raised-button') return 'raised';
  return 'basic';
}

/**
 * Flags raw `<button mat-stroked-button>` / `mat-flat-button` and routes to
 * `<dbx-button>`.
 *
 * @param input - The smell detection input.
 * @returns Matches for each raw Material button usage.
 */
const rawMatButton: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.html.matchAll(RAW_MAT_BUTTON_RE)) {
    if (match.index === undefined) continue;
    const variant = match[2];
    const variantAttr = matButtonVariantAttr(variant);
    matches.push({
      id: 'raw-mat-button',
      severity: 'warn',
      title: `Raw ${variant}`,
      snippet: captureSnippet(input.html, match.index, match[0].length),
      fix: `Use \`<dbx-button ${variantAttr}>\` instead of raw \`${variant}\`. \`<dbx-button>\` plugs into the action stack, accepts \`text\` / \`icon\` inputs, and inherits dbx-web theming.`,
      seeAlsoSlugs: ['button'],
      seeAlsoTokens: [],
      source: 'html',
      index: match.index,
      length: match[0].length,
      line: lineNumberOf(input.html, match.index),
      endLine: lineNumberOf(input.html, match.index),
      dedupKey: `raw-mat-button:${variant}`
    });
  }
  return matches;
};

const HEADER_THEN_HINT_RE = /<(h[1-3])\b[^>]*>([\s\S]*?)<\/\1>\s*<(?:p|span)\b[^>]*>([\s\S]{1,200}?)<\/(?:p|span)>/gi;

/**
 * Flags `<h1>/<h2>/<h3>` followed by a sibling `<p>`/`<span>` — pattern that
 * `<dbx-section header hint>` already encapsulates.
 *
 * @param input - The smell detection input.
 * @returns Matches for each header+hint pair that should be a `<dbx-section>`.
 */
const customSectionHeader: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.html.matchAll(HEADER_THEN_HINT_RE)) {
    if (match.index === undefined) continue;
    const headerTag = match[1].toLowerCase();
    const isPageLevel = headerTag === 'h1';
    matches.push({
      id: 'custom-section-header',
      severity: 'info',
      title: `Custom ${headerTag} + sibling hint text`,
      snippet: captureSnippet(input.html, match.index, match[0].length),
      fix: `Replace this header+hint pair with \`<${isPageLevel ? 'dbx-section-page' : 'dbx-section'} header="…" hint="…">\` — projected content lives inside, the typography and hint color come from dbx-web.`,
      seeAlsoSlugs: [isPageLevel ? 'section-page' : 'section'],
      seeAlsoTokens: ['--mat-sys-on-surface-variant'],
      source: 'html',
      index: match.index,
      length: match[0].length,
      line: lineNumberOf(input.html, match.index),
      endLine: lineNumberOf(input.html, match.index + match[0].length),
      dedupKey: `custom-section:${headerTag}@L${lineNumberOf(input.html, match.index)}`
    });
  }
  return matches;
};

const TWO_COLUMN_GRID_RE = /grid-template-columns\s*:\s*(?:1fr\s+1fr|repeat\(\s*2\s*,)/gi;

/**
 * Flags two-column grid layouts — `[dbxFlexGroup]` with `[breakToColumn]` is
 * the canonical primitive.
 *
 * @param input - The smell detection input.
 * @returns Matches for each two-column grid layout.
 */
const customGridLayout: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.scss.matchAll(TWO_COLUMN_GRID_RE)) {
    if (match.index === undefined) continue;
    matches.push({
      id: 'custom-grid-layout',
      severity: 'info',
      title: 'Custom two-column grid',
      snippet: captureSnippet(input.scss, match.index, match[0].length),
      fix: 'For two-column layouts that should collapse on narrow viewports, prefer `[dbxFlexGroup] [breakToColumn]` on the parent and `[dbxFlexSize]` on each child. The directives handle responsive wrapping consistently across the app.',
      seeAlsoSlugs: ['flex-group', 'flex-size'],
      seeAlsoTokens: [],
      source: 'scss',
      index: match.index,
      length: match[0].length,
      line: lineNumberOf(input.scss, match.index),
      endLine: lineNumberOf(input.scss, match.index),
      dedupKey: `grid-layout@L${lineNumberOf(input.scss, match.index)}`
    });
  }
  return matches;
};

const EYEBROW_TEXT_RE = /<span\b[^>]*?(?:class|style)=[^>]*?(?:text-transform\s*:\s*uppercase|uppercase)/gi;

/**
 * Flags small uppercase "eyebrow" labels above headings — there is no current
 * dbx primitive, so the smell is informational.
 *
 * @param input - The smell detection input.
 * @returns Matches for each eyebrow-style span.
 */
const eyebrowText: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.html.matchAll(EYEBROW_TEXT_RE)) {
    if (match.index === undefined) continue;
    matches.push({
      id: 'eyebrow-text',
      severity: 'info',
      title: 'Eyebrow text (uppercase span above a heading)',
      snippet: captureSnippet(input.html, match.index, match[0].length),
      fix: 'No current dbx-web primitive wraps the "eyebrow" pattern (small uppercase label above a heading). Either keep it inline with `<dbx-label-block>` for now, or propose a `dbx-eyebrow` primitive in dbx-web.',
      seeAlsoSlugs: ['label-block'],
      seeAlsoTokens: ['--mat-sys-label-medium'],
      source: 'html',
      index: match.index,
      length: match[0].length,
      line: lineNumberOf(input.html, match.index),
      endLine: lineNumberOf(input.html, match.index),
      dedupKey: `eyebrow@L${lineNumberOf(input.html, match.index)}`
    });
  }
  return matches;
};

// MARK: Catalog
/**
 * The full smell catalog, in stable order. The dispatcher walks this list
 * and concatenates results.
 */
export const UI_SMELLS: readonly { readonly id: string; readonly detect: SmellDetector }[] = [
  { id: 'card-surface-handrolled', detect: cardSurfaceHandrolled },
  { id: 'hardcoded-radius', detect: hardcodedRadius },
  { id: 'hardcoded-shadow', detect: hardcodedShadow },
  { id: 'hardcoded-hint-color', detect: hardcodedHintColor },
  { id: 'hardcoded-padding', detect: hardcodedPadding },
  { id: 'hardcoded-typography', detect: hardcodedTypography },
  { id: 'pit-instead-of-tinted-bg', detect: pitInsteadOfTintedBg },
  { id: 'flex-column-with-gap-as-card-stack', detect: flexColumnWithGap },
  { id: 'mdc-token-override-instead-of-wrapper', detect: mdcTokenOverride },
  { id: 'hardcoded-hex-brand-color', detect: hardcodedHexBrand },
  { id: 'empty-ruleset', detect: emptyRuleset },
  { id: 'unused-scss-use', detect: unusedScssUse },
  { id: 'raw-mat-button', detect: rawMatButton },
  { id: 'custom-section-header', detect: customSectionHeader },
  { id: 'custom-grid-layout', detect: customGridLayout },
  { id: 'eyebrow-text', detect: eyebrowText }
];

/**
 * Smells whose fix is "wrap the surface in `<dbx-content-box>`" — when
 * `card-surface-handrolled` fires, every match of these IDs that falls inside
 * the same rule body is dropped, since replacing the wrapper resolves them
 * all in one move. The resulting noise reduction is the whole point.
 */
const SMELLS_SUBSUMED_BY_CARD_SURFACE: ReadonlySet<string> = new Set(['hardcoded-padding', 'hardcoded-radius', 'hardcoded-shadow', 'hardcoded-hint-color', 'hardcoded-hex-brand-color', 'flex-column-with-gap-as-card-stack', 'pit-instead-of-tinted-bg']);

/**
 * Inline ignore directive — `// dbx-smell-ignore` (all rules) or
 * `// dbx-smell-ignore: hardcoded-radius, hardcoded-shadow` (specific ids).
 * Recognized in SCSS comments and HTML comments. Applies to the same line and
 * the next non-blank line.
 */
const IGNORE_DIRECTIVE_RE = /(?:\/\/|\/\*|<!--)\s*dbx-smell-ignore(?:\s*:\s*([^\n*]*?))?\s*(?:\*\/|-->|$)/gim;

interface IgnoreEntry {
  readonly line: number;
  readonly ids: readonly string[] | null;
}

function collectIgnoreEntries(text: string): readonly IgnoreEntry[] {
  const entries: IgnoreEntry[] = [];
  for (const match of text.matchAll(IGNORE_DIRECTIVE_RE)) {
    if (match.index === undefined) continue;
    const line = lineNumberOf(text, match.index);
    const idsRaw = match[1]?.trim();
    let ids: readonly string[] | null;
    if (idsRaw === undefined || idsRaw.length === 0) {
      ids = null;
    } else {
      ids = idsRaw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    entries.push({ line, ids });
  }
  return entries;
}

function isIgnored(match: SmellMatch, entries: readonly IgnoreEntry[]): boolean {
  let ignored = false;
  for (const entry of entries) {
    if (entry.line !== match.line && entry.line !== match.line - 1) continue;
    if (entry.ids === null || entry.ids.includes(match.id)) {
      ignored = true;
      break;
    }
  }
  return ignored;
}

/**
 * Result of `detectSmells` — the consolidated match list plus cascade /
 * ignore counters the formatter uses for the summary header.
 */
export interface DetectSmellsResult {
  readonly matches: readonly SmellMatch[];
  /**
   * Sub-findings dropped because they fall inside a card-surface rule.
   */
  readonly suppressedByCascade: number;
  /**
   * Findings dropped because of `// dbx-smell-ignore` directives.
   */
  readonly suppressedByDirective: number;
  /**
   * Duplicate occurrences merged into a single grouped match.
   */
  readonly duplicatesMerged: number;
}

/**
 * Consolidates duplicates by `(id, dedupKey)`. The first match's snippet is
 * kept; subsequent line numbers are appended via the `extraLines` field added
 * to the consolidated copy. The formatter renders these as a Locations list.
 */
export interface SmellMatchWithExtras extends SmellMatch {
  readonly extraLines?: readonly number[];
}

function consolidate(matches: readonly SmellMatch[]): { readonly out: readonly SmellMatchWithExtras[]; readonly merged: number } {
  const groups = new Map<string, { primary: SmellMatch; extras: number[] }>();
  const order: string[] = [];
  for (const match of matches) {
    const key = `${match.id}::${match.dedupKey}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, { primary: match, extras: [] });
      order.push(key);
    } else {
      existing.extras.push(match.line);
    }
  }
  const out: SmellMatchWithExtras[] = [];
  let merged = 0;
  for (const key of order) {
    const group = groups.get(key);
    if (group === undefined) continue;
    if (group.extras.length === 0) {
      out.push(group.primary);
    } else {
      merged += group.extras.length;
      out.push({ ...group.primary, extraLines: group.extras });
    }
  }
  return { out, merged };
}

/**
 * Runs every detector against the input, applies cascade and ignore-directive
 * suppression, and consolidates duplicate findings.
 *
 * @param input - the smell-detector input bundle
 * @returns every surfaced smell match plus telemetry counters
 */
export function detectSmellsDetailed(input: SmellInput): DetectSmellsResult {
  const raw: SmellMatch[] = [];
  for (const smell of UI_SMELLS) {
    const found = smell.detect(input);
    for (const match of found) raw.push(match);
  }

  const cardRanges: { start: number; end: number }[] = [];
  for (const match of raw) {
    if (match.id === 'card-surface-handrolled' && match.source === 'scss') {
      cardRanges.push({ start: match.index, end: match.index + match.length });
    }
  }
  const scssIgnores = collectIgnoreEntries(input.scss);
  const htmlIgnores = collectIgnoreEntries(input.html);

  let suppressedByCascade = 0;
  let suppressedByDirective = 0;
  const surviving: SmellMatch[] = [];
  for (const match of raw) {
    if (match.source === 'scss' && SMELLS_SUBSUMED_BY_CARD_SURFACE.has(match.id)) {
      const inside = cardRanges.some((r) => match.index >= r.start && match.index < r.end);
      if (inside) {
        suppressedByCascade += 1;
        continue;
      }
    }
    const ignores = match.source === 'scss' ? scssIgnores : htmlIgnores;
    if (isIgnored(match, ignores)) {
      suppressedByDirective += 1;
      continue;
    }
    surviving.push(match);
  }

  const consolidated = consolidate(surviving);
  return { matches: consolidated.out, suppressedByCascade, suppressedByDirective, duplicatesMerged: consolidated.merged };
}

/**
 * Backwards-compatible flat list — the historical entry point. Internally
 * delegates to {@link detectSmellsDetailed} and drops the counters.
 *
 * @param input - the smell-detector input bundle
 * @returns every surfaced smell match in catalog order
 */
export function detectSmells(input: SmellInput): readonly SmellMatch[] {
  return detectSmellsDetailed(input).matches;
}
