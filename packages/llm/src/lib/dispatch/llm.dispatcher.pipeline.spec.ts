/**
 * The dispatcher pipeline — the single-attempt cases (pinned to `maxAttempts: 1`). A host's default tier map (the
 * library ships no default slug) and the host-writer capture gates (they belong to the host's recorder) are out of
 * scope. The retry-ladder / lever / correction / backoff /
 * bonus / critique cases live in `llm.dispatcher.retry.spec.ts`, the fast-fix cases in
 * `llm.dispatcher.reply.repair.spec.ts`, and the decision lane in `llm.dispatcher.decision.spec.ts`.
 */

import { type } from 'arktype';
import { describe, expect, it, vi } from 'vitest';
import { makeLlmTapeStrategy, makeLlmScriptedStrategy, type LlmScriptedReplies, hashLlmTapePrompt } from '@dereekb/llm/test';
import { defineLlmCapability, type LlmCapabilityDescriptor } from '../capability/llm.capability.descriptor';
import { type LlmCompiledModelRouting } from '../model/llm.model.routing';
import { DEFAULT_LLM_PROMPT_LAYOUT } from '../prompt/llm.prompt.layout';
import { makeLlmModelAddendumPromptContributor } from '../prompt/llm.prompt.model.addendum';
import { makeLlmPromptChain } from '../prompt/llm.prompt.chain';
import { type LlmPromptContributor } from '../prompt/llm.prompt.contributor';
import { type LlmLiveContextBlock } from '../prompt/llm.prompt.live.context';
import { DEFAULT_LLM_DEGENERATE_THREAD_PLACEHOLDER } from '../prompt/llm.prompt.thread';
import { type LlmPromptTemplate, makeLlmTieredPromptTemplateResolver } from '../prompt/llm.prompt.template';
import { type LlmCallContext, type LlmCallDiag, makeLlmCallContext } from '../record/llm.call.context';
import { type LlmCallRecord, type LlmCallStartRecord, type LlmDecodeFailureRecord } from '../record/llm.call.record';
import { llmDecodeFailureExcerpt } from '../record/llm.decode.failure';
import { makeLlmDispatchTapRegistry, type LlmDecodeFailureTapEvent, type LlmDispatchCompleteTapEvent, type LlmDispatchStartTapEvent } from '../record/llm.dispatch.tap';
import { repairLlmReplyJson } from '../reply/llm.reply.repair';
import { type LlmDispatchResult, type LlmRequest, type LlmStrategy } from '../strategy/llm.strategy';
import { makeLlmStrategyRegistry } from '../strategy/llm.strategy.registry';
import { type LlmDispatchRequest } from './llm.dispatch.request';
import { type LlmDispatchTransportBackoffParams } from './llm.dispatch.control';
import { type LlmDispatchGapParams, type LlmDispatcherConfig, type LlmDispatchRecorder } from './llm.dispatcher.config';
import { makeLlmDispatcher } from './llm.dispatcher.pipeline';
import { isLlmDispatchFaultError, type LlmDispatchFaultError } from './llm.dispatch.fault';
import { formatLlmErrorSummary } from '../strategy/llm.error';

// MARK: Fixtures
const TEMPLATES: ReadonlyArray<LlmPromptTemplate> = [
  { key: 'reply-protocol', role: 'reply-protocol', text: 'A-PROTOCOL' },
  { key: 'instructions', role: 'instructions', text: 'B-CAP' },
  { key: 'context', role: 'context', text: 'C-CTX\n{{liveContext}}' }
];

const RESOLVER = makeLlmTieredPromptTemplateResolver({ tiers: [{ source: 'defaults', templates: TEMPLATES }] });

const TIERS = { fast: 'test/fast', strong: 'test/strong' };

const ANSWER = type({ answer: 'string' });

function descriptorOf(config: Omit<Parameters<typeof defineLlmCapability>[0], 'responseSchema' | 'parseValue'>): LlmCapabilityDescriptor {
  return defineLlmCapability({ responseSchema: ANSWER, parseValue: (value) => value, ...config });
}

const DESCRIPTORS: Readonly<Record<string, LlmCapabilityDescriptor>> = {
  StrongCap: descriptorOf({ capability: 'StrongCap', tier: 'strong' }),
  BudgetCap: descriptorOf({ capability: 'BudgetCap', maxOutputTokens: 321, reasoning: { enabled: true, effort: 'low' } }),
  LineCap: descriptorOf({ capability: 'LineCap', replyProtocol: 'line' }),
  RawJsonCap: descriptorOf({ capability: 'RawJsonCap', rawJsonContext: true }),
  EnvelopeCap: descriptorOf({ capability: 'EnvelopeCap', replyProtocol: 'json-envelope' })
};

const NEAR_MISS = '{"answer":"ok","tags":[1,2,],}';
const MANGLED = '{"a":"a long enough value here","b":None}';

const VALID = (value: unknown) => (typeof (value as { answer?: unknown }).answer === 'string' ? true : { error: 'answer must be a string' });

function blocks(text: string, key = 'facts'): ReadonlyArray<LlmLiveContextBlock> {
  return [{ key, text }];
}

function request(extra: Partial<LlmDispatchRequest> = {}): LlmDispatchRequest {
  return { capability: 'TestCap', renderLiveContext: () => blocks('D-LIVE'), ...extra };
}

interface HostFields {
  readonly host?: string;
}

interface Recording {
  readonly starts: LlmCallStartRecord<HostFields>[];
  readonly calls: LlmCallRecord<HostFields>[];
  readonly decodeFailures: LlmDecodeFailureRecord<HostFields>[];
  readonly recorder: LlmDispatchRecorder<LlmDispatchRequest, HostFields>;
}

function recording(timing?: boolean): Recording {
  const starts: LlmCallStartRecord<HostFields>[] = [];
  const calls: LlmCallRecord<HostFields>[] = [];
  const decodeFailures: LlmDecodeFailureRecord<HostFields>[] = [];
  const recorder: LlmDispatchRecorder<LlmDispatchRequest, HostFields> = {
    ...(timing == null ? {} : { newCallContext: ({ label }) => makeLlmCallContext({ label, timing }) }),
    recordCallStart: (record) => starts.push(record),
    recordCall: (record) => calls.push(record),
    recordDecodeFailure: (record) => decodeFailures.push(record)
  };
  return { starts, calls, decodeFailures, recorder };
}

type SetupConfig = Partial<LlmDispatcherConfig<LlmDispatchRequest, LlmDispatchResult, HostFields>> & { readonly replies?: LlmScriptedReplies; readonly strategy?: LlmStrategy };

function setup(config: SetupConfig = {}) {
  const requests: LlmRequest[] = [];
  const { replies, strategy, ...rest } = config;
  const used = strategy ?? makeLlmScriptedStrategy({ id: 's', replies: replies ?? ['{"answer":"ok"}'], requests });
  const dispatcher = makeLlmDispatcher<LlmDispatchRequest, LlmDispatchResult, HostFields>({
    strategies: makeLlmStrategyRegistry([used]),
    defaultStrategyId: used.id,
    defaultMaxOutputTokens: 1024,
    modelTiers: TIERS,
    descriptorOf: (capability) => DESCRIPTORS[capability],
    templateResolver: RESOLVER,
    ...rest
  });
  return { dispatcher, requests };
}

/**
 * A manual pause gate.
 */
function pauseGate(paused: boolean) {
  let isPaused = paused;
  let resume: () => void = () => undefined;
  let waited = 0;
  const gate = {
    isPaused: () => isPaused,
    waitUntilResumed: (signal?: AbortSignal) =>
      new Promise<void>((resolve) => {
        waited += 1;
        resume = resolve;
        signal?.addEventListener('abort', () => resolve(), { once: true });
      })
  };
  return {
    gate,
    resume: () => {
      isPaused = false;
      resume();
    },
    waited: () => waited
  };
}

class APIUserAbortError extends Error {}

function rateLimited(): Error {
  return Object.assign(new Error('rate limited'), { status: 429 });
}

function badRequest(): Error {
  return Object.assign(new Error('bad request'), { status: 400 });
}

/**
 * A strategy that hands its options to `onCall` and answers with `reply` (or throws what it returns).
 */
