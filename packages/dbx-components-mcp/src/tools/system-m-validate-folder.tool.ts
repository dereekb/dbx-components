/**
 * `dbx_system_m_validate_folder` tool.
 *
 * Validates that one or more `system/` model folders follow the
 * downstream convention. At the folder level: `system.ts` and `index.ts`
 * are required; `system.action.ts` and `system.api.ts` are optional;
 * `system.id.ts` and `system.query.ts` are disallowed. Inside
 * `system.ts`, every `<NAME>_SYSTEM_STATE_TYPE` constant must be paired
 * with an interface `<Foo>SystemData extends SystemStateStoredData` and
 * a converter `<foo>SystemDataConverter` typed
 * `SystemStateStoredDataFieldConverterConfig<<Foo>SystemData>`; the file
 * must end with the aggregate `<app>SystemStateStoredDataConverterMap`
 * whose keys reference each declared type constant.
 *
 * Stray `.ts` files that don't start with `system.` and aren't
 * `index.ts` emit a warning, mirroring `dbx_validate_model_folder`.
 *
 * Accepts two interchangeable input forms (at least one required):
 *   - `paths`: relative folder paths resolved against cwd.
 *   - `glob`: a single glob pattern expanded via `node:fs/promises`;
 *     non-directory matches are filtered out automatically.
 */

import { glob as fsGlob, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { formatResult, inspectFolder, validateSystemFolders, type SystemFolderInspection } from './system-m-validate-folder/index.js';

// MARK: Tool definition
const DBX_SYSTEM_M_VALIDATE_FOLDER_TOOL: Tool = {
  name: 'dbx_system_m_validate_folder',
  description: [
    'Validate that one or more `system/` model folders follow the downstream convention. Each folder must contain `system.ts` and `index.ts` at minimum; `system.action.ts` and `system.api.ts` are optional; `system.id.ts` and `system.query.ts` are disallowed.',
    '',
    'Inside `system.ts`, every `<NAME>_SYSTEM_STATE_TYPE` constant must be paired with an interface `<Foo>SystemData extends SystemStateStoredData` and a converter `<foo>SystemDataConverter` typed `SystemStateStoredDataFieldConverterConfig<<Foo>SystemData>`. The file must end with an aggregate `<app>SystemStateStoredDataConverterMap` whose keys reference each declared type constant.',
    '',
    'Warnings cover: stray `.ts` files at the folder root that do not start with `system.`, converter-map ordering (should be the last top-level export), and bare or unknown identifiers used as converter-map keys.',
    '',
    'Always runs in downstream mode — the base `@dereekb/firebase` system folder ships machinery (`systemStateIdentity`, `SystemStateDocument`, etc.) rather than state-type triples and should not be validated with this tool.',
    '',
    'Provide at least one of:',
    '- `paths`: array of folder paths (relative to the server cwd).',
    '- `glob`: a glob pattern resolved against the server cwd (e.g. `components/foo-firebase/src/lib/model/system`). Non-directory matches are skipped.',
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
async function resolveFolderPaths(args: ParsedArgs, cwd: string): Promise<readonly string[]> {
  const collected: string[] = [];
  const seen = new Set<string>();
  const cwdPrefix = cwd.endsWith(sep) ? cwd : cwd + sep;

  const accept = (relative: string): void => {
    if (seen.has(relative)) return;
    const absolute = resolve(cwd, relative);
    if (!absolute.startsWith(cwdPrefix) && absolute !== cwd) {
      throw new Error(`Path \`${relative}\` resolves outside the server cwd and is not allowed.`);
    }
    seen.add(relative);
    collected.push(relative);
  };

  if (args.paths) {
    for (const p of args.paths) {
      accept(p);
    }
  }
  if (args.glob) {
    for await (const match of fsGlob(args.glob, { cwd })) {
      const absolute = resolve(cwd, match);
      try {
        const stats = await stat(absolute);
        if (!stats.isDirectory()) continue;
      } catch {
        continue;
      }
      accept(match);
    }
  }

  return collected;
}

async function buildInspections(paths: readonly string[], cwd: string): Promise<readonly SystemFolderInspection[]> {
  const out: SystemFolderInspection[] = [];
  for (const relative of paths) {
    const absolute = resolve(cwd, relative);
    const inspection = await inspectFolder(absolute);
    const relativized: SystemFolderInspection = { ...inspection, path: relative };
    out.push(relativized);
  }
  return out;
}

// MARK: Handler
export async function runSystemMValidateFolder(rawArgs: unknown): Promise<ToolResult> {
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
    paths = await resolveFolderPaths(args, process.cwd());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(`Failed to resolve folder paths: ${message}`);
  }

  if (paths.length === 0) {
    return toolError('No matching folders found.');
  }

  let inspections: readonly SystemFolderInspection[];
  try {
    inspections = await buildInspections(paths, process.cwd());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(`Failed to read folders: ${message}`);
  }

  const validation = validateSystemFolders(inspections);
  const text = formatResult(validation);
  const result: ToolResult = {
    content: [{ type: 'text', text }],
    isError: validation.errorCount > 0
  };
  return result;
}

export const systemMValidateFolderTool: DbxTool = {
  definition: DBX_SYSTEM_M_VALIDATE_FOLDER_TOOL,
  run: runSystemMValidateFolder
};
