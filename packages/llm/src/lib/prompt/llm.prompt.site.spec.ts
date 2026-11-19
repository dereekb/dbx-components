import { describe, expect, it } from 'vitest';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { type LlmDispatcher } from '../dispatch/llm.dispatcher';
import { mergeLlmPromptSite, type LlmPromptSite, type LlmPromptSiteJudge, withLlmPromptSite } from './llm.prompt.site';
import { makeLlmPromptFactory } from './llm.prompt.thread';

interface HostSupply {
  readonly glossary?: string;
  readonly persona?: string;
}

interface HostRequest extends LlmDispatchRequest {
  readonly site?: LlmPromptSite<HostSupply>;
}

const judgeA: LlmPromptSiteJudge = async () => undefined;
const judgeB: LlmPromptSiteJudge = async () => new Map();

describe('mergeLlmPromptSite()', () => {
  it('returns undefined when both sides are nullish', () => {
    expect(mergeLlmPromptSite(undefined, null)).toBeUndefined();
  });

  it('returns the other side, the same object, when one side is nullish', () => {
    const site: LlmPromptSite = { kind: 'report' };
    expect(mergeLlmPromptSite(site, undefined)).toBe(site);
    expect(mergeLlmPromptSite(undefined, site)).toBe(site);
  });

  it("replaces the outer's kind and judge with the inner's, keeping the outer's when the inner has none", () => {
    expect(mergeLlmPromptSite({ kind: 'report', judge: judgeA }, { kind: 'memo', judge: judgeB })).toEqual({ kind: 'memo', judge: judgeB });
    expect(mergeLlmPromptSite({ kind: 'report', judge: judgeA }, { facts: { tone: 'plain' } })).toEqual({ kind: 'report', facts: { tone: 'plain' }, judge: judgeA });
  });

  it('merges facts, inputs and supply key by key, the inner winning', () => {
    const merged = mergeLlmPromptSite({ facts: { a: 1, b: 1 }, inputs: { idea: 'outer', brief: 'outer' }, supply: { x: 1 } }, { facts: { b: 2 }, inputs: { brief: 'inner' }, supply: { y: 2 } });
    expect(merged).toEqual({ facts: { a: 1, b: 2 }, inputs: { idea: 'outer', brief: 'inner' }, supply: { x: 1, y: 2 } });
  });

  it('keeps an outer key when the inner record sets it to undefined (B5)', () => {
    const innerFacts = { tone: undefined } as unknown as NonNullable<LlmPromptSite['facts']>;
    expect(mergeLlmPromptSite({ facts: { tone: 'plain' } }, { facts: innerFacts })?.facts).toEqual({ tone: 'plain' });
  });

  it('omits a field absent on both sides, in the order kind, facts, inputs, judge, supply', () => {
    expect(Object.keys(mergeLlmPromptSite({ kind: 'report' }, { facts: { a: 1 } }) ?? {})).toEqual(['kind', 'facts']);
    expect(Object.keys(mergeLlmPromptSite({ supply: { x: 1 }, kind: 'report' }, { judge: judgeA, inputs: { idea: 'i' } }) ?? {})).toEqual(['kind', 'inputs', 'judge', 'supply']);
  });

  it('merges a typed supply', () => {
    const outer: LlmPromptSite<HostSupply> = { supply: { glossary: 'G', persona: 'P1' } };
    const inner: LlmPromptSite<HostSupply> = { supply: { persona: 'P2' } };
    const merged: LlmPromptSite<HostSupply> | null | undefined = mergeLlmPromptSite(outer, inner);
    expect(merged?.supply).toEqual({ glossary: 'G', persona: 'P2' });
  });
});

/**
 * A recording dispatcher built the way a host builds one: `preparePrompt` from `makeLlmPromptFactory`, `dispatch` the
 * unwrapped `preparePrompt(request).execute()`, plus an extra decision counter.
 */
function recordingDispatcherOf() {
  const seen: HostRequest[] = [];
  const preparePrompt = makeLlmPromptFactory<HostRequest>({
    runPromptRequest: async ({ request }) => {
      seen.push(request);
      return { result: { text: 'ok', strategyId: 'fake', capability: request.capability }, sentTurn: { role: 'user', content: 'sent' } };
    }
  });
  const dispatcher: LlmDispatcher<HostRequest> = {
    dispatch: async (request) => (await preparePrompt(request).execute()).result,
    preparePrompt,
    decisionsSpent: () => 3
  };
  return { dispatcher, seen };
}

const request = (site?: LlmPromptSite<HostSupply>): HostRequest => ({ capability: 'summarize', renderLiveContext: () => [], ...(site == null ? {} : { site }) });

describe('withLlmPromptSite()', () => {
  it('stamps the scope site on both dispatch and preparePrompt', async () => {
    const { dispatcher, seen } = recordingDispatcherOf();
    const scoped = withLlmPromptSite({ dispatcher, site: { supply: { glossary: 'G' } } });

    await scoped.dispatch(request());
    await scoped.preparePrompt(request()).execute();

    expect(seen.map((entry) => entry.site)).toEqual([{ supply: { glossary: 'G' } }, { supply: { glossary: 'G' } }]);
  });

  it("lets a request's own site win key by key", async () => {
    const { dispatcher, seen } = recordingDispatcherOf();
    const scoped = withLlmPromptSite({ dispatcher, site: { kind: 'report', supply: { glossary: 'G', persona: 'P1' } } });

    await scoped.dispatch(request({ supply: { persona: 'P2' } }));

    expect(seen[0]?.site).toEqual({ kind: 'report', supply: { glossary: 'G', persona: 'P2' } });
  });

  it('composes: a later wrapper is the narrower scope, and the request site is narrower still', async () => {
    const { dispatcher, seen } = recordingDispatcherOf();
    const outer = withLlmPromptSite({ dispatcher, site: { facts: { a: 'A', b: 'A', c: 'A' } } });
    const inner = withLlmPromptSite({ dispatcher: outer, site: { facts: { b: 'B', c: 'B' } } });

    await inner.dispatch(request({ facts: { c: 'C' } }));

    expect(seen[0]?.site).toEqual({ facts: { a: 'A', b: 'B', c: 'C' } });
  });

  it('carries the other members through the spread', () => {
    const { dispatcher } = recordingDispatcherOf();
    const scoped = withLlmPromptSite({ dispatcher, site: { kind: 'report' } });
    expect(scoped.decisionsSpent?.()).toBe(3);
  });

  it('leaves the wrapped dispatcher untouched', async () => {
    const { dispatcher, seen } = recordingDispatcherOf();
    withLlmPromptSite({ dispatcher, site: { kind: 'report' } });

    await dispatcher.dispatch(request());

    expect(seen[0]?.site).toBeUndefined();
  });

  it('gives a request with no site the scope site', async () => {
    const { dispatcher, seen } = recordingDispatcherOf();
    const site: LlmPromptSite<HostSupply> = { kind: 'report', inputs: { brief: 'b' } };

    await withLlmPromptSite({ dispatcher, site }).dispatch(request());

    expect(seen[0]?.site).toEqual(site);
  });
});
