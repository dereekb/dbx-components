import { type } from 'arktype';
import { type Maybe } from '@dereekb/util';
import { describe, expect, it, type Mock, vi } from 'vitest';
import { type LlmCapabilityDescriptor } from '../capability/llm.capability.descriptor';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { makeLlmCallContext } from '../record/llm.call.context';
import { assembleLlmCapabilityPrompt, composeLlmCapabilityPrompt, type ComposeLlmCapabilityPromptConfig, DEFAULT_LLM_LINE_REPLY_PROTOCOL, type LlmComposedCapabilityPrompt } from './llm.prompt.assembly';
import { renderLlmOutputContract } from './llm.prompt.contract';
import { type LlmPromptContribution, type LlmPromptContributor, type LlmPromptContributorParams } from './llm.prompt.contributor';
import { DEFAULT_LLM_PROMPT_LAYOUT, type LlmPromptSlot, defineLlmPromptLayout } from './llm.prompt.layout';
import { type LlmLiveContextBlock } from './llm.prompt.live.context';
import { type LlmPromptTemplate, type LlmPromptTemplateResolver, type LlmResolvedPromptTemplates, makeLlmTieredPromptTemplateResolver } from './llm.prompt.template';

const TEMPLATES: ReadonlyArray<LlmPromptTemplate> = [
  { key: 'reply-protocol', role: 'reply-protocol', text: 'A-PROTOCOL' },
  { key: 'summarize:instructions', role: 'instructions', capability: 'summarize', text: 'B-SUMMARIZE' },
  { key: 'summarize:context', role: 'context', capability: 'summarize', text: 'C-SUMMARIZE\n{{liveContext}}' }
];

const SYNC_RESOLVER = makeLlmTieredPromptTemplateResolver({ tiers: [{ source: 'defaults', templates: TEMPLATES }] });

const SUMMARY_CONTRACT = { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] };
const OVERRIDE_CONTRACT = { type: 'object', properties: { verdict: { type: 'string' } }, required: ['verdict'] };

function descriptor(capability: string): LlmCapabilityDescriptor {
  return { capability, responseSchema: type({ summary: 'string' }), parseValue: (value) => value, responseSchemaHint: () => SUMMARY_CONTRACT, contractSchemaHint: () => SUMMARY_CONTRACT };
}

const DESCRIPTORS: Readonly<Record<string, LlmCapabilityDescriptor>> = { summarize: descriptor('summarize') };

const RENDERED: ReadonlyArray<LlmLiveContextBlock> = [
  { key: 'heading', text: '## Live context' },
  { key: 'empty', text: '' },
  { key: 'facts', text: 'facts: here' }
];

const TONE_SLOT: LlmPromptSlot = { id: 'tone', role: 'frame', occupancy: 'single', separator: '\n\n' };

const LAYOUT = defineLlmPromptLayout([DEFAULT_LLM_PROMPT_LAYOUT[0], TONE_SLOT, ...DEFAULT_LLM_PROMPT_LAYOUT.slice(1)]);

function request(extra: Partial<LlmDispatchRequest> = {}): LlmDispatchRequest {
  return { capability: 'summarize', renderLiveContext: () => RENDERED, ...extra };
}

interface Fixture {
  readonly resolver: LlmPromptTemplateResolver;
  readonly resolverCalls: () => number;
  readonly descriptorOf: Mock<(capability: string) => Maybe<LlmCapabilityDescriptor>>;
  readonly inputs: LlmPromptContributorParams[];
  readonly alpha: LlmPromptContributor;
  readonly notes: LlmPromptContributor;
}

function fixture(): Fixture {
  let calls = 0;
  const inputs: LlmPromptContributorParams[] = [];
  const resolver: LlmPromptTemplateResolver = (input) => {
    calls += 1;
    return Promise.resolve(SYNC_RESOLVER(input) as LlmResolvedPromptTemplates);
  };
  const alpha: LlmPromptContributor = {
    id: 'alpha',
    slots: ['tone'],
    resolve: (input) => {
      inputs.push(input);
      return { contributions: [{ contributor: 'alpha', slot: 'tone', id: 'tone', text: 'TONE', origin: { kind: 'frame' }, reason: 'the tone frame' }] };
    }
  };
  const notes: LlmPromptContributor = {
    id: 'notes',
    slots: ['craft', 'live'],
    resolve: (input) => {
      inputs.push(input);
      input.diag?.({ level: 'info', code: 'notes-skipped', message: 'no notes to add' });
      return {
        contributions: [
          { contributor: 'notes', slot: 'craft', id: 'craft', key: 'note-1', text: 'NOTE', origin: { kind: 'craft' }, reason: 'a craft note' },
          { contributor: 'notes', slot: 'live', id: 'live', key: 'sup', text: 'D-SUP', origin: { kind: 'supplement' }, reason: 'a supplement', anchor: { after: 'heading' } }
        ],
        cut: [{ contributor: 'notes', slot: 'craft', id: 'craft', key: 'note-2', text: 'NOTE-2', cut: 'budget' }]
      };
    }
  };

  return { resolver, resolverCalls: () => calls, descriptorOf: vi.fn((capability: string) => DESCRIPTORS[capability]), inputs, alpha, notes };
}

