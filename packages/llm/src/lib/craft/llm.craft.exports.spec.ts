import { describe, expect, it } from 'vitest';
import * as barrel from './index';

/**
 * Pins the craft barrel's runtime exports — the `@dereekb/llm/craft` entry's API. The judge's internals (its input,
 * question keys, declared decision, verdict reader and stamp) stay module exports for the specs, off the barrel: a host
 * builds a judge with `makeLlmCraftJudge` and never composes one from parts. A new public craft export is a deliberate
 * edit to `index.ts` and to this list.
 */
const LLM_CRAFT_RUNTIME_EXPORTS: readonly string[] = [
  'DEFAULT_LLM_CRAFT_GUARD_CUT_REASON',
  'DEFAULT_LLM_CRAFT_JUDGE_FLOOR',
  'DEFAULT_LLM_CRAFT_NOTE_HEADINGS',
  'DEFAULT_LLM_CRAFT_NOTE_MAX_CHARS',
  'DEFAULT_LLM_CRAFT_NOTE_PRIORITY',
  'DEFAULT_LLM_CRAFT_SITE_LIMITS',
  'DEFAULT_LLM_CRAFT_SLOT_ID',
  'LLM_CRAFT_CONTRIBUTOR_ID',
  'LLM_CRAFT_HEADING_GENERATOR',
  'LLM_CRAFT_JUDGE_DECIDE_SWALLOW_SITE',
  'LLM_CRAFT_NOTE_CUT_REASONS',
  'LLM_CRAFT_NOTE_GROUPS',
  'LLM_CRAFT_NOTE_ID_PATTERN',
  'LLM_CRAFT_NOTE_INVALID_DIAG_CODE',
  'LLM_CRAFT_NOTE_MAX_PRIORITY',
  'LLM_CRAFT_NOTE_SELECTED_BY',
  'LLM_CRAFT_NOTE_SELECT_DECISION_ID',
  'LLM_CRAFT_NOTE_UNSERVED_POSTURES',
  'LLM_CRAFT_SITE_INPUT_NAME_PATTERN',
  'compareLlmCraftNotes',
  'isLlmCraftNoteKept',
  'llmCraftNoteFrontmatterSchema',
  'llmCraftNoteMatchesSite',
  'llmCraftNoteParseErrorLines',
  'llmCraftNoteTombstoneText',
  'llmCraftNoteUnknownWhereValues',
  'makeLlmCraftJudge',
  'makeLlmCraftNoteRowReader',
  'makeLlmCraftPromptContributor',
  'makeLlmCraftSiteRegistry',
  'mergeLlmCraftNoteTiers',
  'parseLlmCraftNote',
  'parseLlmCraftNoteRows',
  'parseLlmCraftNoteSet',
  'readLlmCraftAskInputs',
  'readLlmCraftNoteGroup',
  'readLlmCraftSiteFactShape',
  'resolveLlmCraftCandidates',
  'selectLlmCraftNotes',
  'settleLlmCraftNotes',
  'toLlmCraftContributions',
  'toLlmCraftNoteRowFiles',
  'toLlmCraftNoteRowSource'
];

describe('craft exports', () => {
  it('exports exactly the documented runtime surface', () => {
    const exported = Object.keys(barrel).sort();
    expect(exported).toEqual(LLM_CRAFT_RUNTIME_EXPORTS);
  });

  it('does not export the judge internals', () => {
    const internals = ['toLlmCraftJudgeInput', 'toLlmCraftJudgeQuestionKey', 'LLM_CRAFT_NOTE_SELECT_DECISION', 'readLlmCraftJudgeVerdicts', 'toLlmCraftJudgeStamp'];
    expect(internals.filter((name) => name in barrel)).toEqual([]);
  });
});
