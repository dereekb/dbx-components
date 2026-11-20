import { describe, expect, it } from 'vitest';
import { type AssembleLlmCapabilityPromptConfig, assembleLlmCapabilityPrompt, DEFAULT_LLM_LINE_REPLY_PROTOCOL, DEFAULT_LLM_MUST_RESOLVE_CLAUSE, type LlmAssembledPrompt, type LlmPromptAssemblyCapabilityRef } from './llm.prompt.assembly';
import { DEFAULT_LLM_OUTPUT_CONTRACT_FOOTER, DEFAULT_LLM_OUTPUT_CONTRACT_INTRO, renderLlmOutputContract } from './llm.prompt.contract';
import { type LlmPromptContribution } from './llm.prompt.contributor';
import { DEFAULT_LLM_PROMPT_LAYOUT, type LlmPromptLayout, type LlmPromptSlot, type LlmPromptSlotRole, defineLlmPromptLayout } from './llm.prompt.layout';
import { joinLlmLiveContextBlocks, type LlmLiveContextBlock, llmLiveContextHeadingBlock } from './llm.prompt.live.context';
import { isLlmPromptSegmentArray, joinLlmPromptSegments, splitLlmPromptCacheSegments, llmPromptSegmentSpans } from './llm.prompt.segment';
import { type LlmPromptTemplate, type LlmResolvedPromptTemplates, makeLlmTieredPromptTemplateResolver } from './llm.prompt.template';

const CAPABILITY_TEMPLATES: Readonly<Record<string, readonly [string, string]>> = {
  test: ['B-TEST', 'C-TEST\n{{liveContext}}'],
  summarize: ['B-SUMMARIZE', 'C-SUMMARIZE\n{{liveContext}}'],
  classify: ['B-CLASSIFY', 'C-CLASSIFY\n{{liveContext}}'],
  nomarker: ['B-NOMARK', 'C-NOMARK-BODY'],
  postmarker: ['B-POST', 'C-PRE\n{{liveContext}}\nC-POST'],
  twomarkers: ['B-TWO', 'PRE\n{{liveContext}}\nMID\n{{liveContext}}\nPOST'],
  opener: ['B-OPEN', '{{liveContext}}'],
  quoting: ['B quotes A-PROTOCOL', 'C-Q\n{{liveContext}}']
};

const TEMPLATES: ReadonlyArray<LlmPromptTemplate> = [
  { key: 'reply-protocol', role: 'reply-protocol', text: 'A-PROTOCOL' },
  ...Object.entries(CAPABILITY_TEMPLATES).flatMap(([capability, [instructions, context]]): LlmPromptTemplate[] => [
    { key: `${capability}:instructions`, role: 'instructions', capability, text: instructions },
    { key: `${capability}:context`, role: 'context', capability, text: context }
  ])
];

const RESOLVER = makeLlmTieredPromptTemplateResolver({ tiers: [{ source: 'defaults', templates: TEMPLATES }] });

/**
 * The library resolver's (synchronous) output for one capability.
 *
 * @param capability - The capability.
 * @returns The resolved templates.
 */
function templatesFor(capability: string): LlmResolvedPromptTemplates {
  return RESOLVER({ request: { capability, renderLiveContext: () => [] }, descriptor: undefined }) as LlmResolvedPromptTemplates;
}

const SUMMARY_CONTRACT = { type: 'object', properties: { summary: { type: 'string' }, points: { type: 'array', items: { type: 'string' } } }, required: ['summary'] };
const CLASSIFY_CONTRACT = { type: 'object', properties: { label: { type: 'string' } }, required: ['label'] };

const DESCRIPTORS: Readonly<Record<string, LlmPromptAssemblyCapabilityRef>> = {
  summarize: { contractSchemaHint: () => SUMMARY_CONTRACT },
  quoting: { contractSchemaHint: () => SUMMARY_CONTRACT },
  classify: { mustResolve: true, contractSchemaHint: () => CLASSIFY_CONTRACT },
  bare: { contractSchemaHint: () => CLASSIFY_CONTRACT }
};

const SUMMARY_RENDERED = renderLlmOutputContract({ schema: SUMMARY_CONTRACT });

function assemble(capability: string, extra: Partial<AssembleLlmCapabilityPromptConfig> = {}): LlmAssembledPrompt {
  return assembleLlmCapabilityPrompt({ capability, descriptor: DESCRIPTORS[capability], templates: templatesFor(capability), liveContext: 'D-LIVE', ...extra });
}

