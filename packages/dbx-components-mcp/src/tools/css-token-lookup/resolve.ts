/**
 * Token resolution algorithm for `dbx_css_token_lookup`.
 *
 * Given an intent string, a raw CSS value, a role filter, a component scope,
 * or any combination, resolve to the registry's best-matching token(s) plus
 * confidence scores. Scoring is non-normalised — higher means more confident
 * — and the calling tool truncates to the top three when the input was
 * ambiguous.
 *
 * Color matching uses a small CIEDE2000-ish OKLab distance, computed without
 * external dependencies — we parse the input value into linear RGB, convert
 * to OKLab, and compute Euclidean distance there. That's close enough to
 * perceptual distance for "this hardcoded grey looks like which Material
 * neutral?" routing without pulling in `culori` for v1.
 */

import type { TokenEntry } from '../../manifest/tokens-schema.js';
import type { ScoredTokenMatch, TokenRegistry } from '../../registry/tokens-runtime.js';
import { expandIntentQuery } from './synonyms.js';

// MARK: Public types
/**
 * Inputs to {@link resolveToken}. At least one of `intent`, `value`,
 * `component`, or `category` must be set. `role` is a filter applied
 * before scoring.
 */
export interface ResolveTokenInput {
  readonly intent?: string;
  readonly value?: string;
  readonly role?: string;
  readonly component?: string;
  readonly category?: string;
}

/**
 * Outcome from {@link resolveToken}. `matches` is sorted by descending
 * `score`; `confident` is true when the top match's score exceeds the
 * `CONFIDENT_THRESHOLD`.
 */
export interface ResolveTokenResult {
  readonly matches: readonly ScoredTokenMatch[];
  readonly confident: boolean;
  readonly category?: string;
}

const CONFIDENT_THRESHOLD = 7;
const MAX_MATCHES = 3;
const SOURCE_RANK: Record<string, number> = { 'mat-sys': 4, mdc: 3, 'dbx-web': 2, app: 1 };

// MARK: Entry point
/**
 * Resolve a css-token-lookup query against the supplied registry. Combines the
 * intent / value / component matchers and applies any role / category
 * filters supplied by the caller.
 *
 * @param registry - the token registry to search
 * @param input - the query inputs (at least one of intent/value/component/category)
 * @returns the top scored matches plus a confidence flag
 */
export function resolveToken(registry: TokenRegistry, input: ResolveTokenInput): ResolveTokenResult {
  let candidates: readonly TokenEntry[] = registry.all;

  if (input.category !== undefined && input.category !== 'list') {
    candidates = candidates.filter((c) => c.source === input.category);
  }
  if (input.role !== undefined) {
    candidates = candidates.filter((c) => c.role === input.role);
  }
  if (input.component !== undefined) {
    candidates = candidates.filter((c) => c.componentScope === input.component);
  }

  const scored = new Map<string, number>();
  function add(entry: TokenEntry, score: number): void {
    if (score <= 0) return;
    const key = `${entry.source}::${entry.cssVariable}`;
    const previous = scored.get(key);
    if (previous === undefined || previous < score) {
      scored.set(key, score);
    }
  }

  if (input.intent !== undefined && input.intent.trim().length > 0) {
    const expanded = expandIntentQuery(input.intent);
    for (const entry of candidates) {
      const score = scoreIntent(entry, expanded);
      if (score > 0) add(entry, score);
    }
  }

  if (input.value !== undefined && input.value.trim().length > 0) {
    const trimmed = input.value.trim();
    const parsedColor = parseColor(trimmed);
    const parsedLength = parseLength(trimmed);
    const parsedShadow = parseShadow(trimmed);
    const legacyHint = isLegacyHintColor(parsedColor);
    for (const entry of candidates) {
      let score = 0;
      if (parsedColor !== null && (entry.role === 'color' || entry.role === 'text-color' || entry.role === 'surface' || entry.role === 'shadow')) {
        score = Math.max(score, scoreColor(entry, parsedColor));
      }
      if (parsedLength !== null && (entry.role === 'spacing' || entry.role === 'radius' || entry.role === 'size')) {
        score = Math.max(score, scoreLength(entry, parsedLength));
      }
      if (parsedShadow !== null && (entry.role === 'elevation' || entry.role === 'shadow')) {
        score = Math.max(score, scoreShadow(entry, trimmed, parsedShadow));
      }
      if (legacyHint && entry.cssVariable === '--mat-sys-on-surface-variant') {
        score = Math.max(score, 9);
      }
      if (score === 0) {
        score = scoreValueLiteral(entry, trimmed);
      }
      if (score > 0) add(entry, score);
    }
  }

  if (input.component !== undefined && input.intent === undefined && input.value === undefined) {
    for (const entry of candidates) {
      add(entry, 5);
    }
  }

  if (input.category !== undefined && scored.size === 0 && input.intent === undefined && input.value === undefined) {
    for (const entry of candidates) {
      add(entry, 1);
    }
  }

  const matches: ScoredTokenMatch[] = [];
  for (const [key, score] of scored) {
    const [source, cssVariable] = splitKey(key);
    const entry = registry.all.find((e) => e.source === source && e.cssVariable === cssVariable);
    if (entry !== undefined) {
      matches.push({ entry, score });
    }
  }
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const rankDiff = (SOURCE_RANK[b.entry.source] ?? 0) - (SOURCE_RANK[a.entry.source] ?? 0);
    if (rankDiff !== 0) return rankDiff;
    return a.entry.cssVariable.localeCompare(b.entry.cssVariable);
  });

  const truncated = matches.slice(0, MAX_MATCHES);
  const confident = truncated.length > 0 && truncated[0].score >= CONFIDENT_THRESHOLD;
  return { matches: truncated, confident, category: input.category };
}

