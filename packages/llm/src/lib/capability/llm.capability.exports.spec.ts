import { describe, expect, it } from 'vitest';
import * as barrel from './index';

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
  'makeLlmReplyFastFixer',
  'makeLlmSemanticCritic',
  'projectLlmContractSchema',
  'projectLlmResponseSchema',
  'resolveLlmCritiqueFields'
];

describe('capability exports', () => {
  it('exports exactly the documented runtime surface', () => {
    const exported = Object.keys(barrel).sort();
    expect(exported).toEqual(LLM_CAPABILITY_RUNTIME_EXPORTS);
  });

  it('does not export the capability internals', () => {
    const internals = ['llmCritiqueOutcomeSchema', 'parseLlmCritiqueOutcomeValue', 'renderLlmCritiqueContext', 'llmRepairReplyJsonSchema', 'parseLlmRepairReplyJsonValue', 'renderLlmRepairReplyJsonContext'];
    expect(internals.filter((name) => name in barrel)).toEqual([]);
  });
});
