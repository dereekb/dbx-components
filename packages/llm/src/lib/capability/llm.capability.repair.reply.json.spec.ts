import { describe, expect, it } from 'vitest';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { type LlmCallContext, makeLlmCallContext, noopLlmCallContext } from '../record/llm.call.context';
import { DEFAULT_LLM_REPLY_FAST_FIX_LIMITS, LLM_REPAIR_REPLY_JSON_CAPABILITY, type LlmReplyFastFixParams } from '../reply/llm.reply.fast.fix';
import { llmReplyRepairFidelity, repairLlmReplyJson, scoreLlmReplyJson } from '../reply/llm.reply.repair';
import { type LlmDispatchResult } from '../strategy/llm.strategy';
import { DEFAULT_LLM_REPAIR_REPLY_JSON_INSTRUCTIONS, LLM_REPAIR_REPLY_JSON_DESCRIPTOR, LLM_REPAIR_REPLY_JSON_TEMPLATE, makeLlmReplyFastFixer, renderLlmRepairReplyJsonContext } from './llm.capability.repair.reply.json';

/**
 * Mangled, object-led replies only the fast fix can save — each fault sits past halfway, after a long leading string.
 */
const MANGLED_REPLIES = [
  { name: 'python-none', text: '{"title":"A sturdy canvas tote for daily errands","price":24,"inStock":None}', expected: { title: 'A sturdy canvas tote for daily errands', price: 24, inStock: null } },
  { name: 'unquoted-key', text: '{"title":"A sturdy canvas tote for daily errands","price":24,inStock:true}', expected: { title: 'A sturdy canvas tote for daily errands', price: 24, inStock: true } },
  { name: 'single-quoted-key', text: '{"title":"A sturdy canvas tote for daily errands","price":24,\'inStock\':true}', expected: { title: 'A sturdy canvas tote for daily errands', price: 24, inStock: true } },
  { name: 'line-comment', text: '{"title":"A sturdy canvas tote for daily errands","price":24, // in dollars\n"inStock":true}', expected: { title: 'A sturdy canvas tote for daily errands', price: 24, inStock: true } }
] as const;

describe('the mangled reply corpus', () => {
  it.each(MANGLED_REPLIES.map((row) => [row.name, row] as const))('%s: the deterministic tier refuses it and the lane would hand it to the fast fix', (_name, row) => {
    const result = repairLlmReplyJson(row.text);

    expect(result.shape.verdict).toBe('mangled');
    expect(result.repaired).toBeUndefined();
    expect(result.shape.objectLed).toBe(true);
    expect(result.shape.score).toBeGreaterThanOrEqual(DEFAULT_LLM_REPLY_FAST_FIX_LIMITS.minScore);
    expect(row.text.length).toBeLessThanOrEqual(DEFAULT_LLM_REPLY_FAST_FIX_LIMITS.maxChars);
    expect(
      renderLlmRepairReplyJsonContext({ text: row.text, shape: result.shape })
        .map((block) => block.text)
        .join('\n')
    ).toContain(row.text);
  });

  it.each(MANGLED_REPLIES.map((row) => [row.name, row] as const))('%s: a perfect fix passes the fidelity gate', (_name, row) => {
    expect(llmReplyRepairFidelity({ original: row.text, repaired: row.expected })).toMatchObject({ ok: true, invented: [] });
  });
});

describe('renderLlmRepairReplyJsonContext()', () => {
  const text = MANGLED_REPLIES[0].text;
  const blocks = renderLlmRepairReplyJsonContext({ text, shape: scoreLlmReplyJson(text) });

  it('renders the diagnosis then the fenced reply', () => {
    expect(blocks.map((block) => block.key)).toEqual(['diagnosis', 'reply']);
    expect(blocks[0].text.startsWith('## Where parsing fails\nParsing fails at character')).toBe(true);
    expect(blocks[1].text).toBe(`## The reply\n<<<REPLY\n${text}\nREPLY`);
  });
});

interface FakeFixDispatch {
  readonly requests: LlmDispatchRequest[];
  readonly dispatch: (request: LlmDispatchRequest) => Promise<LlmDispatchResult>;
}

/**
 * A fake dispatch that answers with one result (or throws) and records each request.
 *
 * @param result - The result fields beyond the minimal ones, or a function that throws.
 * @returns The recorded requests and the dispatch.
 */
