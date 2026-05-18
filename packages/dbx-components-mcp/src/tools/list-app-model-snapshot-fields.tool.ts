/**
 * `dbx_model_snapshot_field_list_app` tool.
 *
 * Walks a downstream `-firebase` component (and optional API app) for
 * every `snapshotConverterFunctions<T>({ fields: { … } })` call, parses
 * each field's converter expression, and maps the head identifier
 * (`firestoreDate(...)` → `firestoreDate`) onto the model-snapshot-fields
 * registry. Emits a per-model report so the agent can see at a glance
 * which snapshot fields the app actually uses — and which converter
 * identifiers are referenced but not in the registry (i.e. "external" /
 * untagged downstream consts that should probably opt in).
 *
 * Mirrors the `componentDir` + (optional) `apiDir` shape used by the
 * notification / storagefile validators so the agent can hand the same
 * directory pair to multiple `*_list_app` tools.
 *
 * Reads only TypeScript source — no compilation, no resolution. The head
 * identifier is captured purely syntactically (the leading callee text
 * before `(`), so this works identically on workspace models, downstream
 * apps, and unbuilt projects.
 */

import { glob, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { Node, Project, type CallExpression, type ObjectLiteralExpression, type SourceFile } from 'ts-morph';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import type { ModelSnapshotFieldRegistry } from '../registry/model-snapshot-fields-runtime.js';

// MARK: Args
const ListAppArgsType = type({
  componentDir: 'string',
  'apiDir?': 'string',
  'format?': "'markdown' | 'json'"
});

// MARK: Tool definition
const DBX_MODEL_SNAPSHOT_FIELD_LIST_APP_TOOL: Tool = {
  name: 'dbx_model_snapshot_field_list_app',
  description: [
    'List every snapshot field referenced inside `snapshotConverterFunctions<T>({ fields: { … } })` calls in a downstream `-firebase` component (and optional API app).',
    '',
    'For each model the report lists field name → converter call → registry slug (or `external` when the head identifier is not in the registry — likely an untagged reusable const that should opt in via `@dbxModelSnapshotField`).',
    '',
    'Provide:',
    '- `componentDir`: relative path to the `-firebase` component package (e.g. `components/demo-firebase`).',
    '- `apiDir` (optional): relative path to the API app (e.g. `apps/demo-api`) for any app-side model files.',
    '- `format` (optional): `markdown` (default) or `json`.',
    '',
    'Paths escaping the server cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: { type: 'string', description: 'Relative path to the `-firebase` component package.' },
      apiDir: { type: 'string', description: 'Relative path to the API app (optional).' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['componentDir']
  }
};

// MARK: Report shapes
interface FieldUsage {
  readonly fieldName: string;
  readonly converter: string;
  readonly headIdentifier: string;
  readonly slug: string | undefined;
  readonly module: string | undefined;
  readonly optional: boolean | undefined;
}

interface ModelUsage {
  readonly modelName: string;
  readonly relPath: string;
  readonly fields: readonly FieldUsage[];
}

interface ListAppReport {
  readonly componentDir: string;
  readonly apiDir: string | undefined;
  readonly modelCount: number;
  readonly fieldCount: number;
  readonly models: readonly ModelUsage[];
  readonly factoryFrequency: readonly { readonly slug: string; readonly name: string; readonly count: number }[];
  readonly externalIdentifiers: readonly { readonly identifier: string; readonly count: number }[];
}

// MARK: Tool factory
/**
 * Input to {@link createListAppModelSnapshotFieldsTool}.
 */
export interface CreateListAppModelSnapshotFieldsToolInput {
  /**
   * Snapshot-field registry the tool resolves converter head identifiers
   * against. The server bootstrap supplies this after loading the bundled
   * `@dereekb/firebase` model-snapshot-fields manifest plus any external
   * manifests declared in `dbx-mcp.config.json`.
   */
  readonly registry: ModelSnapshotFieldRegistry;
}

/**
 * Builds the `dbx_model_snapshot_field_list_app` tool wired to the
 * supplied registry.
 *
 * @param input - The registry the tool resolves identifiers against.
 * @returns A registered {@link DbxTool} ready to add to the dispatch table.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createListAppModelSnapshotFieldsTool(input: CreateListAppModelSnapshotFieldsToolInput): DbxTool {
  const { registry } = input;

  async function run(rawArgs: unknown): Promise<ToolResult> {
    const parsed = ListAppArgsType(rawArgs);
    let result: ToolResult;
    if (parsed instanceof type.errors) {
      result = toolError(`Invalid arguments: ${parsed.summary}`);
    } else {
      const cwd = process.cwd();
      let pathError: string | undefined;
      try {
        ensurePathInsideCwd(parsed.componentDir, cwd);
        if (parsed.apiDir !== undefined) {
          ensurePathInsideCwd(parsed.apiDir, cwd);
        }
      } catch (err) {
        pathError = err instanceof Error ? err.message : String(err);
      }

      if (pathError !== undefined) {
        result = toolError(pathError);
      } else {
        const componentAbs = resolve(cwd, parsed.componentDir);
        const apiAbs = parsed.apiDir === undefined ? undefined : resolve(cwd, parsed.apiDir);

        let report: ListAppReport | undefined;
        let buildError: string | undefined;
        try {
          report = await buildListAppReport({
            componentDir: parsed.componentDir,
            componentAbs,
            apiDir: parsed.apiDir,
            apiAbs,
            registry
          });
        } catch (err) {
          buildError = `Failed to walk app for snapshot fields: ${err instanceof Error ? err.message : String(err)}`;
        }

        if (buildError !== undefined) {
          result = toolError(buildError);
        } else {
          const text = parsed.format === 'json' ? formatReportAsJson(report as ListAppReport) : formatReportAsMarkdown(report as ListAppReport);
          result = { content: [{ type: 'text', text }] };
        }
      }
    }
    return result;
  }

  return { definition: DBX_MODEL_SNAPSHOT_FIELD_LIST_APP_TOOL, run };
}

// MARK: Walking
interface BuildListAppReportInput {
  readonly componentDir: string;
  readonly componentAbs: string;
  readonly apiDir: string | undefined;
  readonly apiAbs: string | undefined;
  readonly registry: ModelSnapshotFieldRegistry;
}

const COMPONENT_MODEL_GLOBS = ['src/lib/model/**/*.ts'];
const API_MODEL_GLOBS = ['src/app/common/model/**/*.ts', 'src/app/common/firebase/**/*.ts'];
const EXCLUDE_PATTERNS = [/\.spec\.ts$/, /\.test\.ts$/];

async function collectFiles(rootAbs: string, globs: readonly string[]): Promise<readonly string[]> {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const pattern of globs) {
    for await (const match of glob(pattern, { cwd: rootAbs })) {
      if (EXCLUDE_PATTERNS.some((rx) => rx.test(match))) continue;
      if (seen.has(match)) continue;
      seen.add(match);
      out.push(match);
    }
  }
  return out;
}

async function buildListAppReport(input: BuildListAppReportInput): Promise<ListAppReport> {
  const { componentDir, componentAbs, apiDir, apiAbs, registry } = input;
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });

  const componentFiles = await collectFiles(componentAbs, COMPONENT_MODEL_GLOBS);
  for (const rel of componentFiles) {
    const abs = resolve(componentAbs, rel);
    const text = await readFile(abs, 'utf-8');
    project.createSourceFile(`/component/${rel}`, text, { overwrite: true });
  }

  if (apiAbs !== undefined) {
    const apiFiles = await collectFiles(apiAbs, API_MODEL_GLOBS);
    for (const rel of apiFiles) {
      const abs = resolve(apiAbs, rel);
      const text = await readFile(abs, 'utf-8');
      project.createSourceFile(`/api/${rel}`, text, { overwrite: true });
    }
  }

  const models: ModelUsage[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    const sourcePath = sourceFile.getFilePath();
    const sidePrefix = sourcePath.startsWith('/component/') ? `${componentDir}/` : `${apiDir ?? ''}/`;
    const relPath = `${sidePrefix}${sourcePath.replace(/^\/(component|api)\//, '')}`;
    for (const call of findSnapshotConverterCalls(sourceFile)) {
      const fieldsObj = readFieldsObject(call);
      if (fieldsObj === undefined) continue;
      const modelName = resolveModelName(call) ?? 'AnonymousConverter';
      const fields = extractFieldUsages(fieldsObj, registry);
      if (fields.length > 0) {
        models.push({ modelName, relPath, fields });
      }
    }
  }

  const fieldCount = models.reduce((acc, m) => acc + m.fields.length, 0);

  const factoryFrequency = aggregateFactoryFrequency(models, registry);
  const externalIdentifiers = aggregateExternalIdentifiers(models);

  return {
    componentDir,
    apiDir,
    modelCount: models.length,
    fieldCount,
    models,
    factoryFrequency,
    externalIdentifiers
  };
}