function observingStrategy(onCall: (request: LlmRequest, signal: AbortSignal | undefined) => string | Error | Promise<string | Error>): LlmStrategy {
  return {
    id: 'o',
    describe: 'observing',
    caching: 'none',
    async complete(llmRequest, options) {
      const reply = await onCall(llmRequest, options?.signal);

      if (reply instanceof Error) {
        throw reply;
      }

      return { text: reply, strategyId: 'o', capability: llmRequest.capability };
    }
  };
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

// MARK: Specs
describe('makeLlmDispatcher()', () => {
  describe('assembly and routing', () => {
    it('should assemble [A][B][C] with the rendered live context and return the strategy envelope unchanged', async () => {
      const { dispatcher, requests } = setup({ replies: ['reply'] });
      const result = await dispatcher.dispatch(request());

      expect(requests[0].prompt).toBe('A-PROTOCOL\n\nB-CAP\n\nC-CTX\nD-LIVE');
      expect(result).toEqual({ text: 'reply', strategyId: 's', strategyKind: 'scripted', capability: 'TestCap', model: 'test/fast' });
    });

    it('should route to the strategy selectStrategy picks', async () => {
      const a = makeLlmScriptedStrategy({ id: 'a', replies: ['a'] });
      const b = makeLlmScriptedStrategy({ id: 'b', replies: ['b'] });
      const { dispatcher } = setup({ strategies: makeLlmStrategyRegistry([a, b]), defaultStrategyId: 'a', selectStrategy: ({ capability }) => (capability === 'TestCap' ? 'b' : 'a') });

      expect((await dispatcher.dispatch(request())).strategyId).toBe('b');
    });

    it('should throw naming the registered strategies when the selected one is not registered', async () => {
      const { dispatcher } = setup({ defaultStrategyId: 'missing' });

      await expect(dispatcher.dispatch(request())).rejects.toThrow("llm dispatcher: no LLM strategy registered for 'missing' (routing TestCap on model 'test/fast'; registered: s).");
    });

    it("should send the resolved model on every request, the default tier's included", async () => {
      const { dispatcher, requests } = setup({ replies: ['{"answer":"ok"}'] });
      await dispatcher.dispatch(request({ capability: 'StrongCap' }));
      await dispatcher.dispatch(request());

      expect(requests[0].model).toBe('test/strong');
      expect(requests[1].model).toBe('test/fast');
    });

    it('should send defaultMaxOutputTokens as the cap when no route, descriptor or tier names one', async () => {
      const { dispatcher, requests } = setup({ replies: ['first', 'second'] });
      const executed = await dispatcher.preparePrompt(request()).execute();
      await executed.followUp({ content: 'and then?' }).execute();

      expect(requests[0]).toMatchObject({ model: 'test/fast', maxOutputTokens: 1024 });
      expect(requests[1]).toMatchObject({ model: 'test/fast', maxOutputTokens: 1024 });
    });

    it('should send attachments on the root only, and omit the key when there are none', async () => {
      const attachment = { kind: 'image' as const, mime: 'image/png', dataBase64: 'AAAA' };
      const { dispatcher, requests } = setup({ replies: ['one', 'two'] });
      const executed = await dispatcher.preparePrompt(request({ attachments: [attachment] })).execute();
      await executed.followUp({ content: 'more' }).execute();
      await dispatcher.dispatch(request({ attachments: [] }));

      expect(requests[0].attachments).toEqual([attachment]);
      expect('attachments' in requests[1]).toBe(false);
      expect('attachments' in requests[2]).toBe(false);
    });

    it('should send the descriptor schema hint for JSON, none for line, and HARDEN an explicit hint', async () => {
      const explicit = { $schema: 'x', type: 'object', properties: { a: { type: 'string' } } };
      const { dispatcher, requests } = setup({ replies: ['{"answer":"ok"}'] });
      await dispatcher.dispatch(request({ capability: 'StrongCap' }));
      await dispatcher.dispatch(request({ capability: 'LineCap' }));
      await dispatcher.dispatch(request({ responseSchemaHint: explicit }));

      expect(requests[0].responseSchemaHint).toEqual(DESCRIPTORS['StrongCap'].responseSchemaHint());
      expect('responseSchemaHint' in requests[1]).toBe(false);
      const hardened = requests[2].responseSchemaHint as Record<string, unknown>;
      expect(hardened['$schema']).toBeUndefined();
      expect(hardened['additionalProperties']).toBe(false);
      expect(hardened).not.toBe(explicit);
      expect(explicit.$schema).toBe('x');
    });

    it('should split the prompt into a cache prefix and a volatile suffix holding the live context', async () => {
      const { dispatcher, requests } = setup({ replies: ['x'] });
      await dispatcher.dispatch(request());
      const { cachePrefix, volatileSuffix } = requests[0].cacheSegments!;

      expect(cachePrefix + volatileSuffix).toBe(requests[0].prompt);
      expect(cachePrefix).not.toContain('D-LIVE');
      expect(volatileSuffix).toContain('D-LIVE');
    });
  });

  describe('tiers', () => {
    it('should resolve a per-invocation tier and a raw model override over the descriptor', async () => {
      const { dispatcher, requests } = setup({ replies: ['x'] });
      await dispatcher.dispatch(request({ tier: 'strong' }));
      await dispatcher.dispatch(request({ capability: 'StrongCap', tier: 'fast' }));
      await dispatcher.dispatch(request({ capability: 'StrongCap', model: 'raw/slug' }));

      expect(requests[0].model).toBe('test/strong');
      expect(requests[1].model).toBe('test/fast');
      expect(requests[2].model).toBe('raw/slug');
    });

    it('should honor a non-default defaultTier', async () => {
      const { dispatcher, requests } = setup({ replies: ['x'], defaultTier: 'strong' });
      await dispatcher.dispatch(request());
      await dispatcher.dispatch(request({ tier: 'fast' }));

      expect(requests[0].model).toBe('test/strong');
      expect(requests[1].model).toBe('test/fast');
    });

    it('should fail loud on an unknown per-invocation tier', async () => {
      const { dispatcher } = setup({ replies: ['x'] });
      await expect(dispatcher.dispatch(request({ tier: 'nope' }))).rejects.toThrow();
    });

    it('should throw at construction when the tier map does not hold the default tier', () => {
      expect(() => setup({ modelTiers: { strong: 'test/strong' } })).toThrow();
    });
  });

  describe('model addendum', () => {
    it('should prepend a named slug addendum onto the prompt and the cache prefix, and leave an unnamed slug byte-identical', async () => {
      const contributors: ReadonlyArray<LlmPromptContributor> = [makeLlmModelAddendumPromptContributor({ promptAddendumByModel: { 'test/strong': 'ADDENDUM' } })];
      const { dispatcher, requests } = setup({ replies: ['x'], contributors });
      const diagContext = makeLlmCallContext({ label: 'root', timing: true });
      await dispatcher.dispatch(request({ capability: 'StrongCap', callContext: diagContext }));
      await dispatcher.dispatch(request());

      expect(requests[0].prompt.startsWith('ADDENDUM\n\n')).toBe(true);
      expect(requests[0].cacheSegments!.cachePrefix.startsWith('ADDENDUM\n\n')).toBe(true);
      expect(requests[1].prompt).toBe('A-PROTOCOL\n\nB-CAP\n\nC-CTX\nD-LIVE');
      expect(diagsOf(diagContext).some((diag) => diag.code === 'model-prompt-addendum')).toBe(true);
    });
  });

  describe('capability routing', () => {
    function routed(): LlmCompiledModelRouting {
      return new Map([['TestCap', { model: 'test/strong', tier: 'strong', provider: 'b', maxOutputTokens: 77 }]]);
    }

    it('should route a capability to its route model, provider and budget', async () => {
      const a = makeLlmScriptedStrategy({ id: 's', replies: ['a'] });
      const bRequests: LlmRequest[] = [];
      const b = makeLlmScriptedStrategy({ id: 'b', replies: ['b'], requests: bRequests });
      const { dispatcher } = setup({ strategies: makeLlmStrategyRegistry([a, b]), capabilityRoutes: routed() });
      const result = await dispatcher.dispatch(request());

      expect(result.strategyId).toBe('b');
      expect(bRequests[0].model).toBe('test/strong');
      expect(bRequests[0].maxOutputTokens).toBe(77);
    });

    it('should let a per-slug provider binding pick the strategy when no route names one', async () => {
      const a = makeLlmScriptedStrategy({ id: 's', replies: ['a'] });
      const b = makeLlmScriptedStrategy({ id: 'b', replies: ['b'] });
      const { dispatcher } = setup({ strategies: makeLlmStrategyRegistry([a, b]), providerByModel: { 'test/strong': 'b' } });

      expect((await dispatcher.dispatch(request({ capability: 'StrongCap' }))).strategyId).toBe('b');
      expect((await dispatcher.dispatch(request())).strategyId).toBe('s');
    });
  });

  describe('reasoning', () => {
    it('should default reasoning off and record reasoningOff', async () => {
      const { calls, recorder } = recording();
      const { dispatcher, requests } = setup({ replies: ['x'], recorder });
      await dispatcher.dispatch(request());

      expect(requests[0].reasoning).toEqual({ enabled: false });
      expect(calls[0].reasoningOff).toBe(true);
    });

    it('should resolve request › descriptor › floor, and thread the descriptor budget', async () => {
      const { calls, recorder } = recording();
      const { dispatcher, requests } = setup({ replies: ['x'], recorder, reasoningDefault: { enabled: true, effort: 'high' } });
      await dispatcher.dispatch(request({ capability: 'BudgetCap' }));
      await dispatcher.dispatch(request({ capability: 'BudgetCap', reasoning: { enabled: false } }));
      await dispatcher.dispatch(request());

      expect(requests[0].reasoning).toEqual({ enabled: true, effort: 'low' });
      expect(requests[0].maxOutputTokens).toBe(321);
      expect(requests[1].reasoning).toEqual({ enabled: false });
      expect(requests[2].reasoning).toEqual({ enabled: true, effort: 'high' });
      expect(calls.map((call) => call.reasoningOff)).toEqual([false, true, false]);
    });

    it('should let a follow-up inherit the root reasoning, model and budget', async () => {
      const { dispatcher, requests } = setup({ replies: ['x'] });
      const executed = await dispatcher.preparePrompt(request({ capability: 'BudgetCap', tier: 'strong' })).execute();
      await executed.followUp({ content: 'next' }).execute();

      expect(requests[1].reasoning).toEqual(requests[0].reasoning);
      expect(requests[1].model).toBe('test/strong');
      expect(requests[1].maxOutputTokens).toBe(321);
    });
  });

  describe('validate (single attempt)', () => {
    it('should return the single-shot result UNCHANGED when no validate is set', async () => {
      const { dispatcher } = setup({ replies: ['{"answer":"ok"}'] });
      const result = await dispatcher.dispatch(request());

      expect('attempts' in result).toBe(false);
      expect('decodeStatus' in result).toBe(false);
    });

    it('should stamp a valid reply attempts 1 and clean', async () => {
      const { dispatcher } = setup({ replies: ['{"answer":"ok"}'] });
      const result = await dispatcher.dispatch(request({ validate: VALID }));

      expect(result).toMatchObject({ attempts: 1, decodeStatus: 'clean', decodeOutcome: 'ok', valueJson: '{"answer":"ok"}' });
    });

    it('should accept a declined envelope in one call', async () => {
      const { dispatcher, requests } = setup({ replies: ['{"answerable":false,"rationale":"cannot"}'] });
      const result = await dispatcher.dispatch(request({ capability: 'EnvelopeCap', validate: VALID }));

      expect(requests).toHaveLength(1);
      expect(result.decodeStatus).toBe('clean');
    });

    it('should drop an invalid reply after one call with an attempt-indexed validation error (maxAttempts 1 / 0)', async () => {
      for (const maxAttempts of [1, 0]) {
        const { dispatcher, requests } = setup({ replies: ['{"answer":1}'] });
        const result = await dispatcher.dispatch(request({ validate: VALID, maxAttempts }));

        expect(requests).toHaveLength(1);
        expect(result).toMatchObject({ attempts: 1, decodeStatus: 'dropped', decodeOutcome: 'schema-invalid', validationErrors: ['attempt 1: answer must be a string'] });
      }
    });
  });

  describe('decode rows', () => {
    it('should record one call record and one decode-failure record for a length-truncated reply on the only attempt', async () => {
      const text = '{"answer":"cut off mid';
      const { calls, decodeFailures, recorder } = recording();
      const { dispatcher } = setup({ replies: [{ text, finishReason: 'length' }], recorder });
      const result = await dispatcher.dispatch(request({ capability: 'StrongCap', validate: VALID, maxAttempts: 1 }));

      expect(result).toMatchObject({ attempts: 1, decodeStatus: 'dropped', lengthCapped: true });
      expect(calls).toHaveLength(1);
      expect(decodeFailures).toHaveLength(1);
      const { payload } = decodeFailures[0];
      expect(payload).toMatchObject({ capability: 'StrongCap', model: 'test/strong', tier: 'strong', attempts: 1, recovered: false, promptChars: calls[0].prompt.length });
      expect(payload.contextExcerpt).toContain('D-LIVE');
      expect(payload.failures).toHaveLength(1);
      expect(payload.failures[0]).toMatchObject({ attempt: 1, class: 'length-truncation', finishReason: 'length', excerpt: llmDecodeFailureExcerpt(text), rawLength: text.length });
    });

    it('should record one schema-validation row with the validator error', async () => {
      const { decodeFailures, recorder } = recording();
      const { dispatcher } = setup({ replies: ['{"answer":1}'], recorder });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(decodeFailures[0].payload.recovered).toBe(false);
      expect(decodeFailures[0].payload.failures).toEqual([expect.objectContaining({ class: 'schema-validation', validatorError: 'answer must be a string' })]);
    });

    it('should never parse-fail a line reply and file no decode row', async () => {
      const { decodeFailures, recorder } = recording();
      const { dispatcher } = setup({ replies: ['just prose'], recorder });
      const result = await dispatcher.dispatch(request({ capability: 'LineCap', validate: VALID }));

      expect(result.decodeStatus).toBe('clean');
      expect(decodeFailures).toHaveLength(0);
    });

    it('should file no decode-failure record for a clean dispatch', async () => {
      const { decodeFailures, recorder } = recording();
      const { dispatcher } = setup({ recorder });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(decodeFailures).toHaveLength(0);
    });
  });

  describe('records', () => {
    it('should record one call record with the prompt, segments, result and the call fields; the start record first', async () => {
      const order: string[] = [];
      const { calls, starts, recorder } = recording();
      const ordered: LlmDispatchRecorder<LlmDispatchRequest, HostFields> = { recordCallStart: (record) => (order.push('start'), recorder.recordCallStart!(record)), recordCall: (record) => (order.push('call'), recorder.recordCall(record)) };
      const { dispatcher } = setup({ replies: ['x'], recorder: ordered, recordFieldsOf: ({ kind }) => ({ host: kind }) });
      const result = await dispatcher.dispatch(request({ tier: 'strong' }));

      expect(order).toEqual(['start', 'call']);
      expect(starts[0]).toEqual({ capability: 'TestCap', model: 'test/strong', tier: 'strong', strategyId: 's', strategyKind: 'scripted', host: 'start' });
      expect(calls[0]).toMatchObject({ capability: 'TestCap', prompt: 'A-PROTOCOL\n\nB-CAP\n\nC-CTX\nD-LIVE', result, tier: 'strong', host: 'call' });
      expect(calls[0].segments.map((segment) => segment.promptSegment).join('')).toContain('D-LIVE');
    });

    it('should carry no host fields when recordFieldsOf is absent, and no phases on a context that does not time', async () => {
      const { calls, recorder } = recording();
      const { dispatcher } = setup({ replies: ['x'], recorder });
      await dispatcher.dispatch(request());

      expect('host' in calls[0]).toBe(false);
      expect('phases' in calls[0]).toBe(false);
      // the prefix hash is not gated on timing: every root dispatch carries it
      expect(calls[0].cachePrefixHash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should stamp phases and hand resultOf a nested callProfile when the per-call context times', async () => {
      const { calls, recorder } = recording(true);
      const profiles: string[][] = [];
      const { dispatcher } = setup({ replies: ['x'], recorder, resultOf: ({ result, callProfile }) => (profiles.push(callProfile?.children.map((child) => child.label) ?? []), result) });
      await dispatcher.dispatch(request());

      expect(calls[0].phases).toMatchObject({ promptChars: calls[0].prompt.length, attempts: [expect.objectContaining({ attempt: 1 })] });
      expect(calls[0].cachePrefixHash).toMatch(/^[0-9a-f]{16}$/);
      expect(profiles).toEqual([['attempt-1']]);
    });

    it('keeps the call record phases and the callProfile byte-identical under a fixed clock (pin)', async () => {
      let t = 0;
      const stepClock = () => () => t++;
      const calls: LlmCallRecord<HostFields>[] = [];
      const profiles: unknown[] = [];
      const recorder: LlmDispatchRecorder<LlmDispatchRequest, HostFields> = { newCallContext: ({ label }) => makeLlmCallContext({ label, now: stepClock() }), recordCall: (record) => calls.push(record) };
      const { dispatcher } = setup({ replies: ['x'], recorder, resultOf: ({ result, callProfile }) => (profiles.push(callProfile), result) });
      await dispatcher.dispatch(request());

      expect(JSON.stringify(calls[0].phases)).toBe('{"totalMs":11,"renderMs":1,"assembleMs":1,"completeMs":1,"attempts":[{"attempt":1,"wallMs":1}],"promptChars":31,"cachePrefixChars":25}');
      expect(Object.keys(calls[0])).toEqual(['capability', 'prompt', 'segments', 'result', 'tier', 'reasoningOff', 'estimatedPromptTokens', 'cachePrefixHash', 'phases']);
      expect(calls[0].cachePrefixHash).toBe('522153e78572010f');
      expect(JSON.stringify(profiles[0])).toBe(
        '{"label":"TestCap","startedAt":0,"totalMs":11,"spans":[{"name":"render","startMs":1,"durationMs":1},{"name":"contribute","startMs":3,"durationMs":1},{"name":"assemble","startMs":5,"durationMs":1}],"diags":[{"level":"debug","code":"model-route","fields":{"capability":"TestCap","model":"test/fast","tier":"fast","source":"default-tier"},"message":"capability model resolved by the precedence ladder"},{"level":"debug","code":"provider-route","fields":{"capability":"TestCap","model":"test/fast","provider":"s"},"message":"provider instance resolved for this dispatch"},{"level":"debug","code":"reasoning-floor","fields":{"capability":"TestCap","source":"default"},"message":"reasoning resolved off for this dispatch"}],"children":[{"label":"attempt-1","startedAt":7,"totalMs":5,"spans":[{"name":"complete","startMs":8,"durationMs":1}],"children":[]}]}'
      );
    });

    it('should hand resultOf no callProfile when timing is off', async () => {
      const { recorder } = recording(false);
      let seen: unknown = 'unset';
      const { dispatcher } = setup({ replies: ['x'], recorder, resultOf: ({ result, callProfile }) => ((seen = callProfile), result) });
      await dispatcher.dispatch(request());

      expect(seen).toBeUndefined();
    });

    it('should record nothing and not throw with no recorder', async () => {
      const { dispatcher } = setup({ replies: ['x'] });
      await expect(dispatcher.dispatch(request())).resolves.toBeDefined();
    });

    it('should land each record kind its own host fields, on the records and the tap events', async () => {
      const { starts, calls, decodeFailures, recorder } = recording();
      const taps = makeLlmDispatchTapRegistry<HostFields>();
      const events: unknown[] = [];
      taps.addTap({ id: 't', onDispatch: (event) => void events.push(event), onDecodeFailure: (event) => void events.push(event), onDispatchComplete: (event) => void events.push(event) });
      const { dispatcher } = setup({ replies: ['{"answer":1}'], recorder, taps, recordFieldsOf: ({ kind }) => ({ host: kind }) });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect([starts[0].host, calls[0].host, decodeFailures[0].host]).toEqual(['start', 'call', 'decode-failure']);
      expect(events.map((event) => (event as HostFields).host)).toEqual(['start', 'decode-failure', 'call']);
    });

    it('should record a contributor placement as a supplement row', async () => {
      const contributor: LlmPromptContributor = { id: 'tone', slots: ['live'], resolve: () => ({ contributions: [{ contributor: 'tone', slot: 'live', id: 'live', key: 'tone', text: 'TONE', origin: { kind: 'supplement' }, reason: 'tone' }] }) };
      const { calls, recorder } = recording();
      const { dispatcher } = setup({ replies: ['x'], recorder, contributors: [contributor] });
      await dispatcher.dispatch(request());

      expect(calls[0].supplements).toEqual([expect.objectContaining({ contributor: 'tone', slot: 'live', key: 'tone' })]);
    });
  });

  describe('prompt instances', () => {
    it('should make dispatch(r) equal preparePrompt(r).execute().result', async () => {
      const { dispatcher } = setup({ replies: ['x'] });
      expect(await dispatcher.dispatch(request())).toEqual((await dispatcher.preparePrompt(request()).execute()).result);
    });

    it('should send no thread on the root and cache execute (one strategy call)', async () => {
      const { dispatcher, requests } = setup({ replies: ['x'] });
      const prompt = dispatcher.preparePrompt(request());
      await prompt.execute();
      await prompt.execute();

      expect(requests).toHaveLength(1);
      expect('thread' in requests[0]).toBe(false);
    });

    it('should replay the root turn and reply on a follow-up, without a cache split, inheriting the hint unless overridden', async () => {
      const { calls, recorder } = recording();
      const { dispatcher, requests } = setup({ replies: ['{"answer":"one"}', '{"answer":"two"}', '{"answer":"three"}'], recorder });
      const executed = await dispatcher.preparePrompt(request({ capability: 'StrongCap' })).execute();
      const second = await executed.followUp({ content: 'next item' }).execute();
      await second.followUp({ content: 'last item', responseSchemaHint: { $schema: 'x', type: 'object', properties: {} } }).execute();

      expect(requests[1].thread).toEqual([
        { role: 'user', content: requests[0].prompt, cacheSegments: requests[0].cacheSegments },
        { role: 'assistant', content: '{"answer":"one"}' }
      ]);
      expect('cacheSegments' in requests[1]).toBe(false);
      expect(requests[1].prompt).toBe('next item');
      expect(requests[1].model).toBe('test/strong');
      expect(requests[1].responseSchemaHint).toEqual(requests[0].responseSchemaHint);
      expect((requests[2].responseSchemaHint as Record<string, unknown>)['additionalProperties']).toBe(false);
      expect(calls).toHaveLength(3);
      expect(calls[1].segments).toEqual([expect.objectContaining({ id: 'follow-up', promptSegment: 'next item', volatile: true })]);
    });

    it('should send the same follow-up from a stored thread resumed on a fresh dispatcher as from the executed head', async () => {
      const original = setup({ replies: ['{"answer":"one"}', '{"answer":"two"}'] });
      const executed = await original.dispatcher.preparePrompt(request({ capability: 'StrongCap' })).execute();
      await executed.followUp({ content: 'next item' }).execute();

      // a later process: a fresh dispatcher, the root request supplied again, and the thread as it came back from storage
      const { calls, recorder } = recording();
      const later = setup({ replies: ['{"answer":"two"}'], recorder });
      // eslint-disable-next-line unicorn/prefer-structured-clone -- a JSON round-trip IS the storage being simulated
      const stored = JSON.parse(JSON.stringify(executed.thread)) as typeof executed.thread;
      const followedUp = await later.dispatcher
        .resumePrompt({ request: request({ capability: 'StrongCap' }), thread: stored })
        .followUp({ content: 'next item' })
        .execute();

      expect(later.requests).toHaveLength(1);
      expect(later.requests[0]).toEqual(original.requests[1]);
      expect(followedUp.result.text).toBe('{"answer":"two"}');
      expect(calls).toHaveLength(1);
      expect(calls[0].segments).toEqual([expect.objectContaining({ id: 'follow-up', promptSegment: 'next item', volatile: true })]);
    });

    it("should append the layout's follow-up separator after the follow-up content", async () => {
      const layout = DEFAULT_LLM_PROMPT_LAYOUT.map((slot) => (slot.role === 'follow-up' ? { ...slot, separator: '\n' } : slot));
      const { calls, recorder } = recording();
      const { dispatcher, requests } = setup({ replies: ['{"answer":"one"}', '{"answer":"two"}'], recorder, layout });
      const executed = await dispatcher.preparePrompt(request({ capability: 'StrongCap' })).execute();
      await executed.followUp({ content: 'next item' }).execute();

      expect(requests[1].prompt).toBe('next item\n');
      expect(calls[1].segments).toEqual([expect.objectContaining({ id: 'follow-up', promptSegment: 'next item\n', volatile: true })]);
    });
  });

  describe('degenerate thread', () => {
    it('should replay an unrecovered decode failure as the placeholder (the configured one when set)', async () => {
      for (const placeholder of [undefined, '{"note":"discarded"}']) {
        const { dispatcher } = setup({ replies: ['{"answer":1}', 'x'], ...(placeholder == null ? {} : { degenerateThreadPlaceholder: placeholder }) });
        const executed = await dispatcher.preparePrompt(request({ validate: VALID })).execute();

        expect(executed.thread[1]).toEqual({ role: 'assistant', content: placeholder ?? DEFAULT_LLM_DEGENERATE_THREAD_PLACEHOLDER });
      }
    });

    it('should replay a clean reply verbatim', async () => {
      const { dispatcher } = setup({ replies: ['{"answer":"ok"}'] });
      const executed = await dispatcher.preparePrompt(request({ validate: VALID })).execute();

      expect(executed.thread[1]).toEqual({ role: 'assistant', content: '{"answer":"ok"}' });
    });
  });

  describe('aborts and transport', () => {
    it('should record a 400-shaped error, then reject with LlmDispatchFaultError on both paths', async () => {
      for (const extra of [{}, { validate: VALID }]) {
        const { calls, recorder } = recording();
        const thrown = badRequest();
        const { dispatcher } = setup({ replies: [thrown], recorder });
        const caught = await dispatcher.dispatch(request(extra)).then(
          () => undefined,
          (e: unknown) => e
        );

        expect(isLlmDispatchFaultError(caught)).toBe(true);
        expect((caught as LlmDispatchFaultError).cause).toBe(thrown);
        expect((caught as LlmDispatchFaultError).message).toContain('bad request');
        expect(calls).toHaveLength(1);
      }
    });

    it('should drop the dispatch on an abort on the validated path (timeout row, attempts 1)', async () => {
      const { decodeFailures, recorder } = recording();
      const { dispatcher } = setup({ replies: [new APIUserAbortError('aborted')], recorder });
      const result = await dispatcher.dispatch(request({ validate: VALID, maxAttempts: 1 }));

      expect(result).toMatchObject({ attempts: 1, decodeStatus: 'dropped', text: '' });
      expect(decodeFailures[0].payload.failures).toEqual([expect.objectContaining({ class: 'timeout' })]);
    });

    it('should drop a 429 on the validated path with a transport row, and propagate it on the single-shot path', async () => {
      const { decodeFailures, recorder } = recording();
      const { dispatcher } = setup({ replies: [rateLimited()], recorder });
      const result = await dispatcher.dispatch(request({ validate: VALID, maxAttempts: 1 }));

      expect(result.decodeStatus).toBe('dropped');
      expect(decodeFailures[0].payload.failures[0]).toMatchObject({ class: 'transport', transportError: expect.any(String) });
      await expect(dispatcher.dispatch(request())).rejects.toThrow('rate limited');
    });

    it('should propagate an abort on the single-shot path when the dispatch is not cancelled', async () => {
      const { dispatcher } = setup({ replies: [new APIUserAbortError('aborted')] });
      await expect(dispatcher.dispatch(request())).rejects.toThrow('aborted');
    });

    it('should drop the dispatch when cancelled, on both paths, with no retry', async () => {
      const controller = new AbortController();
      const { dispatcher, requests } = setup({ replies: [new APIUserAbortError('aborted')], cancellationSignal: controller.signal });
      controller.abort();

      expect((await dispatcher.dispatch(request())).text).toBe('');
      expect((await dispatcher.dispatch(request({ validate: VALID }))).decodeStatus).toBe('dropped');
      expect(requests).toHaveLength(2);
    });

    it('should count an aborted request signal alone as a cancellation', async () => {
      const controller = new AbortController();
      controller.abort();
      const { dispatcher } = setup({ replies: [new APIUserAbortError('aborted')] });

      expect((await dispatcher.dispatch(request({ signal: controller.signal }))).text).toBe('');
    });

    it('should forward the combined signal to strategy.complete', async () => {
      const dispatcherController = new AbortController();
      const requestController = new AbortController();
      let seen: AbortSignal | undefined;
      const { dispatcher } = setup({ strategy: observingStrategy((_, signal) => ((seen = signal), 'x')), cancellationSignal: dispatcherController.signal });
      await dispatcher.dispatch(request({ signal: requestController.signal }));

      expect(seen?.aborted).toBe(false);
      requestController.abort();
      expect(seen?.aborted).toBe(true);
    });
  });

  describe('pause', () => {
    it('should send without parking when not paused', async () => {
      const { gate, waited } = pauseGate(false);
      const { dispatcher, requests } = setup({ replies: ['x'], pause: gate });
      await dispatcher.dispatch(request());

      expect(requests).toHaveLength(1);
      expect(waited()).toBe(0);
    });

    it('should park before sending while paused, file the parked breadcrumb, and send on resume', async () => {
      const { gate, resume } = pauseGate(true);
      const { dispatcher, requests } = setup({ replies: ['x'], pause: gate, cachePartitionOf: () => 'seat-1' });
      const parent = makeLlmCallContext({ label: 'turn', timing: true });
      const pending = dispatcher.dispatch(request({ callContext: parent }));
      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(requests).toHaveLength(0);
      resume();
      await pending;
      expect(requests).toHaveLength(1);
      const child = parent.profile().children[0];
      expect(child.spans.some((span) => span.name === 'paused')).toBe(true);
      expect(diagsOf(parent).find((diag) => diag.code === 'llm-call-parked')?.fields).toEqual({ capability: 'TestCap', partition: 'seat-1' });
    });

    it('should drop the dispatch when aborted while parked (one call, abort-shaped)', async () => {
      const controller = new AbortController();
      const { gate } = pauseGate(true);
      const { dispatcher, requests } = setup({ strategy: observingStrategy((_, signal) => (signal?.aborted ? new APIUserAbortError('aborted') : 'x')), pause: gate, cancellationSignal: controller.signal });
      const pending = dispatcher.dispatch(request({ validate: VALID }));
      controller.abort();
      const result = await pending;

      expect(result.decodeStatus).toBe('dropped');
      expect(requests).toHaveLength(0);
    });
  });

  describe('taps', () => {
    it('should fire onDispatch and onDispatchComplete with no recorder, sharing the call record', async () => {
      const taps = makeLlmDispatchTapRegistry<HostFields>();
      const starts: LlmDispatchStartTapEvent<HostFields>[] = [];
      const completes: LlmDispatchCompleteTapEvent<HostFields>[] = [];
      taps.addTap({ id: 't', onDispatch: (event) => void starts.push(event), onDispatchComplete: (event) => void completes.push(event) });
      const { dispatcher } = setup({ replies: ['x'], taps });
      await dispatcher.dispatch(request());

      expect(starts[0]).toMatchObject({ capability: 'TestCap', prompt: 'A-PROTOCOL\n\nB-CAP\n\nC-CTX\nD-LIVE', estimatedPromptTokens: expect.any(Number) });
      expect('followUp' in starts[0]).toBe(false);
      expect(completes[0]).toMatchObject({ capability: 'TestCap' });
      expect('decodeFailures' in completes[0]).toBe(false);
    });

    it('should fire onDecodeFailure with willRetry false and complete with recovered false', async () => {
      const taps = makeLlmDispatchTapRegistry<HostFields>();
      const failures: LlmDecodeFailureTapEvent<HostFields>[] = [];
      const completes: LlmDispatchCompleteTapEvent<HostFields>[] = [];
      taps.addTap({ id: 't', onDecodeFailure: (event) => void failures.push(event), onDispatchComplete: (event) => void completes.push(event) });
      const { dispatcher } = setup({ replies: ['{"answer":1}'], taps });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(failures).toEqual([expect.objectContaining({ capability: 'TestCap', willRetry: false, attempt: expect.objectContaining({ class: 'schema-validation' }) })]);
      expect(completes[0]).toMatchObject({ recovered: false, decodeFailures: [expect.objectContaining({ class: 'schema-validation' })] });
    });

    it('should count throwing taps in health() without breaking the dispatch', async () => {
      const taps = makeLlmDispatchTapRegistry<HostFields>();
      taps.addTap({
        id: 'bad',
        onDispatch: () => {
          throw new Error('one');
        },
        onDecodeFailure: () => {
          throw new Error('two');
        },
        onDispatchComplete: () => {
          throw new Error('three');
        }
      });
      const { dispatcher } = setup({ replies: ['{"answer":1}'], taps });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(taps.health().failures).toBe(3);
    });

    it('should send byte-identical requests with no, an empty, or a live registry', async () => {
      const prompts: LlmRequest[][] = [];

      const live = makeLlmDispatchTapRegistry<HostFields>();
      live.addTap({ id: 't', onDispatch: () => undefined, onDispatchComplete: () => undefined });

      for (const taps of [undefined, makeLlmDispatchTapRegistry<HostFields>(), live]) {
        const { dispatcher, requests } = setup({ replies: ['x'], ...(taps == null ? {} : { taps }) });
        await dispatcher.dispatch(request());
        prompts.push(requests);
      }

      expect(prompts[1]).toEqual(prompts[0]);
      expect(prompts[2]).toEqual(prompts[0]);
    });

    it('should fire both seams with followUp true on a follow-up, and see a tap attached after construction', async () => {
      const taps = makeLlmDispatchTapRegistry<HostFields>();
      const { dispatcher } = setup({ replies: ['x'], taps });
      const executed = await dispatcher.preparePrompt(request()).execute();
      const seen: unknown[] = [];
      taps.addTap({ id: 'late', onDispatch: (event) => void seen.push(event), onDispatchComplete: (event) => void seen.push(event) });
      await executed.followUp({ content: 'more' }).execute();

      expect(seen).toEqual([expect.objectContaining({ followUp: true }), expect.objectContaining({ followUp: true })]);
    });
  });

  describe('gaps and subject', () => {
    it('should file ONE raw-JSON gap naming the first block and the count, and still send the prompt', async () => {
      const gaps: LlmDispatchGapParams<LlmDispatchRequest>[] = [];
      const { dispatcher, requests } = setup({ replies: ['x'], onGap: (params) => gaps.push(params), isRawJsonBlock: (text) => text.trim().startsWith('{') });
      await dispatcher.dispatch(request({ renderLiveContext: () => [...blocks('{"a":1}', 'reply'), ...blocks('{"b":2}', 'other'), ...blocks('words', 'plain')] }));

      expect(gaps.map((params) => params.gap)).toEqual([{ kind: 'prompt-raw-json', capability: 'TestCap', block: 'reply', blocks: 2 }]);
      expect(requests[0].prompt).toContain('{"a":1}');
    });

    it('should file no raw-JSON gap for plain words or a rawJsonContext descriptor', async () => {
      const gaps: unknown[] = [];
      const { dispatcher } = setup({ replies: ['x'], onGap: (params) => gaps.push(params), isRawJsonBlock: (text) => text.trim().startsWith('{') });
      await dispatcher.dispatch(request());
      await dispatcher.dispatch(request({ capability: 'RawJsonCap', renderLiveContext: () => blocks('{"a":1}', 'reply') }));

      expect(gaps).toHaveLength(0);
    });

    it('should record subjectCapability as subject, and no subject key otherwise', async () => {
      const { calls, recorder } = recording();
      const { dispatcher } = setup({ replies: ['x'], recorder });
      await dispatcher.dispatch(request({ subjectCapability: 'Judged' }));
      await dispatcher.dispatch(request());

      expect(calls[0].subject).toBe('Judged');
      expect('subject' in calls[1]).toBe(false);
    });

    it('should file one over-budget gap and still send when maxPromptTokens is exceeded, and none under budget', async () => {
      const gaps: LlmDispatchGapParams<LlmDispatchRequest>[] = [];
      const { dispatcher, requests } = setup({ replies: ['x'], onGap: (params) => gaps.push(params) });
      await dispatcher.dispatch(request({ maxPromptTokens: 1 }));
      await dispatcher.dispatch(request({ maxPromptTokens: 100_000 }));

      expect(requests).toHaveLength(2);
      expect(gaps.map((params) => params.gap)).toEqual([{ kind: 'prompt-over-budget', capability: 'TestCap', estimatedPromptTokens: expect.any(Number), maxPromptTokens: 1 }]);
    });
  });

  describe('line protocol', () => {
    it('should be single-shot with no validate', async () => {
      const { dispatcher } = setup({ replies: ['a line'] });
      expect(await dispatcher.dispatch(request({ capability: 'LineCap' }))).toEqual({ text: 'a line', strategyId: 's', strategyKind: 'scripted', capability: 'LineCap', model: 'test/fast' });
    });
  });

  describe('failedAttempts', () => {
    it('should record a dropped attempt with its full reply, seen by the tap too', async () => {
      const taps = makeLlmDispatchTapRegistry<HostFields>();
      const completes: LlmDispatchCompleteTapEvent<HostFields>[] = [];
      taps.addTap({ id: 't', onDispatchComplete: (event) => void completes.push(event) });
      const { calls, recorder } = recording();
      const { dispatcher } = setup({ replies: ['{"answer":1}'], recorder, taps });
      await dispatcher.dispatch(request({ validate: VALID, maxAttempts: 1 }));

      expect(calls[0].failedAttempts).toEqual([expect.objectContaining({ attempt: 1, cause: 'schema-validation', error: 'answer must be a string', text: '{"answer":1}', rawLength: 12 })]);
      expect(completes[0].failedAttempts).toBe(calls[0].failedAttempts);
    });

    it('should clip a very long dropped reply', async () => {
      const long = 'x'.repeat(20_000);
      const { calls, recorder } = recording();
      const { dispatcher } = setup({ replies: [long], recorder });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(calls[0].failedAttempts?.[0]).toMatchObject({ rawLength: 20_000, clipped: true });
    });

    it('should record a validated-path timeout row', async () => {
      const { calls, recorder } = recording();
      const { dispatcher } = setup({ replies: [new APIUserAbortError('aborted')], recorder });
      await dispatcher.dispatch(request({ validate: VALID, maxAttempts: 1 }));

      expect(calls[0].failedAttempts).toEqual([expect.objectContaining({ attempt: 1, cause: 'timeout', text: '' })]);
    });

    it('should hold failedAttempts.length === attempts − (accepted ? 1 : 0)', async () => {
      const scenarios: LlmScriptedReplies = ['{"answer":"ok"}', '{"answer":1}', 'prose', new APIUserAbortError('a'), rateLimited()];

      for (const reply of scenarios) {
        const { calls, recorder } = recording();
        const { dispatcher } = setup({ replies: [reply], recorder });
        const result = await dispatcher.dispatch(request({ validate: VALID, maxAttempts: 1 }));
        const accepted = result.decodeStatus !== 'dropped';

        expect(calls[0].failedAttempts?.length ?? 0).toBe((result.attempts ?? 0) - (accepted ? 1 : 0));
      }
    });
  });

  describe('reply repair', () => {
    it('should repair a near-miss in place on the validated path (one call, recovered decode row, repaired record)', async () => {
      const repaired = repairLlmReplyJson(NEAR_MISS).repaired!;
      const { calls, decodeFailures, recorder } = recording(true);
      const { dispatcher, requests } = setup({ replies: [NEAR_MISS], recorder });
      const result = await dispatcher.dispatch(request({ validate: VALID }));

      expect(requests).toHaveLength(1);
      expect(result).toMatchObject({ decodeStatus: 'clean', text: repaired.text, repair: expect.objectContaining({ tier: 'deterministic', originalText: NEAR_MISS }) });
      expect(decodeFailures[0].payload).toMatchObject({ recovered: true, failures: [expect.objectContaining({ class: 'parse-error', repaired: 'deterministic' })] });
      expect(calls[0].result.text).toBe(repaired.text);
      expect(calls[0].result.repair?.originalText).toBe(NEAR_MISS);
      expect(calls[0].phases?.attempts?.[0].repair).toMatchObject({ tier: 'deterministic' });
    });

    it('should refuse a runaway (repetition_truncation) reply as unclean-finish', async () => {
      const context = makeLlmCallContext({ label: 'root', timing: true });
      const { dispatcher } = setup({ replies: [{ text: NEAR_MISS, finishReason: 'repetition_truncation' }] });
      const result = await dispatcher.dispatch(request({ validate: VALID, maxAttempts: 1, callContext: context }));

      expect(result.decodeStatus).toBe('dropped');
      expect(diagsOf(context).find((diag) => diag.code === 'reply-repair-refused')?.fields).toMatchObject({ reason: 'unclean-finish' });
    });

    it('should leave prose-led and line replies untouched', async () => {
      const prose = `Sure! ${NEAR_MISS}`;
      const { dispatcher } = setup({ replies: [prose] });

      expect((await dispatcher.dispatch(request())).text).toBe(prose);
      expect((await dispatcher.dispatch(request({ capability: 'LineCap' }))).text).toBe(prose);
    });

    it('should substitute a single-shot near-miss with no decode record, and refuse a mangled reply as mangled', async () => {
      const { decodeFailures, recorder } = recording();
      const context = makeLlmCallContext({ label: 'root', timing: true });
      const { dispatcher } = setup({ replies: [NEAR_MISS, MANGLED], recorder });

      expect((await dispatcher.dispatch(request())).text).toBe(repairLlmReplyJson(NEAR_MISS).repaired!.text);
      expect((await dispatcher.dispatch(request({ callContext: context }))).text).toBe(MANGLED);
      expect(decodeFailures).toHaveLength(0);
      expect(diagsOf(context).find((diag) => diag.code === 'reply-repair-refused')?.fields).toMatchObject({ reason: 'mangled' });
    });
  });

  describe('library cases', () => {
    it('should resolve capabilityVision over its own tiers and vision map', () => {
      const { dispatcher } = setup({ visionByModel: { 'test/strong': true } });

      expect(dispatcher.capabilityVision!('StrongCap')).toMatchObject({ model: 'test/strong', vision: true });
      expect(dispatcher.capabilityVision!('TestCap')).toMatchObject({ model: 'test/fast', vision: false });
    });

    it('should file prefix-changed naming the first differing segment, per partition', async () => {
      const context = makeLlmCallContext({ label: 'root', timing: true });
      const addenda: Record<string, string> = { 'test/fast': 'ADD-1' };
      const contributors: ReadonlyArray<LlmPromptContributor> = [makeLlmModelAddendumPromptContributor({ promptAddendumByModel: addenda })];
      const { dispatcher } = setup({ replies: ['x'], contributors, cachePartitionOf: (r) => (r.meta as { seat?: string } | undefined)?.seat });
      await dispatcher.dispatch(request({ meta: { seat: 'a' }, callContext: context }));
      await dispatcher.dispatch(request({ meta: { seat: 'b' }, callContext: context }));
      addenda['test/fast'] = 'ADD-2';
      await dispatcher.dispatch(request({ meta: { seat: 'a' }, callContext: context }));
      const changed = diagsOf(context).filter((diag) => diag.code === 'prefix-changed');

      expect(changed).toHaveLength(1);
      expect(changed[0].fields).toMatchObject({ capability: 'TestCap', partition: 'a', firstDifferingSegmentId: 'model-addendum' });
    });

    it('should nest a parented dispatch under request.callContext with the attribution override', async () => {
      const parent = makeLlmCallContext<{ readonly callId?: string }>({ label: 'turn', timing: true, attribution: {} });
      let attribution: unknown;
      const { dispatcher } = setup({ replies: ['x'], callAttributionOf: () => ({ callId: 'c-1' }) as never, resultOf: ({ result, callContext }) => ((attribution = callContext.attribution), result) });
      await dispatcher.dispatch(request({ callContext: parent as LlmCallContext }));

      expect(parent.profile().children.map((child) => child.label)).toEqual(['TestCap']);
      expect(attribution).toMatchObject({ callId: 'c-1' });
    });

    it('should mint an unparented context with the recorder, else report swallows to config.swallow', async () => {
      const labels: string[] = [];
      const sites: string[] = [];
      const recorder: LlmDispatchRecorder<LlmDispatchRequest, HostFields> = { newCallContext: ({ label }) => (labels.push(label), makeLlmCallContext({ label })), recordCall: () => undefined };
      await setup({ replies: ['x'], recorder }).dispatcher.dispatch(request());
      await setup({ replies: ['{"answer": oops}'], swallow: (site) => sites.push(site) }).dispatcher.dispatch(request({ validate: VALID }));

      expect(labels).toEqual(['TestCap']);
      expect(sites).toContain('llm/reply-envelope.decode');
    });

    it("should hand every host hook the completion lane and the host's request", async () => {
      const seen: string[] = [];
      const recorder: LlmDispatchRecorder<LlmDispatchRequest, HostFields> = { newCallContext: ({ lane, request: given, label }) => (seen.push(`newCallContext:${lane}:${given.capability}`), makeLlmCallContext({ label })), recordCall: () => undefined };
      const sent = request();
      const requests: unknown[] = [];
      await setup({
        replies: ['x'],
        recorder,
        callAttributionOf: ({ lane, request: given }) => (seen.push(`callAttributionOf:${lane}`), requests.push(given), undefined),
        recordFieldsOf: ({ lane, kind, request: given }) => (seen.push(`recordFieldsOf:${lane}:${kind}`), requests.push(given), {})
      }).dispatcher.dispatch(sent);

      expect(seen).toEqual(['callAttributionOf:completion', 'newCallContext:completion:TestCap', 'recordFieldsOf:completion:start', 'recordFieldsOf:completion:call']);
      expect(requests.every((given) => given === sent)).toBe(true);
    });

    it('should serve the root by prompt HASH through a tape, and a chained follow-up by order', async () => {
      const expectedRoot = 'A-PROTOCOL\n\nB-CAP\n\nC-CTX\nD-LIVE';
      const tape = makeLlmTapeStrategy({
        id: 'tape',
        turns: [
          { capability: 'TestCap', promptSha: hashLlmTapePrompt(expectedRoot), text: 'root reply' },
          { capability: 'TestCap', promptSha: 'no-such-prompt', text: 'follow reply' }
        ]
      });
      const { dispatcher } = setup({ strategy: tape });
      const executed = await dispatcher.preparePrompt(request()).execute();
      const followed = await executed.followUp({ content: 'next' }).execute();

      expect(executed.result.text).toBe('root reply');
      expect(followed.result.text).toBe('follow reply');
      expect(tape.matches()[0].kind).toBe('hash');
    });

    it('should chain over the real dispatcher: render the root live context once, send only the lead + changed blocks after', async () => {
      const { dispatcher, requests } = setup({ replies: ['one', 'two'] });
      const chain = makeLlmPromptChain();
      let renders = 0;
      const first = await chain.dispatch({ dispatcher, request: request({ renderLiveContext: () => ((renders += 1), [...blocks('same', 'a'), ...blocks('v1', 'b')]) }) });
      await chain.dispatch({ dispatcher, previous: first, request: request({ renderLiveContext: () => [...blocks('same', 'a'), ...blocks('v2', 'b')] }) });

      expect(renders).toBe(1);
      expect(requests[1].prompt).toContain('v2');
      expect(requests[1].prompt).not.toContain('same');
      expect(requests[1].thread?.[0].content).toBe(requests[0].prompt);
    });
  });

  describe('unretryable send errors', () => {
    async function caughtOf(promise: Promise<unknown>): Promise<unknown> {
      return promise.then(
        () => undefined,
        (e: unknown) => e
      );
    }

    function statusError(status: number): Error {
      return Object.assign(new Error(`http ${status}`), { status });
    }

    it('(a) should record a 401 on attempt 1, then reject with the structured fault', async () => {
      const { starts, calls, decodeFailures, recorder } = recording();
      const completes: LlmDispatchCompleteTapEvent<HostFields>[] = [];
      const taps = makeLlmDispatchTapRegistry<HostFields>();
      taps.addTap({ id: 't', onDispatchComplete: (event) => void completes.push(event) });
      const isRetryableUnknownError = vi.fn(() => true);
      const backoff = vi.fn(() => 0);
      const thrown = statusError(401);
      const { dispatcher } = setup({ replies: [thrown], recorder, taps, isRetryableUnknownError, transportBackoff: backoff });
      const caught = await caughtOf(dispatcher.dispatch(request({ validate: VALID })));

      expect(isLlmDispatchFaultError(caught)).toBe(true);
      expect(caught).toMatchObject({ fault: 'unretryable', classification: 'permanent', attempt: 1, summary: formatLlmErrorSummary(thrown) });
      expect((caught as LlmDispatchFaultError).cause).toBe(thrown);
      expect(isRetryableUnknownError).not.toHaveBeenCalled();
      expect(backoff).not.toHaveBeenCalled();
      expect(starts).toHaveLength(1);
      expect(calls).toHaveLength(1);
      expect(calls[0].result).toMatchObject({ decodeStatus: 'dropped', decodeOutcome: 'transport', finishReason: '__unretryable__' });
      expect(calls[0].failedAttempts).toEqual([expect.objectContaining({ cause: 'unretryable', error: formatLlmErrorSummary(thrown), errorClassification: 'permanent' })]);
      expect(decodeFailures).toHaveLength(1);
      expect(decodeFailures[0].payload.failures).toEqual([expect.objectContaining({ class: 'unretryable', errorClassification: 'permanent' })]);
      expect(completes).toHaveLength(1);
    });

    it('(b) should resend a 503, then reject on a 400 at attempt 2', async () => {
      const { calls, recorder } = recording();
      const backoff = vi.fn((_input: LlmDispatchTransportBackoffParams) => 0);
      const unavailable = statusError(503);
      const { dispatcher } = setup({ replies: [unavailable, statusError(400)], recorder, transportBackoff: backoff });
      const caught = await caughtOf(dispatcher.dispatch(request({ validate: VALID, maxAttempts: 3 })));

      expect(caught).toMatchObject({ classification: 'permanent', attempt: 2 });
      expect(backoff).toHaveBeenCalledTimes(1);
      expect(backoff.mock.calls[0][0]).toEqual({ attempt: 1, error: unavailable });
      expect(backoff.mock.calls[0][0].error).toBe(unavailable);
      const [first, second] = calls[0].failedAttempts ?? [];
      expect(first).toMatchObject({ cause: 'transport' });
      expect(first).not.toHaveProperty('errorClassification');
      expect(second).toMatchObject({ cause: 'unretryable', errorClassification: 'permanent' });
    });

    it('(c) should resend a host-approved 409 like a transient error, resolving dropped once the budget is spent', async () => {
      const { calls, recorder } = recording();
      const backoff = vi.fn(() => 0);
      const isRetryableUnknownError = vi.fn(() => true);
      const { dispatcher, requests } = setup({ replies: [statusError(409), statusError(409)], recorder, transportBackoff: backoff, isRetryableUnknownError });
      const result = await dispatcher.dispatch(request({ validate: VALID, maxAttempts: 2 }));

      expect(result.decodeStatus).toBe('dropped');
      expect(requests).toHaveLength(2);
      expect(backoff).toHaveBeenCalledTimes(1);
      expect(isRetryableUnknownError).toHaveBeenCalledTimes(2);
      expect(calls[0].failedAttempts).toEqual([expect.objectContaining({ cause: 'transport', errorClassification: 'unknown' }), expect.objectContaining({ cause: 'transport', errorClassification: 'unknown' })]);
    });

    it('(c) should reject a 409 the host does not vouch for', async () => {
      for (const isRetryableUnknownError of [undefined, () => false, () => undefined]) {
        const { dispatcher, requests } = setup({ replies: [statusError(409)], isRetryableUnknownError, transportBackoff: () => 0 });
        const caught = await caughtOf(dispatcher.dispatch(request({ validate: VALID, maxAttempts: 2 })));

        expect(caught).toMatchObject({ fault: 'unretryable', classification: 'unknown' });
        expect(requests).toHaveLength(1);
      }
    });

    it('(d) should resend a 408', async () => {
      const { dispatcher, requests } = setup({ replies: [statusError(408), '{"answer":"ok"}'], transportBackoff: () => 0 });
      const result = await dispatcher.dispatch(request({ validate: VALID, maxAttempts: 2 }));

      expect(result.decodeStatus).toBe('retried');
      expect(requests).toHaveLength(2);
    });

    it('(e) should drop a 503 on a cancelled dispatch, not reject', async () => {
      const controller = new AbortController();
      controller.abort();
      const { dispatcher } = setup({ replies: [statusError(503)], cancellationSignal: controller.signal, transportBackoff: () => 0 });
      const result = await dispatcher.dispatch(request({ validate: VALID, maxAttempts: 2 }));

      expect(result.decodeStatus).toBe('dropped');
    });

    it('should never consult the host function on the single-shot path, and record the call', async () => {
      const { calls, recorder } = recording();
      const isRetryableUnknownError = vi.fn(() => true);
      const { dispatcher } = setup({ replies: [new Error('boom')], recorder, isRetryableUnknownError });
      const caught = await caughtOf(dispatcher.dispatch(request()));

      expect(caught).toMatchObject({ fault: 'unretryable', classification: 'unknown', attempt: 1 });
      expect(isRetryableUnknownError).not.toHaveBeenCalled();
      expect(calls).toHaveLength(1);
      expect(calls[0].failedAttempts).toEqual([expect.objectContaining({ cause: 'unretryable', errorClassification: 'unknown' })]);
    });

    it('should record a single-shot timeout or transient failure, then rethrow the original error', async () => {
      const scenarios: ReadonlyArray<readonly [Error, string]> = [
        [new APIUserAbortError('aborted'), 'timeout'],
        [statusError(503), 'transport']
      ];

      for (const [thrown, failureClass] of scenarios) {
        const { calls, decodeFailures, recorder } = recording();
        const completes: LlmDispatchCompleteTapEvent<HostFields>[] = [];
        const taps = makeLlmDispatchTapRegistry<HostFields>();
        taps.addTap({ id: 't', onDispatchComplete: (event) => void completes.push(event) });
        const { dispatcher } = setup({ replies: [thrown], recorder, taps });
        const caught = await caughtOf(dispatcher.dispatch(request()));

        expect(caught).toBe(thrown);
        expect(calls).toHaveLength(1);
        expect(calls[0].result).toMatchObject({ attempts: 1, decodeStatus: 'dropped', decodeOutcome: 'transport' });
        expect(calls[0].failedAttempts).toEqual([expect.objectContaining({ attempt: 1, cause: failureClass })]);
        expect(decodeFailures).toHaveLength(1);
        expect(decodeFailures[0].payload.failures).toEqual([expect.objectContaining({ class: failureClass })]);
        expect(completes).toHaveLength(1);
      }
    });

    it('should record a single-shot 429 and a socket reset before rethrowing them', async () => {
      const socketReset = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
      const scenarios: ReadonlyArray<Error> = [rateLimited(), socketReset];

      for (const thrown of scenarios) {
        const { calls, recorder } = recording();
        const completes: LlmDispatchCompleteTapEvent<HostFields>[] = [];
        const taps = makeLlmDispatchTapRegistry<HostFields>();
        taps.addTap({ id: 't', onDispatchComplete: (event) => void completes.push(event) });
        const { dispatcher } = setup({ replies: [thrown], recorder, taps });
        const caught = await caughtOf(dispatcher.dispatch(request()));

        expect(caught).toBe(thrown);
        expect(calls).toHaveLength(1);
        expect(calls[0].failedAttempts).toEqual([expect.objectContaining({ attempt: 1, cause: 'transport' })]);
        expect(completes).toHaveLength(1);
      }
    });

    it('should drop the dispatch on a cancelled single-shot transient failure, recording the call', async () => {
      const controller = new AbortController();
      controller.abort();
      const { calls, decodeFailures, recorder } = recording();
      const { dispatcher } = setup({ replies: [statusError(503)], recorder, cancellationSignal: controller.signal });
      const result = await dispatcher.dispatch(request());

      expect(result).toMatchObject({ text: '', finishReason: '__transport__' });
      expect(result).not.toHaveProperty('decodeStatus');
      expect(calls).toHaveLength(1);
      expect(calls[0].failedAttempts ?? []).toHaveLength(0);
      expect(decodeFailures).toHaveLength(0);
    });
  });
});
