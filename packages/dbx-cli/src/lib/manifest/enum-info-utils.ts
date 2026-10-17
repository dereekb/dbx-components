import { type Maybe } from '@dereekb/util';
import { renderTable, truncate } from '../util/table';
import type { CliEnumManifest, CliModelEnum, CliModelField } from './types';

/**
 * Default command name for the enum-info command. Lives with the resolvers (not the command
 * builder) so the default not-found hint needs no import from the command module.
 */
export const DEFAULT_ENUM_INFO_COMMAND_NAME = 'enum-info';

/**
 * Lookup output of the `enum-info` command: the resolved value tables, with any unmatched names in
 * `notFound`.
 *
 * Mirrors `@dereekb/firebase-server/mcp`'s `EnumInfoToolLookupOutput`.
 */
export interface CliEnumInfoLookupOutput {
  readonly enums: readonly CliModelEnum[];
  readonly notFound?: readonly string[];
  /**
   * How to find the right name. Present when {@link notFound} is non-empty.
   */
  readonly hint?: string;
}

/**
 * List output of the `enum-info` command, returned when no name is passed.
 *
 * Mirrors `@dereekb/firebase-server/mcp`'s `EnumInfoToolListOutput`.
 */
export interface CliEnumInfoListOutput {
  /**
   * The registered enum declaration names, sorted.
   */
  readonly names: readonly string[];
  readonly total: number;
}

/**
 * Output payload of the `enum-info` command.
 */
export type CliEnumInfoOutput = CliEnumInfoLookupOutput | CliEnumInfoListOutput;

/**
 * Input to {@link resolveCliEnumInfoLookupOutput}.
 */
export interface ResolveCliEnumInfoLookupOutputInput {
  /**
   * The requested enum declaration names, already trimmed.
   */
  readonly names: readonly string[];
  readonly manifest: CliEnumManifest;
  /**
   * Command name the not-found hint points to. Defaults to {@link DEFAULT_ENUM_INFO_COMMAND_NAME}.
   */
  readonly commandName?: Maybe<string>;
}

/**
 * Input to {@link findReferencedCliEnums}.
 */
export interface FindReferencedCliEnumsInput {
  readonly fields: readonly CliModelField[];
  readonly manifest: CliEnumManifest;
}

