/**
 * `dbx_storagefile_m_validate_app` tool.
 *
 * Cross-file verifier for downstream app StorageFile configuration.
 * Reads the component package's `src/lib/model/storagefile/` and the
 * API app's `src/app/common/model/storagefile/` +
 * `src/app/common/model/notification/`, then asserts every declared
 * `StorageFilePurpose` is wired through the upload-service initializer
 * path AND, for purposes that declare processing subtasks, through
 * the storage-file processing handler.
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
import { formatResult, inspectAppStorageFiles, validateAppStorageFiles } from './storagefile-m-validate-app/index.js';

// MARK: Tool definition
const DBX_STORAGEFILE_M_VALIDATE_APP_TOOL: Tool = {
  name: 'dbx_storagefile_m_validate_app',
  description: [
    'Validate that every `StorageFilePurpose` declared in a `-firebase` component package is wired through the upload-service path in the API app: a paired `*_UPLOADED_FILE_TYPE_IDENTIFIER` constant, a `StorageFileInitializeFromUploadServiceInitializer` whose `type:` references it, the surrounding `storageFileInitializeFromUploadService({ initializer })` factory, and a NestJS provider with `provide: StorageFileInitializeFromUploadService, useFactory: <factory>`.',
    '',
    'For purposes that declare processing subtasks (a `<Foo>ProcessingSubtask` union alias and at least one `*_PROCESSING_SUBTASK` constant), the validator additionally verifies a `StorageFileProcessingPurposeSubtaskProcessorConfig` whose `target:` references the purpose, with a `flow:` array that covers every declared subtask, and that the surrounding `storageFileProcessingNotificationTaskHandler({ processors })` call exists.',
    '',
    'Cross-file tracing follows direct entries and spread (`...workerFileInitializers`) through every `.ts` file under `src/lib/model/storagefile/` on the component side and `src/app/common/model/storagefile/` + `src/app/common/model/notification/` on the API side.',
    '',
    'External identifiers imported from `@dereekb/*` are trusted — spreads and `type:` / `target:` references that resolve into upstream packages do not produce orphan/unresolved errors.',
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
export async function runStorageFileMValidateApp(rawArgs: unknown): Promise<ToolResult> {
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

  const inspection = await inspectAppStorageFiles(componentAbs, apiAbs);
  const validation = validateAppStorageFiles(inspection, { componentDir: args.componentDir, apiDir: args.apiDir });
  const text = formatResult(validation);
  const result: ToolResult = {
    content: [{ type: 'text', text }],
    isError: validation.errorCount > 0
  };
  return result;
}

export const storageFileMValidateAppTool: DbxTool = {
  definition: DBX_STORAGEFILE_M_VALIDATE_APP_TOOL,
  run: runStorageFileMValidateApp
};
