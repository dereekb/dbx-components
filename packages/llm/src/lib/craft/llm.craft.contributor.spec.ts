/**
 * The craft contributor on the prompt seam: one heading per placed group, the stable group on the cache prefix and the
 * judged group volatile, the `craft` segment origin, the cut rows on the supplements, the byte-identical OFF arms, the
 * guard, the tier order, a per-request row tier and a custom slot / headings.
 */

import { describe, expect, it } from 'vitest';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { type LlmCallDiagRecord } from '../record/llm.call.context';
import { composeLlmCapabilityPrompt } from '../prompt/llm.prompt.assembly';
import { llmPromptSupplementsOf, type LlmPromptContributor, type LlmPromptContributorInput } from '../prompt/llm.prompt.contributor';
import { llmPromptCacheHash } from '../prompt/llm.prompt.hash';
import { DEFAULT_LLM_PROMPT_LAYOUT, makeLlmPromptLayout, type LlmPromptLayout } from '../prompt/llm.prompt.layout';
import { type LlmPromptSite } from '../prompt/llm.prompt.site';
import { tieredLlmPromptTemplateResolver } from '../prompt/llm.prompt.template';
import { DEFAULT_LLM_CRAFT_NOTE_HEADINGS, llmCraftPromptContributor } from './llm.craft.contributor';
import { type LlmCraftNoteSet } from './llm.craft.frontmatter';
import { type LlmCraftNote } from './llm.craft.note';
import { makeLlmCraftNoteRowReader, type LlmCraftNoteRow } from './llm.craft.row';
import { makeLlmCraftSiteRegistry } from './llm.craft.site';

const SITES = makeLlmCraftSiteRegistry({
  sites: {
    'product-page': { facts: { category: 'closed', brand: 'open', bundle: 'boolean' }, inputs: ['brief', 'notes'] },
    'support-reply': { facts: { channel: 'closed', tags: 'open' }, inputs: ['message'], limits: { maxBytes: 2400 } },
    'release-notes': { facts: { audience: 'closed' }, inputs: ['summary'] }
  }
});

const H = DEFAULT_LLM_CRAFT_NOTE_HEADINGS;
const PAGE: LlmPromptSite = { kind: 'product-page', facts: { category: 'apparel', brand: 'acme', bundle: true }, inputs: { brief: 'a winter coat with no logo' } };

interface HostRequest extends LlmDispatchRequest {
  readonly craftRows?: ReadonlyArray<LlmCraftNoteRow>;
}

/**
 * A loaded note with defaults.
 *
 * @param id - Its id.
 * @param overrides - Fields to override.
 * @returns The note.
 */
function note(id: string, overrides: Partial<LlmCraftNote> = {}): LlmCraftNote {
  return { id, title: id, sites: ['product-page'], where: { category: ['apparel'] }, floor: 0.6, unserved: 'omit', priority: 4, enabled: true, body: `${id.toUpperCase()} BODY`, tier: 'builtin', ...overrides };
}

function requestOf(site: LlmPromptSite | undefined, extra: Partial<HostRequest> = {}): HostRequest {
  return { capability: 'summarize', renderLiveContext: () => [{ key: 'facts', text: 'facts: here' }], ...(site == null ? {} : { site }), ...extra };
}

function compose(request: HostRequest, contributors: ReadonlyArray<LlmPromptContributor<HostRequest>>, layout?: LlmPromptLayout) {
  return composeLlmCapabilityPrompt<HostRequest>({ request, descriptorOf: () => undefined, templateResolver: tieredLlmPromptTemplateResolver({ tiers: [] }), contributors, ...(layout == null ? {} : { layout }) });
}

function inputOf(request: HostRequest, diags: LlmCallDiagRecord[]): LlmPromptContributorInput<HostRequest> {
  return { request, descriptor: undefined, templates: { roles: {}, byKey: () => undefined }, liveBlockKeys: [], diag: (record) => diags.push(record) };
}

const NOTES: ReadonlyArray<LlmCraftNote> = [note('stable-a', { priority: 6 }), note('stable-b'), note('judged-include', { ask: '`brief` is a plain garment', unserved: 'include' }), note('judged-omit', { ask: '`brief` is a plain garment' })];