function findSnapshotConverterCalls(sourceFile: SourceFile): readonly CallExpression[] {
  const out: CallExpression[] = [];
  sourceFile.forEachDescendant((node) => {
    if (Node.isCallExpression(node)) {
      const expr = node.getExpression();
      const exprText = expr.getText();
      // Strip generic args from the head ("snapshotConverterFunctions<X>" → "snapshotConverterFunctions")
      const head = exprText.replace(/<[^>]*>$/, '');
      if (head === 'snapshotConverterFunctions') {
        out.push(node);
      }
    }
  });
  return out;
}

function readFieldsObject(call: CallExpression): ObjectLiteralExpression | undefined {
  const args = call.getArguments();
  if (args.length === 0) return undefined;
  const first = args[0];
  if (!Node.isObjectLiteralExpression(first)) return undefined;
  const fieldsProp = first.getProperty('fields');
  if (fieldsProp === undefined || !Node.isPropertyAssignment(fieldsProp)) return undefined;
  const initializer = fieldsProp.getInitializer();
  if (initializer === undefined || !Node.isObjectLiteralExpression(initializer)) return undefined;
  return initializer;
}

function resolveModelName(call: CallExpression): string | undefined {
  // Walk up to find the enclosing variable declaration (e.g. `notificationBoxConverter`)
  let current: Node | undefined = call.getParent();
  while (current !== undefined) {
    if (Node.isVariableDeclaration(current)) {
      return current.getName();
    }
    current = current.getParent();
  }
  return undefined;
}

