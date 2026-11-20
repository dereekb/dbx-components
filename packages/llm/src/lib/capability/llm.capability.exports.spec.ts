import { describe, expect, it } from 'vitest';

/**
 * Pins the capability barrel's runtime exports. The library capabilities' own schemas, value parsers and live-context
 * renderers are internal (specs import them by path), so a new public capability export is a deliberate edit to
 * `index.ts` and to this list.
 */
const LLM_CAPABILITY_RUNTIME_EXPORTS: readonly string[] = [
  'DEFAULT_LLM_CRITIQUE_REPLY_INSTRUCTIONS',
  'DEFAULT_LLM_REPAIR_REPLY_JSON_INSTRUCTIONS',
  'LLM_CRITIQUE_ERROR_DIAG_CODE',
  'LLM_CRITIQUE_REPLY_DESCRIPTOR',
  'LLM_CRITIQUE_REPLY_JUDGE_SWALLOW_SITE',
  'LLM_CRITIQUE_REPLY_MAX_OUTPUT_TOKENS',
  'LLM_CRITIQUE_REPLY_TEMPLATE',
  'LLM_CRITIQUE_UNUSABLE_DIAG_CODE',
  'LLM_REPAIR_REPLY_JSON_DESCRIPTOR',
  'LLM_REPAIR_REPLY_JSON_MAX_OUTPUT_TOKENS',
  'LLM_REPAIR_REPLY_JSON_TEMPLATE',
  'LLM_REPLY_REPAIR_FAST_FIX_SWALLOW_SITE',
  'critiqueLlmReply',
  'defineLlmCapability',
  'hardenLlmResponseSchemaHint',
  'llmCriticFor',
  'makeLlmReplyFastFixer',
  'makeLlmSemanticCritic',
  'projectLlmContractSchema',
  'projectLlmResponseSchema'
];

describe('capability exports', () => {
  it('exports exactly the documented runtime surface', async () => {
    const exported = Object.keys(await import('./index')).sort();
    expect(exported).toEqual(LLM_CAPABILITY_RUNTIME_EXPORTS);
  });

  it('does not export the capability internals', async () => {
    const barrel: Record<string, unknown> = await import('./index');
    const internals = ['llmCritiqueOutcomeSchema', 'parseLlmCritiqueOutcomeLever', 'renderLlmCritiqueContext', 'llmRepairReplyJsonSchema', 'parseLlmRepairReplyJsonLever', 'renderLlmRepairReplyJsonContext'];
    expect(internals.filter((name) => name in barrel)).toEqual([]);
  });
});
