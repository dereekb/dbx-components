import { describe, expect, it } from 'vitest';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { composeLlmCapabilityPrompt } from './llm.prompt.assembly';
import { llmPromptSupplementsOf, type LlmPromptContributorInput } from './llm.prompt.contributor';
import { llmPromptCacheHash } from './llm.prompt.hash';
import { DEFAULT_LLM_PROMPT_LAYOUT, type LlmPromptLayout } from './llm.prompt.layout';
import { llmLiveContextHeadingBlock } from './llm.prompt.live.context';
import { LLM_MODEL_ADDENDUM_REASON, llmModelAddendumContribution, llmModelAddendumPromptContributor, llmModelAddendumSegment, restampLlmModelAddendum } from './llm.prompt.model.addendum';
import { type LlmPromptSegment } from './llm.prompt.segment';
import { tieredLlmPromptTemplateResolver } from './llm.prompt.template';

const ADDENDA = { 'm/x': 'ADDENDUM' };

const request: LlmDispatchRequest = { capability: 'summarize', renderLiveContext: () => [llmLiveContextHeadingBlock()] };

function inputOf(model?: string): LlmPromptContributorInput {
  return { request, descriptor: undefined, templates: { roles: {}, byKey: () => undefined }, liveBlockKeys: ['heading'], ...(model == null ? {} : { model }) };
}

function compose(model?: string) {
  return composeLlmCapabilityPrompt({ request, descriptorOf: () => undefined, templateResolver: tieredLlmPromptTemplateResolver({ tiers: [] }), contributors: [llmModelAddendumPromptContributor({ promptAddendumByModel: ADDENDA })], ...(model == null ? {} : { model }) });
}

describe('llmModelAddendumPromptContributor()', () => {
  const contributor = llmModelAddendumPromptContributor({ promptAddendumByModel: ADDENDA });

  it('contributes nothing without a model', async () => {
    expect((await contributor.resolve(inputOf())).contributions).toEqual([]);
  });

  it('contributes nothing for a model the map does not name', async () => {
    expect((await contributor.resolve(inputOf('m/other'))).contributions).toEqual([]);
  });

  it('contributes nothing without a map', async () => {
    expect((await llmModelAddendumPromptContributor({ promptAddendumByModel: undefined }).resolve(inputOf('m/x'))).contributions).toEqual([]);
  });

  it("contributes the named model's addendum", async () => {
    const { contributions } = await contributor.resolve(inputOf('m/x'));
    expect(contributions).toEqual([llmModelAddendumContribution({ model: 'm/x', promptAddendum: 'ADDENDUM' })]);
    expect(contributions).toEqual([{ contributor: 'model-addendum', slot: 'model-addendum', id: 'model-addendum', key: 'm/x', text: 'ADDENDUM', origin: { kind: 'model', model: 'm/x', setting: 'promptAddendum' }, reason: LLM_MODEL_ADDENDUM_REASON }]);
  });

  it('occupies a configured slot', async () => {
    const custom = llmModelAddendumPromptContributor({ promptAddendumByModel: ADDENDA, slot: 'addendum' });
    const { contributions } = await custom.resolve(inputOf('m/x'));
    expect(custom.slots).toEqual(['addendum']);
    expect(contributions[0]).toMatchObject({ slot: 'addendum', id: 'addendum' });
  });
});

describe('llmModelAddendumPromptContributor(); through composeLlmCapabilityPrompt', () => {
  it('leads the prompt with the one mint', async () => {
    const composed = await compose('m/x');
    expect(composed.prompt.startsWith('ADDENDUM\n\n')).toBe(true);
    expect(composed.segments[0]).toEqual(llmModelAddendumSegment({ model: 'm/x', promptAddendum: 'ADDENDUM' }));
  });

  it('records the supplement row', async () => {
    const composed = await compose('m/x');
    expect(llmPromptSupplementsOf(composed.contributions, composed.cut)).toEqual([{ contributor: 'model-addendum', slot: 'model-addendum', id: 'model-addendum', key: 'm/x', hash: llmPromptCacheHash('ADDENDUM'), bytes: 8 }]);
  });

  it('places no addendum segment without a model', async () => {
    const composed = await compose();
    expect(composed.segments.some((segment) => segment.id === 'model-addendum')).toBe(false);
  });
});

