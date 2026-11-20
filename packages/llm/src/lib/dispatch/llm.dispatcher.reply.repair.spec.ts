/**
 * The dispatcher's REPLY-REPAIR LANE across attempts — repair before retry: the deterministic tier on a clean-stop,
 * object-led reply the reader could not read, then at most one fast fix, with the finish-reason gate keeping every
 * truncation on its own path.
 *
 * The single-attempt halves (the in-place near-miss, the runaway refusal, prose-led / line replies, the single-shot
 * near-miss and the raw-JSON watch) live in `llm.dispatcher.pipeline.spec.ts`.
 */

import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { makeLlmScriptedStrategy, type LlmScriptedReplies } from '@dereekb/llm/test';
import { LLM_CRITIQUE_REPLY_DESCRIPTOR, LLM_CRITIQUE_REPLY_TEMPLATE, makeLlmSemanticCritic } from '../capability/llm.capability.critique.reply';
import { LLM_REPAIR_REPLY_JSON_DESCRIPTOR, LLM_REPAIR_REPLY_JSON_TEMPLATE, LLM_REPLY_REPAIR_FAST_FIX_SWALLOW_SITE, makeLlmReplyFastFixer, renderLlmRepairReplyJsonContext } from '../capability/llm.capability.repair.reply.json';
import { defineLlmCapability, type LlmCapabilityDescriptor } from '../capability/llm.capability.descriptor';
import { type LlmModelTierMap } from '../model/llm.model.tier';
import { type LlmLiveContextBlock } from '../prompt/llm.prompt.live.context';
import { type LlmPromptTemplate, makeLlmTieredPromptTemplateResolver } from '../prompt/llm.prompt.template';
import { type LlmCallContext, type LlmCallDiag, makeLlmCallContext } from '../record/llm.call.context';
import { type LlmCallRecord, type LlmDecodeFailureRecord } from '../record/llm.call.record';
import { type LlmSwallowSiteId } from '../record/llm.swallow';
import { compileLlmCritiquePolicy, LLM_CRITIQUE_REPLY_CAPABILITY } from '../reply/llm.reply.critique';
import { readLlmReply } from '../reply/llm.reply.envelope';
import { DEFAULT_LLM_REPLY_FAST_FIX_LIMITS, LLM_REPAIR_REPLY_JSON_CAPABILITY, type LlmReplyFastFixer } from '../reply/llm.reply.fast.fix';
import { scoreLlmReplyJson } from '../reply/llm.reply.repair';
import { type LlmDispatchResult, type LlmRequest } from '../strategy/llm.strategy';
import { makeLlmStrategyRegistry } from '../strategy/llm.strategy.registry';
import { type LlmDispatchRequest } from './llm.dispatch.request';
import { type LlmDispatcherConfig, type LlmDispatchRecorder } from './llm.dispatcher.config';
import { makeLlmDispatcher } from './llm.dispatcher.pipeline';

// MARK: Fixtures
const TEMPLATES: ReadonlyArray<LlmPromptTemplate> = [
  { key: 'reply-protocol', role: 'reply-protocol', text: 'A-PROTOCOL' },
  { key: 'instructions', role: 'instructions', text: 'B-CAP' },
  { key: 'context', role: 'context', text: 'C-CTX\n{{liveContext}}' }
];

/**
 * The fixer's built-in template is the LOWEST tier; the app's shared templates sit above it, and the fixer's
 * capability-scoped instructions still beat the shared `B-CAP`.
 */
const RESOLVER = makeLlmTieredPromptTemplateResolver({
  tiers: [
    { source: 'llm', templates: [LLM_REPAIR_REPLY_JSON_TEMPLATE] },
    { source: 'defaults', templates: TEMPLATES }
  ]
});

const TIERS: LlmModelTierMap = { fast: 'test/fast', strong: 'test/strong' };

const LINE: LlmCapabilityDescriptor = defineLlmCapability({ capability: 'LineCap', replyProtocol: 'line', responseSchema: type({ line: 'string' }), parseValue: (value) => value as { line: string } });

const DESCRIPTORS: Readonly<Record<string, LlmCapabilityDescriptor>> = {
  [LLM_REPAIR_REPLY_JSON_CAPABILITY]: LLM_REPAIR_REPLY_JSON_DESCRIPTOR,
  LineCap: LINE
};

const MANGLED = '{"say":"a long enough line of dialogue","n":None}';
const FIXED = '{"say":"a long enough line of dialogue","n":null}';
/**
 * A clean-stop reply one `close-object` op repairs.
 */
