/**
 * `dbx_model_validate_folder` tool.
 *
 * Validates that one or more model folders follow the canonical layout:
 * every folder must contain `<name>.ts`, `<name>.id.ts`,
 * `<name>.query.ts`, `<name>.action.ts`, `<name>.api.ts`, and
 * `index.ts`. Stray `.ts` files at the folder root that don't start
 * with `<name>.` trigger a warning.
 *
 * Reserved folder names — `system/`, `notification/`, `storagefile/` —
 * emit a warning naming the dedicated validator to use instead and
 * skip structural checks. `system/` is covered by
 * `dbx_system_m_validate_folder`; `notification/` and `storagefile/` are
 * imported from `@dereekb/firebase` and downstream folders extend the
 * canonical group rather than redeclaring it.
 *
 * Accepts two interchangeable input forms (at least one required):
 *   - `paths`: relative folder paths resolved against cwd.
 *   - `glob`: a single glob pattern expanded via `node:fs/promises`;
 *     non-directory matches are filtered out automatically.
 */

import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { resolveFolderPaths } from './validate-input.js';
import { formatResult, inspectFolder, validateModelFolders, type FolderInspection } from './model-validate-folder/index.js';

// MARK: Tool definition
const DBX_MODEL_VALIDATE_FOLDER_TOOL: Tool = {
  name: 'dbx_model_validate_folder',
  description: [
    'Validate that one or more model folders follow the canonical layout. Each folder named `<name>/` must contain `<name>.ts`, `<name>.id.ts`, `<name>.query.ts`, `<name>.action.ts`, `<name>.api.ts`, and `index.ts`. Missing files are hard errors.',
    '',
    'Warnings cover: stray `.ts` files at the folder root that do not start with `<name>.` (they should be grouped under the model prefix), and reserved folder names (`system/`, `notification/`, `storagefile/`) that have dedicated validators and are skipped here.',
    '',
    'Provide at least one of:',
    '- `paths`: array of folder paths (relative to the server cwd).',
    '- `glob`: a glob pattern resolved against the server cwd (e.g. `packages/foo/src/lib/model/*`). Non-directory matches are skipped.',
    '',
    'Paths escaping the cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      paths: {
        type: 'array',
        description: 'Folder paths (relative to server cwd) to validate.',
        items: { type: 'string' }
      },
      glob: {
        type: 'string',
        description: 'Single glob pattern to expand against the server cwd. Non-directory matches are filtered out.'
      }
    }
  }
};

// MARK: Input validation
const ValidateArgsType = type({
  'paths?': 'string[]',
  'glob?': 'string'
});

interface ParsedArgs {
  readonly paths: readonly string[] | undefined;
  readonly glob: string | undefined;
}

function parseArgs(raw: unknown): ParsedArgs {
  const parsed = ValidateArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedArgs = {
    paths: parsed.paths,
    glob: parsed.glob
  };
  return result;
}

// MARK: Path resolution
async function buildInspections(paths: readonly string[], cwd: string): Promise<readonly FolderInspection[]> {
  const out: FolderInspection[] = [];
  for (const relative of paths) {
    const absolute = resolve(cwd, relative);
    const inspection = await inspectFolder(absolute);
    const relativized: FolderInspection = { ...inspection, path: relative };
    out.push(relativized);
  }
  return out;
}

// MARK: Handler
/**
 * Tool handler for `dbx_validate_app_models_folder`. Walks the resolved
 * components directory and reports per-folder structural deviations from the
 * expected model layout.
 *
 * @param rawArgs - the unvalidated tool arguments from the MCP runtime
 * @returns the formatted folder report, or an error result when args fail validation
 */
export async function runModelValidateFolder(rawArgs: unknown): Promise<ToolResult> {
  let args: ParsedArgs;
  try {
    args = parseArgs(rawArgs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }

  const hasAny = (args.paths && args.paths.length > 0) || args.glob;
  if (!hasAny) {
    return toolError('Must provide at least one of `paths` or `glob`.');
  }

  let paths: readonly string[];
  try {
    paths = await resolveFolderPaths({ paths: args.paths, glob: args.glob, cwd: process.cwd() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(`Failed to resolve folder paths: ${message}`);
  }

  if (paths.length === 0) {
    return toolError('No matching folders found.');
  }

  let inspections: readonly FolderInspection[];
  try {
    inspections = await buildInspections(paths, process.cwd());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(`Failed to read folders: ${message}`);
  }

  const validation = validateModelFolders(inspections);
  const text = formatResult(validation);
  const result: ToolResult = {
    content: [{ type: 'text', text }],
    isError: validation.errorCount > 0
  };
  return result;
}

export const modelValidateFolderTool: DbxTool = {
  definition: DBX_MODEL_VALIDATE_FOLDER_TOOL,
  run: runModelValidateFolder
};