// MARK: Intent scoring
function scoreIntent(entry: TokenEntry, expanded: readonly string[]): number {
  let best = 0;
  for (const intent of entry.intents) {
    const lower = intent.toLowerCase();
    for (const term of expanded) {
      let score = 0;
      if (lower === term) {
        score = 12;
      } else if (lower.includes(term)) {
        score = 7;
      } else if (term.length >= 3 && term.includes(lower)) {
        score = 4;
      }
      if (score > best) best = score;
    }
  }
  return best;
}

// MARK: Value scoring — color
type RgbColor = { r: number; g: number; b: number; a: number };
type OkLabColor = { L: number; a: number; b: number; alpha: number };

const RGB_RE = /rgba?\(\s*([0-9.]+)\s*,?\s*([0-9.]+)\s*,?\s*([0-9.]+)(?:[\s,/]+([0-9.]+%?))?\s*\)/i;
const RGB_NEW_RE = /rgba?\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)/i;
const HEX_RE = /^#([0-9a-f]{3,8})$/i;

/**
 * Parses a CSS color literal into linear RGB plus alpha. Supports `#hex`,
 * `rgb(a)(...)` (comma + space variants), and a few common named colors.
 *
 * @param raw - the user-supplied value, trimmed
 * @returns the parsed color, or null if not a recognisable color literal
 */
