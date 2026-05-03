/**
 * Smell catalog for `dbx_ui_smell_check`.
 *
 * Each smell exports a detector function plus a fix-text builder. Detectors
 * are intentionally regex-based — full Angular template / SCSS parsing is
 * overkill for the patterns we want to flag. Adding a new smell means
 * appending one entry to {@link UI_SMELLS}.
 */

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
 * Returns true when `colonIndex` points at the colon inside an SCSS variable
 * declaration (e.g. `$foo: #abc`). Used to suppress hex/value-level smells
 * fired against the canonical declaration line, which is exactly the place
 * the smell's own fix-text recommends putting the literal.
 */
function isInsideScssVarDeclaration(scss: string, colonIndex: number): boolean {
  const lineStart = scss.lastIndexOf('\n', colonIndex - 1) + 1;
  const prefix = scss.slice(lineStart, colonIndex);
  return /^\s*\$[\w-]+\s*$/.test(prefix);
}

function findCardSurface(scss: string): { index: number; length: number; snippet: string } | null {
  let result: { index: number; length: number; snippet: string } | null = null;
  // Walk SCSS rule blocks: anything between `{` and matching `}`. Then look
  // for the conjunction of `padding`, `background:` (white-ish), and a
  // `border-radius`.
  let depth = 0;
  let blockStart = -1;
  for (let i = 0; i < scss.length; i += 1) {
    const ch = scss[i];
    if (ch === '{') {
      if (depth === 0) blockStart = i + 1;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && blockStart >= 0) {
        const block = scss.slice(blockStart, i);
        if (looksLikeCardSurface(block)) {
          result = { index: blockStart, length: block.length, snippet: block.trim() };
          break;
        }
        blockStart = -1;
      }
    }
  }
  return result;
}

function looksLikeCardSurface(block: string): boolean {
  const hasPadding = /\bpadding\s*:\s*[0-9]/i.test(block);
  const hasWhiteBg = /background\s*:\s*(#fff|#ffffff|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))/i.test(block);
  const hasRadius = /\bborder-radius\s*:\s*[0-9]/i.test(block);
  return hasPadding && hasWhiteBg && hasRadius;
}

// MARK: SCSS smells
/**
 * Detects hand-rolled card surfaces — element with padding + white background
 * + border-radius. Recommends `<dbx-content-box>` + `<dbx-section>`.
 */
const cardSurfaceHandrolled: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  const hit = findCardSurface(input.scss);
  if (hit !== null) {
    const wrapperHint = input.conventions.cardWrapperClasses && input.conventions.cardWrapperClasses.length > 0 ? ` Or wrap the projection in your project-local class: \`${input.conventions.cardWrapperClasses.join('`, `')}\`.` : '';
    matches.push({
      id: 'card-surface-handrolled',
      severity: 'warn',
      title: 'Hand-rolled card surface',
      snippet: hit.snippet,
      fix: ['This block re-implements `<dbx-content-box>`. Replace the wrapper element with `<dbx-content-box>` (it provides padding, surface color, and corner radius automatically) and project the section content via `<dbx-section header="..." hint="...">` for the title/subtitle stack.' + wrapperHint, '', 'Replacement HTML:', '```html', '<dbx-content-box>', '  <dbx-section header="…" hint="…">', '    <!-- projected content -->', '  </dbx-section>', '</dbx-content-box>', '```'].join('\n'),
      seeAlsoSlugs: ['content-box', 'section'],
      seeAlsoTokens: ['--mat-sys-surface-container', '--dbx-padding-3']
    });
  }
  return matches;
};

const HARDCODED_RADIUS_RE = /border-radius\s*:\s*([0-9]+(?:\.[0-9]+)?(?:px|rem|em))(?!\s*\))/gi;

/**
 * Flags hardcoded `border-radius: <N>px|rem` not wrapped in a `var()`.
 */
