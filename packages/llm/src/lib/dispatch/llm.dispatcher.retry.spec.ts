/**
 * The dispatcher's BOUNDED retry loop — the ported validate-and-retry, lever-ladder, correction, transport, bonus,
 * truncation, critique and failed-attempt cases, plus the library's own.
 *
 * Not ported: a host-only validator that duplicated the validate-and-retry case; the case that relied on a host's
 * shipped same-slug default tier map (folded into the same-slug tiers case below); and the host writer's capture
 * gate (it belongs to the host's recorder).
 */

import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { makeLlmScriptedStrategy, type LlmScriptedCompletion, type LlmScriptedReplies } from '@dereekb/llm/test';
import { defineLlmCapability, type LlmCapabilityDescriptor } from '../capability/llm.capability.descriptor';
import { type LlmModelTierMap } from '../model/llm.model.tier';
import { type LlmLiveContextBlock } from '../prompt/llm.prompt.live.context';
import { DEFAULT_LLM_PROMPT_LAYOUT } from '../prompt/llm.prompt.layout';
import { makeLlmModelAddendumPromptContributor } from '../prompt/llm.prompt.model.addendum';
import { DEFAULT_LLM_DEGENERATE_THREAD_PLACEHOLDER } from '../prompt/llm.prompt.thread';
import { type LlmPromptTemplate, makeLlmTieredPromptTemplateResolver } from '../prompt/llm.prompt.template';
import { type LlmCallContext, type LlmCallDiag, makeLlmCallContext } from '../record/llm.call.context';
import { type LlmCallRecord, type LlmCallStartRecord, type LlmDecodeFailureRecord } from '../record/llm.call.record';
import { makeLlmDispatchTapRegistry, type LlmDecodeFailureTapEvent, type LlmDispatchCompleteTapEvent } from '../record/llm.dispatch.tap';
import { type LlmCritic } from '../reply/llm.reply.critique';
import { formatLlmErrorSummary } from '../strategy/llm.error';
import { type LlmDispatchResult, type LlmRequest, type LlmStrategy } from '../strategy/llm.strategy';
import { makeLlmStrategyRegistry } from '../strategy/llm.strategy.registry';
import { type LlmDispatchRequest } from './llm.dispatch.request';
import { type LlmDispatchGap, type LlmDispatcherConfig, type LlmDispatchRecorder } from './llm.dispatcher.config';
import { makeLlmDispatcher } from './llm.dispatcher.pipeline';

// MARK: Fixtures
const TEMPLATES: ReadonlyArray<LlmPromptTemplate> = [
  { key: 'reply-protocol', role: 'reply-protocol', text: 'A-PROTOCOL' },
  { key: 'instructions', role: 'instructions', text: 'B-CAP' },
  { key: 'context', role: 'context', text: 'C-CTX\n{{liveContext}}' }
];

const RESOLVER = makeLlmTieredPromptTemplateResolver({ tiers: [{ source: 'defaults', templates: TEMPLATES }] });

const TIERS: LlmModelTierMap = { fast: 'test/fast', strong: 'test/strong' };

const ANSWER = type({ answer: 'string' });

function descriptorOf(config: Omit<Parameters<typeof defineLlmCapability>[0], 'responseSchema' | 'parseLever'>): LlmCapabilityDescriptor {
  return defineLlmCapability({ responseSchema: ANSWER, parseLever: (lever) => lever, ...config });
}

const DESCRIPTORS: Readonly<Record<string, LlmCapabilityDescriptor>> = {
  StrongCap: descriptorOf({ capability: 'StrongCap', tier: 'strong' }),
  LineCap: descriptorOf({ capability: 'LineCap', replyProtocol: 'line' }),
  EnvelopeCap: descriptorOf({ capability: 'EnvelopeCap', replyProtocol: 'json-envelope' })
};

const VALID = (lever: unknown) => (typeof (lever as { answer?: unknown }).answer === 'string' ? true : { error: 'answer must be a string' });

const OK = '{"answer":"ok"}';
const INVALID = '{"answer":1}';
const PROSE = 'just prose';

/**
 * A completion the cap ended, with no text and every completion token spent reasoning.
 */
const CAP: LlmScriptedCompletion = { text: '', finishReason: 'length', usage: { promptTokens: 10, completionTokens: 2048, totalTokens: 2058, reasoningTokens: 2048 } };

const TRUNCATED: LlmScriptedCompletion = { text: '{"answer":"cut off mid', finishReason: 'length' };

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
  const used = strategy ?? makeLlmScriptedStrategy({ id: 's', replies: replies ?? [OK], requests });
  const dispatcher = makeLlmDispatcher<LlmDispatchRequest, LlmDispatchResult, HostFields>({
    strategies: makeLlmStrategyRegistry([used]),
    defaultStrategyId: used.id,
    defaultMaxOutputTokens: 1024,
    modelTiers: TIERS,
    descriptorOf: (capability) => DESCRIPTORS[capability],
    templateResolver: RESOLVER,
    transportBackoff: () => 0,
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
    pause: () => {
      isPaused = true;
    },
    resume: () => {
      isPaused = false;
      resume();
    },
    waited: () => waited
  };
}

class APIUserAbortError extends Error {}
class APIConnectionError extends Error {}
class APIConnectionTimeoutError extends APIConnectionError {}
class RateLimitError extends Error {
  readonly status = 429;
}
class InternalServerError extends Error {
  readonly status = 503;
}

function timeoutError(): Error {
  return Object.assign(new Error('timed out'), { name: 'TimeoutError' });
}

/**
 * A critic that rejects with `error` the first `fails` times, then accepts; `calls` counts every call.
 */
