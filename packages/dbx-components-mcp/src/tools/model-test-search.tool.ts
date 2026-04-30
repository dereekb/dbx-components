/**
 * `dbx_model_test_search` tool.
 *
 * Searches one `.spec.ts` file for nodes matching a single criterion:
 *
 * - `model` — every fixture call resolving to a given model name.
 * - `chain` — every fixture chain that contains a `>`-separated subsequence.
 * - `describe` — every `describe` whose title matches a substring.
 * - `it` — every `it`/`test` whose title matches a substring.
 *
 * Each hit is returned with the describe path and fixture chain leading to
 * the node — i.e. the data-setup chain a test sitting at that position
 * would inherit. Backed by the shared parser in `model-test-shared/`.
 */

import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { formatSearchAsJson, formatSearchAsMarkdown, inspectSpecFile, searchSpecTree, type SpecSearchQuery } from './model-test-shared/index.js';

const SearchArgsType = type({
  specFile: 'string',
  'apiDir?': 'string',
  'model?': 'string',
  'chain?': 'string',
  'describe?': 'string',
  'it?': 'string',
  'format?': "'markdown' | 'json'"
});

const TOOL: Tool = {
  name: 'dbx_model_test_search',
  description: [
    'Search one API `.spec.ts` file for `describe`s, `it`s, or `<prefix><Model>Context(...)` fixture calls matching a single criterion. Each hit is returned with the full describe path and fixture chain leading to it, plus its line range, so callers can jump straight to the right block.',
    '',
    'Provide exactly one of:',
    '- `model`: bare PascalCase model name (e.g. `Job`) — matches every `<prefix>JobContext(...)` site.',
    '- `chain`: `>`-separated model sequence (e.g. `Country > CountryState`) — matches every fixture chain containing the consecutive subsequence.',
    '- `describe`: case-insensitive substring against `describe(...)` titles.',
    '- `it`: case-insensitive substring against `it(...)` / `test(...)` titles.',
    '',
    'Plus:',
    '- `specFile`: relative path to the `.spec.ts` file.',
    '- `apiDir` (optional but recommended): enables authoritative prefix + fixture-name detection via `inspectAppFixtures()`.',
    '- `format` (optional): `markdown` (default) or `json`.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      specFile: { type: 'string', description: 'Relative path to the `.spec.ts` file.' },
      apiDir: { type: 'string', description: 'Optional relative path to the API app.' },
      model: { type: 'string', description: 'Bare PascalCase model name (e.g. `Job`).' },
      chain: { type: 'string', description: '`>`-separated chain (e.g. `Country > CountryState`).' },
      describe: { type: 'string', description: 'Substring match against describe titles.' },
      it: { type: 'string', description: 'Substring match against it/test titles.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['specFile']
  }
};

async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = SearchArgsType(rawArgs);
  if (parsed instanceof type.errors) {
    return toolError(`Invalid arguments: ${parsed.summary}`);
  }
  const queryFields = [
    { mode: 'model' as const, value: parsed.model },
    { mode: 'chain' as const, value: parsed.chain },
    { mode: 'describe' as const, value: parsed.describe },
    { mode: 'it' as const, value: parsed.it }
  ].filter((q) => q.value !== undefined && q.value !== '');
  if (queryFields.length === 0) {
    return toolError('Provide exactly one of `model`, `chain`, `describe`, or `it`.');
  }
  if (queryFields.length > 1) {
    return toolError(`Provide exactly one query field. Received: ${queryFields.map((q) => q.mode).join(', ')}.`);
  }
  const query: SpecSearchQuery = { mode: queryFields[0].mode, value: queryFields[0].value as string };

  const cwd = process.cwd();
  try {
    ensurePathInsideCwd(parsed.specFile, cwd);
    if (parsed.apiDir !== undefined) ensurePathInsideCwd(parsed.apiDir, cwd);
  } catch (err) {
    return toolError(err instanceof Error ? err.message : String(err));
  }
  const specAbs = resolve(cwd, parsed.specFile);
  const apiAbs = parsed.apiDir !== undefined ? resolve(cwd, parsed.apiDir) : undefined;
  let tree;
  try {
    tree = await inspectSpecFile({ specAbs, specRel: parsed.specFile, apiAbs, apiRel: parsed.apiDir });
  } catch (err) {
    return toolError(`Failed to read spec file: ${err instanceof Error ? err.message : String(err)}`);
  }
  const result = searchSpecTree(tree, query);
  const text = parsed.format === 'json' ? formatSearchAsJson(tree, result) : formatSearchAsMarkdown(tree, result);
  const out: ToolResult = { content: [{ type: 'text', text }] };
  return out;
}

export const modelTestSearchTool: DbxTool = { definition: TOOL, run };