function fakeFixDispatch(result: Partial<LlmDispatchResult> | (() => never)): FakeFixDispatch {
  const requests: LlmDispatchRequest[] = [];
  const dispatch = async (request: LlmDispatchRequest): Promise<LlmDispatchResult> => {
    requests.push(request);
    const extra = typeof result === 'function' ? result() : result;
    return { text: '', strategyId: 'fake', capability: request.capability, ...extra };
  };

  return { requests, dispatch };
}

const BROKEN = MANGLED_REPLIES[0];
const SCHEMA_HINT = { type: 'object', properties: { title: { type: 'string' } } };

/**
 * The fixer input for the first mangled row.
 *
 * @param dispatch - The fake dispatch.
 * @param callContext - The subject attempt's call context.
 * @param subject - Extra subject request fields.
 * @returns The fixer input.
 */
function fixInput(dispatch: FakeFixDispatch['dispatch'], callContext: LlmCallContext = noopLlmCallContext(), subject: Partial<LlmDispatchRequest> = {}): LlmReplyFastFixParams {
  return { request: { capability: 'summarize', renderLiveContext: () => [], ...subject }, subjectCapability: 'summarize', text: BROKEN.text, shape: scoreLlmReplyJson(BROKEN.text), schemaHint: SCHEMA_HINT, attempt: 1, callContext, dispatch };
}

