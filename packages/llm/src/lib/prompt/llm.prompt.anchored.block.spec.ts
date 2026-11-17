import { describe, expect, it } from 'vitest';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { DEFAULT_LLM_ANCHORED_BLOCK_SLOT_ID, type LlmAnchoredBlock, llmAnchoredBlockPromptContributor } from './llm.prompt.anchored.block';
import { composeLlmCapabilityPrompt } from './llm.prompt.assembly';
import { type LlmPromptContributor, type LlmPromptContributorInput } from './llm.prompt.contributor';
import { DEFAULT_LLM_PROMPT_LAYOUT, type LlmPromptLayout } from './llm.prompt.layout';
import { type LlmLiveContextBlock } from './llm.prompt.live.context';
import { type LlmPromptSite } from './llm.prompt.site';
import { tieredLlmPromptTemplateResolver } from './llm.prompt.template';

interface HostSupply {
  readonly research?: LlmAnchoredBlock;
  readonly glossary?: LlmAnchoredBlock;
  readonly persona?: LlmAnchoredBlock;
}

interface HostRequest extends LlmDispatchRequest {
  readonly site?: LlmPromptSite<HostSupply>;
}

const ROOM: ReadonlyArray<LlmLiveContextBlock> = [
  { key: 'heading', text: '## Live context', volatile: false },
  { key: 'members', text: 'Members: Ada, Lin' },
  { key: 'history', text: 'History: two prior items' },
  { key: 'vocabulary', text: 'Vocabulary: SKU' }
];

const RESEARCH_REASON = 'the run read resources';

const research = llmAnchoredBlockPromptContributor<HostRequest>({ id: 'research', reason: RESEARCH_REASON, blockOf: ({ request }) => request.site?.supply?.research });

function requestOf(supply?: HostSupply): HostRequest {
  return { capability: 'summarize', renderLiveContext: () => ROOM, ...(supply == null ? {} : { site: { supply } }) };
}

function compose(request: HostRequest, contributors: ReadonlyArray<LlmPromptContributor<HostRequest>> = [research], layout?: LlmPromptLayout) {
  return composeLlmCapabilityPrompt<HostRequest>({ request, descriptorOf: () => undefined, templateResolver: tieredLlmPromptTemplateResolver({ tiers: [] }), contributors, ...(layout == null ? {} : { layout }) });
}

function inputOf(request: HostRequest): LlmPromptContributorInput<HostRequest> {
  return { request, descriptor: undefined, templates: { roles: {}, byKey: () => undefined }, liveBlockKeys: ROOM.map((block) => block.key) };
}

describe('llmAnchoredBlockPromptContributor(); placement', () => {
  it('places nothing without a supply or for a blank text', async () => {
    const bare = await compose(requestOf(), []);
    const none = await compose(requestOf());
    const blank = await compose(requestOf({ research: { text: '  ' } }));

    expect(none.prompt).toBe(bare.prompt);
    expect(none.segments).toEqual(bare.segments);
    expect(blank.prompt).toBe(bare.prompt);
    expect(blank.segments).toEqual(bare.segments);
  });

  it('places the block at its anchor, verbatim', async () => {
    const text = '[Research]\n- the keep';
    const composed = await compose(requestOf({ research: { text, anchor: { before: 'vocabulary' } } }));

    expect(composed.liveContext.map((block) => block.key)).toEqual(['heading', 'members', 'history', 'research', 'vocabulary']);
    expect(composed.prompt).toContain(text);
  });

  it('lands last in the live slot without an anchor', async () => {
    const composed = await compose(requestOf({ research: { text: 'R' } }));
    expect(composed.liveContext.map((block) => block.key)).toEqual(['heading', 'members', 'history', 'vocabulary', 'research']);
  });

  it('puts a stable claim anchored in the stable head into the cache prefix', async () => {
    const text = 'Research: frozen digest';
    const composed = await compose(requestOf({ research: { text, anchor: { after: 'heading' }, volatile: false } }));
    const segment = composed.segments.find((entry) => entry.key === 'research');

    expect(segment?.volatile).toBe(false);
    expect(composed.cacheSegments.cachePrefix.endsWith(`${text}\n\n`)).toBe(true);
  });

  it('keeps registry order for contributors sharing an anchor', async () => {
    const glossary = llmAnchoredBlockPromptContributor<HostRequest>({ id: 'glossary', reason: 'a glossary was supplied', blockOf: ({ request }) => request.site?.supply?.glossary });
    const persona = llmAnchoredBlockPromptContributor<HostRequest>({ id: 'persona', reason: 'a persona was supplied', blockOf: ({ request }) => request.site?.supply?.persona });
    const after = { after: 'heading' };
    const composed = await compose(requestOf({ research: { text: 'R', anchor: after }, glossary: { text: 'G', anchor: after }, persona: { text: 'P', anchor: after } }), [research, glossary, persona]);

    expect(composed.liveContext.map((block) => block.key)).toEqual(['heading', 'research', 'glossary', 'persona', 'members', 'history', 'vocabulary']);
  });
});

describe('llmAnchoredBlockPromptContributor(); the contribution', () => {
  it('offers one live-slot contribution keyed by its id', async () => {
    const text = '[Research]\n- the keep';
    const anchor = { before: 'vocabulary' };
    const { contributions } = await research.resolve(inputOf(requestOf({ research: { text, anchor } })));

    expect(DEFAULT_LLM_ANCHORED_BLOCK_SLOT_ID).toBe('live');
    expect(contributions).toEqual([{ contributor: 'research', slot: 'live', id: 'live', key: 'research', text, origin: { kind: 'live-context', capability: 'summarize', block: 'research' }, reason: RESEARCH_REASON, anchor }]);
  });

  it('sets volatile only when the block does', async () => {
    const unset = await research.resolve(inputOf(requestOf({ research: { text: 'R' } })));
    const set = await research.resolve(inputOf(requestOf({ research: { text: 'R', volatile: true } })));

    expect('volatile' in (unset.contributions[0] ?? {})).toBe(false);
    expect(set.contributions[0]?.volatile).toBe(true);
  });

  it('places the block under a configured key', async () => {
    const notes = llmAnchoredBlockPromptContributor<HostRequest>({ id: 'research', key: 'notes', reason: RESEARCH_REASON, blockOf: ({ request }) => request.site?.supply?.research });
    const { contributions } = await notes.resolve(inputOf(requestOf({ research: { text: 'R' } })));

    expect(contributions[0]).toMatchObject({ key: 'notes', origin: { block: 'notes' } });
  });

  it("occupies a configured slot — a layout whose live slot is 'D'", async () => {
    const layout: LlmPromptLayout = DEFAULT_LLM_PROMPT_LAYOUT.map((slot) => (slot.id === 'live' ? { ...slot, id: 'D' } : slot));
    const lettered = llmAnchoredBlockPromptContributor<HostRequest>({ id: 'research', slot: 'D', reason: RESEARCH_REASON, blockOf: ({ request }) => request.site?.supply?.research });
    const composed = await compose(requestOf({ research: { text: 'R', anchor: { after: 'members' } } }), [lettered], layout);

    expect(lettered.slots).toEqual(['D']);
    expect(composed.segments.filter((segment) => segment.id === 'D').map((segment) => segment.key)).toEqual(['heading', 'members', 'research', 'history', 'vocabulary']);
  });
});