function critic(fails: number, error = 'too vague') {
  const inputs: Parameters<LlmCritic>[0][] = [];
  const critique: LlmCritic = async (input) => {
    inputs.push(input);
    return inputs.length <= fails ? { error } : true;
  };
  return { critique, inputs };
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

function spanNamesOf(context: LlmCallContext): ReadonlyArray<string> {
  const profile = context.profile();
  const all: string[] = [];
  const walk = (node: typeof profile) => {
    all.push(...node.spans.map((span) => span.name));
    node.children.forEach(walk);
  };
  walk(profile);
  return all;
}

function suffixOf(sent: LlmRequest): string {
  return sent.cacheSegments?.volatileSuffix ?? '';
}

const JSON_CONTRACT_CORRECTION = '\n\n## Correction\nYour previous reply did not conform to the required output contract: answer must be a string\nReply again with a single JSON object that conforms exactly to the contract.';

// MARK: Specs
describe('makeLlmDispatcher() retry', () => {
  describe('addendum', () => {
    it('should land the correction in the volatile suffix with the addendum still prefixed, without moving the model', async () => {
      const { dispatcher, requests } = setup({
        replies: [INVALID, OK],
        contributors: [makeLlmModelAddendumPromptContributor({ promptAddendumByModel: { 'test/strong': 'STRONG-ADDENDUM' } })]
      });
      await dispatcher.dispatch(request({ capability: 'StrongCap', validate: VALID }));

      expect(requests).toHaveLength(2);
      expect(requests[1].model).toBe('test/strong');
      expect(requests[1].cacheSegments?.cachePrefix).toBe(requests[0].cacheSegments?.cachePrefix);
      expect(requests[1].prompt).toContain('STRONG-ADDENDUM');
      expect(suffixOf(requests[1])).toContain('## Correction');
    });
  });

  describe('validate-and-retry', () => {
    it('should re-ask once after an invalid reply, with the correction in the suffix only', async () => {
      const { dispatcher, requests } = setup({ replies: [INVALID, OK] });
      const result = await dispatcher.dispatch(request({ validate: VALID }));

      expect(requests).toHaveLength(2);
      expect(result).toMatchObject({ attempts: 2, decodeStatus: 'retried', validationErrors: ['attempt 1: answer must be a string'] });
      expect(requests[1].cacheSegments?.cachePrefix).toBe(requests[0].cacheSegments?.cachePrefix);
      expect(suffixOf(requests[1])).toContain('## Correction');
      expect(suffixOf(requests[1])).toContain('answer must be a string');
      expect(suffixOf(requests[0])).not.toContain('## Correction');
      expect(`${requests[1].cacheSegments?.cachePrefix}${suffixOf(requests[1])}`).toBe(requests[1].prompt);
    });

    it('should spend maxAttempts 3 on a reply that is invalid throughout, keeping only the latest correction', async () => {
      const { dispatcher, requests } = setup({ replies: [INVALID] });
      const result = await dispatcher.dispatch(request({ validate: VALID, maxAttempts: 3 }));

      expect(requests).toHaveLength(3);
      expect(result).toMatchObject({ attempts: 3, decodeStatus: 'dropped', text: INVALID });
      expect(result.validationErrors).toEqual(['attempt 1: answer must be a string', 'attempt 2: answer must be a string', 'attempt 3: answer must be a string']);
      expect(requests[2].prompt).toBe(requests[1].prompt);
    });

    it('should re-ask after a no-JSON reply with a decode correction and no validationErrors', async () => {
      const { dispatcher, requests } = setup({ replies: [PROSE, OK] });
      const result = await dispatcher.dispatch(request({ validate: VALID }));

      expect(requests).toHaveLength(2);
      expect(result.validationErrors).toBeUndefined();
      expect(result.decodeStatus).toBe('retried');
      expect(suffixOf(requests[1])).toContain('## Correction');
    });

    it('should accept a decline at budget 2 in one call', async () => {
      const { dispatcher, requests } = setup({ replies: ['{"answerable":false,"rationale":"cannot"}'] });
      const result = await dispatcher.dispatch(request({ capability: 'EnvelopeCap', validate: VALID }));

      expect(requests).toHaveLength(1);
      expect(result.decodeStatus).toBe('clean');
    });

    it('should default the budget to 2 attempts', async () => {
      const { dispatcher, requests } = setup({ replies: [INVALID] });
      const result = await dispatcher.dispatch(request({ validate: VALID }));

      expect(requests).toHaveLength(2);
      expect(result).toMatchObject({ attempts: 2, decodeStatus: 'dropped' });
    });
  });

  describe('decode retry and telemetry', () => {
    it('should file one call record and one decode record with two failures for a two-attempt length runaway', async () => {
      const { calls, decodeFailures, recorder } = recording();
      const { dispatcher } = setup({ replies: [TRUNCATED], recorder });
      const result = await dispatcher.dispatch(request({ validate: VALID }));

      expect(result).toMatchObject({ attempts: 2, decodeStatus: 'dropped', lengthCapped: true });
      expect(calls).toHaveLength(1);
      expect(decodeFailures).toHaveLength(1);
      expect(decodeFailures[0].payload).toMatchObject({ attempts: 2, recovered: false });
      expect(decodeFailures[0].payload.failures).toHaveLength(2);
      expect(decodeFailures[0].payload.contextExcerpt).toContain('D-LIVE');
    });

    it('should mark a degenerate reply that a retry recovered from as recovered with one failure', async () => {
      const { decodeFailures, recorder } = recording();
      const { dispatcher } = setup({ replies: ['', OK], recorder });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(decodeFailures[0].payload.recovered).toBe(true);
      expect(decodeFailures[0].payload.failures).toHaveLength(1);
    });

    it('should hold two validationErrors and ONE schema-validation row', async () => {
      const { decodeFailures, recorder } = recording();
      const { dispatcher } = setup({ replies: [INVALID], recorder });
      const result = await dispatcher.dispatch(request({ validate: VALID }));

      expect(result.validationErrors).toHaveLength(2);
      expect(decodeFailures[0].payload.failures).toEqual([expect.objectContaining({ class: 'schema-validation' })]);
    });

    it("should escalate the model on a decode retry with decodeRetryTier 'strong'", async () => {
      const { dispatcher, requests } = setup({ replies: [PROSE, OK], decodeRetryTier: 'strong' });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(requests[0].model).toBe('test/fast');
      expect(requests[1].model).toBe('test/strong');
    });

    it("should keep the resolved model with decodeRetryTier 'off' and take the reasoning-low rung", async () => {
      const { dispatcher, requests } = setup({ replies: [PROSE, OK], decodeRetryTier: 'off' });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(requests[1].model).toBe('test/fast');
      expect(requests[1].reasoning).toEqual({ enabled: true, effort: 'low' });
    });

    it('should not fake an escalation over same-slug tiers, taking the reasoning-low rung instead', async () => {
      const { dispatcher, requests } = setup({ replies: [PROSE, OK], modelTiers: { fast: 'test/same', strong: 'test/same' } });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(requests[1].model).toBe(requests[0].model);
      expect(requests[1].reasoning).toEqual({ enabled: true, effort: 'low' });
    });

    it('should resend a timeout identically, with no correction segment and no model change', async () => {
      const { dispatcher, requests } = setup({ replies: [new APIUserAbortError('aborted'), OK] });
      const result = await dispatcher.dispatch(request({ validate: VALID }));

      expect(result.decodeStatus).toBe('retried');
      expect(requests[1]).toEqual(requests[0]);
    });

    it('should stamp the retry decision on the second attempt phase only', async () => {
      const { calls, recorder } = recording(true);
      const { dispatcher } = setup({ replies: [PROSE, OK], recorder });
      await dispatcher.dispatch(request({ validate: VALID }));

      const attempts = calls[0].phases?.attempts ?? [];
      expect(attempts[0].retry).toBeUndefined();
      expect(attempts[1].retry).toMatchObject({ lever: 'model', from: 'test/fast', to: 'test/strong', cause: 'parse-error' });
    });

    it('should never parse a length-capped reply while budget remains', async () => {
      const { dispatcher, requests } = setup({ replies: [{ text: OK, finishReason: 'length' }, OK] });
      const result = await dispatcher.dispatch(request({ validate: VALID }));

      // the library's 1024 default × 4 (the host ran 2048 × 2)
      expect(requests[1].maxOutputTokens).toBe(4096);
      expect(result).toMatchObject({ decodeStatus: 'retried', lengthCapped: true, decodeOutcome: 'ok' });
    });

    it('should retry a reasoning-only reply with reasoning off', async () => {
      const { dispatcher, requests } = setup({ replies: [{ text: '', usage: CAP.usage }, OK], reasoningDefault: { enabled: true, effort: 'medium' } });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(requests[0].reasoning?.enabled).toBe(true);
      expect(requests[1].reasoning?.enabled).toBe(false);
    });

    it('should take no reasoning rung on a strategy that does not accept the reasoning parameter', async () => {
      const requests: LlmRequest[] = [];
      const strategy: LlmStrategy = { ...makeLlmScriptedStrategy({ id: 's', replies: [{ text: '', usage: CAP.usage }, OK], requests }), supportsReasoningParam: false };
      const { dispatcher } = setup({ strategy, reasoningDefault: { enabled: true, effort: 'medium' } });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(requests[1].reasoning).toEqual(requests[0].reasoning);
      expect(requests[1].maxOutputTokens).toBe(4096);
    });

    it('should accept a line reply at budget 2 in one call with no decode rows', async () => {
      const { decodeFailures, recorder } = recording();
      const { dispatcher, requests } = setup({ replies: ['a plain line'], recorder });
      await dispatcher.dispatch(request({ capability: 'LineCap', validate: VALID }));

      expect(requests).toHaveLength(1);
      expect(decodeFailures).toHaveLength(0);
    });
  });

  describe('bonus attempt', () => {
    it('should grant one bonus attempt with reasoning off after a reasoning-low retry the cap ended', async () => {
      const { calls, decodeFailures, recorder } = recording(true);
      const { dispatcher, requests } = setup({ replies: [INVALID, CAP, OK], recorder });
      const result = await dispatcher.dispatch(request({ validate: VALID }));

      expect(requests).toHaveLength(3);
      expect(requests[0].reasoning?.enabled ?? false).toBe(false);
      expect(requests[1].reasoning).toEqual({ enabled: true, effort: 'low' });
      expect(requests[2].reasoning?.enabled).toBe(false);
      expect(requests[1].maxOutputTokens).toBe(2048);
      const attempts = calls[0].phases?.attempts ?? [];
      expect(attempts[1].retry).toMatchObject({ lever: 'reasoning-low', headroom: requests[1].maxOutputTokens });
      expect(attempts[2].retry).toMatchObject({ lever: 'reasoning-off', bonus: true, induced: 'reasoning-low' });
      expect(decodeFailures[0].payload.failures).toContainEqual(expect.objectContaining({ class: 'empty-result', lever: 'reasoning-off', bonus: true }));
      expect(decodeFailures[0].payload.recovered).toBe(true);
      expect(result.decodeStatus).toBe('retried');
    });

    it('should grant the bonus at most once', async () => {
      const { dispatcher, requests } = setup({ replies: [INVALID, CAP, CAP] });
      const result = await dispatcher.dispatch(request({ validate: VALID }));

      expect(requests).toHaveLength(3);
      expect(result).toMatchObject({ decodeStatus: 'dropped', decodeOutcome: 'length-capped' });
    });

    it('should grant no bonus when the capped retry was not reasoning-low, the strategy refuses reasoning, or nothing capped', async () => {
      const unsupported: LlmRequest[] = [];
      const scenarios: ReadonlyArray<SetupConfig> = [{ replies: [PROSE, CAP] }, { strategy: { ...makeLlmScriptedStrategy({ id: 's', replies: [INVALID, CAP], requests: unsupported }), supportsReasoningParam: false } }, { replies: [INVALID, ''] }];

      for (const scenario of scenarios) {
        const { dispatcher, requests } = setup(scenario);
        const result = await dispatcher.dispatch(request({ validate: VALID }));

        expect(result.attempts).toBe(2);
        expect(requests.length + unsupported.length).toBeGreaterThan(0);
      }
    });
  });

  describe('truncation budget', () => {
    it('should send the default cap first, then the raised one', async () => {
      const { dispatcher, requests } = setup({ replies: [TRUNCATED, OK] });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(requests[0].maxOutputTokens).toBe(1024);
      expect(requests[1].maxOutputTokens).toBe(4096);
    });

    it('should raise the budget on an empty reply the cap ended', async () => {
      const { dispatcher, requests } = setup({ replies: [{ text: '', finishReason: 'length' }, OK] });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(requests[1].maxOutputTokens).toBe(4096);
    });

    it("should climb from a tier's own budget to the ceiling", async () => {
      const { dispatcher, requests } = setup({ replies: [TRUNCATED], modelTiers: { fast: { model: 'test/fast', maxOutputTokens: 4096 }, strong: 'test/strong' } });
      await dispatcher.dispatch(request({ validate: VALID, maxAttempts: 3 }));

      expect(requests.map((sent) => sent.maxOutputTokens)).toEqual([4096, 16384, 32768]);
    });

    it('should hold the budget at the ceiling once reached (the budget persists)', async () => {
      const { dispatcher, requests } = setup({ replies: [TRUNCATED], defaultMaxOutputTokens: 8192 });
      await dispatcher.dispatch(request({ validate: VALID, maxAttempts: 3 }));

      expect(requests[1].maxOutputTokens).toBe(32768);
      expect(requests[2].maxOutputTokens).toBe(32768);
    });

    it('should move the budget, not the model, on a truncation even with an escalation tier', async () => {
      const { dispatcher, requests } = setup({ replies: [TRUNCATED, OK], decodeRetryTier: 'strong' });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(requests[1].model).toBe('test/fast');
      expect(requests[1].maxOutputTokens).toBe(4096);
    });
  });

  describe('telemetry', () => {
    it('should stamp one phase per attempt with its ordinal', async () => {
      const { calls, recorder } = recording(true);
      const { dispatcher } = setup({ replies: [INVALID, OK], recorder });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(calls[0].phases?.attempts?.map((phase) => phase.attempt)).toEqual([1, 2]);
    });

    it('should nest one callProfile child per attempt', async () => {
      const { recorder } = recording(true);
      const labels: string[][] = [];
      const { dispatcher } = setup({ replies: [INVALID, OK], recorder, resultOf: ({ result, callProfile }) => (labels.push(callProfile?.children.map((child) => child.label) ?? []), result) });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(labels[0]).toEqual(['attempt-1', 'attempt-2']);
    });
  });

  describe('prompt instances', () => {
    it("should reprompt only the follow-up on a follow-up validate, keep the thread byte-stable, and read the follow-up's maxAttempts", async () => {
      const { dispatcher, requests } = setup({ replies: [OK, INVALID, '{"answer":"two"}', '{"answer":"three"}'] });
      const executed = await dispatcher.preparePrompt(request()).execute();
      const second = await executed.followUp({ content: 'next item', validate: VALID }).execute();

      expect(requests).toHaveLength(3);
      expect(requests[1].prompt).toBe('next item');
      expect(requests[2].prompt.startsWith('next item\n\n## Correction')).toBe(true);
      expect(requests[2].thread).toEqual(requests[1].thread);

      await second.followUp({ content: 'last item', validate: VALID }).execute();
      expect(requests[3].thread?.[2]).toEqual({ role: 'user', content: requests[2].prompt });
      expect(requests[3].thread?.[3]).toEqual({ role: 'assistant', content: '{"answer":"two"}' });

      const single = setup({ replies: [OK, INVALID, OK] });
      const root = await single.dispatcher.preparePrompt(request()).execute();
      await root.followUp({ content: 'next item', validate: VALID, maxAttempts: 1 }).execute();
      expect(single.requests).toHaveLength(2);
    });
  });

  describe('degenerate thread', () => {
    it('should replay the placeholder after a budget-2 drop', async () => {
      const { dispatcher } = setup({ replies: [INVALID, INVALID, 'x'] });
      const executed = await dispatcher.preparePrompt(request({ validate: VALID })).execute();

      expect(executed.thread[1]).toEqual({ role: 'assistant', content: DEFAULT_LLM_DEGENERATE_THREAD_PLACEHOLDER });
    });

    it('should replay a recovered reply verbatim', async () => {
      const { dispatcher } = setup({ replies: [INVALID, OK] });
      const executed = await dispatcher.preparePrompt(request({ validate: VALID })).execute();

      expect(executed.thread[1]).toEqual({ role: 'assistant', content: OK });
    });
  });

  describe('timeout and transport', () => {
    it('should recover from a TimeoutError by name', async () => {
      const { decodeFailures, recorder } = recording();
      const { dispatcher } = setup({ replies: [timeoutError(), OK], recorder });
      const result = await dispatcher.dispatch(request({ validate: VALID }));

      expect(result.decodeStatus).toBe('retried');
      expect(decodeFailures[0].payload.failures).toEqual([expect.objectContaining({ class: 'timeout' })]);
    });

    it('should classify each transport error and retry it', async () => {
      const scenarios: ReadonlyArray<readonly [Error, string]> = [
        [new APIConnectionError('connection'), 'transport'],
        [new APIConnectionTimeoutError('connection timed out'), 'timeout'],
        [new RateLimitError('rate limited'), 'transport'],
        [new InternalServerError('unavailable'), 'transport']
      ];

      for (const [error, failureClass] of scenarios) {
        const { decodeFailures, recorder } = recording();
        const { dispatcher, requests } = setup({ replies: [error, OK], recorder });
        const result = await dispatcher.dispatch(request({ validate: VALID }));

        expect(requests).toHaveLength(2);
        expect(result.attempts).toBe(2);
        expect(decodeFailures[0].payload.failures[0].class).toBe(failureClass);

        if (failureClass === 'transport') {
          expect(decodeFailures[0].payload.failures[0].transportError).toBe(formatLlmErrorSummary(error));
        }
      }
    });

    it('should spend the budget on an endless abort, every row a timeout, in one decode record', async () => {
      const { decodeFailures, recorder } = recording();
      const { dispatcher, requests } = setup({ replies: [new APIUserAbortError('aborted')], recorder });
      const result = await dispatcher.dispatch(request({ validate: VALID }));

      expect(requests).toHaveLength(2);
      expect(result).toMatchObject({ attempts: 2, decodeStatus: 'dropped' });
      expect(decodeFailures).toHaveLength(1);
      expect(decodeFailures[0].payload.failures.map((row) => row.class)).toEqual(['timeout', 'timeout']);
    });

    it('should never retry a cancelled dispatch', async () => {
      const controller = new AbortController();
      const { dispatcher, requests } = setup({ replies: [new APIUserAbortError('aborted')], cancellationSignal: controller.signal });
      controller.abort();
      const result = await dispatcher.dispatch(request({ validate: VALID }));

      expect(requests).toHaveLength(1);
      expect(result.attempts).toBe(1);
    });

    it('should still retry when the request signal was not aborted', async () => {
      const controller = new AbortController();
      const { dispatcher, requests } = setup({ replies: [new APIUserAbortError('aborted'), OK] });
      const result = await dispatcher.dispatch(request({ validate: VALID, signal: controller.signal }));

      expect(requests).toHaveLength(2);
      expect(result.decodeStatus).toBe('retried');
    });

    it('should hand transportBackoff the failed ordinal and the thrown error, and file the backoff diag and span', async () => {
      const ordinals: number[] = [];
      const errors: unknown[] = [];
      const limited = new RateLimitError('rate limited');
      const parent = makeLlmCallContext({ label: 'turn', timing: true });
      const { dispatcher } = setup({ replies: [limited, OK], transportBackoff: ({ attempt, error }) => (ordinals.push(attempt), errors.push(error), 0) });
      await dispatcher.dispatch(request({ validate: VALID, callContext: parent }));

      expect(ordinals).toEqual([1]);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe(limited);
      expect(diagsOf(parent).find((diag) => diag.code === 'transport-backoff')).toMatchObject({ level: 'warn', fields: expect.objectContaining({ attempt: 1, delayMs: 0 }) });
      expect(spanNamesOf(parent)).toContain('transport-backoff');
    });
  });

  describe('cancellation at a retry decision', () => {
    function decodeTaps() {
      const taps = makeLlmDispatchTapRegistry<HostFields>();
      const events: LlmDecodeFailureTapEvent<HostFields>[] = [];
      taps.addTap({ id: 't', onDecodeFailure: (event) => void events.push(event) });
      return { taps, events };
    }

    it('should ship a reply the critic rejected after the dispatch was cancelled, sending nothing more', async () => {
      const controller = new AbortController();
      const { calls, decodeFailures, recorder } = recording(true);
      const critique: LlmCritic = async () => (controller.abort(), { error: 'too vague' });
      const { dispatcher, requests } = setup({ replies: [OK, OK], recorder });
      const result = await dispatcher.dispatch(request({ critique, signal: controller.signal }));

      expect(requests).toHaveLength(1);
      expect(result).toMatchObject({ attempts: 1, decodeStatus: 'clean', decodeOutcome: 'ok', lever: OK });
      expect(calls[0].phases?.attempts).toHaveLength(1);
      expect(calls[0].failedAttempts ?? []).toHaveLength(0);
      expect(decodeFailures).toHaveLength(0);
    });

    it('should not retry a schema miss judged after the dispatch was cancelled', async () => {
      const controller = new AbortController();
      const { taps, events } = decodeTaps();
      const validate = () => (controller.abort(), { error: 'answer must be a string' });
      const { dispatcher, requests } = setup({ replies: [OK, OK], taps });
      const result = await dispatcher.dispatch(request({ validate, signal: controller.signal }));

      expect(requests).toHaveLength(1);
      expect(result).toMatchObject({ attempts: 1, decodeStatus: 'dropped', decodeOutcome: 'schema-invalid' });
      expect(events).toEqual([expect.objectContaining({ willRetry: false, attempt: expect.objectContaining({ class: 'schema-validation' }) })]);
    });

    it('should not retry a decode failure read after the dispatch was cancelled, taking no lever', async () => {
      const controller = new AbortController();
      const { taps, events } = decodeTaps();
      const requests: LlmRequest[] = [];
      const strategy = makeLlmScriptedStrategy({ id: 's', requests, respond: () => (controller.abort(), PROSE) });
      const { dispatcher } = setup({ strategy, taps });
      const result = await dispatcher.dispatch(request({ validate: VALID, signal: controller.signal }));

      expect(requests).toHaveLength(1);
      expect(result).toMatchObject({ attempts: 1, decodeStatus: 'dropped' });
      expect(events.map((event) => event.willRetry)).toEqual([false]);
      expect(events[0].attempt).not.toHaveProperty('lever');
    });

    it('should not re-ask a length-capped reply, nor grant the bonus, once the dispatch was cancelled', async () => {
      const truncatedController = new AbortController();
      const truncatedRequests: LlmRequest[] = [];
      const truncated = setup({ strategy: makeLlmScriptedStrategy({ id: 's', requests: truncatedRequests, respond: () => (truncatedController.abort(), TRUNCATED) }) });
      const truncatedResult = await truncated.dispatcher.dispatch(request({ validate: VALID, signal: truncatedController.signal }));

      expect(truncatedRequests).toHaveLength(1);
      expect(truncatedResult).toMatchObject({ attempts: 1, decodeStatus: 'dropped', lengthCapped: true });

      const bonusController = new AbortController();
      const bonusRequests: LlmRequest[] = [];
      const bonus = setup({ strategy: makeLlmScriptedStrategy({ id: 's', requests: bonusRequests, respond: (_, call) => (call === 0 ? INVALID : (bonusController.abort(), CAP)) }) });
      const bonusResult = await bonus.dispatcher.dispatch(request({ validate: VALID, signal: bonusController.signal }));

      // attempt 2 took reasoning-low and the cap ended it: the bonus would be due, but the dispatch is cancelled
      expect(bonusRequests).toHaveLength(2);
      expect(bonusResult).toMatchObject({ attempts: 2, decodeStatus: 'dropped' });
    });

    it('should settle without resending when cancelled during the transport backoff', async () => {
      const controller = new AbortController();
      const { taps, events } = decodeTaps();
      const { dispatcher, requests } = setup({ replies: [new InternalServerError('unavailable'), OK], taps, transportBackoff: () => (controller.abort(), 0) });
      const result = await dispatcher.dispatch(request({ validate: VALID, signal: controller.signal }));

      expect(requests).toHaveLength(1);
      expect(result).toMatchObject({ attempts: 1, decodeStatus: 'dropped', decodeOutcome: 'transport' });
      // the row keeps the decision it was judged with; no timeout row follows it
      expect(events.map((event) => [event.attempt.class, event.willRetry])).toEqual([['transport', true]]);
    });

    it('should settle without resending when cancelled while parked before a retry', async () => {
      const controller = new AbortController();
      const { gate, pause } = pauseGate(false);
      const { calls, recorder } = recording(true);
      const requests: LlmRequest[] = [];
      const strategy = makeLlmScriptedStrategy({ id: 's', requests, respond: (_, call) => (call === 0 ? (pause(), INVALID) : OK) });
      const { dispatcher } = setup({ strategy, pause: gate, recorder });
      const pending = dispatcher.dispatch(request({ validate: VALID, signal: controller.signal }));
      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(requests).toHaveLength(1);
      controller.abort();
      const result = await pending;

      expect(requests).toHaveLength(1);
      expect(result).toMatchObject({ attempts: 1, decodeStatus: 'dropped', decodeOutcome: 'schema-invalid' });
      expect(calls[0].failedAttempts).toHaveLength(1);
      expect(calls[0].phases?.attempts).toHaveLength(1);
    });

    it('should stamp the outcome of the last sent attempt, never an earlier one', async () => {
      const controller = new AbortController();
      const { gate, pause } = pauseGate(false);
      const requests: LlmRequest[] = [];
      const strategy = makeLlmScriptedStrategy({ id: 's', requests, respond: (_, call) => (call === 0 ? INVALID : (pause(), OK)) });
      const { dispatcher } = setup({ strategy, pause: gate });
      const pending = dispatcher.dispatch(request({ validate: VALID, critique: critic(99).critique, maxAttempts: 3, signal: controller.signal }));
      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(requests).toHaveLength(2);
      controller.abort();
      const result = await pending;

      expect(requests).toHaveLength(2);
      expect(result).toMatchObject({ attempts: 2, decodeStatus: 'dropped' });
      expect(result.decodeOutcome).not.toBe('schema-invalid');
      expect(result.decodeOutcome).toBe('ok');
    });
  });

  describe('pause', () => {
    it('should not retry an abort while parked, even at maxAttempts 3', async () => {
      const controller = new AbortController();
      const { gate } = pauseGate(true);
      const seen: LlmRequest[] = [];
      // The transport's own behaviour under an aborted signal: reject at once with an abort error.
      const strategy: LlmStrategy = {
        id: 's',
        describe: 'abort-on-signal',
        caching: 'none',
        async complete(llmRequest, options) {
          seen.push(llmRequest);

          if (options?.signal?.aborted === true) {
            throw new APIUserAbortError('aborted');
          }

          return { text: OK, strategyId: 's', capability: llmRequest.capability };
        }
      };
      const { dispatcher } = setup({ strategy, pause: gate, cancellationSignal: controller.signal });
      const pending = dispatcher.dispatch(request({ validate: VALID, maxAttempts: 3 }));
      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(seen).toHaveLength(0);
      controller.abort();
      const result = await pending;

      // ONE attempt: the woken waiter falls through to the strategy, which rejects, and a cancellation is never retried.
      expect(seen).toHaveLength(1);
      expect(result).toMatchObject({ attempts: 1, decodeStatus: 'dropped', text: '' });
      expect(gate.isPaused()).toBe(true);
    });

    it('should hold attempt 2 while paused between attempts', async () => {
      const { gate, pause, resume } = pauseGate(false);
      const requests: LlmRequest[] = [];
      const strategy = makeLlmScriptedStrategy({ id: 's', requests, respond: (_, call) => (call === 0 ? (pause(), INVALID) : OK) });
      const { dispatcher } = setup({ strategy, pause: gate });
      const pending = dispatcher.dispatch(request({ validate: VALID }));
      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(requests).toHaveLength(1);
      resume();
      expect((await pending).decodeStatus).toBe('retried');
      expect(requests).toHaveLength(2);
    });
  });

  describe('taps', () => {
    it('should fire complete once, after the retried decode failure, sharing the decode rows', async () => {
      const taps = makeLlmDispatchTapRegistry<HostFields>();
      const timeline: string[] = [];
      const failures: LlmDecodeFailureTapEvent<HostFields>[] = [];
      const completes: LlmDispatchCompleteTapEvent<HostFields>[] = [];
      taps.addTap({
        id: 't',
        onDispatch: () => void timeline.push('dispatch'),
        onDecodeFailure: (event) => void (timeline.push(`decode:${event.willRetry}`), failures.push(event)),
        onDispatchComplete: (event) => void (timeline.push('complete'), completes.push(event))
      });
      const { dispatcher } = setup({ replies: [PROSE, OK], taps });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(timeline).toEqual(['dispatch', 'decode:true', 'complete']);
      expect(completes[0].decodeFailures?.[0]).toBe(failures[0].attempt);
      expect(completes[0].recovered).toBe(true);
    });

    it('should report willRetry true then false over a dropped budget-2 parse failure', async () => {
      const taps = makeLlmDispatchTapRegistry<HostFields>();
      const willRetry: boolean[] = [];
      taps.addTap({ id: 't', onDecodeFailure: (event) => void willRetry.push(event.willRetry) });
      const { dispatcher } = setup({ replies: [PROSE], taps });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(willRetry).toEqual([true, false]);
    });

    it('should fire one final schema event over a dropped schema retry', async () => {
      const taps = makeLlmDispatchTapRegistry<HostFields>();
      const failures: LlmDecodeFailureTapEvent<HostFields>[] = [];
      taps.addTap({ id: 't', onDecodeFailure: (event) => void failures.push(event) });
      const { dispatcher } = setup({ replies: [INVALID], taps });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(failures).toEqual([expect.objectContaining({ willRetry: false, attempt: expect.objectContaining({ class: 'schema-validation' }) })]);
    });

    it('should fire one willRetry false on a cancelled dispatch', async () => {
      const controller = new AbortController();
      const taps = makeLlmDispatchTapRegistry<HostFields>();
      const willRetry: boolean[] = [];
      taps.addTap({ id: 't', onDecodeFailure: (event) => void willRetry.push(event.willRetry) });
      const { dispatcher } = setup({ replies: [new APIUserAbortError('aborted')], taps, cancellationSignal: controller.signal });
      controller.abort();
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(willRetry).toEqual([false]);
    });

    it('should count throwing taps over a retried dispatch without breaking it', async () => {
      const taps = makeLlmDispatchTapRegistry<HostFields>();
      const thrower = () => {
        throw new Error('tap');
      };
      taps.addTap({ id: 'bad', onDispatch: thrower, onDecodeFailure: thrower, onDispatchComplete: thrower });
      const { dispatcher } = setup({ replies: [PROSE, OK], taps });
      const result = await dispatcher.dispatch(request({ validate: VALID }));

      expect(result.attempts).toBe(2);
      expect(taps.health().failures).toBe(3);
    });

    it('should send byte-identical requests over the retry script with and without taps', async () => {
      const taps = makeLlmDispatchTapRegistry<HostFields>();
      taps.addTap({ id: 't', onDecodeFailure: () => undefined });
      const without = setup({ replies: [PROSE, INVALID, OK] });
      const withTaps = setup({ replies: [PROSE, INVALID, OK], taps });
      await without.dispatcher.dispatch(request({ validate: VALID, maxAttempts: 3 }));
      await withTaps.dispatcher.dispatch(request({ validate: VALID, maxAttempts: 3 }));

      expect(withTaps.requests).toEqual(without.requests);
    });
  });

  describe('correction wording', () => {
    it('should append the exact json contract correction', async () => {
      const { dispatcher, requests } = setup({ replies: [INVALID, OK] });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(requests[1].prompt).toBe(`${requests[0].prompt}${JSON_CONTRACT_CORRECTION}`);
    });

    it("should append the layout's correction separator after the correction", async () => {
      const layout = DEFAULT_LLM_PROMPT_LAYOUT.map((slot) => (slot.role === 'correction' ? { ...slot, separator: '\n' } : slot));
      const { dispatcher, requests } = setup({ replies: [INVALID, OK], layout });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(requests[1].prompt).toBe(`${requests[0].prompt}${JSON_CONTRACT_CORRECTION}\n`);
      expect(requests[1].segments?.at(-1)).toEqual(expect.objectContaining({ id: 'correction', promptSegment: `${JSON_CONTRACT_CORRECTION}\n` }));
    });

    it('should append the line contract correction', async () => {
      const { dispatcher, requests } = setup({ replies: [INVALID, 'a plain line'] });
      await dispatcher.dispatch(request({ capability: 'LineCap', validate: VALID }));

      expect(requests[1].prompt).toBe(`${requests[0].prompt}\n\n## Correction\nYour previous reply did not conform to the required output contract: answer must be a string\nReply again with ONLY the line: no JSON, no code fence, no commentary.`);
    });

    it('should append the json and line critique corrections', async () => {
      const json = setup({ replies: [OK, OK] });
      await json.dispatcher.dispatch(request({ validate: VALID, critique: critic(1).critique }));
      expect(json.requests[1].prompt).toBe(`${json.requests[0].prompt}\n\n## Correction\nYour previous reply was rejected on review: too vague\nFix exactly that. Reply again with a single JSON object that conforms exactly to the contract.`);

      const line = setup({ replies: ['first line', 'second line'] });
      await line.dispatcher.dispatch(request({ capability: 'LineCap', critique: critic(1).critique }));
      expect(line.requests[1].prompt).toBe(`${line.requests[0].prompt}\n\n## Correction\nYour previous reply was rejected on review: too vague\nRewrite the line to fix exactly that, and nothing else. Reply with ONLY the rewritten line.`);
    });

    it('should keep a 4 kB critique in the suffix', async () => {
      const feedback = 'x'.repeat(4096);
      const { dispatcher, requests } = setup({ replies: [OK, OK] });
      await dispatcher.dispatch(request({ validate: VALID, critique: critic(1, feedback).critique }));

      expect(requests[1].cacheSegments?.cachePrefix).toBe(requests[0].cacheSegments?.cachePrefix);
      expect(suffixOf(requests[1])).toContain(feedback);
    });

    it('should send the correctionTexts overrides', async () => {
      const { dispatcher, requests } = setup({ replies: [PROSE, OK], correctionTexts: { heading: '## Fix', decode: { 'parse-error': 'bad json' } } });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(requests[1].prompt).toBe(`${requests[0].prompt}\n\n## Fix\nYour previous reply did not conform to the required output contract: bad json\nReply again with a single JSON object that conforms exactly to the contract.`);
    });
  });

  describe('semantic critique', () => {
    it('should retry once on a critique failure, then accept', async () => {
      const { critique, inputs } = critic(1);
      const { dispatcher, requests } = setup({ replies: [OK, OK] });
      const result = await dispatcher.dispatch(request({ validate: VALID, critique }));

      expect(requests).toHaveLength(2);
      expect(inputs).toHaveLength(2);
      expect(result).toMatchObject({ decodeStatus: 'retried', validationErrors: ['attempt 1: too vague'] });
    });

    it('should spend maxAttempts 3 on a critic that rejects throughout', async () => {
      const { critique, inputs } = critic(99);
      const { dispatcher, requests } = setup({ replies: [OK] });
      const result = await dispatcher.dispatch(request({ validate: VALID, critique, maxAttempts: 3 }));

      expect(requests).toHaveLength(3);
      expect(inputs).toHaveLength(3);
      expect(result.validationErrors).toHaveLength(3);
    });

    it('should not call the critic when validate fails, nor on a decline', async () => {
      const failing = critic(0);
      await setup({ replies: [INVALID] }).dispatcher.dispatch(request({ validate: VALID, critique: failing.critique }));
      expect(failing.inputs).toHaveLength(0);

      const declined = critic(0);
      await setup({ replies: ['{"answerable":false,"rationale":"cannot"}'] }).dispatcher.dispatch(request({ capability: 'EnvelopeCap', validate: VALID, critique: declined.critique }));
      expect(declined.inputs).toHaveLength(0);
    });

    it('should enter the loop with a critique alone', async () => {
      const { critique, inputs } = critic(0);
      const { dispatcher } = setup({ replies: [OK] });
      const result = await dispatcher.dispatch(request({ critique }));

      expect(inputs).toHaveLength(1);
      expect(result).toMatchObject({ attempts: 1, decodeStatus: 'clean' });
    });

    it('should hand the critic the capability, live context, reply, protocol, attempt and meta', async () => {
      const { critique, inputs } = critic(0);
      const { dispatcher } = setup({ replies: [OK] });
      await dispatcher.dispatch(request({ critique, meta: { trace: 't-1' } }));

      expect(inputs[0]).toMatchObject({ capability: 'TestCap', liveContext: 'D-LIVE', replyText: OK, replyProtocol: 'json', attempt: 1, meta: { trace: 't-1' }, lever: { answer: 'ok' } });
    });

    it('should file no decode rows for a critique retry', async () => {
      const { decodeFailures, recorder } = recording();
      const { dispatcher } = setup({ replies: [OK, OK], recorder });
      await dispatcher.dispatch(request({ critique: critic(1).critique }));

      expect(decodeFailures).toHaveLength(0);
    });

    it('should file ONE critique-fail gap after onDispatchComplete and before prompt-over-budget when exhausted', async () => {
      const order: string[] = [];
      const gaps: LlmDispatchGap[] = [];
      const taps = makeLlmDispatchTapRegistry<HostFields>();
      taps.addTap({ id: 't', onDispatchComplete: () => void order.push('complete') });
      const { dispatcher } = setup({ replies: [OK], taps, onGap: ({ gap }) => void (order.push(gap.kind), gaps.push(gap)) });
      await dispatcher.dispatch(request({ critique: critic(99, 'still vague').critique, maxPromptTokens: 1 }));

      expect(order).toEqual(['complete', 'critique-fail', 'prompt-over-budget']);
      expect(gaps[0]).toEqual({ kind: 'critique-fail', capability: 'TestCap', feedback: 'still vague', text: OK });
    });

    it('should ship the last reply a critic rejected once the budget is spent, stamped accepted with no row for it', async () => {
      const { calls, decodeFailures, recorder } = recording();
      const gaps: LlmDispatchGap[] = [];
      let round = 0;
      const critique: LlmCritic = async () => ({ error: `vague ${(round += 1)}` });
      const { dispatcher, requests } = setup({ replies: [OK, '{"answer":"second"}'], recorder, onGap: ({ gap }) => void gaps.push(gap) });
      const executed = await dispatcher.preparePrompt(request({ validate: VALID, critique })).execute();
      const { result } = executed;

      expect(requests).toHaveLength(2);
      expect(result).toMatchObject({ attempts: 2, decodeStatus: 'retried', decodeOutcome: 'ok', lever: '{"answer":"second"}', validationErrors: ['attempt 1: vague 1', 'attempt 2: vague 2'] });
      expect(calls[0].failedAttempts).toEqual([expect.objectContaining({ attempt: 1, cause: 'critique', error: 'vague 1' })]);
      expect(decodeFailures).toHaveLength(0);
      expect(gaps).toEqual([{ kind: 'critique-fail', capability: 'TestCap', feedback: 'vague 2', text: '{"answer":"second"}' }]);
      // the shipped reply is replayed, not the degenerate placeholder
      expect(executed.thread[1]).toEqual({ role: 'assistant', content: '{"answer":"second"}' });
    });

    it('should ship a first-attempt reply the critic rejected at maxAttempts 1 as clean', async () => {
      const gaps: LlmDispatchGap[] = [];
      const { dispatcher, requests } = setup({ replies: [OK], onGap: ({ gap }) => void gaps.push(gap) });
      const result = await dispatcher.dispatch(request({ critique: critic(99).critique, maxAttempts: 1 }));

      expect(requests).toHaveLength(1);
      expect(result).toMatchObject({ attempts: 1, decodeStatus: 'clean', decodeOutcome: 'ok', lever: OK });
      expect(gaps.map((gap) => gap.kind)).toEqual(['critique-fail']);
    });

    it('should not stamp an earlier schema miss on a shipped critique-rejected reply', async () => {
      const { dispatcher } = setup({ replies: [INVALID, OK] });
      const result = await dispatcher.dispatch(request({ validate: VALID, critique: critic(99).critique }));

      expect(result).toMatchObject({ attempts: 2, decodeStatus: 'retried', decodeOutcome: 'ok', lever: OK });
    });

    it('should file no gap when the critic accepts', async () => {
      const gaps: LlmDispatchGap[] = [];
      const { dispatcher } = setup({ replies: [OK, OK], onGap: ({ gap }) => void gaps.push(gap) });
      await dispatcher.dispatch(request({ critique: critic(1).critique }));

      expect(gaps).toHaveLength(0);
    });
  });

  describe('line lift', () => {
    it('should lift a line reply to { line } for the critic', async () => {
      const { critique, inputs } = critic(0);
      const { dispatcher } = setup({ replies: ['a plain line'] });
      await dispatcher.dispatch(request({ capability: 'LineCap', critique }));

      expect(inputs[0].lever).toEqual({ line: 'a plain line' });
    });

    it('should lift to the lineLeverField', async () => {
      const { critique, inputs } = critic(0);
      const { dispatcher } = setup({ replies: ['a plain line'] });
      await dispatcher.dispatch(request({ capability: 'LineCap', critique, lineLeverField: 'say' }));

      expect(inputs[0].lever).toEqual({ say: 'a plain line' });
    });

    it('should not lift nor retry a line reply without a critic', async () => {
      let validated = 0;
      const { dispatcher, requests } = setup({ replies: ['a plain line'] });
      const result = await dispatcher.dispatch(request({ capability: 'LineCap', validate: () => ((validated += 1), { error: 'never' }) }));

      expect(requests).toHaveLength(1);
      expect(validated).toBe(0);
      expect(result.decodeStatus).toBe('clean');
    });
  });

  describe('failedAttempts', () => {
    it('should record a recovered failure with its telemetry and the retry the next attempt took', async () => {
      const { calls, recorder } = recording(true);
      const { dispatcher } = setup({ replies: [PROSE, OK], recorder });
      await dispatcher.dispatch(request({ validate: VALID }));

      const rows = calls[0].failedAttempts ?? [];
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ attempt: 1, cause: 'parse-error', text: PROSE, rawLength: PROSE.length });
      expect(rows[0].error).toBeUndefined();
      expect(rows[0].retry).toEqual(calls[0].phases?.attempts?.[1].retry);
    });

    it('should keep both rows of a dropped dispatch, the last without a retry', async () => {
      const { calls, recorder } = recording();
      const { dispatcher } = setup({ replies: [PROSE], recorder });
      await dispatcher.dispatch(request({ validate: VALID }));

      const rows = calls[0].failedAttempts ?? [];
      expect(rows).toHaveLength(2);
      expect(rows[0].retry).toBeDefined();
      expect(rows[1].retry).toBeUndefined();
    });

    it('should record transport and timeout rows', async () => {
      const error = new RateLimitError('rate limited');
      const transport = recording();
      await setup({ replies: [error, OK], recorder: transport.recorder }).dispatcher.dispatch(request({ validate: VALID }));
      expect(transport.calls[0].failedAttempts?.[0]).toMatchObject({ cause: 'transport', error: formatLlmErrorSummary(error), text: '' });

      const timeout = recording();
      await setup({ replies: [new APIUserAbortError('aborted'), OK], recorder: timeout.recorder }).dispatcher.dispatch(request({ validate: VALID }));
      expect(timeout.calls[0].failedAttempts?.[0]).toMatchObject({ cause: 'timeout', text: '' });
    });

    it("should record the budget lever, with the second row's maxOutputTokens as sent", async () => {
      const { calls, recorder } = recording();
      const { dispatcher, requests } = setup({ replies: [TRUNCATED], recorder });
      await dispatcher.dispatch(request({ validate: VALID }));

      const rows = calls[0].failedAttempts ?? [];
      expect(rows[0].retry).toMatchObject({ lever: 'budget' });
      expect(rows[1].maxOutputTokens).toBe(requests[1].maxOutputTokens);
    });

    it('should record the bonus row', async () => {
      const { calls, recorder } = recording();
      const { dispatcher } = setup({ replies: [INVALID, CAP, OK], recorder });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(calls[0].failedAttempts?.[1].retry).toMatchObject({ lever: 'reasoning-off', bonus: true, induced: 'reasoning-low' });
    });

    it('should record a critique row with no decode row', async () => {
      const { calls, decodeFailures, recorder } = recording();
      const { dispatcher } = setup({ replies: [OK, OK], recorder });
      await dispatcher.dispatch(request({ critique: critic(1).critique }));

      expect(calls[0].failedAttempts).toEqual([expect.objectContaining({ attempt: 1, cause: 'critique', error: 'too vague' })]);
      expect(decodeFailures).toHaveLength(0);
    });

    it('should leave the correction off row 1 and stamp the sent correction on row 2', async () => {
      const { calls, recorder } = recording();
      const { dispatcher, requests } = setup({ replies: [INVALID], recorder });
      await dispatcher.dispatch(request({ validate: VALID }));

      const rows = calls[0].failedAttempts ?? [];
      expect(rows[0].correction).toBeUndefined();
      expect(requests[1].prompt.endsWith(rows[1].correction ?? '-')).toBe(true);
    });

    it('should hold failedAttempts.length === attempts − (accepted ? 1 : 0) over every scenario', async () => {
      const scenarios: ReadonlyArray<LlmScriptedReplies> = [[OK], [INVALID], [INVALID, OK], [PROSE], [PROSE, OK], ['', OK], [TRUNCATED], [TRUNCATED, OK], [new APIUserAbortError('a')], [new APIUserAbortError('a'), OK], [new RateLimitError('r')], [new RateLimitError('r'), OK], [INVALID, CAP, OK], [INVALID, CAP, CAP]];

      for (const replies of scenarios) {
        const { calls, recorder } = recording();
        const { dispatcher } = setup({ replies, recorder });
        const result = await dispatcher.dispatch(request({ validate: VALID }));
        const accepted = result.decodeStatus !== 'dropped';

        expect(calls[0].failedAttempts?.length ?? 0).toBe((result.attempts ?? 0) - (accepted ? 1 : 0));
      }
    });

    it('should hand the tap every row', async () => {
      const taps = makeLlmDispatchTapRegistry<HostFields>();
      const completes: LlmDispatchCompleteTapEvent<HostFields>[] = [];
      taps.addTap({ id: 't', onDispatchComplete: (event) => void completes.push(event) });
      const { calls, recorder } = recording();
      const { dispatcher } = setup({ replies: [PROSE], recorder, taps });
      await dispatcher.dispatch(request({ validate: VALID }));

      expect(completes[0].failedAttempts).toBe(calls[0].failedAttempts);
      expect(completes[0].failedAttempts).toHaveLength(2);
    });
  });
});
