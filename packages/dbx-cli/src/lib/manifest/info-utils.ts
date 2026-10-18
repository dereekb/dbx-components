import { type ModelManifestCatalogHit, type ModelManifestInfoEnumOutput, type ModelManifestInfoHints, type ModelManifestInfoModelOutput, type ModelManifestInfoOutput, type ModelManifestInfoOverviewOutput, type ModelManifestInfoSearchOutput } from '@dereekb/firebase/manifest';
import { type Maybe } from '@dereekb/util';
import { renderTable, truncate } from '../util/table';
import { renderCliEnumEntry } from './enum-info-utils';
import { renderModelManifestEntry } from './model-info-utils';
import type { CliEnumManifest } from './types';

/**
 * Default name of the `info` command.
 */
export const DEFAULT_INFO_COMMAND_NAME = 'info';

/**
 * Maximum length of a search hit's summary in the human-readable table.
 */
export const CLI_INFO_SUMMARY_MAX_LENGTH = 80;

/**
 * Builds the hint texts the `info` command attaches to its output, naming its own flags. The same sentences as the MCP
 * `<prefix>_api_info` tool's hints.
 *
 * @param commandName - The configured info command name.
 * @returns The hints.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildCliInfoHints(commandName: Maybe<string>): ModelManifestInfoHints {
  const command = commandName ?? DEFAULT_INFO_COMMAND_NAME;

  return {
    overview: `Run \`${command} <words>\` (one to three keywords) to find models, fields and enums; narrow with \`--kind\` and page with \`--offset\`. Run \`${command} --model <name>\` or \`${command} --enum <name>\` to look entries up by name.`,
    partial: 'No hit matched every query word; these hits match some of them.',
    noMatch: `Nothing matched. Try fewer or different keywords, or run \`${command}\` with no arguments for the overview.`,
    modelNotFound: `Match a model by modelType, identity const or collection prefix. Run \`${command}\` with no arguments to list the model types.`,
    enumNotFound: `Match an enum by its exact declaration name. Run \`${command}\` with no arguments to list the enum names.`
  };
}

/**
 * Options for {@link renderCliInfoOutput}.
 */
export interface RenderCliInfoOutputOptions {
  /**
   * The `offset` the search ran with, for the paging line. Defaults to 0.
   */
  readonly offset?: Maybe<number>;
  /**
   * Generated enum value tables, used to print the enums a looked-up model's fields reference.
   */
  readonly enumManifest?: Maybe<CliEnumManifest>;
}

/**
 * Renders the shared info output as human-readable text.
 *
 * @param output - The resolved info output.
 * @param options - The search offset and the enum manifest.
 * @returns The formatted text with a trailing newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderCliInfoOutput(output: ModelManifestInfoOutput, options?: RenderCliInfoOutputOptions): string {
  let result: string;

  switch (output.mode) {
    case 'overview':
      result = renderCliInfoOverview(output);
      break;
    case 'search':
      result = renderCliInfoSearch(output, options?.offset ?? 0);
      break;
    case 'model':
      result = renderCliInfoModels(output, options?.enumManifest);
      break;
    case 'enum':
      result = renderCliInfoEnums(output);
      break;
  }

  return result;
}

/**
 * Renders the overview: a `GROUP · MODELS` table, then the enum names and the hint.
 *
 * @param output - The overview output.
 * @returns The formatted text with a trailing newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderCliInfoOverview(output: ModelManifestInfoOverviewOutput): string {
  const lines: string[] = [`${output.totalModels} model${output.totalModels === 1 ? '' : 's'}, ${output.totalEnums} enum${output.totalEnums === 1 ? '' : 's'}.`];

  if (output.groups.length > 0) {
    lines.push('', renderTable([['GROUP', 'MODELS'], ...output.groups.map((group) => [group.modelGroup, group.modelTypes.join(', ')])]));
  }

  if (output.enumNames.length > 0) {
    lines.push('', `Enums: ${output.enumNames.join(', ')}`);
  }

  lines.push('', output.hint);
  return lines.join('\n') + '\n';
}

/**
 * Renders search hits as a `KIND · NAME · MODEL · SUMMARY` table plus a paging line.
 *
 * @param output - The search output.
 * @param offset - The offset the search ran with.
 * @returns The formatted text with a trailing newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderCliInfoSearch(output: ModelManifestInfoSearchOutput, offset: number): string {
  const lines: string[] = [];

  if (output.hits.length > 0) {
    lines.push(renderTable([['KIND', 'NAME', 'MODEL', 'SUMMARY'], ...output.hits.map(cliInfoHitRow)]));
    const nextSuffix = output.nextOffset == null ? '' : ` Next: --offset ${output.nextOffset}.`;
    lines.push('', `Showing ${offset + 1}–${offset + output.hits.length} of ${output.total}.${nextSuffix}`);
  } else {
    lines.push(output.total > 0 ? `No hits at offset ${offset}; there are ${output.total}.` : 'No hits.');
  }

  if (output.hint) {
    lines.push(output.hint);
  }

  return lines.join('\n') + '\n';
}

function cliInfoHitRow(hit: ModelManifestCatalogHit): string[] {
  let row: string[];

  switch (hit.kind) {
    case 'model':
      row = ['model', hit.modelType, '', hit.summary ?? ''];
      break;
    case 'field':
      row = ['field', `${hit.longName} (${hit.field})`, hit.modelType, hit.summary ?? ''];
      break;
    case 'enum':
      row = ['enum', hit.enum, '', hit.summary ?? ''];
      break;
  }

  row[3] = truncate(row[3], CLI_INFO_SUMMARY_MAX_LENGTH);
  return row;
}

/**
 * Renders a model lookup: each entry with the enum tables its fields reference, then any misses.
 *
 * @param output - The model output.
 * @param enumManifest - The generated enum value tables.
 * @returns The formatted text with a trailing newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderCliInfoModels(output: ModelManifestInfoModelOutput, enumManifest: Maybe<CliEnumManifest>): string {
  const blocks: string[] = output.models.map((entry) => renderModelManifestEntry(entry, { enumManifest }).trimEnd());
  pushNotFound(blocks, output.notFound, output.hint);
  return blocks.join('\n\n') + '\n';
}

/**
 * Renders an enum lookup: each value table followed by a `MODEL · FIELD · LONG NAME` table of the fields that use it,
 * then any misses.
 *
 * @param output - The enum output.
 * @returns The formatted text with a trailing newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderCliInfoEnums(output: ModelManifestInfoEnumOutput): string {
  const blocks: string[] = output.enums.map((enumTable) => {
    const usedBy = enumTable.usedBy.length > 0 ? renderTable([['MODEL', 'FIELD', 'LONG NAME'], ...enumTable.usedBy.map((x) => [x.modelType, x.field, x.longName])]) : '(no fields)';
    return `${renderCliEnumEntry(enumTable)}\n\nUsed by:\n${usedBy}`;
  });

  pushNotFound(blocks, output.notFound, output.hint);
  return blocks.join('\n\n') + '\n';
}

function pushNotFound(blocks: string[], notFound: Maybe<readonly string[]>, hint: Maybe<string>): void {
  if (notFound != null && notFound.length > 0) {
    blocks.push(`Not found: ${notFound.join(', ')}.${hint ? ' ' + hint : ''}`);
  }
}