function frameSlot(id: string, extra: Partial<LlmPromptSlot> = {}): LlmPromptSlot {
  return { id, role: 'frame', occupancy: 'single', separator: '\n\n', ...extra };
}

function defaultSlot(role: LlmPromptSlotRole): LlmPromptSlot {
  return DEFAULT_LLM_PROMPT_LAYOUT.find((slot) => slot.role === role) as LlmPromptSlot;
}

const FRAMED_LAYOUT = defineLlmPromptLayout([
  defaultSlot('model-addendum'),
  frameSlot('tone'),
  frameSlot('perspective'),
  frameSlot('style'),
  defaultSlot('reply-protocol'),
  defaultSlot('reply-amendment'),
  defaultSlot('instructions'),
  defaultSlot('context-pre'),
  defaultSlot('contract'),
  frameSlot('speaker'),
  defaultSlot('craft'),
  defaultSlot('live'),
  defaultSlot('context-post'),
  defaultSlot('correction'),
  defaultSlot('follow-up')
]);

function contribution(slot: string, text: string, extra: Partial<LlmPromptContribution> = {}): LlmPromptContribution {
  return { contributor: 'host', slot, id: slot, text, origin: { kind: 'frame' }, reason: `the ${slot} piece`, ...extra };
}

function withoutRole(role: LlmPromptSlotRole): LlmPromptLayout {
  return DEFAULT_LLM_PROMPT_LAYOUT.filter((slot) => slot.role !== role);
}

function idsOf(assembled: LlmAssembledPrompt): ReadonlyArray<string> {
  return assembled.segments.map((segment) => segment.id);
}

function liveOf(assembled: LlmAssembledPrompt, id = 'live') {
  return assembled.segments.filter((segment) => segment.id === id);
}