function extractFieldUsages(fieldsObj: ObjectLiteralExpression, registry: ModelSnapshotFieldRegistry): readonly FieldUsage[] {
  const out: FieldUsage[] = [];
  for (const property of fieldsObj.getProperties()) {
    if (!Node.isPropertyAssignment(property) && !Node.isShorthandPropertyAssignment(property)) continue;
    const fieldName = property.getName();
    let converterText: string;
    if (Node.isShorthandPropertyAssignment(property)) {
      converterText = property.getName();
    } else {
      const initializer = property.getInitializer();
      converterText = initializer === undefined ? '' : initializer.getText();
    }
    if (converterText.length === 0) continue;
    const headIdentifier = parseHeadIdentifier(converterText);
    const entry = headIdentifier === undefined ? undefined : (registry.findByName(headIdentifier) ?? registry.findByNameInsensitive(headIdentifier));
    out.push({
      fieldName,
      converter: converterText,
      headIdentifier: headIdentifier ?? '',
      slug: entry?.slug,
      module: entry?.module,
      optional: entry?.optional
    });
  }
  return out;
}

/**
 * Extracts the head identifier from a converter expression text. Returns
 * `firestoreDate` for `firestoreDate()` / `firestoreDate({ ... })` and
 * `firestoreModelKeyString` for the bare const reference. Returns
 * `undefined` for property accesses, computed expressions, and other
 * shapes the registry can't resolve syntactically.
 *
 * @param text - The converter expression source text.
 * @returns The leading identifier, or undefined if the head can't be parsed.
 */
export function parseHeadIdentifier(text: string): string | undefined {
  const trimmed = text.trim();
  // Strip trailing call args / generic args — keep only the head identifier
  const callMatch = /^([A-Za-z_$][A-Za-z0-9_$]*)/.exec(trimmed);
  return callMatch === null ? undefined : callMatch[1];
}

// MARK: Aggregations
/**
 * Counts how many times each registry-resolved snapshot field appears across
 * the given models. Returns rows sorted by descending count, then slug.
 *
 * @param models - The per-model usage rows.
 * @param registry - The snapshot-field registry used to attach `name` to each slug.
 * @returns Frequency rows ready for the markdown / JSON formatter.
 */
function aggregateFactoryFrequency(models: readonly ModelUsage[], registry: ModelSnapshotFieldRegistry): readonly { readonly slug: string; readonly name: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const model of models) {
    for (const field of model.fields) {
      if (field.slug === undefined) continue;
      counts.set(field.slug, (counts.get(field.slug) ?? 0) + 1);
    }
  }
  const out: { readonly slug: string; readonly name: string; readonly count: number }[] = [];
  for (const [slug, count] of counts) {
    const entry = registry.findBySlug(slug);
    if (entry !== undefined) {
      out.push({ slug, name: entry.name, count });
    }
  }
  out.sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
  return out;
}

