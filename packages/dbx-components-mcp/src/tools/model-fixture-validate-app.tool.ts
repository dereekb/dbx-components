/**
 * `dbx_model_fixture_validate_app` tool.
 *
 * Validates `<apiDir>/src/test/fixture.ts` and reports the union of:
 *
 * - **Forwarding completeness** — every public Instance method is forwarded
 *   by a matching Fixture method (signatures aligned).
 * - **Triplet completeness** — Fixture / Instance / Params / factory /
 *   singleton are all present per model.
 * - **Generic alignment** — Model / Document generics match across
 *   Fixture, Instance, and the factory call.
 * - **Archetype consistency** — sub-collection wiring requires a parent
 *   fixture field on the Params type.
 * - **Parent-fixture field naming** — when the validator is given a model
 *   registry, parent fixture fields must equal the parent model's
 *   firestoreModelIdentity short alias (e.g. `sg` for `SchoolGroup`).
 * - **Registry cross-reference** — surfaces fixtures whose model isn't in
 *   the registry, and registry models without a fixture.
 *
 * Built via {@link createModelFixtureValidateAppTool} so the validator can
 * be wired with or without a registry by the central dispatcher.
 */

import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { formatValidationAsJson, formatValidationAsMarkdown, inspectAppFixtures, validateAppFixtures, type FixtureModelRegistry } from './model-fixture-shared/index.js';

const ValidateArgsType = type({
  apiDir: 'string',
  'format?': "'markdown' | 'json'"
});

const TOOL: Tool = {
  name: 'dbx_model_fixture_validate_app',
  description: [
    "Validate every `<Prefix><Model>TestContext{Fixture,Instance,Params}` triplet in a downstream API app's `src/test/fixture.ts`.",
    '',
    'Diagnostics emitted:',
    '- `forwarder-missing` / `forwarder-divergent`: every public Instance method must have a Fixture forwarder with a matching signature.',
    '- `triplet-incomplete`: Fixture, Instance, Params, factory, and singleton must all be present per model.',
    '- `generics-misaligned`: Model and Document generics must agree across Fixture, Instance, and factory call.',
    '- `archetype-inconsistent`: sub-collection wiring requires a matching parent fixture field on the Params type.',
    "- `params-field-naming`: parent fixture field names must equal the parent model's firestoreModelIdentity short alias (when a model registry is configured).",
    '- `model-not-in-registry` / `model-without-fixture`: registry cross-reference (when a model registry is configured).',
    '',
    'Provide:',
    '- `apiDir`: relative path to the API app.',
    '- `format` (optional): `markdown` (default) or `json`.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      apiDir: { type: 'string', description: 'Relative path to the API app.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['apiDir']
  }
};

/**
 * Configuration accepted by {@link createModelFixtureValidateAppTool}. The
 * dispatcher wires the registry callable so the same tool definition can run
 * with or without registry-backed cross-reference rules.
 */
export interface CreateModelFixtureValidateAppToolConfig {
  /**
   * Returns a {@link FixtureModelRegistry} to enable parent-field-naming and
   * registry cross-reference rules. When omitted (or returns `undefined`),
   * those rules are skipped.
   */
  readonly getRegistry?: () => FixtureModelRegistry | undefined;
}

/**
 * Builds the `dbx_model_fixture_validate_app` tool. Centralised here so the
 * dispatcher can lazily inject a model registry from `RegisterToolsOptions`.
 *
 * @param config - registry configuration
 * @returns the registered {@link DbxTool}
 */
export function createModelFixtureValidateAppTool(config: CreateModelFixtureValidateAppToolConfig = {}): DbxTool {
  async function run(rawArgs: unknown): Promise<ToolResult> {
    const parsed = ValidateArgsType(rawArgs);
    if (parsed instanceof type.errors) {
      return toolError(`Invalid arguments: ${parsed.summary}`);
    }
    const cwd = process.cwd();
    try {
      ensurePathInsideCwd(parsed.apiDir, cwd);
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err));
    }
    const apiAbs = resolve(cwd, parsed.apiDir);
    let extraction;
    try {
      extraction = await inspectAppFixtures(apiAbs, parsed.apiDir);
    } catch (err) {
      return toolError(`Failed to read fixture file: ${err instanceof Error ? err.message : String(err)}`);
    }
    const registry = config.getRegistry ? config.getRegistry() : undefined;
    const result = validateAppFixtures(extraction, { registry });
    const text = parsed.format === 'json' ? formatValidationAsJson(result) : formatValidationAsMarkdown(result);
    const toolResult: ToolResult = {
      content: [{ type: 'text', text }],
      isError: result.errorCount > 0
    };
    return toolResult;
  }
  return { definition: TOOL, run };
}
