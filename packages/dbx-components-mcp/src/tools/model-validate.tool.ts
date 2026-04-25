/**
 * `dbx_model_validate` tool.
 *
 * Validates that a @dereekb/firebase model file follows the workspace's
 * model-group convention: a `<Group>FirestoreCollections` interface and
 * `<Group>Types` union declared before the first model, and each model
 * anchored on a `firestoreModelIdentity(...)` call with the canonical
 * ordered set of declarations (identity, interface, roles, document class,
 * converter, reference fn, collection type, collection fn — plus the
 * single-item factory and collection-group triple for subcollections).
 *
 * Accepts three interchangeable input forms (at least one required):
 *   - `sources`: `{ name, text }[]` — file contents supplied by the caller.
 *   - `paths`: relative file paths resolved against cwd.
 *   - `glob`: a single glob pattern expanded via `node:fs/promises` (Node 24+).
 *
 * Returns a markdown report with all violations grouped by file and model.
 */

import { glob as fsGlob, readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { formatResult, validateFirebaseModelSources, type ValidatorSource } from './model-validate/index.js';

// MARK: Tool definition
const DBX_MODEL_VALIDATE_TOOL: Tool = {
  name: 'dbx_model_validate',
  description: [
    'Validate a @dereekb/firebase model file against the workspace model-group convention. Checks that the file exports a `<Group>FirestoreCollections` interface and `<Group>Types` union, and that every `firestoreModelIdentity(...)` has the canonical declarations in order (interface, roles, document class, converter, collection reference fn, collection type, collection fn) — plus the factory-type + collection-group triple for subcollections. All reported issues are hard errors.',
    '',
    'Provide at least one of:',
    '- `sources`: array of `{ name, text }` — file contents supplied directly.',
    '- `paths`: array of file paths (relative to the server cwd).',
    '- `glob`: a glob pattern resolved against the server cwd (e.g. `packages/foo/src/lib/model/**/*.ts`).',
    '',
    'Paths escaping the cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      sources: {
        type: 'array',
        description: 'File contents to validate directly.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Display name (used in violation messages).' },
            text: { type: 'string', description: 'Full TypeScript source text.' }
          },
          required: ['name', 'text']
        }
      },
      paths: {
        type: 'array',
        description: 'File paths (relative to server cwd) to read and validate.',
        items: { type: 'string' }
      },
      glob: {
        type: 'string',
        description: 'Single glob pattern to expand against the server cwd.'
      }
    }
  }
};

// MARK: Input validation
const ValidateArgsType = type({
  'sources?': type({ name: 'string', text: 'string' }).array(),
  'paths?': 'string[]',
  'glob?': 'string'
});

interface ParsedArgs {
  readonly sources: readonly ValidatorSource[] | undefined;
  readonly paths: readonly string[] | undefined;
  readonly glob: string | undefined;
}

function parseArgs(raw: unknown): ParsedArgs {
  const parsed = ValidateArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedArgs = {
    sources: parsed.sources,
    paths: parsed.paths,
    glob: parsed.glob
  };
  return result;
}

// MARK: Source resolution
async function resolveSources(args: ParsedArgs, cwd: string): Promise<readonly ValidatorSource[]> {
  const collected: ValidatorSource[] = [];
  const seenNames = new Set<string>();

  if (args.sources) {
    for (const src of args.sources) {
      if (seenNames.has(src.name)) continue;
      seenNames.add(src.name);
      collected.push(src);
    }
  }

  const pathList: string[] = [];
  if (args.paths) {
    for (const p of args.paths) {
      pathList.push(p);
    }
  }
  if (args.glob) {
    for await (const match of fsGlob(args.glob, { cwd })) {
      pathList.push(match);
    }
  }

  for (const relative of pathList) {
    if (seenNames.has(relative)) continue;
    const absolute = resolve(cwd, relative);
    const cwdPrefix = cwd.endsWith(sep) ? cwd : cwd + sep;
    if (!absolute.startsWith(cwdPrefix) && absolute !== cwd) {
      throw new Error(`Path \`${relative}\` resolves outside the server cwd and is not allowed.`);
    }
    const text = await readFile(absolute, 'utf8');
    seenNames.add(relative);
    collected.push({ name: relative, text });
  }

  return collected;
}

// MARK: Handler
export async function runModelValidate(rawArgs: unknown): Promise<ToolResult> {
  let args: ParsedArgs;
  try {
    args = parseArgs(rawArgs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }

  const hasAny = (args.sources && args.sources.length > 0) || (args.paths && args.paths.length > 0) || args.glob;
  if (!hasAny) {
    return toolError('Must provide at least one of `sources`, `paths`, or `glob`.');
  }

  let sources: readonly ValidatorSource[];
  try {
    sources = await resolveSources(args, process.cwd());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(`Failed to read sources: ${message}`);
  }

  if (sources.length === 0) {
    return toolError('No matching source files found.');
  }

  const validation = validateFirebaseModelSources(sources);
  const text = formatResult(validation);
  const result: ToolResult = {
    content: [{ type: 'text', text }],
    isError: validation.errorCount > 0
  };
  return result;
}

export const modelValidateTool: DbxTool = {
  definition: DBX_MODEL_VALIDATE_TOOL,
  run: runModelValidate
};