describe('llmModelAddendumSegment()', () => {
  it('closes the body with the default layout separator, in the placement key order', () => {
    const segment = llmModelAddendumSegment({ model: 'm/x', promptAddendum: 'ADDENDUM' });
    expect(segment.promptSegment).toBe('ADDENDUM\n\n');
    expect(Object.keys(segment)).toEqual(['id', 'promptSegment', 'origin', 'key', 'reason']);
  });

  it("takes the layout slot's separator, and its lastSeparator over it", () => {
    const withSeparator: LlmPromptLayout = [{ id: 'model-addendum', role: 'model-addendum', occupancy: 'single', separator: '\n' }, ...DEFAULT_LLM_PROMPT_LAYOUT.slice(1)];
    const withLast: LlmPromptLayout = [{ id: 'model-addendum', role: 'model-addendum', occupancy: 'single', separator: '\n', lastSeparator: ' ' }, ...DEFAULT_LLM_PROMPT_LAYOUT.slice(1)];
    expect(llmModelAddendumSegment({ model: 'm/x', promptAddendum: 'ADDENDUM', layout: withSeparator }).promptSegment).toBe('ADDENDUM\n');
    expect(llmModelAddendumSegment({ model: 'm/x', promptAddendum: 'ADDENDUM', layout: withLast }).promptSegment).toBe('ADDENDUM ');
  });

  it('throws for a layout without the slot', () => {
    expect(() => llmModelAddendumSegment({ model: 'm/x', promptAddendum: 'ADDENDUM', layout: DEFAULT_LLM_PROMPT_LAYOUT.slice(1) })).toThrow(/declares no 'model-addendum' slot/);
  });
});

describe('restampLlmModelAddendum()', () => {
  const body: LlmPromptSegment = { id: 'reply-protocol', promptSegment: 'A\n\n', origin: { kind: 'generated' } };

  it('replaces a captured addendum with the new one, never stacking them', () => {
    const captured = [llmModelAddendumSegment({ model: 'old/slug', promptAddendum: 'OLD' }), body];
    const restamped = restampLlmModelAddendum({ segments: captured, model: 'new/slug', promptAddendum: 'NEW' });
    expect(restamped.map((segment) => segment.promptSegment)).toEqual(['NEW\n\n', 'A\n\n']);
    expect(restamped.filter((segment) => segment.id === 'model-addendum')).toHaveLength(1);
    expect(restamped[0]?.key).toBe('new/slug');
  });

  it('adds an addendum at the front of a capture that had none', () => {
    const restamped = restampLlmModelAddendum({ segments: [body], model: 'new/slug', promptAddendum: 'NEW' });
    expect(restamped.map((segment) => segment.id)).toEqual(['model-addendum', 'reply-protocol']);
  });

  it('filters and mints under a custom slot', () => {
    const layout: LlmPromptLayout = [{ id: 'addendum', role: 'model-addendum', occupancy: 'single', separator: '\n\n' }, ...DEFAULT_LLM_PROMPT_LAYOUT.slice(1)];
    const captured = [llmModelAddendumSegment({ model: 'old/slug', promptAddendum: 'OLD', slot: 'addendum', layout }), body];
    const restamped = restampLlmModelAddendum({ segments: captured, model: 'new/slug', promptAddendum: 'NEW', slot: 'addendum', layout });
    expect(restamped.map((segment) => `${segment.id}:${segment.promptSegment}`)).toEqual(['addendum:NEW\n\n', 'reply-protocol:A\n\n']);
  });

  it('places the addendum where the layout puts its slot — after a frame slot that precedes it', () => {
    const layout: LlmPromptLayout = [{ id: 'frame', role: 'frame', occupancy: 'single', separator: '\n\n' }, ...DEFAULT_LLM_PROMPT_LAYOUT];
    const frame: LlmPromptSegment = { id: 'frame', promptSegment: 'FRAME\n\n', origin: { kind: 'generated' } };
    const captured = [frame, llmModelAddendumSegment({ model: 'old/slug', promptAddendum: 'OLD', layout }), body];
    const restamped = restampLlmModelAddendum({ segments: captured, model: 'new/slug', promptAddendum: 'NEW', layout });
    expect(restamped.map((segment) => `${segment.id}:${segment.promptSegment}`)).toEqual(['frame:FRAME\n\n', 'model-addendum:NEW\n\n', 'reply-protocol:A\n\n']);
  });

  it('never anchors on an undeclared segment id, and appends when no later slot is captured', () => {
    const layout: LlmPromptLayout = [{ id: 'frame', role: 'frame', occupancy: 'single', separator: '\n\n' }, ...DEFAULT_LLM_PROMPT_LAYOUT];
    const frame: LlmPromptSegment = { id: 'frame', promptSegment: 'FRAME\n\n', origin: { kind: 'generated' } };
    const stray: LlmPromptSegment = { id: 'stray', promptSegment: 'STRAY', origin: { kind: 'generated' } };
    const restamped = restampLlmModelAddendum({ segments: [stray, frame], model: 'new/slug', promptAddendum: 'NEW', layout });
    expect(restamped.map((segment) => segment.id)).toEqual(['stray', 'frame', 'model-addendum']);
  });
});
