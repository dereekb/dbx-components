/**
 * Inline-literal extractors for `dbx_color_smell_check`.
 *
 * Two flavours:
 *   - `extractTsLiterals` — ts-morph walk that recognises object literals
 *     in `DbxColorConfig` / `DbxColorInput` positions plus property
 *     assignments named `color` / `dbxColor` / `dbxTextColor`.
 *   - `extractHtmlLiterals` — regex scan over Angular attribute bindings
 *     `[dbxColor]` / `[dbxTextColor]` / `[color]` that holds a `{...}`
 *     literal.
 *
 * Both emit the same {@link ExtractedLiteral} shape so the grouper can
 * treat TS and HTML hits uniformly.
 */

import { Node, Project, SyntaxKind, type ObjectLiteralExpression, type SourceFile } from 'ts-morph';
import type { ColorSmellLiteralSource, NormalizedColorConfig } from './types.js';

const COLOR_INPUT_NAMES = new Set(['color', 'dbxColor', 'dbxTextColor']);
const COLOR_TYPE_NAMES = new Set(['DbxColorConfig', 'DbxColorInput', 'Maybe<DbxColorInput>', 'Maybe<DbxColorConfig>']);
const KNOWN_CONFIG_KEYS = new Set(['template', 'color', 'contrast', 'tone', 'tonal']);

/**
 * One literal recovered from a source file. The parser sets `dynamic`
 * to `true` when the literal couldn't be statically resolved (e.g.
 * spread expressions); the grouper increments its skip counter on
 * those entries and drops them.
 */
export interface ExtractedLiteral {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly source: ColorSmellLiteralSource;
  readonly snippet: string;
  /**
   * Parsed (but not yet normalised) field values.
   */
  readonly raw: NormalizedColorConfig;
  /**
   * Whether the literal explicitly set `template` — those are excluded
   * from findings because they're already using the service.
   */
  readonly hasTemplate: boolean;
  /**
   * Whether the literal contained an unresolved expression (spread,
   * computed key, identifier-valued color, etc.). When `true` the
   * grouper increments its skip counter and drops the entry.
   */
  readonly dynamic: boolean;
}

/**
 * Walks the supplied TS source text and emits every candidate
 * {@link ExtractedLiteral}. Object literals are flagged as candidates
 * when they sit in a `DbxColorConfig` / `DbxColorInput`-typed position
 * (variable annotation or property assignment) or are passed as the
 * value of a `color` / `dbxColor` / `dbxTextColor` property.
 *
 * @param filePath - workspace-relative path used in the output records
 * @param text - source text of the file
 * @returns the list of candidate literals (may include dynamic ones)
 */
export function extractTsLiterals(filePath: string, text: string): readonly ExtractedLiteral[] {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sf = project.createSourceFile(filePath, text, { overwrite: true });
  const out: ExtractedLiteral[] = [];
  for (const obj of sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
    if (!isInColorPosition(obj)) continue;
    const literal = parseObjectLiteral({ filePath, sf, obj });
    if (literal !== undefined) out.push(literal);
  }
  return out;
}

interface ParseObjectLiteralInput {
  readonly filePath: string;
  readonly sf: SourceFile;
  readonly obj: ObjectLiteralExpression;
}