const hardcodedRadius: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.scss.matchAll(HARDCODED_RADIUS_RE)) {
    if (match.index === undefined) continue;
    const colonIndex = input.scss.indexOf(':', match.index);
    if (colonIndex !== -1 && isInsideScssVarDeclaration(input.scss, colonIndex)) continue;
    const raw = match[1];
    const candidates = input.tokenRegistry.findByValue(raw, 'radius');
    const top = candidates[0];
    const fix = top !== undefined ? `Replace \`border-radius: ${raw}\` with \`border-radius: var(${top.entry.cssVariable})\` (matches the design-system corner token).` : `Hardcoded radius \`${raw}\` doesn't match any known design-system token. Either wrap it in a project-local SCSS variable or align it with one of \`--mat-sys-corner-extra-small/-small/-medium/-large/-extra-large/-full\`.`;
    matches.push({
      id: 'hardcoded-radius',
      severity: 'warn',
      title: 'Hardcoded border-radius',
      snippet: captureSnippet(input.scss, match.index, match[0].length),
      fix,
      seeAlsoSlugs: top !== undefined && top.entry.recommendedPrimitive !== undefined ? [top.entry.recommendedPrimitive] : [],
      seeAlsoTokens: top !== undefined ? [top.entry.cssVariable] : []
    });
  }
  return matches;
};

const HARDCODED_SHADOW_RE = /box-shadow\s*:\s*([^;]+);/gi;

/**
 * Flags raw `box-shadow:` declarations and recommends elevation tokens or the
 * `<dbx-content-box [elevate]>` wrapper.
 */
const hardcodedShadow: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.scss.matchAll(HARDCODED_SHADOW_RE)) {
    if (match.index === undefined) continue;
    const raw = match[1].trim();
    if (raw.startsWith('var(') || raw === 'none') continue;
    const candidates = input.tokenRegistry.findByValue(raw, 'elevation');
    const top = candidates[0];
    const fix = top !== undefined ? `Replace this hardcoded shadow with \`box-shadow: var(${top.entry.cssVariable})\` or use \`<dbx-content-box [elevate]="true">\` to apply the elevation through the wrapper component.` : 'Hardcoded `box-shadow:` declarations should map to one of the `--mat-sys-level0..5` elevation tokens, or wrap the surface in `<dbx-content-box [elevate]="true">` so the shadow comes from the design system.';
    matches.push({
      id: 'hardcoded-shadow',
      severity: 'warn',
      title: 'Hardcoded box-shadow',
      snippet: captureSnippet(input.scss, match.index, match[0].length),
      fix,
      seeAlsoSlugs: ['content-box', 'content-elevate'],
      seeAlsoTokens: top !== undefined ? [top.entry.cssVariable] : ['--mat-sys-level1']
    });
  }
  return matches;
};

const HARDCODED_HINT_COLOR_RE = /color\s*:\s*(rgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,/\s]\s*0\.[5-7][0-9]?\s*\)|rgba?\(\s*255\s*,\s*255\s*,\s*255\s*[,/\s]\s*0\.[6-8][0-9]?\s*\))/gi;

/**
 * Flags low-emphasis text colors written as raw `rgba(0,0,0,0.6)` etc. and
 * routes them to `--mat-sys-on-surface-variant`.
 */
const hardcodedHintColor: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.scss.matchAll(HARDCODED_HINT_COLOR_RE)) {
    if (match.index === undefined) continue;
    matches.push({
      id: 'hardcoded-hint-color',
      severity: 'warn',
      title: 'Hardcoded hint text color',
      snippet: captureSnippet(input.scss, match.index, match[0].length),
      fix: ['Replace this hardcoded hint color with `color: var(--mat-sys-on-surface-variant)` so it adapts to dark mode and matches Material guidance.', '', 'If this `color:` is on text inside a card, prefer `<dbx-section [header]="…" [hint]="…">`, which already styles the hint slot with the right token.'].join('\n'),
      seeAlsoSlugs: ['section'],
      seeAlsoTokens: ['--mat-sys-on-surface-variant']
    });
  }
  return matches;
};

const HARDCODED_PADDING_RE = /(?:padding|margin)\s*(?:-(?:top|right|bottom|left))?\s*:\s*([0-9]+(?:\.[0-9]+)?px)(?!\s*\))/gi;

/**
 * Flags hardcoded `padding: <N>px` / `margin: <N>px` that align with one of
 * the `--dbx-padding-{0..5}` tokens.
 */