/**
 * Builds the hint attached to a lookup that missed, pointing at the list mode of the command.
 *
 * @param commandName - The configured enum-info command name.
 * @returns The hint text.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function cliEnumInfoNotFoundHint(commandName: Maybe<string>): string {
  return `Run \`${commandName ?? DEFAULT_ENUM_INFO_COMMAND_NAME}\` with no arguments to list the registered enum names.`;
}

/**
 * Resolves each requested enum name against the manifest by exact declaration name. Keeps request
 * order and duplicates; misses land in `notFound` together with a hint. Only the manifest's own keys
 * match, so `constructor` / `toString` / `__proto__` are misses.
 *
 * Mirrors `@dereekb/firebase-server/mcp`'s `resolveEnumInfoOutput` — keep the matching rules in lockstep.
 *
 * @param input - The names, the manifest, and the optional command name for the hint.
 * @returns The matched tables, with any unmatched names in `notFound`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function resolveCliEnumInfoLookupOutput(input: ResolveCliEnumInfoLookupOutputInput): CliEnumInfoLookupOutput {
  const found: CliModelEnum[] = [];
  const notFound: string[] = [];

  for (const name of input.names) {
    const table = findCliEnum(input.manifest, name);
    if (table == null) {
      notFound.push(name);
    } else {
      found.push(table);
    }
  }

  return notFound.length > 0 ? { enums: found, notFound, hint: cliEnumInfoNotFoundHint(input.commandName) } : { enums: found };
}

/**
 * Lists the registered enum names, sorted.
 *
 * Mirrors `@dereekb/firebase-server/mcp`'s `resolveEnumInfoListOutput` — keep the matching rules in lockstep.
 *
 * @param manifest - The generated enum manifest.
 * @returns The sorted names and their count.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function resolveCliEnumInfoListOutput(manifest: CliEnumManifest): CliEnumInfoListOutput {
  const names = Object.keys(manifest).sort((a, b) => a.localeCompare(b));
  return { names, total: names.length };
}

/**
 * Collects the value tables of the enums the given fields reference by `enumRef`, recursing through
 * `nestedFields`. Deduped, in first-reference order; names missing from the manifest are skipped.
 *
 * The CLI counterpart of the `enums` section the MCP `model-info` tool attaches.
 *
 * @param input - The fields to scan and the manifest to resolve against.
 * @returns The referenced value tables.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findReferencedCliEnums(input: FindReferencedCliEnumsInput): CliModelEnum[] {
  const referenced = new Set<string>();
  collectFieldEnumRefs(input.fields, referenced);

  const tables: CliModelEnum[] = [];
  for (const name of referenced) {
    const table = findCliEnum(input.manifest, name);
    if (table != null) tables.push(table);
  }

  return tables;
}

/**
 * Renders an enum's `VALUE · NAME · [DESCRIPTION]` table. Values are JSON-encoded (`0`, `-1`,
 * `"private"`) so a string value can't be mistaken for a number. The DESCRIPTION column appears
 * only when some value has a description, and is never truncated — it is the meaning of the value.
 *
 * @param enumTable - The enum value table to render.
 * @returns The formatted table with no trailing newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderCliEnumValuesTable(enumTable: CliModelEnum): string {
  const includeDescription = enumTable.values.some((v) => v.description != null && v.description.length > 0);
  const header = includeDescription ? ['VALUE', 'NAME', 'DESCRIPTION'] : ['VALUE', 'NAME'];
  const rows = enumTable.values.map((v) => {
    const row = [JSON.stringify(v.value), v.name];
    if (includeDescription) row.push(v.description ?? '');
    return row;
  });
  return renderTable([header, ...rows]);
}

/**
 * Renders one enum: a `# Name` heading, its description (when present), then its values table.
 *
 * @param enumTable - The enum value table to render.
 * @returns The formatted entry with no trailing newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderCliEnumEntry(enumTable: CliModelEnum): string {
  const lines: string[] = [`# ${enumTable.name}`];
  if (enumTable.description) lines.push(enumTable.description);
  lines.push('', renderCliEnumValuesTable(enumTable));
  return lines.join('\n');
}

/**
 * Produces a column-aligned `ENUM · VALUES · DESCRIPTION` summary of every enum in the manifest,
 * sorted by name, with descriptions cut to 80 characters.
 *
 * @param manifest - The generated enum manifest.
 * @returns The formatted table as a single string with a trailing newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderCliEnumList(manifest: CliEnumManifest): string {
  const { names } = resolveCliEnumInfoListOutput(manifest);
  let result: string;
  if (names.length === 0) {
    result = 'No enums found in the generated manifest.\n';
  } else {
    const rows = names.map((name) => {
      const table = manifest[name] as CliModelEnum;
      return [name, String(table.values.length), table.description ? truncate(table.description, 80) : ''];
    });
    result = renderTable([['ENUM', 'VALUES', 'DESCRIPTION'], ...rows]) + '\n';
  }
  return result;
}

/**
 * Renders a lookup result: each resolved enum entry separated by a blank line, then a final
 * `Not found: A, B. <hint>` line when some names missed.
 *
 * @param output - The resolved lookup output.
 * @returns The formatted text with a trailing newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderCliEnumInfoLookupOutput(output: CliEnumInfoLookupOutput): string {
  const blocks: string[] = output.enums.map((e) => renderCliEnumEntry(e));
  if (output.notFound != null && output.notFound.length > 0) {
    const hintSuffix = output.hint ? ' ' + output.hint : '';
    blocks.push(`Not found: ${output.notFound.join(', ')}.${hintSuffix}`);
  }
  return blocks.join('\n\n') + '\n';
}

function findCliEnum(manifest: CliEnumManifest, name: string): Maybe<CliModelEnum> {
  // own keys only: the generated literal inherits from Object.prototype, so `manifest['constructor']` is `Object`
  return Object.hasOwn(manifest, name) ? manifest[name] : undefined;
}

function collectFieldEnumRefs(fields: readonly CliModelField[], into: Set<string>): void {
  for (const field of fields) {
    if (field.enumRef) into.add(field.enumRef);
    if (field.nestedFields) collectFieldEnumRefs(field.nestedFields, into);
  }
}
