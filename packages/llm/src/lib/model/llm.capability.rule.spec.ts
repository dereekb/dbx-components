import { describe, expect, it, vi } from 'vitest';
import { compileLlmCapabilityRules, type LlmCapabilityRuleTarget, type LlmModelRoutingCapabilityRef } from './llm.capability.rule';

interface Rule extends LlmCapabilityRuleTarget {
  readonly name: string;
}

const CAPABILITIES: ReadonlyArray<LlmModelRoutingCapabilityRef> = [{ capability: 'summarize', tags: ['text'] }, { capability: 'judge', tags: ['meta'] }, { capability: 'draft', tags: ['text'] }, { capability: 'plain' }];
const EXCLUDE = [{ capability: 'judge', reason: 'the judge is excluded.' }];

function compile(rules: ReadonlyArray<Rule>, extra?: Partial<Parameters<typeof compileLlmCapabilityRules<Rule, string>>[0]>) {
  return compileLlmCapabilityRules<Rule, string>({ rules, capabilities: CAPABILITIES, label: 'test', exclude: EXCLUDE, readValue: (rule) => rule.name, ...extra });
}

describe('compileLlmCapabilityRules()', () => {
  it('returns an empty map and validates nothing when there are no rules', () => {
    const validateRule = vi.fn();
    expect(compile([], { validateRule }).size).toBe(0);
    expect(compileLlmCapabilityRules<Rule, string>({ rules: undefined, capabilities: CAPABILITIES, label: 'test', validateRule, readValue: (rule) => rule.name }).size).toBe(0);
    expect(validateRule).not.toHaveBeenCalled();
  });

  it('checks an exclusion before the unknown-capability check', () => {
    expect(() => compileLlmCapabilityRules<Rule, string>({ rules: [{ name: 'a', capabilities: ['ghost'] }], capabilities: [], label: 'test', exclude: [{ capability: 'ghost', reason: 'ghosts are excluded.' }], readValue: (rule) => rule.name })).toThrow('test rule #1: ghosts are excluded.');
    expect(() => compile([{ name: 'a', capabilities: ['nope'] }])).toThrow("test rule #1: unknown capability 'nope'.");
  });

  it('runs validateRule after the no-target check and before the capability checks', () => {
    expect(() =>
      compile([{ name: 'a' }], {
        validateRule: () => {
          throw new Error('validated');
        }
      })
    ).toThrow("test rule #1: declares no target; set 'capabilities' and/or 'tags'.");
    expect(() =>
      compile([{ name: 'a', capabilities: ['nope'] }], {
        validateRule: (_rule, { label }) => {
          throw new Error(`${label}: validated`);
        }
      })
    ).toThrow('test rule #1: validated');
  });

  it("lists every capability's tags in the unknown-tag error, the excluded ones included", () => {
    expect(() => compile([{ name: 'a', tags: ['ghost'] }])).toThrow("test rule #1: no capability carries the tag 'ghost' (have: text, meta).");
  });

  it('calls readValue eagerly, once per rule, even for a rule nothing matches', () => {
    const readValue = vi.fn((rule: Rule) => rule.name);
    compile(
      [
        { name: 'a', capabilities: ['summarize'] },
        { name: 'b', capabilities: ['summarize'] }
      ],
      { readValue }
    );
    expect(readValue.mock.calls.map(([rule]) => rule.name)).toEqual(['a', 'b']);
  });

  it('lets a key match beat a tag match, and the first match win within a level', () => {
    const map = compile([
      { name: 'tag-first', tags: ['text'] },
      { name: 'key', capabilities: ['draft'] },
      { name: 'key-later', capabilities: ['draft'] }
    ]);
    expect(map.get('draft')).toBe('key');
    expect(map.get('summarize')).toBe('tag-first');
  });

  it('never matches an excluded capability, even by tag', () => {
    const map = compile([{ name: 'meta', tags: ['meta'] }]);
    expect(map.has('judge')).toBe(false);
  });

  it('builds the map in capability order', () => {
    const map = compile([{ name: 'z', capabilities: ['draft', 'summarize', 'plain'] }]);
    expect([...map.keys()]).toEqual(['summarize', 'draft', 'plain']);
  });
});