describe('assembleLlmCapabilityPrompt()', () => {
  describe('bytes and separators', () => {
    it('should place the protocol, instructions, raw context-pre and the live context', () => {
      const assembled = assemble('test');
      expect(assembled.prompt).toBe('A-PROTOCOL\n\nB-TEST\n\nC-TEST\nD-LIVE');
      expect(idsOf(assembled)).toEqual(['reply-protocol', 'instructions', 'context-pre', 'live']);
      expect(assembled.cacheSegments).toEqual({ cachePrefix: 'A-PROTOCOL\n\nB-TEST\n\nC-TEST\n', volatileSuffix: 'D-LIVE' });
    });

    it('should close a no-marker context with the separator', () => {
      expect(assemble('nomarker').cacheSegments.cachePrefix).toBe('A-PROTOCOL\n\nB-NOMARK\n\nC-NOMARK-BODY\n\n');
    });

    it('should place the text after the marker after the live context', () => {
      expect(assemble('postmarker').cacheSegments).toEqual({ cachePrefix: 'A-PROTOCOL\n\nB-POST\n\nC-PRE\n', volatileSuffix: 'D-LIVE\nC-POST' });
    });

    it('should place the output contract after the context and before the live context, in the prefix', () => {
      const assembled = assemble('summarize');
      expect(assembled.cacheSegments.cachePrefix).toBe(`A-PROTOCOL\n\nB-SUMMARIZE\n\nC-SUMMARIZE\n${SUMMARY_RENDERED}\n\n`);
      expect(assembled.prompt.indexOf('## Output contract')).toBeLessThan(assembled.prompt.indexOf('D-LIVE'));
    });

    it('should place a contract for a capability without templates', () => {
      expect(assemble('bare').prompt).toBe(`A-PROTOCOL\n\n${renderLlmOutputContract({ schema: CLASSIFY_CONTRACT })}\n\nD-LIVE`);
    });

    it('should keep the prefix when only the live context changes', () => {
      expect(assemble('summarize', { liveContext: 'D-LIVE-1' }).cacheSegments.cachePrefix).toBe(assemble('summarize', { liveContext: 'D-LIVE-2' }).cacheSegments.cachePrefix);
    });

    it("should place '$' patterns literally", () => {
      expect(assemble('test', { liveContext: 'D $& $$ LIVE' }).prompt).toBe('A-PROTOCOL\n\nB-TEST\n\nC-TEST\nD $& $$ LIVE');
      expect(assemble('test', { layout: FRAMED_LAYOUT, contributions: [contribution('tone', 'T $& $1 $$')] }).prompt.startsWith('T $& $1 $$\n\nA-PROTOCOL')).toBe(true);
    });
  });

  describe('reply protocol', () => {
    it("should treat no named protocol as 'json'", () => {
      expect(assemble('summarize').prompt).toBe(assemble('summarize', { replyProtocol: 'json' }).prompt);
    });

    it("should replace the reply-protocol template with the built-in line protocol under 'line'", () => {
      const assembled = assemble('summarize', { replyProtocol: 'line' });
      expect(assembled.prompt).toBe(`${DEFAULT_LLM_LINE_REPLY_PROTOCOL}\n\nB-SUMMARIZE\n\nC-SUMMARIZE\nD-LIVE`);
      expect(assembled.segments[0].origin).toEqual({ kind: 'generated', generator: 'line-reply-protocol' });
      expect('key' in assembled.segments[0]).toBe(false);
      expect(idsOf(assembled)).not.toContain('contract');
    });

    it('should resolve the request, then the descriptor, then the host default', () => {
      const lineDescriptor: LlmPromptAssemblyCapabilityRef = { replyProtocol: 'line', contractSchemaHint: () => SUMMARY_CONTRACT };
      expect(assemble('summarize', { descriptor: lineDescriptor }).prompt.startsWith(DEFAULT_LLM_LINE_REPLY_PROTOCOL)).toBe(true);
      expect(assemble('summarize', { descriptor: lineDescriptor, replyProtocol: 'json' }).prompt.startsWith('A-PROTOCOL')).toBe(true);
      expect(assemble('summarize', { defaultReplyProtocol: 'line' }).prompt.startsWith(DEFAULT_LLM_LINE_REPLY_PROTOCOL)).toBe(true);
      expect(assemble('summarize', { descriptor: { replyProtocol: 'json', contractSchemaHint: () => SUMMARY_CONTRACT }, defaultReplyProtocol: 'line' }).prompt.startsWith('A-PROTOCOL')).toBe(true);
    });

    it("should place 'json-envelope' exactly as 'json'", () => {
      expect(assemble('classify', { replyProtocol: 'json-envelope' }).prompt).toBe(assemble('classify').prompt);
    });
  });

  describe('amendments', () => {
    it('should place the must-resolve clause after the protocol, before the instructions and the contract, in the prefix', () => {
      const assembled = assemble('classify');
      expect(assembled.prompt.startsWith(`A-PROTOCOL\n\n${DEFAULT_LLM_MUST_RESOLVE_CLAUSE}\n\n`)).toBe(true);
      expect(assembled.prompt.indexOf('B-CLASSIFY')).toBeGreaterThan(assembled.prompt.indexOf(DEFAULT_LLM_MUST_RESOLVE_CLAUSE));
      expect(assembled.cacheSegments.cachePrefix).toContain(DEFAULT_LLM_MUST_RESOLVE_CLAUSE);
      expect(assembled.segments[1]).toEqual({ id: 'reply-amendment', promptSegment: `${DEFAULT_LLM_MUST_RESOLVE_CLAUSE}\n\n`, origin: { kind: 'generated', generator: 'must-resolve-amendment' }, reason: expect.any(String) });
    });

    it("should place no clause without the flag, or under 'line'", () => {
      expect(idsOf(assemble('summarize'))).not.toContain('reply-amendment');
      expect(assemble('classify', { replyProtocol: 'line' }).prompt).not.toContain(DEFAULT_LLM_MUST_RESOLVE_CLAUSE);
    });

    it("should place no amendment under 'line', and carry a host amendment through a frame slot", () => {
      expect(idsOf(assemble('summarize', { replyProtocol: 'line' }))).not.toContain('reply-amendment');

      const layout = defineLlmPromptLayout(DEFAULT_LLM_PROMPT_LAYOUT.flatMap((slot) => (slot.role === 'reply-amendment' ? [slot, frameSlot('manner')] : [slot])));
      const assembled = assemble('summarize', { layout, replyProtocol: 'line', contributions: [contribution('manner', 'MANNER', { id: 'reply-amendment' })] });
      expect(assembled.prompt.startsWith(`${DEFAULT_LLM_LINE_REPLY_PROTOCOL}\n\nMANNER\n\nB-SUMMARIZE`)).toBe(true);
      expect(assembled.segments[1]).toEqual({ id: 'reply-amendment', promptSegment: 'MANNER\n\n', origin: { kind: 'frame' }, reason: expect.any(String) });
    });
  });

  describe('context marker', () => {
    it('should split at the first marker only and keep later markers literal', () => {
      expect(assemble('twomarkers').segments.find((segment) => segment.id === 'context-post')?.promptSegment).toBe('\nMID\n{{liveContext}}\nPOST');
    });

    it('should still place an empty context-pre when the marker opens the body, and no context-post', () => {
      const assembled = assemble('opener');
      expect(assembled.segments.find((segment) => segment.id === 'context-pre')?.promptSegment).toBe('');
      expect(idsOf(assembled)).not.toContain('context-post');
    });

    it('should record the marker fill on both halves, and no fills without a marker', () => {
      const origin = { kind: 'template', templateKey: 'postmarker:context', source: 'defaults', fills: ['{{liveContext}}'] };
      const assembled = assemble('postmarker');
      expect(assembled.segments.find((segment) => segment.id === 'context-pre')?.origin).toEqual(origin);
      expect(assembled.segments.find((segment) => segment.id === 'context-post')?.origin).toEqual(origin);
      expect('fills' in (assemble('nomarker').segments.find((segment) => segment.id === 'context-pre')?.origin ?? {})).toBe(false);
    });
  });

  describe('live', () => {
    const BLOCKS: ReadonlyArray<LlmLiveContextBlock> = [llmLiveContextHeadingBlock(), { key: 'directive', text: 'Directive: hold.', reason: 'the standing directive' }, { key: 'cast', text: 'Cast:\n- Ben' }];

    it('should place one volatile segment per block, closing the last with the last separator', () => {
      const live = liveOf(assemble('test', { liveContext: BLOCKS }));
      expect(live.map((segment) => segment.key)).toEqual(['heading', 'directive', 'cast']);
      expect(live.every((segment) => segment.volatile === true)).toBe(true);
      expect(live[0].promptSegment).toBe('## Live context\n\n');
      expect(live[2].promptSegment).toBe('Cast:\n- Ben');
      expect(live[1].reason).toBe('the standing directive');
    });

    it('should send the same bytes for the blocks and their joined string', () => {
      expect(assemble('test', { liveContext: BLOCKS }).prompt).toBe(assemble('test', { liveContext: joinLlmLiveContextBlocks(BLOCKS) }).prompt);
    });

    it('should keep one empty volatile boundary segment for an empty live context', () => {
      for (const liveContext of ['', []]) {
        const assembled = assemble('postmarker', { liveContext });
        expect(liveOf(assembled)).toEqual([{ id: 'live', promptSegment: '', origin: { kind: 'live-context', capability: 'postmarker' }, reason: expect.any(String), volatile: true }]);
        expect(assembled.cacheSegments.volatileSuffix).toBe('\nC-POST');
      }
    });

    it('should move the cache boundary past stable leading blocks without changing the prompt', () => {
      const declared: ReadonlyArray<LlmLiveContextBlock> = [
        { ...llmLiveContextHeadingBlock(), volatile: false },
        { key: 'brief', text: 'BRIEF', volatile: false },
        { key: 'now', text: 'NOW' }
      ];
      const undeclared = declared.map(({ key, text }) => ({ key, text }));
      expect(assemble('test', { liveContext: declared }).cacheSegments.cachePrefix).toBe('A-PROTOCOL\n\nB-TEST\n\nC-TEST\n## Live context\n\nBRIEF\n\n');
      expect(assemble('test', { liveContext: declared }).prompt).toBe(assemble('test', { liveContext: undeclared }).prompt);
      expect(assemble('test', { liveContext: undeclared }).cacheSegments.cachePrefix).toBe('A-PROTOCOL\n\nB-TEST\n\nC-TEST\n');
    });

    it('should force the last block volatile and replace its reason when every block claims stability', () => {
      const assembled = assemble('postmarker', {
        liveContext: [
          { ...llmLiveContextHeadingBlock(), volatile: false },
          { key: 'what', text: 'WHAT-JUST-HAPPENED', volatile: false, reason: 'its own reason' }
        ]
      });
      const live = liveOf(assembled);
      expect(live.filter((segment) => segment.volatile === true).map((segment) => segment.key)).toEqual(['what']);
      expect(live[1].reason).toContain('forced volatile');
      expect(assembled.cacheSegments.volatileSuffix).toBe('WHAT-JUST-HAPPENED\nC-POST');
    });

    it('should give every live segment an explicit volatile, and only a volatile contribution elsewhere', () => {
      const assembled = assemble('summarize', {
        layout: FRAMED_LAYOUT,
        liveContext: [
          { ...llmLiveContextHeadingBlock(), volatile: false },
          { key: 'cast', text: 'CAST' }
        ],
        contributions: [contribution('tone', 'TONE'), contribution('craft', 'JUDGED', { volatile: true })]
      });
      assembled.segments.forEach((segment) => expect('volatile' in segment).toBe(segment.id === 'live' || segment.id === 'craft'));
      expect(liveOf(assembled).map((segment) => segment.volatile)).toEqual([false, true]);
    });

    it('should merge live contributions at their anchors before dropping empty blocks', () => {
      const blocks: ReadonlyArray<LlmLiveContextBlock> = [
        { key: 'heading', text: '' },
        { key: 'members', text: 'MEMBERS' },
        { key: 'vocabulary', text: 'VOCAB' }
      ];
      const anchored = assemble('test', { liveContext: blocks, contributions: [contribution('live', 'WRITER', { contributor: 'notes', key: 'writer', anchor: { after: 'heading' } })] });
      expect(liveOf(anchored).map((segment) => segment.key)).toEqual(['writer', 'members', 'vocabulary']);
      const keyless = assemble('test', { liveContext: blocks, contributions: [contribution('live', 'SUP', { contributor: 'notes' })] });
      expect(liveOf(keyless).map((segment) => segment.key)).toEqual(['members', 'vocabulary', 'notes']);
      const missing = assemble('test', { liveContext: blocks, contributions: [contribution('live', 'SUP', { key: 'sup', anchor: { after: 'absent' } })] });
      expect(liveOf(missing).map((segment) => segment.key)).toEqual(['sup', 'members', 'vocabulary']);
    });
  });

  describe('contributions and layout', () => {
    const FRAMES = [contribution('tone', 'TONE'), contribution('perspective', 'PERSPECTIVE'), contribution('style', 'STYLE')];

    it('should place frames in layout order ahead of the protocol, in the prefix', () => {
      const assembled = assemble('test', { layout: FRAMED_LAYOUT, contributions: [...FRAMES].reverse() });
      expect(idsOf(assembled).slice(0, 4)).toEqual(['tone', 'perspective', 'style', 'reply-protocol']);
      expect(assembled.cacheSegments.cachePrefix.startsWith('TONE\n\nPERSPECTIVE\n\nSTYLE\n\nA-PROTOCOL\n\n')).toBe(true);
    });

    it('should place a frame declared after the contract after it, sharing every segment before it', () => {
      const speaker = (text: string) => assemble('nomarker', { layout: FRAMED_LAYOUT, descriptor: DESCRIPTORS['summarize'], contributions: [contribution('speaker', text)] });
      const first = speaker('SPEAKER-1');
      expect(idsOf(first)).toEqual(['reply-protocol', 'instructions', 'context-pre', 'contract', 'speaker', 'live']);
      expect(first.segments.slice(0, 4)).toEqual(speaker('SPEAKER-2').segments.slice(0, 4));
      expect(first.cacheSegments.cachePrefix.endsWith('SPEAKER-1\n\n')).toBe(true);
    });

    it("should keep a craft slot's contributions in contribution order; the first volatile one starts the suffix", () => {
      const assembled = assemble('test', { contributions: [contribution('craft', 'CRAFT-S1', { key: 's1' }), contribution('craft', 'CRAFT-S2', { key: 's2' }), contribution('craft', 'CRAFT-V1', { key: 'v1', volatile: true }), contribution('craft', 'CRAFT-V2', { key: 'v2', volatile: true })] });
      expect(liveOf(assembled, 'craft').map((segment) => segment.key)).toEqual(['s1', 's2', 'v1', 'v2']);
      expect(assembled.cacheSegments.cachePrefix.endsWith('CRAFT-S1\n\nCRAFT-S2\n\n')).toBe(true);
      expect(assembled.cacheSegments.volatileSuffix.startsWith('CRAFT-V1\n\n')).toBe(true);

      const volatileFirst = assemble('test', { contributions: [contribution('craft', 'CRAFT-V1', { key: 'v1', volatile: true }), contribution('craft', 'CRAFT-S1', { key: 's1' })] });
      expect(liveOf(volatileFirst, 'craft').map((segment) => segment.key)).toEqual(['v1', 's1']);
      expect(volatileFirst.cacheSegments.volatileSuffix.startsWith('CRAFT-V1\n\n')).toBe(true);
    });

    it('should fail loud when a single slot is held twice', () => {
      expect(() => assemble('test', { layout: FRAMED_LAYOUT, contributions: [contribution('tone', 'A'), contribution('tone', 'B', { contributor: 'other' })] })).toThrow(/slot 'tone' holds one contribution/);
    });

    it('should treat no contributions as an empty list', () => {
      expect(assemble('test', { contributions: [] })).toEqual(assemble('test'));
    });

    it("should pass a contribution's origin, key and reason through, with volatile only when set", () => {
      const assembled = assemble('test', { layout: FRAMED_LAYOUT, contributions: [contribution('speaker', 'SPEECH', { origin: { kind: 'speech-style' }, key: 'speech', reason: 'the speaker speaks' })] });
      expect(assembled.segments.find((segment) => segment.id === 'speaker')).toEqual({ id: 'speaker', promptSegment: 'SPEECH\n\n', origin: { kind: 'speech-style' }, key: 'speech', reason: 'the speaker speaks' });
    });

    it("should close pieces with the slot's own separators", () => {
      const layout = defineLlmPromptLayout([{ id: 'notes', role: 'frame', occupancy: 'many', separator: '\n---\n', lastSeparator: '\n\n' }, defaultSlot('reply-protocol'), { id: 'live', role: 'live', occupancy: 'many', separator: '\n', lastSeparator: '' }]);
      const templates: LlmResolvedPromptTemplates = { roles: { 'reply-protocol': templatesFor('test').roles['reply-protocol'] }, byKey: () => undefined };
      const assembled = assembleLlmCapabilityPrompt({
        capability: 'test',
        layout,
        templates,
        liveContext: [
          { key: 'a', text: 'L1' },
          { key: 'b', text: 'L2' }
        ],
        contributions: [contribution('notes', 'X'), contribution('notes', 'Y')]
      });
      expect(assembled.prompt).toBe('X\n---\nY\n\nA-PROTOCOL\n\nL1\nL2');
    });
  });

  describe('fail loud', () => {
    it('should throw when a piece has no slot, or when the layout has no live slot', () => {
      const cases: ReadonlyArray<readonly [string, Partial<AssembleLlmCapabilityPromptConfig>]> = [
        ['test', { layout: withoutRole('live') }],
        ['summarize', { layout: withoutRole('contract') }],
        ['test', { layout: withoutRole('instructions') }],
        ['postmarker', { layout: withoutRole('context-post') }],
        ['test', { layout: withoutRole('reply-protocol'), replyProtocol: 'line' }],
        ['classify', { layout: withoutRole('reply-amendment') }]
      ];

      for (const [capability, extra] of cases) {
        expect(() => assemble(capability, extra)).toThrow(/^llm prompt assembly: /);
      }
    });

    it('should need no slot for a role with nothing to place, and place nothing in dispatcher slots', () => {
      expect(assemble('test', { layout: withoutRole('contract') }).prompt).toBe(assemble('test').prompt);
      expect(idsOf(assemble('postmarker'))).not.toContain('correction');
      expect(idsOf(assemble('postmarker'))).not.toContain('follow-up');
    });
  });

  describe('texts', () => {
    it('should change exactly its own bytes for each text override', () => {
      expect(assemble('summarize', { replyProtocol: 'line', texts: { lineReplyProtocol: 'MY-LINE' } }).prompt).toBe(assemble('summarize', { replyProtocol: 'line' }).prompt.replace(DEFAULT_LLM_LINE_REPLY_PROTOCOL, 'MY-LINE'));
      expect(assemble('classify', { texts: { mustResolveClause: 'MY-MUST' } }).prompt).toBe(assemble('classify').prompt.replace(DEFAULT_LLM_MUST_RESOLVE_CLAUSE, 'MY-MUST'));
      expect(assemble('summarize', { texts: { outputContractIntro: 'MY-INTRO' } }).prompt).toBe(assemble('summarize').prompt.replace(DEFAULT_LLM_OUTPUT_CONTRACT_INTRO, 'MY-INTRO'));
      expect(assemble('summarize', { texts: { outputContractFooter: 'MY-FOOTER' } }).prompt).toBe(assemble('summarize').prompt.replace(DEFAULT_LLM_OUTPUT_CONTRACT_FOOTER, 'MY-FOOTER'));
    });

    it("should let a call's contractFooter win, and keep a default for an undefined text", () => {
      expect(assemble('summarize', { contractFooter: 'CALL-FOOTER', texts: { outputContractFooter: 'MY-FOOTER' } }).prompt).toBe(assemble('summarize').prompt.replace(DEFAULT_LLM_OUTPUT_CONTRACT_FOOTER, 'CALL-FOOTER'));
      expect(assemble('summarize', { replyProtocol: 'line', texts: { lineReplyProtocol: undefined } }).prompt).toBe(assemble('summarize', { replyProtocol: 'line' }).prompt);
    });

    it('should apply a per-call contract schema over the descriptor one', () => {
      expect(assemble('summarize', { contractSchemaHint: CLASSIFY_CONTRACT }).prompt).toContain(renderLlmOutputContract({ schema: CLASSIFY_CONTRACT }));
      expect(assemble('test', { contractSchemaHint: CLASSIFY_CONTRACT }).prompt).not.toContain('## Output contract');
    });
  });

  describe('derivations', () => {
    const CONFIGS: ReadonlyArray<readonly [string, string, Partial<AssembleLlmCapabilityPromptConfig>]> = [
      ['test', 'test', {}],
      ['nomarker', 'nomarker', {}],
      ['postmarker', 'postmarker', {}],
      ['summarize', 'summarize', {}],
      ['classify', 'classify', {}],
      ['line', 'summarize', { replyProtocol: 'line' }],
      ['framed', 'summarize', { layout: FRAMED_LAYOUT, contributions: [contribution('tone', 'TONE'), contribution('speaker', 'SPEAKER')] }],
      ['blocks', 'test', { liveContext: [llmLiveContextHeadingBlock(), { key: 'cast', text: 'CAST' }] }],
      ['empty', 'postmarker', { liveContext: '' }],
      ['quoting', 'quoting', {}]
    ];

    for (const [name, capability, extra] of CONFIGS) {
      it(`should derive the prompt, the cache split and gapless spans from the segments (${name})`, () => {
        const assembled = assemble(capability, extra);
        expect(isLlmPromptSegmentArray(assembled.segments)).toBe(true);
        expect(joinLlmPromptSegments(assembled.segments)).toBe(assembled.prompt);
        expect(splitLlmPromptCacheSegments(assembled.segments)).toEqual(assembled.cacheSegments);
        expect(assembled.cacheSegments.cachePrefix + assembled.cacheSegments.volatileSuffix).toBe(assembled.prompt);

        const spans = llmPromptSegmentSpans(assembled.segments);
        expect(spans.at(-1)?.end).toBe(assembled.prompt.length);
        spans.forEach((span, index) => {
          expect(span.start).toBe(index === 0 ? 0 : spans[index - 1].end);
          expect(assembled.prompt.slice(span.start, span.end)).toBe(span.segment.promptSegment);
        });
      });
    }
  });

  describe('origins', () => {
    it('should tag template, generated and live-context origins', () => {
      const assembled = assemble('summarize');
      expect(assembled.segments[0]).toMatchObject({ id: 'reply-protocol', key: 'reply-protocol', origin: { kind: 'template', templateKey: 'reply-protocol', source: 'defaults' } });
      expect(assembled.segments[1]).toMatchObject({ id: 'instructions', key: 'summarize:instructions', origin: { kind: 'template', templateKey: 'summarize:instructions', source: 'defaults' } });
      const contract = assembled.segments.find((segment) => segment.id === 'contract');
      expect(contract?.origin).toEqual({ kind: 'generated', generator: 'output-contract' });
      expect(contract != null && 'key' in contract).toBe(false);
      expect(liveOf(assembled)[0].origin).toEqual({ kind: 'live-context', capability: 'summarize', block: 'live-context' });
    });

    it('should place only the live context (and a contract) without templates', () => {
      expect(idsOf(assemble('test', { templates: undefined }))).toEqual(['live']);
      expect(idsOf(assemble('summarize', { templates: undefined }))).toEqual(['contract', 'live']);
    });
  });
});
