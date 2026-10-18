import { type Maybe } from '@dereekb/util';
import { findCliModelManifestEntry } from '../api/expand-keys';
import { indentLines, renderTable, truncate } from '../util/table';
import { findReferencedCliEnums, renderCliEnumValuesTable } from './enum-info-utils';
import type { CliEnumManifest, CliModelField, CliModelManifest, CliModelManifestEntry } from './types';

/**
 * Glosses for the closed `@dbxModelRead` enum surfaced on each model entry.
 * `system` / `owner` / `admin-only` are statically inferable from the common
 * `roleMapForModel` helpers; `permissions` is the escape hatch for non-trivial
 * computed read grants.
 */
const READ_POSTURE_GLOSS: Readonly<Record<NonNullable<CliModelManifestEntry['read']>, string>> = {
  system: 'readable by any authenticated user',
  owner: 'readable by the record owner (and admins)',
  'admin-only': 'readable by admins only',
  permissions: 'computed/custom read grants'
};

/**
 * Resolves the manifest entry for `query` against `modelType`, `identityConst`,
 * and `collectionPrefix` in that order.
 *
 * Re-exports {@link findCliModelManifestEntry} under a more descriptive name
 * for the model-info command.
 *
 * @param manifest - The generated model manifest.
 * @param query - Identifier to look up.
 * @returns The matching entry or `undefined`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function resolveCliModel(manifest: CliModelManifest, query: string): CliModelManifestEntry | undefined {
  return findCliModelManifestEntry(query, manifest);
}

/**
 * Produces a column-aligned summary table of every model in the manifest.
 *
 * @param manifest - The generated model manifest.
 * @returns The formatted table as a single string with a trailing newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderModelManifestList(manifest: CliModelManifest): string {
  let result: string;
  if (manifest.length === 0) {
    result = 'No models found in the generated manifest.\n';
  } else {
    const rows: readonly (readonly string[])[] = [['MODEL', 'PREFIX', 'GROUP', 'FIELDS', 'PACKAGE', 'IDENTITY'], ...manifest.map((m) => [m.modelType, m.collectionPrefix, m.modelGroup ?? '', String(m.fields.length), m.sourcePackage, m.identityConst])];
    result = renderTable(rows);
  }
  return result;
}

/**
 * Options accepted by {@link renderModelManifestEntry}.
 */
export interface RenderModelManifestEntryOptions {
  /**
   * Generated enum value tables. When provided, the summary ends with an `Enums (N):` section
   * holding the tables of the enums the entry's fields reference (recursing into `nestedFields`).
   */
  readonly enumManifest?: Maybe<CliEnumManifest>;
}

/**
 * Produces a human-readable summary of one model entry: header, description,
 * an indented field tree (recursing into `nestedFields`), and — when an enum
 * manifest is supplied — the value tables of the enums its fields reference.
 *
 * @param entry - The manifest entry to render.
 * @param options - Optional render options; see {@link RenderModelManifestEntryOptions}.
 * @returns The formatted summary as a single string with a trailing newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderModelManifestEntry(entry: CliModelManifestEntry, options?: RenderModelManifestEntryOptions): string {
  const groupSuffix = entry.modelGroup ? ` · group ${entry.modelGroup}` : '';
  const lines: string[] = [`# ${entry.modelType}${groupSuffix}`, `Identity: ${entry.identityConst}`, `Collection prefix: ${entry.collectionPrefix}`];
  if (entry.parentIdentityConst) lines.push(`Parent identity: ${entry.parentIdentityConst}`);
  if (entry.read) lines.push(`Read: ${entry.read} — ${READ_POSTURE_GLOSS[entry.read]}`);
  lines.push(`Source package: ${entry.sourcePackage}`, `Source file: ${entry.sourceFile}`);
  if (entry.description) {
    lines.push('', entry.description);
  }
  lines.push('', `Fields (${entry.fields.length}):`, renderFieldsTree(entry.fields, 0));
  const enums = options?.enumManifest ? findReferencedCliEnums({ fields: entry.fields, manifest: options.enumManifest }) : [];
  if (enums.length > 0) {
    lines.push('', `Enums (${enums.length}):`);
    for (const enumTable of enums) {
      lines.push('', indentLines(enumTable.description ? `${enumTable.name} — ${enumTable.description}` : enumTable.name, 2), indentLines(renderCliEnumValuesTable(enumTable), 4));
    }
  }
  return lines.join('\n') + '\n';
}

/**
 * Produces the field-table portion of {@link renderModelManifestEntry} on its
 * own, used by the `--fields` flag of the `model-info` command.
 *
 * @param entry - The manifest entry whose fields should be rendered.
 * @returns The formatted field tree as a single string with a trailing newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderModelManifestFields(entry: CliModelManifestEntry): string {
  return renderFieldsTree(entry.fields, 0) + '\n';
}

function renderFieldsTree(fields: readonly CliModelField[], indent: number): string {
  const columns: FieldTableColumns = { includeEnum: fields.some((f) => f.enumRef != null), includeConverter: fields.some((f) => f.converter !== undefined) };
  const tableBlock = indentLines(renderTable(buildFieldsTableRows(fields, columns)), indent);
  const nestedBlocks = fields.flatMap((field) => renderNestedFieldBlock(field, indent));
  return [tableBlock, ...nestedBlocks].join('\n');
}

/**
 * Optional columns of a field table, each shown only when some field in that table carries the data.
 */
interface FieldTableColumns {
  readonly includeEnum: boolean;
  readonly includeConverter: boolean;
}

function buildFieldsTableRows(fields: readonly CliModelField[], columns: FieldTableColumns): readonly string[][] {
  const header = ['NAME', 'LONG NAME', 'TYPE', 'OPTIONAL'];
  if (columns.includeEnum) header.push('ENUM');
  if (columns.includeConverter) header.push('CONVERTER');
  return [header, ...fields.map((field) => buildFieldRow(field, columns))];
}

function buildFieldRow(field: CliModelField, columns: FieldTableColumns): string[] {
  const row: string[] = [field.name, field.longName, field.tsType ?? '', field.optional ? 'yes' : 'no'];
  if (columns.includeEnum) {
    row.push(field.enumRef ?? '');
  }
  if (columns.includeConverter) {
    row.push(field.converter ? truncate(field.converter, 60) : '');
  }
  return row;
}

function renderNestedFieldBlock(field: CliModelField, indent: number): string[] {
  const nested = field.nestedFields;
  let result: string[];
  if (!nested || nested.length === 0) {
    result = [];
  } else {
    const label = field.nestedIsArray ? 'array element' : 'sub-object';
    const plural = nested.length === 1 ? '' : 's';
    result = [indentLines(`↳ ${field.name} (${label}, ${nested.length} field${plural})`, indent + 2), renderFieldsTree(nested, indent + 4)];
  }
  return result;
}
