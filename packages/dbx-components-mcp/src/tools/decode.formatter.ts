/**
 * Formatter for `dbx_model_decode`.
 *
 * Turns a registry-matched {@link FirebaseModel} plus the raw Firestore
 * document into a markdown explanation suitable for AI clients — field
 * table, enum decodings, and foreign-key relationship hints.
 */

import type { FirebaseEnum, FirebaseField, FirebaseModel } from '../registry/firebase-models.js';

/**
 * A single decoded field row with value + any enum decoding applied.
 */
export interface DecodedField {
  readonly field: FirebaseField;
  readonly rawValue: unknown;
  readonly enumName?: string;
  readonly displayValue: string;
  readonly extraDetail?: string;
}

/**
 * A detected relationship — a string value on the document that matches a
 * known collection prefix from the registry.
 */
export interface DecodedRelationship {
  readonly fieldName: string;
  readonly value: string;
  readonly targetPrefix: string;
  readonly targetModel?: string;
}

export interface DecodeContext {
  readonly model: FirebaseModel;
  readonly doc: Readonly<Record<string, unknown>>;
  readonly prefixes: ReadonlyMap<string, string>;
  readonly extraKey?: string;
}

/**
 * Produces the markdown body for a successful decode.
 *
 * @param context - the resolved model, document, prefixes, and optional extra key
 * @returns the rendered markdown that the tool emits as content
 */
export function formatDecode(context: DecodeContext): string {
  const { model, doc, prefixes, extraKey } = context;
  const decodedFields = model.fields.map((f) => decodeField(f, doc[f.name], model.enums));
  const unknownKeys = Object.keys(doc).filter((k) => !model.fields.some((f) => f.name === k) && k !== 'key' && k !== '_key' && k !== 'id');
  const relationships = detectRelationships(doc, prefixes);
  const referencedEnums = collectReferencedEnums(decodedFields, model.enums);

  const lines: string[] = [];
  lines.push(`# ${model.name}`, '');
  const identity = model.parentIdentityConst ? `subcollection of \`${model.parentIdentityConst}\`` : 'root collection';
  lines.push(`**Identity:** \`${model.identityConst}\` — ${identity}.`, `**Collection:** \`${model.modelType}\` (prefix \`${model.collectionPrefix}\`)`, `**Source:** \`${model.sourceFile}\``);
  if (extraKey) lines.push(`**Document key:** \`${extraKey}\``);
  lines.push('');

  lines.push(`## Fields (${decodedFields.length})`, '', '| Field | Description | Value | Type / Converter |', '|-------|-------------|-------|------------------|', ...decodedFields.map(formatFieldRow));
  lines.push('');

  if (unknownKeys.length > 0) {
    lines.push('## Unknown keys on document', '', 'These keys appear in the input but are not declared on the model. They may be legacy fields, fields from a newer model version not yet in the registry, or indicate the wrong model was matched.', '');
    for (const key of unknownKeys) {
      lines.push(`- \`${key}\`: ${formatValue(doc[key])}`);
    }
    lines.push('');
  }

  if (referencedEnums.length > 0) {
    lines.push('## Enums', '');
    for (const en of referencedEnums) {
      const valueList = en.values.map((v) => `\`${v.name}=${v.value}\``).join(', ');
      lines.push(`- **${en.name}**: ${valueList}`);
    }
    lines.push('');
  }

  if (relationships.length > 0) {
    lines.push('## Detected relationships', '');
    for (const rel of relationships) {
      const target = rel.targetModel ? `**${rel.targetModel}**` : `(unknown model)`;
      lines.push(`- \`${rel.fieldName}\` → ${target} via prefix \`${rel.targetPrefix}\` — \`${rel.value}\``);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function decodeField(field: FirebaseField, rawValue: unknown, enums: readonly FirebaseEnum[]): DecodedField {
  let displayValue = formatValue(rawValue);
  let enumName: string | undefined;
  let extraDetail: string | undefined;
  if (rawValue === undefined || rawValue === null) {
    displayValue = '–';
  } else if (field.enumRef) {
    const en = enums.find((e) => e.name === field.enumRef);
    if (en) {
      const match = en.values.find((v) => v.value === rawValue);
      if (match) {
        displayValue = `${formatValue(rawValue)} → \`${en.name}.${match.name}\``;
        enumName = en.name;
        if (match.description) extraDetail = match.description;
      }
    }
  }
  return { field, rawValue, displayValue, enumName, extraDetail };
}

function formatFieldRow(row: DecodedField): string {
  const name = `\`${row.field.name}\``;
  const desc = escapeCell(row.field.description ?? '–');
  const value = escapeCell(row.displayValue);
  const typeSeg = [row.field.tsType ? `\`${row.field.tsType}\`` : undefined, `\`${row.field.converter}\``].filter(Boolean).join(' · ');
  return `| ${name} | ${desc} | ${value} | ${typeSeg} |`;
}

function escapeCell(text: string): string {
  return text.replaceAll('|', String.raw`\|`).replaceAll('\n', ' ');
}

function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') {
    const truncated = value.length > 120 ? `${value.slice(0, 117)}...` : value;
    return `"${truncated}"`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.length <= 3) return JSON.stringify(value);
    return `[Array(${value.length})]`;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 0) return '{}';
    if (keys.length <= 4) return JSON.stringify(value);
    return `{Object(${keys.length} keys)}`;
  }
  if (typeof value === 'bigint') return `${value.toString()}n`;
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'function') return `[Function]`;
  return JSON.stringify(value);
}

function collectReferencedEnums(fields: readonly DecodedField[], enums: readonly FirebaseEnum[]): readonly FirebaseEnum[] {
  const names = new Set<string>();
  for (const f of fields) {
    if (f.field.enumRef) names.add(f.field.enumRef);
  }
  return enums.filter((e) => names.has(e.name));
}

/**
 * Walks every string value (including inside arrays) looking for values that
 * start with a known collection prefix. The resulting hints let callers see
 * which other models this document relates to.
 *
 * @param doc - the raw decoded Firestore document being inspected
 * @param prefixes - map of `prefix -> targetModelName` for the active registry
 * @returns the inferred outbound relationships in document order
 */
export function detectRelationships(doc: Readonly<Record<string, unknown>>, prefixes: ReadonlyMap<string, string>): readonly DecodedRelationship[] {
  const out: DecodedRelationship[] = [];
  for (const [fieldName, value] of Object.entries(doc)) {
    if (typeof value === 'string') {
      const match = matchPrefix(value, prefixes);
      if (match) out.push({ fieldName, value, targetPrefix: match.prefix, targetModel: match.model });
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          const match = matchPrefix(item, prefixes);
          if (match) out.push({ fieldName, value: item, targetPrefix: match.prefix, targetModel: match.model });
        }
      }
    }
  }
  return out;
}

function matchPrefix(value: string, prefixes: ReadonlyMap<string, string>): { readonly prefix: string; readonly model: string } | undefined {
  const slashIdx = value.indexOf('/');
  const underscoreIdx = value.indexOf('_');
  const candidates: string[] = [];
  if (slashIdx > 0) candidates.push(value.slice(0, slashIdx));
  if (underscoreIdx > 0) candidates.push(value.slice(0, underscoreIdx));
  for (const candidate of candidates) {
    const model = prefixes.get(candidate);
    if (model) {
      return { prefix: candidate, model };
    }
  }
  return undefined;
}
