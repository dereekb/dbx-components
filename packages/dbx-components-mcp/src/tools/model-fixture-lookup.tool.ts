/**
 * `dbx_model_fixture_lookup` tool.
 *
 * Returns a per-model report for one `<Prefix><Model>TestContext{Fixture,Instance,Params}`
 * triplet declared in `<apiDir>/src/test/fixture.ts`: archetype, generics,
 * factory call shape, Params dependency edges, and the full method tables for
 * both Fixture and Instance with forwarding status.
 *
 * Backed by the same `inspectAppFixtures()` parse used by `list_app` and
 * `validate_app` so the three tools speak from one source of truth.
 */

import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { formatLookupAsJson, formatLookupAsMarkdown, inspectAppFixtures } from '@dereekb/dbx-cli/model-test';

const LookupArgsType = type({
  apiDir: 'string',
  'model?': 'string',
  'identity?': 'string',
  'format?': "'markdown' | 'json'"
});

const TOOL: Tool = {
  name: 'dbx_model_fixture_lookup',
  description: [
    'Look up one fixture/instance triplet declared in `<apiDir>/src/test/fixture.ts`. Returns the archetype, generic args, Params shape with dependency edges, factory + singleton names, and full method tables for both Fixture and Instance with forwarding status.',
    '',
    'Provide one of:',
    '- `model`: bare model name with the workspace prefix stripped (e.g. `StorageFile`, `Profile`).',
    '- `identity`: the `firestoreModelIdentity` const string (e.g. `profileIdentity`). Resolves to the matching fixture by camel-stem.',
    '',
    'Plus:',
    '- `apiDir`: relative path to the API app (e.g. `apps/demo-api`).',
    '- `format` (optional): `markdown` (default) or `json`.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      apiDir: { type: 'string', description: 'Relative path to the API app.' },
      model: { type: 'string', description: 'Bare model name (e.g. `StorageFile`).' },
      identity: { type: 'string', description: 'Identity const string (e.g. `profileIdentity`). Alternative to `model`.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['apiDir']
  }
};

async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = LookupArgsType(rawArgs);
  if (parsed instanceof type.errors) {
    return toolError(`Invalid arguments: ${parsed.summary}`);
  }
  if (!parsed.model && !parsed.identity) {
    return toolError('Provide either `model` (PascalCase model name) or `identity` (the `<camelName>Identity` const string).');
  }
  const cwd = process.cwd();
  const ensureError = runEnsurePathInsideCwd(parsed.apiDir, cwd);
  let result: ToolResult;
  if (ensureError !== undefined) {
    result = toolError(ensureError);
  } else {
    const apiAbs = resolve(cwd, parsed.apiDir);
    const inspection = await inspectFixturesSafe(apiAbs, parsed.apiDir);
    if (inspection.kind === 'error') {
      result = toolError(inspection.message);
    } else {
      result = formatFixtureLookupResult({
        extraction: inspection.extraction,
        model: parsed.model,
        identity: parsed.identity,
        format: parsed.format
      });
    }
  }
  return result;
}

function runEnsurePathInsideCwd(apiDir: string, cwd: string): string | undefined {
  let error: string | undefined;
  try {
    ensurePathInsideCwd(apiDir, cwd);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  return error;
}

type FixtureInspection = { readonly kind: 'ok'; readonly extraction: Awaited<ReturnType<typeof inspectAppFixtures>> } | { readonly kind: 'error'; readonly message: string };

async function inspectFixturesSafe(apiAbs: string, apiDir: string): Promise<FixtureInspection> {
  let inspection: FixtureInspection;
  try {
    const extraction = await inspectAppFixtures(apiAbs, apiDir);
    inspection = { kind: 'ok', extraction };
  } catch (err) {
    inspection = { kind: 'error', message: `Failed to read fixture file: ${err instanceof Error ? err.message : String(err)}` };
  }
  return inspection;
}

interface FormatFixtureLookupInput {
  readonly extraction: Awaited<ReturnType<typeof inspectAppFixtures>>;
  readonly model: string | undefined;
  readonly identity: string | undefined;
  readonly format: 'markdown' | 'json' | undefined;
}

function formatFixtureLookupResult(input: FormatFixtureLookupInput): ToolResult {
  const { extraction, model, identity, format } = input;
  const lookupModel = model ?? identityToModel(identity as string);
  const entry = extraction.entries.find((e) => e.model === lookupModel);
  let result: ToolResult;
  if (entry) {
    const text = format === 'json' ? formatLookupAsJson(extraction, entry) : formatLookupAsMarkdown(extraction, entry);
    result = { content: [{ type: 'text', text }] };
  } else {
    const known = extraction.entries.map((e) => e.model).join(', ') || '(none)';
    const usedIdentity = identity && !model ? ` (resolved \`identity="${identity}"\` → \`${lookupModel}\`)` : '';
    result = toolError(`Model \`${lookupModel}\` not found in \`${extraction.fixturePath}\`${usedIdentity}. Known: ${known}.`);
  }
  return result;
}

/**
 * Maps a `firestoreModelIdentity` const name to the bare PascalCase
 * model name used as the fixture entry key. Strips the trailing
 * `Identity` suffix (case-insensitive) and PascalCases the remainder.
 *
 * @param identity - The identity const string (e.g. `profileIdentity`)
 * @returns The bare PascalCase model name (e.g. `Profile`)
 */
function identityToModel(identity: string): string {
  const stem = identity.replace(/Identity$/i, '');
  if (stem.length === 0) return identity;
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

export const MODEL_FIXTURE_LOOKUP_TOOL: DbxTool = { definition: TOOL, run };
