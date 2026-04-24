/**
 * `dbx_scaffold` tool.
 *
 * Generates a copy-paste-ready @dereekb/dbx-form forge `FormConfig` skeleton
 * from a compact field spec list. Each entry in `fields` is either:
 *
 *   • `"<slug>:<key>"` — picks the registry entry by slug, uses `<key>` as
 *     the form control name (e.g. `"text:email"` → `dbxForgeTextField({ key: 'email' })`).
 *   • `"<slug>"` — when the entry doesn't need a caller-supplied key (e.g.
 *     composites like `address-group` that auto-key, or layout primitives).
 *
 * The tool emits imports, a `FormConfig` wrapper, and an optional
 * `*Value` interface inferred from each entry's `produces` + `arrayOutput`.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { getForgeField, type ForgeFieldInfo } from '../registry/index.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const DEFAULT_VALUE_TYPE_NAME = 'ScaffoldedFormValue';

// MARK: Tool advertisement
const DBX_SCAFFOLD_TOOL: Tool = {
  name: 'dbx_scaffold',
  description: [
    'Generate a @dereekb/dbx-form forge FormConfig skeleton from a compact field list.',
    '',
    'Each entry in `fields` is either:',
    '  • `"<slug>:<key>"` — e.g. `"text:email"`, `"phone:contactPhone"`, `"number-slider:rating"`',
    '  • `"<slug>"` — use this for composites that auto-key (e.g. `"address-group"`, `"date-range-row"`) or layout primitives where you\'ll add content separately.',
    '',
    "Output includes: imports grouped by source, a `FormConfig` literal, and a `<name>Value` interface inferred from each field's produces+arrayOutput. Pass `valueTypeName` to customize the interface name.",
    '',
    'Use `dbx_lookup topic="list"` to see every available slug. Use `dbx_examples` for pre-built multi-field compositions.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      fields: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        description: 'Compact field specs — "<slug>:<key>" or "<slug>".'
      },
      valueTypeName: {
        type: 'string',
        description: `Name for the emitted value-type interface. Defaults to "${DEFAULT_VALUE_TYPE_NAME}".`,
        default: DEFAULT_VALUE_TYPE_NAME
      },
      wrapInSection: {
        type: 'boolean',
        description: "When true, wraps all fields in a `dbxForgeSectionWrapper` via the first field's `wrappers: []`. Defaults to false.",
        default: false
      }
    },
    required: ['fields']
  }
};

// MARK: Input validation
const ScaffoldArgsType = type({
  fields: 'string[]>0',
  'valueTypeName?': 'string',
  'wrapInSection?': 'boolean'
});

interface ParsedScaffoldArgs {
  readonly fields: readonly string[];
  readonly valueTypeName: string;
  readonly wrapInSection: boolean;
}

function parseScaffoldArgs(raw: unknown): ParsedScaffoldArgs {
  const parsed = ScaffoldArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedScaffoldArgs = {
    fields: parsed.fields,
    valueTypeName: parsed.valueTypeName?.trim() || DEFAULT_VALUE_TYPE_NAME,
    wrapInSection: parsed.wrapInSection ?? false
  };
  return result;
}

// MARK: Spec parsing
interface FieldSpec {
  readonly raw: string;
  readonly slug: string;
  readonly key?: string;
  readonly field: ForgeFieldInfo;
}

interface SpecError {
  readonly raw: string;
  readonly reason: string;
}

function parseFieldSpec(raw: string): FieldSpec | SpecError {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { raw, reason: 'empty spec' };
  }
  const colonIndex = trimmed.indexOf(':');
  let slug: string;
  let key: string | undefined;
  if (colonIndex === -1) {
    slug = trimmed;
  } else {
    slug = trimmed.slice(0, colonIndex).trim();
    key = trimmed.slice(colonIndex + 1).trim();
    if (key.length === 0) {
      return { raw, reason: 'key is empty after colon' };
    }
    if (!/^[a-z_$][\w$]*$/i.test(key)) {
      return { raw, reason: `key "${key}" is not a valid JS identifier` };
    }
  }
  const field = getForgeField(slug);
  if (!field) {
    return { raw, reason: `unknown slug "${slug}"` };
  }
  const spec: FieldSpec = { raw, slug, key, field };
  return spec;
}

// MARK: Value-type inference
interface ValuePropertyInfo {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly tierContext?: 'composite' | 'primitive';
}

function inferValueProperty(spec: FieldSpec): ValuePropertyInfo | undefined {
  // Composites and primitives don't directly contribute a named top-level
  // property — they either auto-key, render layout, or spread into parent.
  if (spec.field.tier !== 'field-factory') {
    return undefined;
  }
  if (!spec.key) {
    return undefined;
  }
  const produces = spec.field.produces;
  const arrayOutput = spec.field.arrayOutput;
  let tsType: string;
  if (arrayOutput === 'yes') {
    tsType = produces.endsWith('[]') ? produces : `${produces}[]`;
  } else if (arrayOutput === 'optional') {
    tsType = produces.endsWith('[]') ? produces : `${produces} | ${produces}[]`;
  } else {
    tsType = produces;
  }
  const result: ValuePropertyInfo = { name: spec.key, type: tsType, required: false };
  return result;
}

// MARK: Emit
function renderFieldCall(spec: FieldSpec): string {
  const base = spec.key ? `{ key: '${spec.key}' }` : `{}`;
  // For primitives like `row` / `group` we don't auto-emit args because callers
  // almost always want to fill `fields: [...]` themselves. Emit an empty call
  // with a TODO so the code compiles up to the user's edits.
  if (spec.field.tier === 'primitive') {
    const result = `${spec.field.factoryName}({ /* TODO */ })`;
    return result;
  }
  const result = `${spec.field.factoryName}(${base})`;
  return result;
}

function groupImportsBySource(specs: readonly FieldSpec[]): readonly string[] {
  const names = new Set<string>();
  for (const spec of specs) {
    names.add(spec.field.factoryName);
  }
  const sorted = Array.from(names).sort();
  const result = [`import { ${sorted.join(', ')} } from '@dereekb/dbx-form';`];
  return result;
}

function renderValueInterface(valueTypeName: string, properties: readonly ValuePropertyInfo[]): string {
  if (properties.length === 0) {
    const result = `// Caller fills out ${valueTypeName} — the fields you scaffolded are composite / layout.\nexport interface ${valueTypeName} {}`;
    return result;
  }
  const lines: string[] = [`export interface ${valueTypeName} {`];
  for (const prop of properties) {
    const modifier = prop.required ? '' : '?';
    lines.push(`  readonly ${prop.name}${modifier}: ${prop.type};`);
  }
  lines.push('}');
  const result = lines.join('\n');
  return result;
}

