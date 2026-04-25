/**
 * `dbx_storagefile_model_validate_folder` tool.
 *
 * Validates that the `storagefile/` model folder layout on both the
 * component (`<componentDir>/src/lib/model/storagefile/`) and API
 * (`<apiDir>/src/app/common/model/storagefile/`) sides follows the
 * downstream convention. The API side must contain
 * `storagefile.upload.service.ts`, `storagefile.module.ts`, and
 * `storagefile.init.ts` at minimum. Any `.ts` file that does not start
 * with `storagefile.` (and is not `index.ts`) is flagged as a stray
 * filename. When a `handlers/` subfolder exists at the API root,
 * non-canonical files at root are flagged so handler logic stays
 * inside `handlers/`.
 *
 * Cross-file wiring (whether each declared StorageFilePurpose is
 * reachable from the upload service / processing handler) is checked
 * by the sibling `dbx_storagefile_model_validate_app` tool.
 *
 * Accepts two required inputs:
 *   - `componentDir`: relative path to the `-firebase` component package.
 *   - `apiDir`: relative path to the API app.
 *
 * Paths escaping the cwd are rejected.
 */

import { resolve, sep } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { formatResult, inspectStorageFileFolder, validateStorageFileFolder } from './storagefile-model-validate-folder/index.js';

// MARK: Tool definition
const DBX_STORAGEFILE_MODEL_VALIDATE_FOLDER_TOOL: Tool = {
  name: 'dbx_storagefile_model_validate_folder',
  description: [
    'Validate that the `storagefile/` model folder layout on both the component and API sides follows the downstream convention. The component-side folder lives at `<componentDir>/src/lib/model/storagefile/` and the API-side folder at `<apiDir>/src/app/common/model/storagefile/`.',
    '',
    'API-side required files (errors when missing): `storagefile.upload.service.ts`, `storagefile.module.ts`, `storagefile.init.ts`.',
    '',
    'Layout warnings cover: `.ts` files at the folder root that do not start with `storagefile.` (and are not `index.ts`); and non-canonical files at the API root when a sibling `handlers/` subfolder also exists (suggesting they should move into `handlers/`).',
    '',
    "Barrel rule (error): when an `index.ts` is present at either folder root, every `export * from './X'` clause must resolve locally — to either `./X.ts` or `./X/`.",
    '',
    'Cross-file wiring (whether every declared `StorageFilePurpose` is reachable from the upload service and processing handler) is verified by the sibling `dbx_storagefile_model_validate_app` tool and is not re-checked here.',
    '',
    'Provide both:',
    '- `componentDir`: relative path to the `-firebase` component package (e.g. `components/demo-firebase`).',
    '- `apiDir`: relative path to the API app (e.g. `apps/demo-api`).',
    '',
    'Paths escaping the server cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: {
        type: 'string',
        description: 'Relative path to the `-firebase` component package (e.g. `components/demo-firebase`).'
      },
      apiDir: {
        type: 'string',
        description: 'Relative path to the API app (e.g. `apps/demo-api`).'
      }
    },
    required: ['componentDir', 'apiDir']
  }
};

// MARK: Input validation
const ValidateArgsType = type({
  componentDir: 'string',
  apiDir: 'string'
});

interface ParsedArgs {
  readonly componentDir: string;
  readonly apiDir: string;
}

function parseArgs(raw: unknown): ParsedArgs {
  const parsed = ValidateArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedArgs = {
    componentDir: parsed.componentDir,
    apiDir: parsed.apiDir
  };
  return result;
}

// MARK: Path guard
function ensureInsideCwd(relativePath: string, cwd: string): string {
  const absolute = resolve(cwd, relativePath);
  const cwdPrefix = cwd.endsWith(sep) ? cwd : cwd + sep;
  if (!absolute.startsWith(cwdPrefix) && absolute !== cwd) {
    throw new Error(`Path \`${relativePath}\` resolves outside the server cwd and is not allowed.`);
  }
  return absolute;
}

// MARK: Handler
export async function runStorageFileModelValidateFolder(rawArgs: unknown): Promise<ToolResult> {
  let args: ParsedArgs;
  try {
    args = parseArgs(rawArgs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }

  const cwd = process.cwd();
  let componentAbs: string;
  let apiAbs: string;
  try {
    componentAbs = ensureInsideCwd(args.componentDir, cwd);
    apiAbs = ensureInsideCwd(args.apiDir, cwd);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }

  const inspection = await inspectStorageFileFolder({
    componentRootDir: componentAbs,
    componentRelDir: args.componentDir,
    apiRootDir: apiAbs,
    apiRelDir: args.apiDir
  });
  const validation = validateStorageFileFolder(inspection);
  const text = formatResult(validation);
  const result: ToolResult = {
    content: [{ type: 'text', text }],
    isError: validation.errorCount > 0
  };
  return result;
}

export const storageFileModelValidateFolderTool: DbxTool = {
  definition: DBX_STORAGEFILE_MODEL_VALIDATE_FOLDER_TOOL,
  run: runStorageFileModelValidateFolder
};