const hardcodedPadding: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.scss.matchAll(HARDCODED_PADDING_RE)) {
    if (match.index === undefined) continue;
    const raw = match[1];
    const candidates = input.tokenRegistry.findByValue(raw, 'spacing');
    const top = candidates[0];
    if (top !== undefined) {
      const utility = top.entry.utilityClasses?.[0];
      const fix = ['Replace `' + match[0].trim() + '` with `var(' + top.entry.cssVariable + ')`' + (utility !== undefined ? ` (or use the \`${utility}\` utility class on the host element)` : '') + '.'].join('\n');
      matches.push({
        id: 'hardcoded-padding',
        severity: 'warn',
        title: 'Hardcoded padding/margin',
        snippet: captureSnippet(input.scss, match.index, match[0].length),
        fix,
        seeAlsoSlugs: [],
        seeAlsoTokens: [top.entry.cssVariable]
      });
    }
  }
  return matches;
};

const HARDCODED_TYPOGRAPHY_RE = /font-size\s*:\s*([0-9]+(?:\.[0-9]+)?)(rem|px)/gi;

/**
 * Flags large hardcoded `font-size:` values on what look like heading rules.
 */
const hardcodedTypography: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.scss.matchAll(HARDCODED_TYPOGRAPHY_RE)) {
    if (match.index === undefined) continue;
    const value = parseFloat(match[1]);
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
        seeAlsoTokens: ['--mat-sys-headline-medium', '--mat-sys-title-large']
      });
    }
  }
  return matches;
};

const PIT_BACKGROUND_RE = /background\s*:\s*(rgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,/\s]\s*0\.0[2-8]\s*\))/gi;

/**
 * Flags ad-hoc tinted backgrounds intended as a "pit" surface and recommends
 * the `[dbxContentPit]` directive.
 */
const pitInsteadOfTintedBg: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.scss.matchAll(PIT_BACKGROUND_RE)) {
    if (match.index === undefined) continue;
    matches.push({
      id: 'pit-instead-of-tinted-bg',
      severity: 'warn',
      title: 'Hand-rolled tinted "pit" background',
      snippet: captureSnippet(input.scss, match.index, match[0].length),
      fix: 'Apply `[dbxContentPit]` to the host element. The directive paints the right tinted surface color and supports the rounded variant via `[dbxContentPitRounded]`.',
      seeAlsoSlugs: ['content-pit'],
      seeAlsoTokens: ['--mat-sys-surface-container-low']
    });
  }
  return matches;
};

const FLEX_COLUMN_GAP_RE = /display\s*:\s*flex\s*;\s*flex-direction\s*:\s*column\s*;\s*gap\s*:\s*[0-9]+(?:\.[0-9]+)?px\s*;/gi;

/**
 * Flags flex-column with gap as a stacked card layout — recommends
 * `[dbxFlexGroup]` or relying on `<dbx-content-box>` margins.
 */
const flexColumnWithGap: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.scss.matchAll(FLEX_COLUMN_GAP_RE)) {
    if (match.index === undefined) continue;
    matches.push({
      id: 'flex-column-with-gap-as-card-stack',
      severity: 'info',
      title: 'Flex column + gap on a card stack',
      snippet: captureSnippet(input.scss, match.index, match[0].length),
      fix: 'For stacking dbx-web cards/content-boxes, prefer `[dbxFlexGroup]` with `[breakToColumn]` (it handles wrapping, gaps, and responsive flow) or rely on the default sibling margins emitted by `<dbx-content-box>` siblings.',
      seeAlsoSlugs: ['flex-group'],
      seeAlsoTokens: ['--dbx-padding-3']
    });
  }
  return matches;
};

const MDC_OVERRIDE_RE = /(--mdc-[a-z0-9-]+)\s*:/gi;