function parseObjectLiteral(input: ParseObjectLiteralInput): ExtractedLiteral | undefined {
  const { filePath, obj } = input;
  let dynamic = false;
  let hasTemplate = false;
  let hasKnownField = false;
  const raw: { -readonly [K in keyof NormalizedColorConfig]: NormalizedColorConfig[K] } = {};
  for (const prop of obj.getProperties()) {
    if (Node.isSpreadAssignment(prop)) {
      dynamic = true;
      continue;
    }
    if (!Node.isPropertyAssignment(prop) && !Node.isShorthandPropertyAssignment(prop)) {
      dynamic = true;
      continue;
    }
    const name = prop.getName();
    if (!KNOWN_CONFIG_KEYS.has(name)) {
      return undefined; // not a color config — has unknown keys
    }
    hasKnownField = true;
    if (name === 'template') {
      hasTemplate = true;
      continue;
    }
    if (!Node.isPropertyAssignment(prop)) {
      dynamic = true;
      continue;
    }
    const value = prop.getInitializer();
    if (value === undefined) continue;
    assignRawField({
      raw,
      name,
      value,
      onDynamic: () => {
        dynamic = true;
      }
    });
  }
  if (!hasKnownField) return undefined;
  if (hasTemplate) {
    return undefined;
  }
  const start = obj.getStart();
  const sf = obj.getSourceFile();
  const { line, column } = sf.getLineAndColumnAtPos(start);
  const snippet = collapseSnippet(obj.getText());
  const literal: ExtractedLiteral = { file: filePath, line, column, source: 'ts', snippet, raw, hasTemplate: false, dynamic };
  return literal;
}

interface AssignRawFieldInput {
  readonly raw: { -readonly [K in keyof NormalizedColorConfig]: NormalizedColorConfig[K] };
  readonly name: string;
  readonly value: Node;
  readonly onDynamic: () => void;
}

function assignRawField(input: AssignRawFieldInput): void {
  const { raw, name, value, onDynamic } = input;
  if (name === 'tonal') {
    if (value.getKind() === SyntaxKind.TrueKeyword) raw.tonal = true;
    else if (value.getKind() === SyntaxKind.FalseKeyword) raw.tonal = false;
    else onDynamic();
    return;
  }
  if (name === 'tone') {
    if (Node.isNumericLiteral(value)) raw.tone = Number(value.getText());
    else onDynamic();
    return;
  }
  if (Node.isStringLiteral(value) || Node.isNoSubstitutionTemplateLiteral(value)) {
    const text = value.getLiteralText();
    if (name === 'color') raw.color = text;
    else if (name === 'contrast') raw.contrast = text;
    return;
  }
  onDynamic();
}

function isInColorPosition(obj: ObjectLiteralExpression): boolean {
  const parent = obj.getParent();
  if (parent === undefined) return false;
  if (Node.isVariableDeclaration(parent)) {
    const tn = parent.getTypeNode();
    return tn !== undefined && COLOR_TYPE_NAMES.has(tn.getText());
  }
  if (Node.isPropertyAssignment(parent)) {
    const name = parent.getName();
    if (COLOR_INPUT_NAMES.has(name)) return true;
  }
  if (Node.isPropertyDeclaration(parent) || Node.isPropertySignature(parent)) {
    const tn = parent.getTypeNode();
    if (tn !== undefined && COLOR_TYPE_NAMES.has(tn.getText())) return true;
  }
  if (Node.isParameterDeclaration(parent)) {
    const tn = parent.getTypeNode();
    if (tn !== undefined && COLOR_TYPE_NAMES.has(tn.getText())) return true;
  }
  if (Node.isAsExpression(parent) || Node.isTypeAssertion(parent)) {
    const tn = parent.getTypeNode();
    if (tn !== undefined && COLOR_TYPE_NAMES.has(tn.getText())) return true;
  }
  return false;
}

function collapseSnippet(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const HTML_ATTR_RE = /\[(dbxColor|dbxTextColor|color)\]="([^"]+)"/g;

/**
 * Scans HTML/text-template content for Angular property bindings that
 * pass an inline `{...}` literal to `[dbxColor]` / `[dbxTextColor]` /
 * `[color]`. Bracket-balanced object literals are parsed with the same
 * key whitelist the TS extractor uses; everything else is ignored.
 *
 * @param filePath - workspace-relative path used in the output records
 * @param text - HTML source text of the file
 * @returns the list of candidate literals (may include dynamic ones)
 */