function compose(f: Fixture, extra: Partial<ComposeLlmCapabilityPromptConfig> = {}): Promise<LlmComposedCapabilityPrompt> {
  return composeLlmCapabilityPrompt({ request: request(), layout: LAYOUT, descriptorOf: f.descriptorOf, templateResolver: f.resolver, contributors: [f.alpha, f.notes], ...extra });
}

describe('composeLlmCapabilityPrompt()', () => {
  describe('lookups', () => {
    it('should look the descriptor up once, and not at all when one is passed', async () => {
      const f = fixture();
      await compose(f);
      expect(f.descriptorOf).toHaveBeenCalledTimes(1);
      expect(f.descriptorOf).toHaveBeenCalledWith('summarize');

      const g = fixture();
      await compose(g, { descriptor: DESCRIPTORS['summarize'] });
      expect(g.descriptorOf).not.toHaveBeenCalled();
    });

    it('should await the resolver once with the request and descriptor, and share its result with every contributor', async () => {
      const f = fixture();
      const seen: unknown[] = [];
      const resolver: LlmPromptTemplateResolver = (input) => {
        seen.push(input);
        return f.resolver(input);
      };
      const req = request();
      await compose(f, { request: req, templateResolver: resolver });
      expect(f.resolverCalls()).toBe(1);
      expect(seen).toEqual([{ request: req, descriptor: DESCRIPTORS['summarize'] }]);
      expect(f.inputs).toHaveLength(2);
      expect(f.inputs[0].templates).toBe(f.inputs[1].templates);
      expect(f.inputs[0].templates.roles.instructions?.key).toBe('summarize:instructions');
    });
  });

  describe('contributors', () => {
    it('should resolve each contributor once, in registry order, with the rendered keys', async () => {
      const f = fixture();
      const alphaSpy = vi.spyOn(f.alpha, 'resolve');
      const notesSpy = vi.spyOn(f.notes, 'resolve');
      await compose(f);
      expect(alphaSpy).toHaveBeenCalledTimes(1);
      expect(notesSpy).toHaveBeenCalledTimes(1);
      expect(alphaSpy.mock.invocationCallOrder[0]).toBeLessThan(notesSpy.mock.invocationCallOrder[0]);
      expect(f.inputs[0].liveBlockKeys).toEqual(['heading', 'empty', 'facts']);
    });

    it('should pass the model only when given', async () => {
      const f = fixture();
      await compose(f);
      expect('model' in f.inputs[0]).toBe(false);

      const g = fixture();
      await compose(g, { model: 'm/x' });
      expect(g.inputs[0].model).toBe('m/x');
    });

    it('should record a contributor diag on the call context', async () => {
      const f = fixture();
      const callContext = makeLlmCallContext({ label: 'summarize' });
      await compose(f, { callContext });
      expect(callContext.profile().diags?.map((diag) => diag.code)).toEqual(['notes-skipped']);
    });
  });

  describe('result', () => {
    it('should return the contributions, cuts and the merged, unfiltered live context', async () => {
      const composed = await compose(fixture());
      expect(composed.contributions.map((x) => `${x.contributor}:${x.text}`)).toEqual(['alpha:TONE', 'notes:NOTE', 'notes:D-SUP']);
      expect(composed.cut.map((x) => x.key)).toEqual(['note-2']);
      expect(composed.liveContext.map((block) => block.key)).toEqual(['heading', 'sup', 'empty', 'facts']);
    });

    it('should equal the assembly over the same inputs', async () => {
      const composed = await compose(fixture());
      const assembled = assembleLlmCapabilityPrompt({ layout: LAYOUT, capability: 'summarize', descriptor: DESCRIPTORS['summarize'], templates: SYNC_RESOLVER({ request: request(), descriptor: DESCRIPTORS['summarize'] }) as LlmResolvedPromptTemplates, liveContext: RENDERED, contributions: composed.contributions });
      expect(composed.segments).toEqual(assembled.segments);
      expect(composed.prompt).toBe(assembled.prompt);
      expect(composed.cacheSegments).toEqual(assembled.cacheSegments);
      expect(composed.prompt).toBe(`TONE\n\nA-PROTOCOL\n\nB-SUMMARIZE\n\nC-SUMMARIZE\n${renderLlmOutputContract({ schema: SUMMARY_CONTRACT })}\n\nNOTE\n\n## Live context\n\nD-SUP\n\nfacts: here`);
    });
  });

  describe('forwarding', () => {
    it("should forward the request's reply protocol", async () => {
      const composed = await compose(fixture(), { request: request({ replyProtocol: 'line' }) });
      expect(composed.prompt.startsWith(`TONE\n\n${DEFAULT_LLM_LINE_REPLY_PROTOCOL}\n\nB-SUMMARIZE`)).toBe(true);
    });

    it("should forward the request's contract footer and the contract hint", async () => {
      const composed = await compose(fixture(), { request: request({ contractFooter: 'CALL-FOOTER' }), contractSchemaHint: OVERRIDE_CONTRACT });
      expect(composed.prompt).toContain('- `verdict` (string, required)\n\nCALL-FOOTER\n\n');
      expect(composed.prompt).not.toContain('`summary`');
    });

    it('should apply the default reply protocol and the texts', async () => {
      const composed = await compose(fixture(), { defaultReplyProtocol: 'line', texts: { lineReplyProtocol: 'HOST-LINE' } });
      expect(composed.prompt.startsWith('TONE\n\nHOST-LINE\n\nB-SUMMARIZE')).toBe(true);
    });

    it('should use the default layout when none is passed', async () => {
      const f = fixture();
      const composed = await compose(f, { layout: undefined, contributors: [f.notes] });
      expect(composed.segments.map((segment) => segment.id)).toEqual(['reply-protocol', 'instructions', 'context-pre', 'contract', 'craft', 'live', 'live', 'live']);
    });
  });

  describe('model addendum', () => {
    const addendum: LlmPromptContributor = {
      id: 'model-addendum',
      slots: ['model-addendum'],
      resolve: (input) => ({ contributions: input.model == null ? [] : [{ contributor: 'model-addendum', slot: 'model-addendum', id: 'model-addendum', key: input.model, text: `ADDENDUM for ${input.model}`, origin: { kind: 'model' }, reason: 'the resolved model prompt addendum' }] })
    };

    it('should place the addendum first when a model is given, and none without one', async () => {
      const f = fixture();
      expect((await compose(f, { contributors: [f.alpha, addendum], model: 'm/x' })).prompt.startsWith('ADDENDUM for m/x\n\nTONE\n\n')).toBe(true);
      expect((await compose(f, { contributors: [f.alpha, addendum] })).prompt.startsWith('TONE\n\n')).toBe(true);
    });
  });

  describe('timing', () => {
    it('should time render, contribute and assemble, in order', async () => {
      let clock = 1000;
      const callContext = makeLlmCallContext({
        label: 'summarize',
        now: () => {
          clock += 1;
          return clock;
        }
      });
      await compose(fixture(), { callContext });
      expect(callContext.profile().spans.map((span) => span.name)).toEqual(['render', 'contribute', 'assemble']);
    });
  });

  describe('errors', () => {
    it('should reject when the resolver rejects', async () => {
      await expect(compose(fixture(), { templateResolver: () => Promise.reject(new Error('resolver down')) })).rejects.toThrow('resolver down');
    });

    it('should reject when a contributor rejects', async () => {
      const failing: LlmPromptContributor = { id: 'failing', slots: ['tone'], resolve: () => Promise.reject(new Error('contributor down')) };
      await expect(compose(fixture(), { contributors: [failing] })).rejects.toThrow('contributor down');
    });

    it('should reject a contribution in a slot the layout does not declare', async () => {
      const contribution: LlmPromptContribution = { contributor: 'stray', slot: 'nowhere', id: 'nowhere', text: 'X', origin: { kind: 'frame' }, reason: 'stray' };
      const stray: LlmPromptContributor = { id: 'stray', slots: ['nowhere'], resolve: () => ({ contributions: [contribution] }) };
      await expect(compose(fixture(), { contributors: [stray] })).rejects.toThrow("llm prompt seam: 'stray' offered a 'nowhere' contribution, but the layout declares no slot 'nowhere'.");
    });
  });
});
