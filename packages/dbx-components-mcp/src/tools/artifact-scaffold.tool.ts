/**
 * `dbx_artifact_scaffold` tool.
 *
 * Sibling to `dbx_artifact_file_convention`. Where that tool returns canonical
 * file paths + required-export shapes for an artifact kind, this tool
 * emits the body templates — copy-paste-ready TypeScript for a new
 * `StorageFilePurpose`, `NotificationTemplateType`, or
 * `NotificationTaskType`. Inline string templates with
 * `<<camel>>` / `<<Pascal>>` / `<<SCREAMING>>` / `<<kebab>>` slots
 * substituted from the caller's `name` input.
 *
 * Idempotency: each emission target is checked against the cwd via
 * `fs.access`. Existing files are marked `exists-skipped` rather than
 * overwritten — the tool never mutates the workspace.
 *
 * Pairs with the recently-shipped strict-reachability validators
 * (`dbx_storagefile_m_validate_app`, `dbx_notification_m_validate_app`)
 * — generated handler files use the bindingName discipline those
 * validators enforce.
 */

import { access } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { applyIdempotency, formatResult, scaffoldArtifact, type ArtifactKind, type ScaffoldArtifactInput } from './artifact-scaffold/index.js';

const ARTIFACT_KINDS: readonly ArtifactKind[] = ['storagefile-purpose', 'notification-template', 'notification-task'];
const ARTIFACT_KIND_LITERAL_UNION = ARTIFACT_KINDS.map((k) => `'${k}'`).join(' | ');
const ARTIFACT_KIND_BACKTICK_LIST = ARTIFACT_KINDS.map((k) => '`' + k + '`').join(', ');

// MARK: Tool definition
const DBX_ARTIFACT_SCAFFOLD_TOOL: Tool = {
  name: 'dbx_artifact_scaffold',
  description: [
    'Generate copy-paste-ready body templates for a downstream dbx-components artifact: a new `StorageFilePurpose`, `NotificationTemplateType`, or `NotificationTaskType`. Sibling to `dbx_artifact_file_convention` — that tool says where each piece belongs and what its export shape is; this one emits the actual TypeScript bodies.',
    '',
    `Supported artifact kinds: ${ARTIFACT_KIND_BACKTICK_LIST}.`,
    '',
    'Inputs:',
    '- `artifact`: required — which artifact kind to scaffold.',
    '- `name`: required — camelCase name (or kebab/Pascal/screaming — the tool normalizes via word-splitting).',
    '- `componentDir`: required — relative path to the `-firebase` component package (e.g. `components/demo-firebase`).',
    '- `apiDir`: required — relative path to the API app (e.g. `apps/demo-api`).',
    '- `options.withProcessing` (storagefile-purpose only): also emit subtask processor scaffold + processing constants.',
    '- `options.unique` (notification-task only): emit `unique: true` on the template factory.',
    '- `options.handlersSubfolder` (default `true`): place API handler files inside `handlers/` subfolder.',
    '',
    'Output is a markdown response with one fenced code block per emitted file plus a "Wiring instructions" section listing the call-site changes the user must apply manually. Existing files are marked `EXISTS — skipped` and not overwritten.',
    '',
    'Paths escaping the server cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      artifact: {
        type: 'string',
        enum: [...ARTIFACT_KINDS],
        description: 'Which artifact kind to scaffold.'
      },
      name: { type: 'string', description: 'Name in any case style (camel/kebab/Pascal/screaming) — normalized via word-splitting.' },
      componentDir: { type: 'string', description: 'Relative path to the `-firebase` component package.' },
      apiDir: { type: 'string', description: 'Relative path to the API app.' },
      options: {
        type: 'object',
        properties: {
          withProcessing: { type: 'boolean', description: 'storagefile-purpose: also emit processor scaffold.' },
          unique: { type: 'boolean', description: 'notification-task: emit `unique: true`.' },
          handlersSubfolder: { type: 'boolean', description: 'Place handler files under `handlers/`. Defaults to true.' }
        }
      }
    },
    required: ['artifact', 'name', 'componentDir', 'apiDir']
  }
};

// MARK: Input validation
const ScaffoldArtifactArgsType = type({
  artifact: ARTIFACT_KIND_LITERAL_UNION,
  name: 'string',
  componentDir: 'string',
  apiDir: 'string',
  'options?': {
    'withProcessing?': 'boolean',
    'unique?': 'boolean',
    'handlersSubfolder?': 'boolean'
  }
});

function parseArgs(raw: unknown): ScaffoldArtifactInput {
  const parsed = ScaffoldArtifactArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ScaffoldArtifactInput = {
    artifact: parsed.artifact as ArtifactKind,
    name: parsed.name,
    componentDir: parsed.componentDir,
    apiDir: parsed.apiDir,
    options: parsed.options
  };
  return result;
}

// MARK: Path guard + idempotency
function ensureInsideCwd(relativePath: string, cwd: string): string {
  const absolute = resolve(cwd, relativePath);
  const cwdPrefix = cwd.endsWith(sep) ? cwd : cwd + sep;
  if (!absolute.startsWith(cwdPrefix) && absolute !== cwd) {
    throw new Error(`Path \`${relativePath}\` resolves outside the server cwd and is not allowed.`);
  }
  return absolute;
}

async function fileExists(absolutePath: string): Promise<boolean> {
  let exists = false;
  try {
    await access(absolutePath);
    exists = true;
  } catch {
    exists = false;
  }
  return exists;
}

// MARK: Handler
/**
 * Tool handler for `dbx_artifact_scaffold`. Validates the request, scaffolds
 * the requested artifact (writing files within the workspace), and reports
 * existing-file conflicts before any write happens.
 *
 * @param rawArgs - the unvalidated tool arguments object from the MCP runtime
 * @returns the scaffold report, or an error result when validation or write fails
 */
export async function runArtifactScaffold(rawArgs: unknown): Promise<ToolResult> {
  let input: ScaffoldArtifactInput;
  try {
    input = parseArgs(rawArgs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }

  const cwd = process.cwd();
  try {
    ensureInsideCwd(input.componentDir, cwd);
    ensureInsideCwd(input.apiDir, cwd);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }

  let raw;
  try {
    raw = scaffoldArtifact(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(`Scaffold failed: ${message}`);
  }

  const checked = await applyIdempotency(raw, (relativePath) => fileExists(resolve(cwd, relativePath)));
  const text = formatResult(checked);
  const result: ToolResult = {
    content: [{ type: 'text', text }]
  };
  return result;
}

export const artifactScaffoldTool: DbxTool = {
  definition: DBX_ARTIFACT_SCAFFOLD_TOOL,
  run: runArtifactScaffold
};