export function parseColor(raw: string): RgbColor | null {
  const trimmed = raw.trim();
  if (trimmed === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (trimmed.toLowerCase() === 'white') return { r: 255, g: 255, b: 255, a: 1 };
  if (trimmed.toLowerCase() === 'black') return { r: 0, g: 0, b: 0, a: 1 };
  let match = RGB_RE.exec(trimmed);
  let result: RgbColor | null = null;
  if (match !== null) {
    result = {
      r: clamp(Number.parseFloat(match[1]), 0, 255),
      g: clamp(Number.parseFloat(match[2]), 0, 255),
      b: clamp(Number.parseFloat(match[3]), 0, 255),
      a: parseAlpha(match[4])
    };
  }
  if (result === null) {
    match = RGB_NEW_RE.exec(trimmed);
    if (match !== null) {
      result = {
        r: clamp(Number.parseFloat(match[1]), 0, 255),
        g: clamp(Number.parseFloat(match[2]), 0, 255),
        b: clamp(Number.parseFloat(match[3]), 0, 255),
        a: parseAlpha(match[4])
      };
    }
  }
  if (result === null) {
    const hexMatch = HEX_RE.exec(trimmed);
    if (hexMatch !== null) {
      result = parseHex(hexMatch[1]);
    }
  }
  return result;
}

function parseAlpha(value: string | undefined): number {
  let alpha = 1;
  if (value !== undefined) {
    if (value.endsWith('%')) {
      alpha = clamp(Number.parseFloat(value.slice(0, -1)) / 100, 0, 1);
    } else {
      alpha = clamp(Number.parseFloat(value), 0, 1);
    }
  }
  return alpha;
}

function parseHex(hex: string): RgbColor {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 1;
  if (hex.length === 3) {
    r = Number.parseInt(hex[0] + hex[0], 16);
    g = Number.parseInt(hex[1] + hex[1], 16);
    b = Number.parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 4) {
    r = Number.parseInt(hex[0] + hex[0], 16);
    g = Number.parseInt(hex[1] + hex[1], 16);
    b = Number.parseInt(hex[2] + hex[2], 16);
    a = Number.parseInt(hex[3] + hex[3], 16) / 255;
  } else if (hex.length === 6) {
    r = Number.parseInt(hex.slice(0, 2), 16);
    g = Number.parseInt(hex.slice(2, 4), 16);
    b = Number.parseInt(hex.slice(4, 6), 16);
  } else if (hex.length === 8) {
    r = Number.parseInt(hex.slice(0, 2), 16);
    g = Number.parseInt(hex.slice(2, 4), 16);
    b = Number.parseInt(hex.slice(4, 6), 16);
    a = Number.parseInt(hex.slice(6, 8), 16) / 255;
  }
  return { r, g, b, a };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function srgbToLinear(channel: number): number {
  const v = channel / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function rgbToOkLab(rgb: RgbColor): OkLabColor {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lCbrt = Math.cbrt(l);
  const mCbrt = Math.cbrt(m);
  const sCbrt = Math.cbrt(s);
  return {
    L: 0.2104542553 * lCbrt + 0.793617785 * mCbrt - 0.0040720468 * sCbrt,
    a: 1.9779984951 * lCbrt - 2.428592205 * mCbrt + 0.4505937099 * sCbrt,
    b: 0.0259040371 * lCbrt + 0.7827717662 * mCbrt - 0.808675766 * sCbrt,
    alpha: rgb.a
  };
}

/**
 * Returns the OKLab Euclidean distance between two colors. Smaller is more
 * similar — values under ~0.05 are perceptually close, under ~0.02 are
 * indistinguishable to most viewers.
 *
 * @param a - first color
 * @param b - second color
 * @returns the OKLab distance, including alpha as an extra channel
 */
export function colorDistance(a: RgbColor, b: RgbColor): number {
  const lab1 = rgbToOkLab(a);
  const lab2 = rgbToOkLab(b);
  const dL = lab1.L - lab2.L;
  const dA = lab1.a - lab2.a;
  const dB = lab1.b - lab2.b;
  const dAlpha = (lab1.alpha - lab2.alpha) * 0.5;
  return Math.hypot(dL, dA, dB, dAlpha);
}

function scoreColor(entry: TokenEntry, target: RgbColor): number {
  let best = 0;
  const candidates = [entry.defaults.light, entry.defaults.dark].filter((v): v is string => v !== undefined);
  for (const value of candidates) {
    const parsed = parseColor(value);
    if (parsed !== null) {
      const distance = colorDistance(target, parsed);
      let score = 0;
      if (distance <= 0.005) score = 11;
      else if (distance <= 0.02) score = 9;
      else if (distance <= 0.04) score = 5;
      else if (distance <= 0.08) score = 3;
      if (score > best) best = score;
    }
  }
  return best;
}

function isLegacyHintColor(parsed: RgbColor | null): boolean {
  let result = false;
  if (parsed !== null) {
    const isBlack = parsed.r < 5 && parsed.g < 5 && parsed.b < 5;
    const isWhite = parsed.r > 250 && parsed.g > 250 && parsed.b > 250;
    if ((isBlack && parsed.a >= 0.5 && parsed.a <= 0.74) || (isWhite && parsed.a >= 0.6 && parsed.a <= 0.85)) {
      result = true;
    }
  }
  return result;
}

// MARK: Value scoring — length
type ParsedLength = { value: number; unit: string };

const LENGTH_RE = /^([0-9.]+)\s*(px|rem|em|%|vh|vw)?$/i;

/**
 * Parses a CSS length literal (px, rem, em, %, vh, vw, or unitless number).
 *
 * @param raw - the trimmed value
 * @returns the parsed length, or null if not a recognisable length literal
 */
export function parseLength(raw: string): ParsedLength | null {
  const match = LENGTH_RE.exec(raw.trim());
  let result: ParsedLength | null = null;
  if (match !== null) {
    result = {
      value: Number.parseFloat(match[1]),
      unit: (match[2] ?? '').toLowerCase()
    };
  }
  return result;
}

function scoreLength(entry: TokenEntry, target: ParsedLength): number {
  let best = 0;
  const candidates = [entry.defaults.light, entry.defaults.dark].filter((v): v is string => v !== undefined);
  for (const value of candidates) {
    const parsed = parseLength(value);
    if (parsed !== null && parsed.unit === target.unit) {
      const diff = Math.abs(parsed.value - target.value);
      let score = 0;
      if (diff < 0.01) score = 11;
      else if (diff <= 1 && (entry.role === 'spacing' || entry.role === 'radius')) score = 7;
      else if (diff <= 2 && entry.role === 'spacing') score = 4;
      if (score > best) best = score;
    }
  }
  return best;
}

// MARK: Value scoring — shadow
type ShadowLayer = { offsetX: number; offsetY: number; blur: number; spread: number; color: RgbColor | null };

/**
 * Parses a CSS shadow literal into one or more layers.
 *
 * @param raw - the trimmed value
 * @returns the parsed layers, or null if not a recognisable shadow
 */
export function parseShadow(raw: string): ShadowLayer[] | null {
  const trimmed = raw.trim();
  if (!trimmed.includes('px') && !trimmed.startsWith('rgba(') && !trimmed.includes(' ')) return null;
  const layers: ShadowLayer[] = [];
  for (const layerRaw of splitShadowLayers(trimmed)) {
    const parsed = parseShadowLayer(layerRaw);
    if (parsed !== null) layers.push(parsed);
  }
  return layers.length > 0 ? layers : null;
}

function splitShadowLayers(raw: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of raw) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      if (buf.trim().length > 0) out.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim().length > 0) out.push(buf.trim());
  return out;
}

function parseShadowLayer(raw: string): ShadowLayer | null {
  const colorMatch = /(rgba?\([^)]*\)|#[0-9a-f]+)/i.exec(raw);
  let color: RgbColor | null = null;
  let withoutColor = raw;
  if (colorMatch !== null) {
    color = parseColor(colorMatch[1]);
    withoutColor = (raw.slice(0, colorMatch.index) + raw.slice(colorMatch.index + colorMatch[0].length)).trim();
  }
  const parts = withoutColor.split(/\s+/).filter((p) => p.length > 0);
  let result: ShadowLayer | null = null;
  if (parts.length >= 2) {
    const ox = parseLength(parts[0]);
    const oy = parseLength(parts[1]);
    const blur = parts.length >= 3 ? parseLength(parts[2]) : { value: 0, unit: 'px' };
    const spread = parts.length >= 4 ? parseLength(parts[3]) : { value: 0, unit: 'px' };
    if (ox !== null && oy !== null && blur !== null && spread !== null) {
      result = {
        offsetX: ox.value,
        offsetY: oy.value,
        blur: blur.value,
        spread: spread.value,
        color
      };
    }
  }
  return result;
}

function scoreShadow(entry: TokenEntry, raw: string, target: ShadowLayer[]): number {
  let best = 0;
  for (const value of [entry.defaults.light, entry.defaults.dark].filter((v): v is string => v !== undefined)) {
    const parsed = parseShadow(value);
    if (parsed !== null) {
      let layerHits = 0;
      for (const t of target) {
        const found = parsed.find((p) => Math.abs(p.offsetX - t.offsetX) <= 1 && Math.abs(p.offsetY - t.offsetY) <= 1 && Math.abs(p.blur - t.blur) <= 2);
        if (found !== undefined) layerHits += 1;
      }
      let score = 0;
      if (layerHits === target.length) score = 9;
      else if (layerHits > 0) score = 5;
      if (score > best) best = score;
    }
    if (value === raw) best = Math.max(best, 11);
  }
  return best;
}

// MARK: Literal fallback
function scoreValueLiteral(entry: TokenEntry, raw: string): number {
  let best = 0;
  for (const value of [entry.defaults.light, entry.defaults.dark].filter((v): v is string => v !== undefined)) {
    if (value === raw) best = Math.max(best, 11);
    else if (value.includes(raw)) best = Math.max(best, 4);
  }
  return best;
}

function splitKey(key: string): readonly [string, string] {
  const idx = key.indexOf('::');
  let result: readonly [string, string];
  if (idx < 0) {
    result = ['', key];
  } else {
    result = [key.slice(0, idx), key.slice(idx + 2)];
  }
  return result;
}
