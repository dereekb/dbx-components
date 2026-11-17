import { describe, expect, it } from 'vitest';
import { DEFAULT_LLM_PROMPT_LAYOUT, LLM_PROMPT_CONTRIBUTION_SLOT_ROLES, type LlmPromptLayout, type LlmPromptSlot, llmPromptSlotOf, llmPromptSlotsOfRole, makeLlmPromptLayout } from './llm.prompt.layout';

/**
 * The LETTERED layout — a host layout with three frames before the reply protocol and one after the contract. The
 * assembly's golden replica copies it.
 */
const LETTERED_LAYOUT: LlmPromptLayout = [
  { id: 'model-addendum', role: 'model-addendum', occupancy: 'single', separator: '\n\n' },
  { id: 'A0', role: 'frame', occupancy: 'single', separator: '\n\n' },
  { id: 'A0.5', role: 'frame', occupancy: 'single', separator: '\n\n' },
  { id: 'A0.7', role: 'frame', occupancy: 'single', separator: '\n\n' },
  { id: 'A', role: 'reply-protocol', occupancy: 'single', separator: '\n\n' },
  { id: 'A-amendment', role: 'reply-amendment', occupancy: 'single', separator: '\n\n' },
  { id: 'B', role: 'instructions', occupancy: 'single', separator: '\n\n' },
  { id: 'C-pre', role: 'context-pre', occupancy: 'single', separator: '\n\n' },
  { id: 'contract', role: 'contract', occupancy: 'single', separator: '\n\n' },
  { id: 'B1', role: 'frame', occupancy: 'single', separator: '\n\n' },
  { id: 'craft', role: 'craft', occupancy: 'many', separator: '\n\n' },
  { id: 'D', role: 'live', occupancy: 'many', separator: '\n\n', lastSeparator: '' },
  { id: 'C-post', role: 'context-post', occupancy: 'single', separator: '' },
  { id: 'correction', role: 'correction', occupancy: 'single', separator: '' },
  { id: 'follow-up', role: 'follow-up', occupancy: 'single', separator: '' }
];

function slot(id: string, role: LlmPromptSlot['role'], extra: Partial<LlmPromptSlot> = {}): LlmPromptSlot {
  return { id, role, occupancy: role === 'live' || role === 'craft' ? 'many' : 'single', separator: '\n\n', ...extra };
}

describe('makeLlmPromptLayout()', () => {
  it('should return the default layout unchanged', () => {
    expect(makeLlmPromptLayout(DEFAULT_LLM_PROMPT_LAYOUT)).toBe(DEFAULT_LLM_PROMPT_LAYOUT);
  });

  it('should name every default slot after its role', () => {
    expect(DEFAULT_LLM_PROMPT_LAYOUT.every((x) => x.id === x.role)).toBe(true);
    expect(llmPromptSlotsOfRole(DEFAULT_LLM_PROMPT_LAYOUT, 'frame')).toEqual([]);
  });

  it('should validate the lettered layout and expose its contribution slots', () => {
    expect(makeLlmPromptLayout(LETTERED_LAYOUT)).toBe(LETTERED_LAYOUT);
    const contributionSlots = LETTERED_LAYOUT.filter((x) => LLM_PROMPT_CONTRIBUTION_SLOT_ROLES.has(x.role));
    expect(contributionSlots.map((x) => x.id)).toEqual(['model-addendum', 'A0', 'A0.5', 'A0.7', 'B1', 'craft', 'D']);
    expect(new Set(contributionSlots.filter((x) => x.occupancy === 'single').map((x) => x.id))).toEqual(new Set(['model-addendum', 'A0', 'A0.5', 'A0.7', 'B1']));
  });

  it('should reject a duplicate id', () => {
    expect(() => makeLlmPromptLayout([slot('a', 'frame'), slot('a', 'frame')])).toThrow(/slot id 'a' is declared twice/);
  });

  it('should reject an empty id', () => {
    expect(() => makeLlmPromptLayout([slot('', 'frame')])).toThrow(/a slot has an empty id/);
  });

  it('should reject an unknown role', () => {
    expect(() => makeLlmPromptLayout([slot('a', 'banner' as LlmPromptSlot['role'])])).toThrow(/slot 'a' has unknown role 'banner'/);
  });

  it('should reject an assembly role declared twice', () => {
    expect(() => makeLlmPromptLayout([slot('a', 'instructions'), slot('b', 'instructions')])).toThrow(/role 'instructions' is declared twice/);
  });

  it('should reject a many contract', () => {
    expect(() => makeLlmPromptLayout([slot('c', 'contract', { occupancy: 'many' })])).toThrow(/slot 'c' \(contract\) must be 'single'/);
  });

  it('should reject a single live slot', () => {
    expect(() => makeLlmPromptLayout([slot('d', 'live', { occupancy: 'single' })])).toThrow(/slot 'd' \(live\) must be 'many'/);
  });

  it('should reject a context-post before context-pre', () => {
    expect(() => makeLlmPromptLayout([slot('post', 'context-post'), slot('pre', 'context-pre'), slot('d', 'live')])).toThrow(/slot 'post' \(context-post\) has no context-pre slot before it/);
  });

  it('should reject a context-post with no live slot between', () => {
    expect(() => makeLlmPromptLayout([slot('d', 'live'), slot('pre', 'context-pre'), slot('post', 'context-post')])).toThrow(/slot 'post' \(context-post\) has no live slot between/);
  });

  it('should reject a non-string separator', () => {
    expect(() => makeLlmPromptLayout([slot('a', 'frame', { separator: 2 as unknown as string })])).toThrow(/slot 'a' separator is not a string/);
    expect(() => makeLlmPromptLayout([slot('a', 'frame', { lastSeparator: 2 as unknown as string })])).toThrow(/slot 'a' lastSeparator is not a string/);
  });

  it('should reject an unknown occupancy', () => {
    expect(() => makeLlmPromptLayout([slot('a', 'frame', { occupancy: 'few' as LlmPromptSlot['occupancy'] })])).toThrow(/slot 'a' has unknown occupancy 'few'/);
  });

  it('should collect several issues into one error', () => {
    let message = '';

    try {
      makeLlmPromptLayout([slot('a', 'frame'), slot('a', 'frame'), slot('c', 'contract', { occupancy: 'many' })]);
    } catch (e) {
      message = (e as Error).message;
    }

    expect(message).toMatch(/^llm prompt layout: /);
    expect(message).toContain("slot id 'a' is declared twice");
    expect(message).toContain("slot 'c' (contract) must be 'single'");
  });

  it('should let contribution-only roles repeat and take either occupancy', () => {
    expect(() => makeLlmPromptLayout([slot('a', 'frame', { occupancy: 'many' }), slot('b', 'frame'), slot('c', 'craft', { occupancy: 'single' }), slot('d', 'craft'), slot('e', 'model-addendum'), slot('f', 'model-addendum', { occupancy: 'many' })])).not.toThrow();
  });
});

describe('llmPromptSlotOf()', () => {
  it('should find a slot by id', () => {
    expect(llmPromptSlotOf(LETTERED_LAYOUT, 'D')?.lastSeparator).toBe('');
    expect(llmPromptSlotOf(LETTERED_LAYOUT, 'nope')).toBeUndefined();
  });
});

describe('llmPromptSlotsOfRole()', () => {
  it('should list a role slots in layout order', () => {
    expect(llmPromptSlotsOfRole(LETTERED_LAYOUT, 'frame').map((x) => x.id)).toEqual(['A0', 'A0.5', 'A0.7', 'B1']);
  });
});
