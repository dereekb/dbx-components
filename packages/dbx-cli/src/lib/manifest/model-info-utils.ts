import { findCliModelManifestEntry } from '../api/expand-keys';
import type { CliModelField, CliModelManifest, CliModelManifestEntry } from './types';

/**
 * Resolves the manifest entry for `query` against `modelType`, `identityConst`,
 * and `collectionPrefix` in that order.
 *
 * Re-exports {@link findCliModelManifestEntry} under a more descriptive name
 * for the model-info command.
 *
 * @param manifest - the generated model manifest.
 * @param query - identifier to look up.
 * @returns the matching entry or `undefined`.
 * @__NO_SIDE_EFFECTS__
 */
export function resolveCliModel(manifest: CliModelManifest, query: string): CliModelManifestEntry | undefined {
  return findCliModelManifestEntry(query, manifest);
}

/**
 * Produces a column-aligned summary table of every model in the manifest.
 *
 * @param manifest - the generated model manifest.
 * @returns the formatted table as a single string with a trailing newline.
 * @__NO_SIDE_EFFECTS__
 */
export function renderModelManifestList(manifest: CliModelManifest): string {
  if (manifest.length === 0) {
    return 'No models found in the generated manifest.\n';
  }
  const rows: readonly (readonly string[])[] = [['MODEL', 'PREFIX', 'GROUP', 'FIELDS', 'PACKAGE', 'IDENTITY'], ...manifest.map((m) => [m.modelType, m.collectionPrefix, m.modelGroup ?? '', String(m.fields.length), m.sourcePackage, m.identityConst])];
  return renderTable(rows);
}

/**
 * Produces a human-readable summary of one model entry: header, description,
 * and an indented field tree (recursing into `nestedFields`).
 *
 * @param entry - the manifest entry to render.
 * @returns the formatted summary as a single string with a trailing newline.
 * @__NO_SIDE_EFFECTS__
 */
export function renderModelManifestEntry(entry: CliModelManifestEntry): string {
  const groupSuffix = entry.modelGroup ? ` · group ${entry.modelGroup}` : '';
  const lines: string[] = [`# ${entry.modelType}${groupSuffix}`, `Identity: ${entry.identityConst}`, `Collection prefix: ${entry.collectionPrefix}`];
  if (entry.parentIdentityConst) lines.push(`Parent identity: ${entry.parentIdentityConst}`);
  lines.push(`Source package: ${entry.sourcePackage}`, `Source file: ${entry.sourceFile}`);
  if (entry.description) {
    lines.push('', entry.description);
  }
  lines.push('', `Fields (${entry.fields.length}):`, renderFieldsTree(entry.fields, 0));
  return lines.join('\n') + '\n';
}

/**
 * Produces the field-table portion of {@link renderModelManifestEntry} on its
 * own, used by the `--fields` flag of the `model-info` command.
 *
 * @param entry - the manifest entry whose fields should be rendered.
 * @returns the formatted field tree as a single string with a trailing newline.
 * @__NO_SIDE_EFFECTS__
 */
export function renderModelManifestFields(entry: CliModelManifestEntry): string {
  return renderFieldsTree(entry.fields, 0) + '\n';
}

function renderFieldsTree(fields: readonly CliModelField[], indent: number): string {
  const includeConverter = fields.some((f) => f.converter !== undefined);
  const tableBlock = indentLines(renderTable(buildFieldsTableRows(fields, includeConverter)), indent);
  const nestedBlocks = fields.flatMap((field) => renderNestedFieldBlock(field, indent));
  return [tableBlock, ...nestedBlocks].join('\n');
}

function buildFieldsTableRows(fields: readonly CliModelField[], includeConverter: boolean): readonly string[][] {
  const header = includeConverter ? ['NAME', 'LONG NAME', 'TYPE', 'OPTIONAL', 'CONVERTER'] : ['NAME', 'LONG NAME', 'TYPE', 'OPTIONAL'];
  return [header, ...fields.map((field) => buildFieldRow(field, includeConverter))];
}

function buildFieldRow(field: CliModelField, includeConverter: boolean): string[] {
  const row: string[] = [field.name, field.longName, field.tsType ?? '', field.optional ? 'yes' : 'no'];
  if (includeConverter) {
    row.push(field.converter ? truncate(field.converter, 60) : '');
  }
  return row;
}

function renderNestedFieldBlock(field: CliModelField, indent: number): string[] {
  const nested = field.nestedFields;
  if (!nested || nested.length === 0) return [];
  const label = field.nestedIsArray ? 'array element' : 'sub-object';
  const plural = nested.length === 1 ? '' : 's';
  return [indentLines(`↳ ${field.name} (${label}, ${nested.length} field${plural})`, indent + 2), renderFieldsTree(nested, indent + 4)];
}

function renderTable(rows: readonly (readonly string[])[]): string {
  if (rows.length === 0) return '';
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      const cellWidth = cell.length;
      widths[i] = Math.max(widths[i] ?? 0, cellWidth);
    });
  }
  return rows
    .map((row) =>
      row
        .map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i] ?? 0)))
        .join('  ')
        .replace(/\s+$/, '')
    )
    .join('\n');
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

function indentLines(text: string, indent: number): string {
  if (indent <= 0) return text;
  const pad = ' '.repeat(indent);
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? pad + line : line))
    .join('\n');
}
