/**
 * `dbx_file_convention` tool.
 *
 * Returns canonical file paths + required exports + wiring
 * registrations for a given artifact kind. Companion to the
 * cross-file validators (`dbx_validate_app_*`) — they detect missing
 * pieces, this tool says where each piece belongs.
 *
 * Pure data — no AST, no file I/O.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { formatSpec, getFileConventionSpec, listArtifactKinds, type ArtifactKind } from './file-convention/index.js';

const ARTIFACT_KINDS = listArtifactKinds();
const ARTIFACT_KIND_LITERAL_UNION = ARTIFACT_KINDS.map((k) => `'${k}'`).join(' | ');

// MARK: Tool definition
const DBX_FILE_CONVENTION_TOOL: Tool = {
  name: 'dbx_file_convention',
  description: [
    'Return canonical file paths + required exports + wiring registrations for a given artifact kind in a dbx-components project. Companion to the cross-file validators (`dbx_validate_app_notifications`, `dbx_validate_app_storagefiles`, `dbx_validate_firebase_model`) — those say what is missing, this says where each piece belongs.',
    '',
    `Supported artifact kinds: ${ARTIFACT_KINDS.map((k) => `\`${k}\``).join(', ')}.`,
    '',
    'Inputs:',
    '- `artifact`: required — the artifact kind to look up.',
    '- `componentDir` (optional): substitutes `<componentDir>` in path templates with the given relative path.',
    '- `apiDir` (optional): substitutes `<apiDir>` in path templates.',
    '- `name` (optional): substitutes `<name>` (kebab), `<camelName>`, `<Name>` (Pascal), `<NAME>` (SCREAMING_SNAKE) variants in path templates and required-export names. Accepts kebab, camel, Pascal, or screaming-snake input — the tool normalizes via word splitting.',
    '',
    'When optional inputs are omitted, paths render with the literal placeholder tokens (e.g. `<componentDir>/src/lib/model/storagefile/storagefile.<name>.ts`) so the consumer can substitute their own values.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      artifact: {
        type: 'string',
        enum: [...ARTIFACT_KINDS],
        description: 'The artifact kind to look up.'
      },
      componentDir: { type: 'string', description: 'Optional. Substitutes `<componentDir>` in path templates.' },
      apiDir: { type: 'string', description: 'Optional. Substitutes `<apiDir>` in path templates.' },
      name: { type: 'string', description: 'Optional. Substitutes `<name>`/`<camelName>`/`<Name>`/`<NAME>` in path templates and required-export names.' }
    },
    required: ['artifact']
  }
};

// MARK: Input validation
const FileConventionArgsType = type({
  artifact: ARTIFACT_KIND_LITERAL_UNION,
  'componentDir?': 'string',
  'apiDir?': 'string',
  'name?': 'string'
});

interface ParsedArgs {
  readonly artifact: ArtifactKind;
  readonly componentDir: string | undefined;
  readonly apiDir: string | undefined;
  readonly name: string | undefined;
}

function parseArgs(raw: unknown): ParsedArgs {
  const parsed = FileConventionArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedArgs = {
    artifact: parsed.artifact as ArtifactKind,
    componentDir: parsed.componentDir,
    apiDir: parsed.apiDir,
    name: parsed.name
  };
  return result;
}

// MARK: Handler
export function runFileConvention(rawArgs: unknown): ToolResult {
  let args: ParsedArgs;
  try {
    args = parseArgs(rawArgs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }
  const spec = getFileConventionSpec(args.artifact);
  if (!spec) {
    return toolError(`Unknown artifact kind: \`${args.artifact}\`. Known: ${ARTIFACT_KINDS.join(', ')}.`);
  }
  const text = formatSpec(spec, { componentDir: args.componentDir, apiDir: args.apiDir, name: args.name });
  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const fileConventionTool: DbxTool = {
  definition: DBX_FILE_CONVENTION_TOOL,
  run: runFileConvention
};