/**
 * Flags direct `--mdc-*` token overrides — the right answer is almost always
 * to set `color="primary"` on the host or wrap in a styled component.
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
      seeAlsoTokens: [tokenName]
    });
  }
  return matches;
};

const HARDCODED_HEX_RE = /:\s*(#[0-9a-fA-F]{3,8})\b(?!\s*(?:px|rem|em))/g;

/**
 * Flags bare brand-chrome hexes that don't match any known token. Reports
 * once per unique hex.
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
      matches.push({
        id: 'hardcoded-hex-brand-color',
        severity: 'info',
        title: 'Hardcoded hex with no matching token',
        snippet: captureSnippet(input.scss, match.index, match[0].length),
        fix: `\`${hex}\` doesn't map to a known design-system token. If this is project-local brand chrome, define a project-local SCSS variable in your app's \`styles.scss\` (e.g. \`$myapp-onboarding-bg: ${hex};\`) so the value has one source of truth.`,
        seeAlsoSlugs: [],
        seeAlsoTokens: []
      });
    }
  }
  return matches;
};

const EMPTY_RULESET_RE = /([^{}\n;]+?)\s*\{\s*\}/g;

/**
 * Flags empty SCSS rule blocks (`.foo {}`, `&:hover { }`). They add noise and
 * are usually leftover scaffolding.
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
      seeAlsoTokens: []
    });
  }
  return matches;
};

const SCSS_USE_AS_RE = /@use\s+['"][^'"]+['"]\s+as\s+([\w-]+)\s*;/g;

/**
 * Flags `@use 'pkg' as ns;` declarations whose namespace is never referenced
 * (`ns.something`) elsewhere in the file. Skips `as *` (wildcard) imports —
 * those don't expose a namespace, so usage is undetectable by name.
 */
const unusedScssUse: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.scss.matchAll(SCSS_USE_AS_RE)) {
    if (match.index === undefined) continue;
    const ns = match[1];
    const usagePattern = new RegExp(`(?:^|[^\\w-])${ns}\\.`, 'g');
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
        seeAlsoTokens: []
      });
    }
  }
  return matches;
};

// MARK: HTML smells
const RAW_MAT_BUTTON_RE = /<button\b([^>]*?)\b(mat-stroked-button|mat-flat-button|mat-raised-button|mat-button)\b/gi;

/**
 * Flags raw `<button mat-stroked-button>` / `mat-flat-button` and routes to
 * `<dbx-button>`.
 */
const rawMatButton: SmellDetector = (input) => {
  const matches: SmellMatch[] = [];
  for (const match of input.html.matchAll(RAW_MAT_BUTTON_RE)) {
    if (match.index === undefined) continue;
    const variant = match[2];
    const variantAttr = variant === 'mat-stroked-button' ? 'stroked' : variant === 'mat-flat-button' ? 'flat' : variant === 'mat-raised-button' ? 'raised' : 'basic';
    matches.push({
      id: 'raw-mat-button',
      severity: 'warn',
      title: `Raw ${variant}`,
      snippet: captureSnippet(input.html, match.index, match[0].length),
      fix: `Use \`<dbx-button ${variantAttr}>\` instead of raw \`${variant}\`. \`<dbx-button>\` plugs into the action stack, accepts \`text\` / \`icon\` inputs, and inherits dbx-web theming.`,
      seeAlsoSlugs: ['button'],
      seeAlsoTokens: []
    });
  }
  return matches;
};

const HEADER_THEN_HINT_RE = /<(h[1-3])\b[^>]*>([\s\S]*?)<\/\1>\s*<(?:p|span)\b[^>]*>([\s\S]{1,200}?)<\/(?:p|span)>/gi;

/**
 * Flags `<h1>/<h2>/<h3>` followed by a sibling `<p>`/`<span>` — pattern that
 * `<dbx-section header hint>` already encapsulates.
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
      seeAlsoTokens: ['--mat-sys-on-surface-variant']
    });
  }
  return matches;
};

const TWO_COLUMN_GRID_RE = /grid-template-columns\s*:\s*(?:1fr\s+1fr|repeat\(\s*2\s*,)/gi;

/**
 * Flags two-column grid layouts — `[dbxFlexGroup]` with `[breakToColumn]` is
 * the canonical primitive.
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
      seeAlsoTokens: []
    });
  }
  return matches;
};

const EYEBROW_TEXT_RE = /<span\b[^>]*?(?:class|style)=[^>]*?(?:text-transform\s*:\s*uppercase|uppercase)/gi;

/**
 * Flags small uppercase "eyebrow" labels above headings — there is no current
 * dbx primitive, so the smell is informational.
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
      seeAlsoTokens: ['--mat-sys-label-medium']
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
 * Runs every detector against the input. Returns the flat list of matches in
 * the catalog's declared order.
 *
 * @param input - the smell-detector input bundle
 * @returns every smell match the catalog produces
 */
export function detectSmells(input: SmellInput): readonly SmellMatch[] {
  const matches: SmellMatch[] = [];
  for (const smell of UI_SMELLS) {
    const found = smell.detect(input);
    for (const match of found) matches.push(match);
  }
  return matches;
}
