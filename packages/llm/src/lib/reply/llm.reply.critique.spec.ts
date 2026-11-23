import { describe, expect, it, vi } from 'vitest';
import { type LlmModelRoutingCapabilityRef } from '../model/llm.capability.rule';
import { noopLlmCallContext } from '../record/llm.call.context';
import { compileLlmCritiquePolicy, composeLlmCritics, LLM_CRITIQUE_REPLY_CAPABILITY, type LlmCritic, type LlmCritiqueParams } from './llm.reply.critique';

const CAPABILITIES: ReadonlyArray<LlmModelRoutingCapabilityRef> = [
  { capability: 'summarize', tags: ['copy'] },
  { capability: 'draft-copy', tags: ['copy'] },
  { capability: 'classify-intent', tags: ['classify'] },
  { capability: LLM_CRITIQUE_REPLY_CAPABILITY, tags: ['classify'] }
];

describe('compileLlmCritiquePolicy()', () => {
  it('compiles an absent / rule-less config to an empty policy (nothing is ever billed)', () => {
    expect(compileLlmCritiquePolicy({ critique: {}, capabilities: CAPABILITIES }).size).toBe(0);
    expect(compileLlmCritiquePolicy({ critique: { rules: [] }, capabilities: CAPABILITIES }).size).toBe(0);
  });

  it('matches by capability key', () => {
    const policy = compileLlmCritiquePolicy({ critique: { rules: [{ capabilities: ['summarize'], maxAttempts: 3 }] }, capabilities: CAPABILITIES });

    expect(policy.get('summarize')?.maxAttempts).toBe(3);
    expect(policy.get('draft-copy')).toBeUndefined();
  });

  it('matches by tag (the whole family)', () => {
    const policy = compileLlmCritiquePolicy({ critique: { rules: [{ tags: ['copy'], goal: 'G' }] }, capabilities: CAPABILITIES });

    expect(policy.get('summarize')?.goal).toBe('G');
    expect(policy.get('draft-copy')?.goal).toBe('G');
  });

  it('lets a capability-key match beat a tag match regardless of rule order', () => {
    const policy = compileLlmCritiquePolicy({
      critique: {
        rules: [
          { tags: ['copy'], goal: 'TAG' },
          { capabilities: ['summarize'], goal: 'ID' }
        ]
      },
      capabilities: CAPABILITIES
    });

    expect(policy.get('summarize')?.goal).toBe('ID');
    expect(policy.get('draft-copy')?.goal).toBe('TAG');
  });

  it('lets the first matching tag rule win (array order = priority)', () => {
    const policy = compileLlmCritiquePolicy({
      critique: {
        rules: [
          { tags: ['copy'], goal: 'FIRST' },
          { tags: ['copy'], goal: 'SECOND' }
        ]
      },
      capabilities: CAPABILITIES
    });

    expect(policy.get('summarize')?.goal).toBe('FIRST');
  });

  it('throws on an unknown capability key', () => {
    expect(() => compileLlmCritiquePolicy({ critique: { rules: [{ capabilities: ['nope-cap'] }] }, capabilities: CAPABILITIES })).toThrow("llm critique rule #1: unknown capability 'nope-cap'.");
  });

  it('throws on a tag no capability carries', () => {
    expect(() => compileLlmCritiquePolicy({ critique: { rules: [{ tags: ['nope'] }] }, capabilities: CAPABILITIES })).toThrow("llm critique rule #1: no capability carries the tag 'nope' (have: copy, classify).");
  });

  it('throws on a rule that declares no target', () => {
    expect(() => compileLlmCritiquePolicy({ critique: { rules: [{ goal: 'G' }] }, capabilities: CAPABILITIES })).toThrow("llm critique rule #1: declares no target; set 'capabilities' and/or 'tags'.");
  });

  it('throws on a rule naming the judge', () => {
    expect(() => compileLlmCritiquePolicy({ critique: { rules: [{ capabilities: [LLM_CRITIQUE_REPLY_CAPABILITY] }] }, capabilities: CAPABILITIES })).toThrow("llm critique rule #1: 'CritiqueReply' is the judge itself and can never be critiqued (a judge judging a judge is unbounded).");
  });

  it('never matches the judge with a tag rule it carries', () => {
    const policy = compileLlmCritiquePolicy({ critique: { rules: [{ tags: ['classify'], goal: 'G' }] }, capabilities: CAPABILITIES });

    expect(policy.get('classify-intent')?.goal).toBe('G');
    expect(policy.get(LLM_CRITIQUE_REPLY_CAPABILITY)).toBeUndefined();
  });

  it('prefixes its messages with a custom label', () => {
    expect(() => compileLlmCritiquePolicy({ critique: { rules: [{ tags: ['copy'] }, { capabilities: ['nope-cap'] }] }, capabilities: CAPABILITIES, label: 'shop critique' })).toThrow("shop critique rule #2: unknown capability 'nope-cap'.");
  });
});

describe('composeLlmCritics()', () => {
  const input: LlmCritiqueParams = { capability: 'summarize', value: {}, replyText: '{}', liveContext: '', replyProtocol: 'json', attempt: 1, callContext: noopLlmCallContext() };

  it('returns undefined for nothing, or for only absent critics', () => {
    expect(composeLlmCritics()).toBeUndefined();
    expect(composeLlmCritics(undefined, null)).toBeUndefined();
  });

  it('returns a lone critic itself', () => {
    const critic: LlmCritic = async () => true;
    expect(composeLlmCritics(undefined, critic, null)).toBe(critic);
  });

  it('runs several in order and lets the first non-true verdict win, never calling a later critic', async () => {
    const first = vi.fn<LlmCritic>(async () => true);
    const second = vi.fn<LlmCritic>(async () => ({ error: 'second' }));
    const third = vi.fn<LlmCritic>(async () => ({ error: 'third' }));
    const composed = composeLlmCritics(first, second, third);

    await expect(composed?.(input)).resolves.toEqual({ error: 'second' });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(third).not.toHaveBeenCalled();
  });

  it('accepts when every critic accepts', async () => {
    const composed = composeLlmCritics(
      async () => true,
      async () => true
    );

    await expect(composed?.(input)).resolves.toBe(true);
  });
});
