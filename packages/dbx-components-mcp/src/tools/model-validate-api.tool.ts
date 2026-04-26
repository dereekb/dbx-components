/**
 * `dbx_model_validate_api` tool.
 *
 * Validates that a `<model>.api.ts` file follows the workspace's CRUD
 * model-api convention: one or more exported `*Params` / `*Result`
 * interfaces paired with Arktype validators, followed by the Functions
 * block — `<Group>FunctionTypeMap`, `<group>FunctionTypeConfigMap`,
 * `<Group>ModelCrudFunctionsConfig` (type + const), `<group>FunctionMap`,
 * and the `<Group>Functions` abstract class.
 *
 * Accepts three interchangeable input forms (at least one required):
 *   - `sources`: `{ name, text }[]` — file contents supplied by the caller.
 *   - `paths`: relative file paths resolved against cwd.
 *   - `glob`: a single glob pattern expanded via `node:fs/promises` (Node 24+).
 *
 * Returns a markdown report with all violations grouped by file and model
 * group. Hard errors fail the tool call; warnings flag convention
 * deviations (ordering, readonly fields, `Maybe<T>` without
 * `clearable(...)`, missing `[Params, Result]` tuple form, missing
 * `// MARK:` markers).
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type DbxTool } from './types.js';
import { createSourceValidateTool } from './validate-tool.js';
import { formatResult, validateModelApiSources } from './model-validate-api/index.js';

// MARK: Tool definition
const DBX_MODEL_VALIDATE_API_TOOL: Tool = {
  name: 'dbx_model_validate_api',
  description: [
    'Validate a `<model>.api.ts` file against the workspace CRUD model-api convention. Checks that every `*Params` interface has a matching `*ParamsType` Arktype validator (with the correct `as Type<...>` cast), and that the Functions block at the bottom declares the six required exports in the canonical order: `<Group>FunctionTypeMap` → `<group>FunctionTypeConfigMap` → `<Group>ModelCrudFunctionsConfig` → `<group>ModelCrudFunctionsConfig` → `<group>FunctionMap` → `<Group>Functions` abstract class.',
    '',
    'Warnings cover: readonly fields, `Maybe<T>` fields without `clearable(...)` in the validator, missing `[Params, Result]` tuple form in the CRUD config when a matching `*Result` interface exists, missing `// MARK: Constants/Keys/Functions` section markers, validators not adjacent to their paired interfaces, and declarations appearing after the Functions block.',
    '',
    'Files whose basename is conventionally non-CRUD (e.g. `development.api.ts`) emit a tool-level warning and skip structural validation. Files without a `callModelFirebaseFunctionMapFactory(...)` call are skipped silently.',
    '',
    'Provide at least one of:',
    '- `sources`: array of `{ name, text }` — file contents supplied directly.',
    '- `paths`: array of file paths (relative to the server cwd).',
    '- `glob`: a glob pattern resolved against the server cwd (e.g. `packages/foo/src/lib/model/**/*.api.ts`).',
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

export const modelValidateApiTool: DbxTool = createSourceValidateTool({
  definition: DBX_MODEL_VALIDATE_API_TOOL,
  validate: validateModelApiSources,
  format: formatResult
});