function renderFieldsArray(specs: readonly FieldSpec[], wrapInSection: boolean): string {
  const calls = specs.map((s) => renderFieldCall(s));
  if (wrapInSection) {
    if (calls.length === 0) {
      const result = `[]`;
      return result;
    }
    const first = calls[0];
    const rest = calls.slice(1);
    const wrappedFirst = `{ ...${first}, wrappers: [dbxForgeSectionWrapper({ headerConfig: { text: 'Section' } })] }`;
    const all = [wrappedFirst, ...rest];
    const result = `[\n    ${all.join(',\n    ')}\n  ]`;
    return result;
  }
  const result = `[\n    ${calls.join(',\n    ')}\n  ]`;
  return result;
}

function renderScaffold(specs: readonly FieldSpec[], valueTypeName: string, wrapInSection: boolean): string {
  const importLines = [...groupImportsBySource(specs)];
  if (wrapInSection) {
    importLines[0] = importLines[0].replace("} from '@dereekb/dbx-form';", ", dbxForgeSectionWrapper } from '@dereekb/dbx-form';");
  }
  const properties = specs.map((s) => inferValueProperty(s)).filter((p): p is ValuePropertyInfo => p !== undefined);
  const fieldsLiteral = renderFieldsArray(specs, wrapInSection);
  const valueInterface = renderValueInterface(valueTypeName, properties);

  const lines: string[] = [...importLines, '', `export const formConfig: FormConfig<${valueTypeName}> = {`, `  fields: ${fieldsLiteral}`, `};`, '', valueInterface];
  const result = lines.join('\n');
  return result;
}

// MARK: Handler
export function runScaffold(rawArgs: unknown): ToolResult {
  let args: ParsedScaffoldArgs;
  try {
    args = parseScaffoldArgs(rawArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toolError(message);
  }
  const parsed = args.fields.map((raw) => parseFieldSpec(raw));
  const errors = parsed.filter((p): p is SpecError => 'reason' in p);
  if (errors.length > 0) {
    const lines: string[] = ['Invalid field specs:', ''];
    for (const error of errors) {
      lines.push(`- \`${error.raw}\` — ${error.reason}`);
    }
    lines.push('');
    lines.push('Expected format: `"<slug>:<key>"` (e.g. `"text:email"`) or `"<slug>"` for auto-keyed entries. Run `dbx_lookup topic="list"` for every slug.');
    return toolError(lines.join('\n'));
  }
  const specs = parsed as readonly FieldSpec[];
  const code = renderScaffold(specs, args.valueTypeName, args.wrapInSection);
  const slugList = specs.map((s) => s.slug).join(', ');
  const preamble = `# Scaffold\n\nGenerated from \`${slugList}\` (${specs.length} field${specs.length === 1 ? '' : 's'}).`;
  const text = `${preamble}\n\n\`\`\`ts\n${code}\n\`\`\``;
  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const scaffoldTool: DbxTool = {
  definition: DBX_SCAFFOLD_TOOL,
  run: runScaffold
};
