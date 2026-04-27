/**
 * `dbx_filter_scaffold` tool.
 *
 * Generates the filter-source + connector + (optional) preset stack for a
 * model + filter shape. Pure synchronous: no I/O, just template / class /
 * imports / type strings.
 *
 * The tool emits a markdown response with up to four fenced blocks:
 *
 *   1. Filter type interface (TS)
 *   2. Filter map / preset constants (TS) — emitted only if preset_keys are
 *      provided
 *   3. Component template fragment (HTML)
 *   4. Component class fragment (TS)
 *
 * Plus a "Notes" section pointing at the matching `dbx_filter_lookup` slugs.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Tool definition
const DBX_FILTER_SCAFFOLD_TOOL: Tool = {
  name: 'dbx_filter_scaffold',
  description: [
    'Scaffold a filter wiring stack — filter type interface, source/connector directives, optional preset chips, optional collection-store hookup.',
    '',
    'Inputs:',
    '  • `model_name` — PascalCase model name (e.g. "Profile"). Used to derive the component class name.',
    '  • `filter_type` — PascalCase filter interface name (e.g. "ProfileFilter").',
    '  • `preset_keys` — optional preset string identifiers (e.g. ["active", "archived"]). Each becomes a `ClickableFilterPreset` entry.',
    '  • `uses_collection_store` — when true, wires `DbxFirebaseCollectionStore` to consume the filter source.',
    '',
    'Output: a markdown bundle with the filter type, optional preset constants, the component template fragment, and the component class fragment.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      model_name: { type: 'string', description: 'PascalCase model name (used to derive the component class name).' },
      filter_type: { type: 'string', description: 'PascalCase filter interface name.' },
      preset_keys: { type: 'array', items: { type: 'string' }, description: 'Preset string identifiers to scaffold as `ClickableFilterPreset` entries.' },
      uses_collection_store: { type: 'boolean', description: 'Wire a Firebase collection store consumer.', default: false }
    },
    required: ['model_name', 'filter_type']
  }
};

// MARK: Input validation
const ScaffoldArgsType = type({
  model_name: 'string',
  filter_type: 'string',
  'preset_keys?': 'string[]',
  'uses_collection_store?': 'boolean'
});

interface ParsedScaffoldArgs {
  readonly modelName: string;
  readonly filterType: string;
  readonly presetKeys: readonly string[];
  readonly usesCollectionStore: boolean;
}

function parseArgs(raw: unknown): ParsedScaffoldArgs {
  const parsed = ScaffoldArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new TypeError(`Invalid arguments: ${parsed.summary}`);
  }
  const modelName = parsed.model_name.trim();
  const filterType = parsed.filter_type.trim();
  if (modelName.length === 0) {
    throw new Error('Invalid arguments: model_name must not be empty.');
  }
  if (filterType.length === 0) {
    throw new Error('Invalid arguments: filter_type must not be empty.');
  }
  const presetKeys = (parsed.preset_keys ?? []).map((k) => k.trim()).filter((k) => k.length > 0);
  const result: ParsedScaffoldArgs = {
    modelName,
    filterType,
    presetKeys,
    usesCollectionStore: parsed.uses_collection_store ?? false
  };
  return result;
}

// MARK: Naming helpers
function camelCase(name: string): string {
  if (name.length === 0) {
    return name;
  }
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function presetConstName(modelCamel: string, presetKey: string): string {
  const cleaned = presetKey.replaceAll(/[^a-zA-Z0-9]/g, ' ').trim();
  const parts = cleaned.split(/\s+/).filter((p) => p.length > 0);
  let suffix = '';
  for (const part of parts) {
    suffix += part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }
  return `${modelCamel}${suffix}Preset`;
}

// MARK: Snippet builders
function renderFilterType(args: ParsedScaffoldArgs): string {
  const lines: string[] = [`export interface ${args.filterType} {`];
  if (args.presetKeys.length > 0) {
    const union = args.presetKeys.map((k) => `'${k}'`).join(' | ');
    lines.push(`  readonly preset?: ${union};`);
  }
  lines.push(`  // TODO: add filter fields (e.g. status, search, dates)`, `}`);
  return lines.join('\n');
}

function renderPresetConstants(args: ParsedScaffoldArgs): string {
  const lines: string[] = [];
  const modelCamel = camelCase(args.modelName);
  for (const key of args.presetKeys) {
    const constName = presetConstName(modelCamel, key);
    lines.push(`export const ${constName}: ClickableFilterPreset<${args.filterType}> = {`, `  preset: '${key}',`, `  title: '${capitalize(key)}',`, `  presetValue: { preset: '${key}' }`, `};`, '');
  }
  const arrayName = `${modelCamel}FilterPresets`;
  const elements = args.presetKeys.map((k) => presetConstName(modelCamel, k)).join(', ');
  lines.push(`export const ${arrayName}: readonly ClickableFilterPreset<${args.filterType}>[] = [${elements}];`);
  return lines.join('\n');
}

function renderTemplate(args: ParsedScaffoldArgs): string {
  const modelCamel = camelCase(args.modelName);
  const lines: string[] = [`<div dbxFilterSourceConnector>`];
  if (args.presetKeys.length > 0) {
    lines.push(`  <dbx-filter-preset-list [presets]="${modelCamel}FilterPresets"></dbx-filter-preset-list>`);
  }
  lines.push(`  <my-${modelCamel}-filter-form dbxFilterSource dbxFilterConnectSource></my-${modelCamel}-filter-form>`);
  if (args.usesCollectionStore) {
    lines.push(`  <my-${modelCamel}-list [state]="store.pageLoadingState$" dbxFirebaseCollectionList></my-${modelCamel}-list>`);
  } else {
    lines.push(`  <my-${modelCamel}-list></my-${modelCamel}-list>`);
  }
  lines.push(`</div>`);
  return lines.join('\n');
}

function renderClass(args: ParsedScaffoldArgs): string {
  const modelCamel = camelCase(args.modelName);
  const componentName = `${args.modelName}ListPageComponent`;
  const lines: string[] = [`@Component({`, `  selector: 'app-${modelCamel}-list-page',`, `  templateUrl: './${modelCamel}-list-page.component.html',`, `  standalone: true,`, `  changeDetection: ChangeDetectionStrategy.OnPush,`, `  imports: [`, `    DbxCoreFilterModule,`];
  if (args.presetKeys.length > 0) {
    lines.push(`    DbxFilterPresetListComponent,`);
  }
  if (args.usesCollectionStore) {
    lines.push(`    DbxFirebaseCollectionListDirective,`);
  }
  lines.push(`    My${args.modelName}FilterFormComponent,`, `    My${args.modelName}ListComponent`, `  ]`, `})`, `export class ${componentName} {`);
  if (args.usesCollectionStore) {
    lines.push(`  readonly store = inject(${args.modelName}CollectionStore);`);
  }
  lines.push(`}`);
  return lines.join('\n');
}

function renderImports(args: ParsedScaffoldArgs): readonly string[] {
  const imports: string[] = [`import { ChangeDetectionStrategy, Component${args.usesCollectionStore ? ', inject' : ''} } from '@angular/core';`, `import { DbxCoreFilterModule${args.presetKeys.length > 0 ? ', type ClickableFilterPreset' : ''} } from '@dereekb/dbx-core';`];
  if (args.presetKeys.length > 0) {
    imports.push(`import { DbxFilterPresetListComponent } from '@dereekb/dbx-web';`);
  }
  if (args.usesCollectionStore) {
    imports.push(`import { DbxFirebaseCollectionListDirective } from '@dereekb/dbx-firebase';`);
  }
  return imports;
}

function capitalize(value: string): string {
  if (value.length === 0) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// MARK: Output
function formatScaffold(args: ParsedScaffoldArgs): string {
  const lines: string[] = [`# ${args.modelName} filter scaffold`, '', `Filter type: \`${args.filterType}\` · Presets: ${args.presetKeys.length > 0 ? args.presetKeys.length : 'none'} · Collection store: ${args.usesCollectionStore ? 'yes' : 'no'}`, '', '## Filter type', '', '```ts', renderFilterType(args), '```', ''];

  if (args.presetKeys.length > 0) {
    lines.push('## Presets', '', '```ts', renderPresetConstants(args), '```', '');
  }

  lines.push('## Template', '', '```html', renderTemplate(args), '```', '', '## Component class', '', '```ts', ...renderImports(args), '', renderClass(args), '```', '', '## Notes', '', '- The outer `[dbxFilterSourceConnector]` provides both `FilterSource` and `FilterSourceConnector`. Children that own the form use `[dbxFilterSource]` + `[dbxFilterConnectSource]` to wire up.');
  if (args.presetKeys.length > 0) {
    lines.push('- Each `ClickableFilterPreset` listed in the preset array becomes a chip; clicking sets `presetValue` on the filter source.');
  }
  if (args.usesCollectionStore) {
    lines.push('- The collection store consumes the filter source via the standard `dbxFirebaseCollectionList` directive — see skill `dbx__guide__angular-stores`.');
  }
  lines.push('- See `dbx_filter_lookup topic="list"` for related directives.');

  return lines.join('\n');
}

// MARK: Handler
/**
 * Tool handler for `dbx_filter_scaffold`. Renders a starter filter-component /
 * directive snippet for the requested filter pattern.
 *
 * @param rawArgs - the unvalidated tool arguments from the MCP runtime
 * @returns the rendered scaffold, or an error result when args fail validation
 */
export function runFilterScaffold(rawArgs: unknown): ToolResult {
  let args: ParsedScaffoldArgs;
  try {
    args = parseArgs(rawArgs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }
  const text = formatScaffold(args);
  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const filterScaffoldTool: DbxTool = {
  definition: DBX_FILTER_SCAFFOLD_TOOL,
  run: runFilterScaffold
};