const NEAR_MISS = '{"say":"a long enough line of dialogue","n":1';
const OK = '{"say":"ok"}';
const SUBJECT_HINT = { type: 'object', properties: { say: { type: 'string' }, n: { type: ['null', 'number'] } } };
const acceptAny = () => true as const;

function liveContext(): ReadonlyArray<LlmLiveContextBlock> {
  return [{ key: 'live-context', text: 'D-LIVE' }];
}

interface SetupConfig extends Partial<LlmDispatcherConfig<LlmDispatchRequest, LlmDispatchResult>> {
  readonly subject?: LlmScriptedReplies;
  readonly fixer?: LlmScriptedReplies;
}

function setup(config: SetupConfig = {}) {
  const requests: LlmRequest[] = [];
  const decodeFailures: LlmDecodeFailureRecord[] = [];
  const { subject, fixer, ...rest } = config;
  const strategy = makeLlmScriptedStrategy({ id: 's', byCapability: { TestCap: subject ?? [OK], LineCap: subject ?? [OK], [LLM_REPAIR_REPLY_JSON_CAPABILITY]: fixer ?? [FIXED] }, requests });
  const recorder: LlmDispatchRecorder<LlmDispatchRequest> = { recordCall: () => undefined, recordDecodeFailure: (record) => decodeFailures.push(record) };
  const dispatcher = makeLlmDispatcher<LlmDispatchRequest, LlmDispatchResult>({
    strategies: makeLlmStrategyRegistry([strategy]),
    defaultStrategyId: 's',
    defaultMaxOutputTokens: 1024,
    modelTiers: TIERS,
    descriptorOf: (capability) => DESCRIPTORS[capability],
    templateResolver: RESOLVER,
    transportBackoff: () => 0,
    recorder,
    ...rest
  });
  return { dispatcher, requests, decodeFailures };
}

/**
 * Build a dispatcher, run one subject request under a timing context, and split what was sent.
 */
async function run(config: SetupConfig & { readonly request?: Partial<LlmDispatchRequest> } = {}) {
  const { request, ...rest } = config;
  const swallows: LlmSwallowSiteId[] = [];
  const context = makeLlmCallContext({ label: 'root', timing: true, onSwallow: (site) => swallows.push(site) });
  const { dispatcher, requests, decodeFailures } = setup(rest);
  const result = await dispatcher.dispatch({ capability: 'TestCap', renderLiveContext: liveContext, validate: acceptAny, responseSchemaHint: SUBJECT_HINT, callContext: context, ...request });
  const subjectCalls = requests.filter((sent) => sent.capability !== LLM_REPAIR_REPLY_JSON_CAPABILITY);
  const fixerCalls = requests.filter((sent) => sent.capability === LLM_REPAIR_REPLY_JSON_CAPABILITY);
  const diags = diagsOf(context);
  return { result, requests, subjectCalls, fixerCalls, decodeFailures, diags, swallows };
}

function diagsOf(context: LlmCallContext): ReadonlyArray<LlmCallDiag> {
  const profile = context.profile();
  const all: LlmCallDiag[] = [];
  const walk = (node: typeof profile) => {
    all.push(...(node.diags ?? []));
    node.children.forEach(walk);
  };
  walk(profile);
  return all;
}

function reasonsOf(diags: ReadonlyArray<LlmCallDiag>, code: string): ReadonlyArray<unknown> {
  return diags.filter((diag) => diag.code === code).map((diag) => diag.fields?.['reason']);
}