export function extractHtmlLiterals(filePath: string, text: string): readonly ExtractedLiteral[] {
  const out: ExtractedLiteral[] = [];
  const matches = text.matchAll(HTML_ATTR_RE);
  for (const match of matches) {
    const value = match[2].trim();
    if (!value.startsWith('{')) continue;
    const literal = parseHtmlObjectValue({ filePath, text, matchIndex: match.index ?? 0, value });
    if (literal !== undefined) out.push(literal);
  }
  return out;
}

interface ParseHtmlObjectValueInput {
  readonly filePath: string;
  readonly text: string;
  readonly matchIndex: number;
  readonly value: string;
}

function parseHtmlObjectValue(input: ParseHtmlObjectValueInput): ExtractedLiteral | undefined {
  const { filePath, text, matchIndex, value } = input;
  const inner = stripObjectBraces(value);
  if (inner === undefined) return undefined;
  const parsed = parseObjectInner(inner);
  if (parsed === undefined) return undefined;
  if (parsed.hasUnknownKey) return undefined;
  if (parsed.hasTemplate) return undefined;
  if (!parsed.hasKnownField) return undefined;
  const position = positionAt(text, matchIndex);
  const snippet = `[dbxColor]="${value}"`.replace(/\s+/g, ' ').trim();
  const literal: ExtractedLiteral = {
    file: filePath,
    line: position.line,
    column: position.column,
    source: 'html',
    snippet,
    raw: parsed.raw,
    hasTemplate: false,
    dynamic: parsed.dynamic
  };
  return literal;
}

function stripObjectBraces(value: string): string | undefined {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  let result: string | undefined;
  if (start === 0 && end === value.length - 1 && end > start) {
    result = value.slice(start + 1, end).trim();
  }
  return result;
}

interface ParseObjectInnerResult {
  readonly raw: NormalizedColorConfig;
  readonly hasKnownField: boolean;
  readonly hasTemplate: boolean;
  readonly hasUnknownKey: boolean;
  readonly dynamic: boolean;
}

const HTML_FIELD_RE = /([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*([^,]+)/g;

function parseObjectInner(inner: string): ParseObjectInnerResult | undefined {
  const raw: { -readonly [K in keyof NormalizedColorConfig]: NormalizedColorConfig[K] } = {};
  let hasKnownField = false;
  let hasTemplate = false;
  let hasUnknownKey = false;
  let dynamic = false;
  const matches = inner.matchAll(HTML_FIELD_RE);
  for (const match of matches) {
    const key = match[1];
    const rawValue = match[2].trim().replace(/,?$/, '').trim();
    if (!KNOWN_CONFIG_KEYS.has(key)) {
      hasUnknownKey = true;
      continue;
    }
    hasKnownField = true;
    if (key === 'template') {
      hasTemplate = true;
      continue;
    }
    if (key === 'tonal') {
      if (rawValue === 'true') raw.tonal = true;
      else if (rawValue === 'false') raw.tonal = false;
      else dynamic = true;
      continue;
    }
    if (key === 'tone') {
      const num = Number(rawValue);
      if (Number.isFinite(num) && /^\d+(\.\d+)?$/.test(rawValue)) raw.tone = num;
      else dynamic = true;
      continue;
    }
    const stringValue = readHtmlStringLiteral(rawValue);
    if (stringValue === undefined) {
      dynamic = true;
      continue;
    }
    if (key === 'color') raw.color = stringValue;
    else if (key === 'contrast') raw.contrast = stringValue;
  }
  return { raw, hasKnownField, hasTemplate, hasUnknownKey, dynamic };
}

function readHtmlStringLiteral(value: string): string | undefined {
  const trimmed = value.trim();
  let result: string | undefined;
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
      result = trimmed.slice(1, -1);
    }
  }
  return result;
}

interface FilePosition {
  readonly line: number;
  readonly column: number;
}

function positionAt(text: string, offset: number): FilePosition {
  let line = 1;
  let lastNewline = -1;
  for (let i = 0; i < offset; i++) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
      lastNewline = i;
    }
  }
  return { line, column: offset - lastNewline };
}