/**
 * Counts each unmatched ("external") head identifier across the given models.
 * Returns rows sorted by descending count, then identifier.
 *
 * @param models - The per-model usage rows.
 * @returns External-identifier rows ready for the formatter.
 */
function aggregateExternalIdentifiers(models: readonly ModelUsage[]): readonly { readonly identifier: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const model of models) {
    for (const field of model.fields) {
      if (field.slug !== undefined) continue;
      if (field.headIdentifier.length === 0) continue;
      counts.set(field.headIdentifier, (counts.get(field.headIdentifier) ?? 0) + 1);
    }
  }
  const out: { readonly identifier: string; readonly count: number }[] = [];
  for (const [identifier, count] of counts) {
    out.push({ identifier, count });
  }
  out.sort((a, b) => b.count - a.count || a.identifier.localeCompare(b.identifier));
  return out;
}

// MARK: Formatting
function formatReportAsMarkdown(report: ListAppReport): string {
  const lines: string[] = [];
  appendMarkdownHeader(lines, report);
  let result: string;
  if (report.models.length === 0) {
    lines.push('_No `snapshotConverterFunctions` calls found._');
    result = lines.join('\n').trimEnd();
  } else {
    appendMarkdownModelTables(lines, report.models);
    appendMarkdownFrequencyTable(lines, report.factoryFrequency);
    appendMarkdownExternalIdentifiersTable(lines, report.externalIdentifiers);
    result = lines.join('\n').trimEnd();
  }
  return result;
}

function appendMarkdownHeader(lines: string[], report: ListAppReport): void {
  const apiSuffix = report.apiDir === undefined ? '' : ` + \`${report.apiDir}\``;
  lines.push(`# Snapshot fields used by \`${report.componentDir}\`${apiSuffix}`, '', `${report.modelCount} model${report.modelCount === 1 ? '' : 's'}, ${report.fieldCount} field${report.fieldCount === 1 ? '' : 's'} resolved.`, '');
}

function appendMarkdownModelTables(lines: string[], models: readonly ModelUsage[]): void {
  for (const model of models) {
    lines.push(`## \`${model.modelName}\``, `_${model.relPath}_`, '', '| Field | Converter | Slug | Optional? |', '| --- | --- | --- | --- |');
    for (const field of model.fields) {
      lines.push(formatFieldRow(field));
    }
    lines.push('');
  }
}

function formatFieldRow(field: FieldUsage): string {
  const slugCell = field.slug === undefined ? '_external_' : `\`${field.slug}\``;
  const optionalCell = formatOptionalCell(field.optional);
  return `| \`${field.fieldName}\` | \`${truncate(field.converter, 60)}\` | ${slugCell} | ${optionalCell} |`;
}

function formatOptionalCell(optional: boolean | undefined): string {
  let cell: string;
  if (optional === undefined) {
    cell = '—';
  } else {
    cell = optional ? 'yes' : 'no';
  }
  return cell;
}

function appendMarkdownFrequencyTable(lines: string[], rows: readonly { readonly slug: string; readonly name: string; readonly count: number }[]): void {
  if (rows.length === 0) return;
  lines.push('## Snapshot field frequency', '', '| Slug | Name | Count |', '| --- | --- | --- |');
  for (const row of rows) {
    lines.push(`| \`${row.slug}\` | \`${row.name}\` | ${row.count} |`);
  }
  lines.push('');
}

function appendMarkdownExternalIdentifiersTable(lines: string[], rows: readonly { readonly identifier: string; readonly count: number }[]): void {
  if (rows.length === 0) return;
  lines.push('## External identifiers (not in registry)', '', 'Tag these with `@dbxModelSnapshotField` (and re-run `nx run dbx-components-mcp:generate-manifests`) to surface them in the catalog.', '', '| Identifier | Count |', '| --- | --- |');
  for (const row of rows) {
    lines.push(`| \`${row.identifier}\` | ${row.count} |`);
  }
  lines.push('');
}

function formatReportAsJson(report: ListAppReport): string {
  return JSON.stringify(report, null, 2);
}

function truncate(text: string, max: number): string {
  const flat = text.replaceAll(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

// Re-export entry types for tests / external consumers.
export type { ListAppReport, ModelUsage, FieldUsage };

// Re-export registry-aware helpers for external consumers (e.g. tests that
// build a fixture report without spinning up the full tool).
export { aggregateFactoryFrequency, aggregateExternalIdentifiers };