describe('makeLlmReplyFastFixer()', () => {
  it('dispatches one RepairReplyJson request built from the subject', async () => {
    const fake = fakeFixDispatch({ text: JSON.stringify(BROKEN.expected) });
    const callContext = noopLlmCallContext();
    await makeLlmReplyFastFixer()(fixInput(fake.dispatch, callContext, { meta: { shopId: 'alpha' } }));

    expect(fake.requests).toHaveLength(1);
    const request = fake.requests[0];
    expect(request.capability).toBe('RepairReplyJson');
    expect(request.capability).toBe(LLM_REPAIR_REPLY_JSON_CAPABILITY);
    expect(request.maxAttempts).toBe(1);
    expect(request.subjectCapability).toBe('summarize');
    expect(request.callContext).toBe(callContext);
    expect(request.responseSchemaHint).toBe(SCHEMA_HINT);
    expect(request.meta).toEqual({ shopId: 'alpha' });
    expect('critique' in request).toBe(false);
    expect(request.validate?.({ a: 1 })).toBe(true);
    expect(request.validate?.([])).toEqual({ error: 'the reply must be one JSON object' });
    expect(request.validate?.('x')).toEqual({ error: 'the reply must be one JSON object' });
    expect(request.renderLiveContext().map((block) => block.key)).toEqual(['diagnosis', 'reply']);
  });

  it('returns the fixed value and its JSON text', async () => {
    const outcome = await makeLlmReplyFastFixer()(fixInput(fakeFixDispatch({ text: JSON.stringify(BROKEN.expected) }).dispatch));
    expect(outcome).toEqual({ kind: 'fixed', value: BROKEN.expected, text: JSON.stringify(BROKEN.expected) });
  });

  it('misses as truncated on a length-capped fix', async () => {
    const outcome = await makeLlmReplyFastFixer()(fixInput(fakeFixDispatch({ text: JSON.stringify(BROKEN.expected), lengthCapped: true }).dispatch));
    expect(outcome).toEqual({ kind: 'missed', reason: 'truncated' });
  });

  it('misses as unusable on prose', async () => {
    const outcome = await makeLlmReplyFastFixer()(fixInput(fakeFixDispatch({ text: 'I cannot fix this.' }).dispatch));
    expect(outcome).toEqual({ kind: 'missed', reason: 'unusable' });
  });

  it('misses on fidelity when the fix invents a string', async () => {
    const outcome = await makeLlmReplyFastFixer()(fixInput(fakeFixDispatch({ text: JSON.stringify({ ...BROKEN.expected, title: 'A rugged leather duffel for weekend trips' }) }).dispatch));
    expect(outcome).toEqual({ kind: 'missed', reason: 'fidelity' });
  });

  it('reads its own call decoded payload: a decline misses as declined and an enveloped fix unwraps', async () => {
    const fixer = makeLlmReplyFastFixer();

    await expect(fixer(fixInput(fakeFixDispatch({ text: '{"answerable":false}', decodeStatus: 'clean' }).dispatch))).resolves.toEqual({ kind: 'missed', reason: 'declined' });
    await expect(fixer(fixInput(fakeFixDispatch({ text: JSON.stringify({ answerable: true, value: BROKEN.expected }), valueJson: JSON.stringify(BROKEN.expected), decodeStatus: 'clean' }).dispatch))).resolves.toEqual({ kind: 'fixed', value: BROKEN.expected, text: JSON.stringify(BROKEN.expected) });
    await expect(fixer(fixInput(fakeFixDispatch({ text: '', decodeStatus: 'dropped' }).dispatch))).resolves.toEqual({ kind: 'missed', reason: 'unusable' });
  });

  it('checks fidelity over the object under the subject envelope value key, so a trailing envelope field does not count', async () => {
    const keys = { value: 'payload', answerable: 'ok', rationale: 'why' };
    const text = '{"ok":true,"payload":{"title":"A sturdy canvas tote for daily errands","price":24,"inStock":None},"why":"The listing names a canvas tote in stock."}';
    const dispatch = fakeFixDispatch({ text: JSON.stringify(BROKEN.expected), valueJson: JSON.stringify(BROKEN.expected), decodeStatus: 'clean' }).dispatch;
    const input = { ...fixInput(dispatch), text, shape: scoreLlmReplyJson(text, { envelope: keys }) };

    await expect(makeLlmReplyFastFixer()({ ...input, subjectEnvelope: keys })).resolves.toEqual({ kind: 'fixed', value: BROKEN.expected, text: JSON.stringify(BROKEN.expected) });
    await expect(makeLlmReplyFastFixer()(input)).resolves.toEqual({ kind: 'missed', reason: 'fidelity' });
  });

  it('misses as error on a throw, recording the swallow and no meta', async () => {
    const swallows: string[] = [];
    const callContext = makeLlmCallContext({ label: 'spec', onSwallow: (site) => swallows.push(site) });
    const fixer = makeLlmReplyFastFixer({ metaOf: () => ({ callId: 'fix-1' }) });
    const outcome = await fixer(
      fixInput(
        fakeFixDispatch(() => {
          throw new Error('fixer down');
        }).dispatch,
        callContext
      )
    );

    expect(outcome).toEqual({ kind: 'missed', reason: 'error' });
    expect(swallows).toEqual(['llm/reply-repair.fast-fix']);
  });

  it('echoes metaOf on both the fixed and the missed outcomes', async () => {
    const fixer = makeLlmReplyFastFixer({ metaOf: () => ({ callId: 'fix-1' }) });

    await expect(fixer(fixInput(fakeFixDispatch({ text: JSON.stringify(BROKEN.expected) }).dispatch))).resolves.toMatchObject({ kind: 'fixed', meta: { callId: 'fix-1' } });
    await expect(fixer(fixInput(fakeFixDispatch({ text: 'prose' }).dispatch))).resolves.toEqual({ kind: 'missed', reason: 'unusable', meta: { callId: 'fix-1' } });
  });

  it('builds a host request through requestOf', async () => {
    interface ShopRequest extends LlmDispatchRequest {
      readonly shopId: string;
    }

    const requests: ShopRequest[] = [];
    const fixer = makeLlmReplyFastFixer<ShopRequest, LlmDispatchResult>({ requestOf: (base, subject) => ({ ...base, shopId: subject.shopId }) });
    const subject: ShopRequest = { capability: 'summarize', renderLiveContext: () => [], shopId: 'shop-7' };

    await fixer({
      request: subject,
      subjectCapability: 'summarize',
      text: BROKEN.text,
      shape: scoreLlmReplyJson(BROKEN.text),
      schemaHint: SCHEMA_HINT,
      attempt: 1,
      callContext: noopLlmCallContext(),
      dispatch: async (request) => {
        requests.push(request);
        return { text: JSON.stringify(BROKEN.expected), strategyId: 'fake', capability: request.capability };
      }
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].shopId).toBe('shop-7');
    expect(requests[0].capability).toBe(LLM_REPAIR_REPLY_JSON_CAPABILITY);
    expect(requests[0].maxAttempts).toBe(1);
  });
});

describe('LLM_REPAIR_REPLY_JSON_DESCRIPTOR', () => {
  it('declares the fixer controls', () => {
    expect(LLM_REPAIR_REPLY_JSON_DESCRIPTOR).toMatchObject({ capability: LLM_REPAIR_REPLY_JSON_CAPABILITY, rawJsonContext: true, maxOutputTokens: 8192, reasoning: { enabled: false } });
  });

  it('keys its template to the capability as instructions', () => {
    expect(LLM_REPAIR_REPLY_JSON_TEMPLATE).toEqual({ key: 'repair-reply-json.instructions', role: 'instructions', capability: LLM_REPAIR_REPLY_JSON_CAPABILITY, text: DEFAULT_LLM_REPAIR_REPLY_JSON_INSTRUCTIONS });
  });
});