// MARK: Specs
describe('makeLlmDispatcher() reply repair', () => {
  it('should score the mangled fixture above the fast-fix floor', () => {
    const shape = scoreLlmReplyJson(MANGLED);

    expect(shape.verdict).toBe('mangled');
    expect(shape.score).toBeGreaterThanOrEqual(DEFAULT_LLM_REPLY_FAST_FIX_LIMITS.minScore);
  });

  describe('the deterministic tier', () => {
    it('should save a last-attempt near-miss (accepted on attempt 2)', async () => {
      let calls = 0;
      const schemaOnce = () => (calls++ === 0 ? { error: 'say must be present' } : true);
      const { result, subjectCalls } = await run({ subject: ['{"choice":"other"}', { text: NEAR_MISS, finishReason: 'stop' }], request: { validate: schemaOnce } });

      expect(subjectCalls).toHaveLength(2);
      expect(result.decodeStatus).toBe('retried');
      expect(result.repair).toMatchObject({ tier: 'deterministic', attempt: 2 });
    });

    it("should re-ask a repaired value the validator rejects with the VALIDATOR's error, not the parse-error text", async () => {
      let calls = 0;
      const rejectFirst = () => (calls++ === 0 ? { error: 'say must be longer' } : true);
      const { subjectCalls } = await run({ subject: ['{"say":"a long enough line of dialogue"', OK], request: { validate: rejectFirst } });

      expect(subjectCalls).toHaveLength(2);
      expect(subjectCalls[1].prompt).toContain('say must be longer');
      expect(subjectCalls[1].prompt).not.toContain('not parseable JSON');
    });

    it('should keep the budget rung on a length-capped reply and never repair it on the final attempt either', async () => {
      const closable = '{"say":"a long enough line of dialogue"';
      const { result, subjectCalls, diags } = await run({ subject: [{ text: closable, finishReason: 'length' }], request: { maxAttempts: 2 } });

      expect(subjectCalls).toHaveLength(2);
      // the library's default budget 1024 × 4
      expect(subjectCalls[1].maxOutputTokens).toBe(4096);
      expect(result.repair).toBeUndefined();
      expect(result.decodeStatus).toBe('dropped');
      expect(reasonsOf(diags, 'reply-repair-refused')).toEqual(['unclean-finish']);
    });
  });

  describe('the fast-fix tier', () => {
    it('should make exactly ONE fixer call for a mangled reply: the broken reply + the subject schema, no live context and no subject re-ask', async () => {
      const { result, subjectCalls, fixerCalls } = await run({ subject: [MANGLED], replyFastFix: makeLlmReplyFastFixer() });

      expect(subjectCalls).toHaveLength(1);
      expect(fixerCalls).toHaveLength(1);
      const fixer = fixerCalls[0];

      renderLlmRepairReplyJsonContext({ text: MANGLED, shape: scoreLlmReplyJson(MANGLED) }).forEach((block) => expect(fixer.prompt).toContain(block.text));
      expect(fixer.prompt).not.toContain('D-LIVE');
      expect((fixer.responseSchemaHint as { properties?: Record<string, unknown> }).properties).toHaveProperty('say');
      expect(result.decodeStatus).toBe('clean');
      expect(result.repair).toMatchObject({ tier: 'fast-fix', attempt: 1, verdict: 'mangled', originalText: MANGLED });
      expect(readLlmReply(result.text)).toEqual({ kind: 'value', value: { say: 'a long enough line of dialogue', n: null } });
    });

    it('should miss on fidelity when the fixer changes a number, and re-ask the subject', async () => {
      const { subjectCalls, fixerCalls, diags } = await run({ subject: [MANGLED, OK], fixer: ['{"say":"a long enough line of dialogue","n":7}'], replyFastFix: makeLlmReplyFastFixer() });

      expect(fixerCalls).toHaveLength(1);
      expect(subjectCalls).toHaveLength(2);
      expect(reasonsOf(diags, 'reply-fast-fix-miss')).toEqual(['fidelity']);
    });

    it('should swallow a fixer that throws: the subject re-asks and the dispatch does not throw', async () => {
      const throwing: LlmReplyFastFixer = () => Promise.reject(new Error('fixer down'));
      const { result, subjectCalls, decodeFailures, swallows } = await run({ subject: [MANGLED, OK], replyFastFix: throwing });

      expect(subjectCalls).toHaveLength(2);
      expect(result.decodeStatus).toBe('retried');
      expect(swallows).toContain(LLM_REPLY_REPAIR_FAST_FIX_SWALLOW_SITE);
      expect(decodeFailures[0].payload.failures[0]).toMatchObject({ class: 'parse-error', fastFix: 'missed', fastFixMiss: 'error', shape: { verdict: 'mangled' } });
    });

    it('should count a cut-off or a declining fixer as a miss', async () => {
      const truncated = await run({ subject: [MANGLED, OK], fixer: [{ text: '{"say":"a long', finishReason: 'length' }], replyFastFix: makeLlmReplyFastFixer() });
      expect(reasonsOf(truncated.diags, 'reply-fast-fix-miss')).toEqual(['truncated']);

      // a fixer configured with no envelope reads its own nested call's decoded payload, so a json-envelope host's decline reads as one
      const declined = await run({ subject: [MANGLED, OK], fixer: ['{"answerable":false,"rationale":"cannot repair"}'], replyFastFix: makeLlmReplyFastFixer(), defaultReplyProtocol: 'json-envelope' });
      expect(reasonsOf(declined.diags, 'reply-fast-fix-miss')).toEqual(['declined']);
    });

    it('should fix a json-envelope subject with a custom value key and a trailing rationale (fidelity over the object under the value key)', async () => {
      const replyEnvelope = { value: 'payload', answerable: 'ok', rationale: 'why' };
      const subject = '{"ok":true,"payload":{"say":"a long enough line of dialogue","n":None},"why":"The line answers the scene prompt well."}';
      const { result, subjectCalls, fixerCalls, diags } = await run({ subject: [subject], fixer: ['{"ok":true,"payload":{"say":"a long enough line of dialogue","n":null}}'], replyFastFix: makeLlmReplyFastFixer(), defaultReplyProtocol: 'json-envelope', replyEnvelope });

      expect(subjectCalls).toHaveLength(1);
      expect(fixerCalls).toHaveLength(1);
      expect(reasonsOf(diags, 'reply-fast-fix-miss')).toEqual([]);
      expect(result.repair).toMatchObject({ tier: 'fast-fix' });
      expect(result.valueJson).toBe(FIXED);
    });

    it('should make ONE fixer call across two mangled attempts (the second is fast-fix-spent)', async () => {
      const { fixerCalls, diags } = await run({ subject: [MANGLED], fixer: ['{"say":"changed words entirely"}'], replyFastFix: makeLlmReplyFastFixer() });

      expect(fixerCalls).toHaveLength(1);
      expect(reasonsOf(diags, 'reply-repair-refused')[0]).toBe('fast-fix-spent');
    });

    it('should never bind a fixer on a RepairReplyJson dispatch (the recursion guard)', async () => {
      const { requests } = await run({ fixer: [MANGLED], replyFastFix: makeLlmReplyFastFixer(), request: { capability: LLM_REPAIR_REPLY_JSON_CAPABILITY, maxAttempts: 1 } });

      expect(requests).toHaveLength(1);
    });

    it('should take the ordinary re-ask with no fixer bound', async () => {
      const { result, subjectCalls, fixerCalls, diags } = await run({ subject: [MANGLED] });

      expect(fixerCalls).toHaveLength(0);
      expect(subjectCalls).toHaveLength(2);
      expect(result.decodeStatus).toBe('dropped');
      expect(reasonsOf(diags, 'reply-repair-refused')).toEqual(['fast-fix-off', 'fast-fix-off']);
    });

    it('should send an identical fixer prompt for identical input (a stable tape hash)', async () => {
      const first = await run({ subject: [MANGLED], replyFastFix: makeLlmReplyFastFixer() });
      const second = await run({ subject: [MANGLED], replyFastFix: makeLlmReplyFastFixer() });

      expect(first.fixerCalls[0].prompt).toBe(second.fixerCalls[0].prompt);
    });
  });

  describe('the single-shot path', () => {
    it('should never call a bound fixer, and refuse a mangled reply as mangled', async () => {
      const { result, fixerCalls, diags } = await run({ subject: [MANGLED], request: { validate: undefined }, replyFastFix: makeLlmReplyFastFixer() });

      expect(fixerCalls).toHaveLength(0);
      expect(result.text).toBe(MANGLED);
      expect(reasonsOf(diags, 'reply-repair-refused')).toEqual(['mangled']);
    });
  });

  describe('library cases', () => {
    it('should refuse as too-long past fastFixLimits.maxChars, and as low-score under fastFixLimits.minScore', async () => {
      const tooLong = await run({ subject: [MANGLED, OK], replyFastFix: makeLlmReplyFastFixer(), fastFixLimits: { maxChars: MANGLED.length - 1 } });
      expect(tooLong.fixerCalls).toHaveLength(0);
      expect(reasonsOf(tooLong.diags, 'reply-repair-refused')).toEqual(['too-long']);

      const lowScore = await run({ subject: [MANGLED, OK], replyFastFix: makeLlmReplyFastFixer(), fastFixLimits: { minScore: 0.99 } });
      expect(lowScore.fixerCalls).toHaveLength(0);
      expect(reasonsOf(lowScore.diags, 'reply-repair-refused')).toEqual(['low-score']);
    });

    it('should keep the default maxPerDispatch (1) when fastFixLimits passes an explicit undefined (B5)', async () => {
      const { fixerCalls, diags } = await run({ subject: [MANGLED], fixer: ['{"say":"changed words entirely"}'], replyFastFix: makeLlmReplyFastFixer(), fastFixLimits: { maxPerDispatch: undefined } });

      expect(fixerCalls).toHaveLength(1);
      expect(reasonsOf(diags, 'reply-repair-refused')[0]).toBe('fast-fix-spent');
    });

    it('should never bind on a line call or a schema-less call', async () => {
      const line = await run({ subject: [MANGLED], replyFastFix: makeLlmReplyFastFixer(), request: { capability: 'LineCap', maxAttempts: 1 } });
      expect(line.fixerCalls).toHaveLength(0);

      const schemaless = await run({ subject: [MANGLED, OK], replyFastFix: makeLlmReplyFastFixer(), request: { responseSchemaHint: undefined } });
      expect(schemaless.fixerCalls).toHaveLength(0);
      expect(reasonsOf(schemaless.diags, 'reply-repair-refused')).toEqual(['no-schema']);
    });

    it("should land the fixer's meta on result.repair.meta", async () => {
      const withMeta = makeLlmReplyFastFixer({ metaOf: () => ({ fixCall: 'fix-1' }) });
      const { result } = await run({ subject: [MANGLED], replyFastFix: withMeta });

      expect(result.repair).toMatchObject({ tier: 'fast-fix', meta: { fixCall: 'fix-1' } });
    });

    it("should keep the fixer's meta on the failed row of a fix the validator then rejects", async () => {
      const records: LlmCallRecord[] = [];
      const withMeta = makeLlmReplyFastFixer({ metaOf: () => ({ fixCall: 'fix-1' }) });
      let validated = 0;
      const rejectFirst = () => {
        validated += 1;
        return validated === 1 ? { error: 'the first value is rejected' } : (true as const);
      };
      await run({ subject: [MANGLED, OK], replyFastFix: withMeta, recorder: { recordCall: (record) => records.push(record) }, request: { validate: rejectFirst } });

      const subjectRecord = records.find((record) => record.capability === 'TestCap');
      expect(subjectRecord?.failedAttempts?.[0]).toMatchObject({ cause: 'schema-validation', repair: { tier: 'fast-fix', meta: { fixCall: 'fix-1' } } });
    });
  });

  describe('critique on a json-envelope host', () => {
    it('should read the judge decoded payload with no binding envelope, so a rejecting judge re-asks', async () => {
      const requests: LlmRequest[] = [];
      const strategy = makeLlmScriptedStrategy({
        id: 's',
        byCapability: {
          TestCap: ['{"answerable":true,"value":{"say":"first"}}', '{"answerable":true,"value":{"say":"second"}}'],
          [LLM_CRITIQUE_REPLY_CAPABILITY]: ['{"answerable":true,"value":{"pass":false,"feedback":"name the tote"}}', '{"answerable":true,"value":{"pass":true}}']
        },
        requests
      });
      const dispatcher = makeLlmDispatcher<LlmDispatchRequest, LlmDispatchResult>({
        strategies: makeLlmStrategyRegistry([strategy]),
        defaultStrategyId: 's',
        defaultMaxOutputTokens: 1024,
        modelTiers: TIERS,
        defaultReplyProtocol: 'json-envelope',
        descriptorOf: (capability) => (capability === LLM_CRITIQUE_REPLY_CAPABILITY ? LLM_CRITIQUE_REPLY_DESCRIPTOR : DESCRIPTORS[capability]),
        templateResolver: makeLlmTieredPromptTemplateResolver({
          tiers: [
            { source: 'llm', templates: [LLM_CRITIQUE_REPLY_TEMPLATE] },
            { source: 'defaults', templates: TEMPLATES }
          ]
        }),
        transportBackoff: () => 0
      });
      const rule = { capabilities: ['TestCap'], maxAttempts: 2 };
      const binding = { policy: compileLlmCritiquePolicy({ critique: { rules: [rule] }, capabilities: [{ capability: 'TestCap' }] }), dispatch: (request: LlmDispatchRequest) => dispatcher.dispatch(request) };
      const critique = makeLlmSemanticCritic({ binding, rule, goal: 'name the product' });
      const result = await dispatcher.dispatch({ capability: 'TestCap', renderLiveContext: liveContext, validate: acceptAny, critique, maxAttempts: 2 });

      expect(requests.filter((sent) => sent.capability === 'TestCap')).toHaveLength(2);
      expect(result.decodeStatus).toBe('retried');
      expect(result.valueJson).toBe('{"say":"second"}');
    });
  });
});