describe('llmCraftPromptContributor()', () => {
  it('places one heading per group, the stable group on the cache prefix and the unserved-include note volatile', async () => {
    const composed = await compose(requestOf(PAGE), [llmCraftPromptContributor({ sites: SITES, tiers: [NOTES] })]);
    const craft = composed.segments.filter((segment) => segment.id === 'craft');

    expect(craft.map((segment) => `${segment.key ?? ''}${segment.volatile === true ? ' (volatile)' : ''}`)).toEqual(['heading:stable', 'stable-a', 'stable-b', 'heading:judged (volatile)', 'judged-include (volatile)']);
    expect(composed.prompt).toContain(`${H.stable}\n\nSTABLE-A BODY\n\nSTABLE-B BODY\n\n${H.judged}\n\nJUDGED-INCLUDE BODY\n\nfacts: here`);
    expect(composed.cacheSegments.cachePrefix.endsWith('STABLE-B BODY\n\n')).toBe(true);
    expect(composed.cut.map((cut) => `${cut.key}:${cut.cut}`)).toEqual(['judged-omit:unserved']);
    expect(craft.slice(0, 2).map((segment) => segment.origin)).toEqual([
      { kind: 'generated', generator: 'craft-heading' },
      { kind: 'craft', note: 'stable-a', tier: 'builtin', by: 'match' }
    ]);
  });

  it('records every placed note and every cut on the supplements rows', async () => {
    const composed = await compose(requestOf(PAGE), [llmCraftPromptContributor({ sites: SITES, tiers: [NOTES] })]);
    const rows = llmPromptSupplementsOf(composed.contributions, composed.cut);

    expect(rows.find((row) => row.key === 'stable-a')).toEqual({ contributor: 'craft', slot: 'craft', id: 'craft', key: 'stable-a', hash: llmPromptCacheHash('STABLE-A BODY'), bytes: 'STABLE-A BODY'.length, tier: 'builtin', by: 'match' });
    expect(rows.find((row) => row.key === 'judged-include')?.by).toBe('unserved');
    expect(rows.at(-1)).toEqual({ contributor: 'craft', slot: 'craft', id: 'craft', key: 'judged-omit', hash: llmPromptCacheHash('JUDGED-OMIT BODY'), bytes: 'JUDGED-OMIT BODY'.length, tier: 'builtin', cut: 'unserved' });
  });

  it('is byte-identical with no site, a non-matching site, no notes, or enabled: false', async () => {
    const bare = await compose(requestOf(undefined), []);

    for (const [request, contributor] of [
      [requestOf(undefined), llmCraftPromptContributor<HostRequest>({ sites: SITES, tiers: [NOTES] })],
      [requestOf({ kind: 'product-page', facts: { category: 'shoes' } }), llmCraftPromptContributor<HostRequest>({ sites: SITES, tiers: [NOTES] })],
      [requestOf(PAGE), llmCraftPromptContributor<HostRequest>({ sites: SITES, tiers: [[]] })],
      [requestOf(PAGE), llmCraftPromptContributor<HostRequest>({ sites: SITES, tiers: [NOTES], enabled: false })]
    ] as const) {
      const composed = await compose(request, [contributor]);
      expect(composed.segments).toEqual(bare.segments);
      expect(composed.cut).toEqual([]);
    }
  });

  it('lets a later tier shadow an earlier one of the same id', async () => {
    const composed = await compose(requestOf(PAGE), [llmCraftPromptContributor({ sites: SITES, tiers: [[note('shared')], [note('shared', { tier: 'machine', body: 'MACHINE BODY' })]] })]);
    expect(composed.segments.filter((segment) => segment.id === 'craft').map((segment) => segment.promptSegment)).toEqual([`${H.stable}\n\n`, 'MACHINE BODY\n\n']);
  });

  it('a guarded capability places nothing and cuts every match with the guard reason', async () => {
    for (const [guardCutReason, expected] of [
      [undefined, 'guard'],
      ['audience-guard', 'audience-guard']
    ] as const) {
      const contributor = llmCraftPromptContributor<HostRequest>({ sites: SITES, tiers: [NOTES], guard: ({ request }) => request.capability === 'speak', guardCutReason });
      const composed = await compose(requestOf(PAGE, { capability: 'speak' }), [contributor]);

      expect(composed.segments.some((segment) => segment.id === 'craft')).toBe(false);
      expect(composed.cut.map((cut) => `${cut.key}:${cut.cut}`)).toEqual(['stable-a', 'judged-include', 'judged-omit', 'stable-b'].map((key) => `${key}:${expected}`));
    }
  });

  it('reads a per-request row tier: a workspace note shadows, a tombstone hides, an invalid row latches one diag', async () => {
    const rows: ReadonlyArray<LlmCraftNoteRow> = [
      { id: 'shared', text: '---\nid: shared\ntitle: Workspace\nsites: [product-page]\nwhere:\n  category: [apparel]\n---\nWORKSPACE BODY\n' },
      { id: 'stable-b', enabled: false },
      { id: 'broken', text: '---\nid: broken\n---\nno title\n' },
      { id: 'renamed', text: '---\nid: other-id\ntitle: Mismatch\nsites: [product-page]\n---\nX\n' }
    ];
    const readRows = makeLlmCraftNoteRowReader({ tier: 'workspace', sites: SITES });
    const contributor = llmCraftPromptContributor<HostRequest>({ sites: SITES, tiers: [[note('shared'), note('stable-b')], [note('shared', { tier: 'machine', body: 'MACHINE BODY' })], ({ request }) => readRows(request.craftRows)] });
    const diags: LlmCallDiagRecord[] = [];
    const input = inputOf(requestOf(PAGE, { craftRows: rows }), diags);
    const first = await contributor.resolve(input);

    expect(first.contributions.map((contribution) => contribution.text)).toEqual([H.stable, 'WORKSPACE BODY']);
    expect(first.contributions[1]?.origin).toEqual({ kind: 'craft', note: 'shared', tier: 'workspace', by: 'match' });
    expect(diags.map((record) => [record.code, record.fields?.['source'], record.message])).toEqual([
      ['craft-note-invalid', 'workspace:broken', 'a workspace craft note failed to parse and was skipped'],
      ['craft-note-invalid', 'workspace:renamed', 'a workspace craft note failed to parse and was skipped']
    ]);
    expect(diags.every((record) => record.level === 'warn' && typeof record.once === 'string')).toBe(true);

    // An unchanged tier reparses nothing new and re-sends the SAME latch keys (the sink dedupes on `once`).
    await contributor.resolve(input);
    expect(diags.slice(2).map((record) => record.once)).toEqual(diags.slice(0, 2).map((record) => record.once));
  });

  it('a row tombstone alone empties a site: byte-identical to no notes', async () => {
    const bare = await compose(requestOf(PAGE), []);
    const readRows = makeLlmCraftNoteRowReader({ tier: 'workspace', sites: SITES });
    const contributor = llmCraftPromptContributor<HostRequest>({ sites: SITES, tiers: [[note('only')], ({ request }) => readRows(request.craftRows)] });
    const composed = await compose(requestOf(PAGE, { craftRows: [{ id: 'only', enabled: false }] }), [contributor]);
    expect(composed.segments).toEqual(bare.segments);
  });

  it('never reads a per-request tier for a request without a site kind', async () => {
    let reads = 0;
    const reader = (): LlmCraftNoteSet => {
      reads += 1;
      return { tier: 'workspace', notes: [], refused: [] };
    };
    const contributor = llmCraftPromptContributor<HostRequest>({ sites: SITES, tiers: [NOTES, reader] });

    await compose(requestOf(undefined), [contributor]);
    await compose(requestOf({ facts: { category: 'apparel' } }), [contributor]);
    expect(reads).toBe(0);

    await compose(requestOf(PAGE), [contributor]);
    expect(reads).toBe(1);
  });

  it('places into a custom slot, with custom headings, and omits a blank heading', async () => {
    const layout = makeLlmPromptLayout(DEFAULT_LLM_PROMPT_LAYOUT.map((slot) => (slot.id === 'craft' ? { ...slot, id: 'notes' } : slot)));
    const custom = await compose(requestOf(PAGE), [llmCraftPromptContributor<HostRequest>({ sites: SITES, tiers: [[note('stable-a')]], slot: 'notes', headings: { stable: '## Know-how', judged: '## Know-how for now' } })], layout);
    expect(custom.segments.filter((segment) => segment.id === 'notes').map((segment) => segment.promptSegment)).toEqual(['## Know-how\n\n', 'STABLE-A BODY\n\n']);

    const blank = await compose(requestOf(PAGE), [llmCraftPromptContributor<HostRequest>({ sites: SITES, tiers: [[note('stable-a')]], headings: { stable: '', judged: H.judged } })]);
    expect(blank.segments.filter((segment) => segment.id === 'craft').map((segment) => segment.key)).toEqual(['stable-a']);
  });
});
