import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { composeLlmCapabilityPrompt, DEFAULT_LLM_MUST_RESOLVE_CLAUSE } from '../prompt/llm.prompt.assembly';
import { joinLlmLiveContextBlocks } from '../prompt/llm.prompt.live.context';
import { tieredLlmPromptTemplateResolver } from '../prompt/llm.prompt.template';
import { type LlmCallDiagRecord, makeLlmCallContext, noopLlmCallContext } from '../record/llm.call.context';
import { compileLlmCritiquePolicy, LLM_CRITIQUE_REPLY_CAPABILITY, type LlmCritiqueBinding, type LlmCritiqueInput, type LlmCritiqueRule } from '../reply/llm.reply.critique';
import { DEFAULT_LLM_REPLY_ENVELOPE_KEYS } from '../reply/llm.reply.envelope';
import { type LlmDispatchResult } from '../strategy/llm.strategy';
import { critiqueLlmReply, DEFAULT_LLM_CRITIQUE_REPLY_INSTRUCTIONS, LLM_CRITIQUE_REPLY_DESCRIPTOR, LLM_CRITIQUE_REPLY_TEMPLATE, llmCriticFor, llmCritiqueOutcomeSchema, makeLlmSemanticCritic, parseLlmCritiqueOutcomeLever, renderLlmCritiqueContext } from './llm.capability.critique.reply';

interface FakeDispatch {
  readonly requests: LlmDispatchRequest[];
  readonly dispatch: (request: LlmDispatchRequest) => Promise<LlmDispatchResult>;
}

/**
 * A fake dispatch that answers every request with one reply text and records each request.
 *
 * @param reply - The reply text, or a function that throws.
 * @returns The recorded requests and the dispatch.
 */
function fakeDispatch(reply: string | (() => never)): FakeDispatch {
  const requests: LlmDispatchRequest[] = [];
  const dispatch = async (request: LlmDispatchRequest): Promise<LlmDispatchResult> => {
    requests.push(request);
    const text = typeof reply === 'string' ? reply : reply();
    return { text, strategyId: 'fake', capability: request.capability };
  };

  return { requests, dispatch };
}

const CAPABILITIES = [{ capability: 'summarize', tags: ['copy'] }, { capability: 'draft-copy', tags: ['copy'] }, { capability: LLM_CRITIQUE_REPLY_CAPABILITY }];

/**
 * A binding over a fake dispatch with one rule.
 *
 * @param fake - The fake dispatch.
 * @param rule - The rule (default: `summarize` on the fast tier, three attempts).
 * @param envelope - Whether the judge's reply is enveloped.
 * @returns The binding.
 */
function bindingOf(fake: FakeDispatch, rule: LlmCritiqueRule = { capabilities: ['summarize'], tier: 'fast', maxAttempts: 3 }, envelope = false): LlmCritiqueBinding {
  return { policy: compileLlmCritiquePolicy({ critique: { rules: [rule] }, capabilities: CAPABILITIES }), dispatch: fake.dispatch, ...(envelope ? { envelope: DEFAULT_LLM_REPLY_ENVELOPE_KEYS } : {}) };
}

/**
 * A recording call context plus the subject critique input it rides on.
 *
 * @returns The input and the recorded diags / swallows.
 */
function recordingInput() {
  const diags: LlmCallDiagRecord[] = [];
  const swallows: string[] = [];
  const callContext = makeLlmCallContext({ label: 'spec', onDiag: (record) => diags.push(record), onSwallow: (site) => swallows.push(site) });
  const input: LlmCritiqueInput = { capability: 'summarize', lever: { summary: 'a tote' }, replyText: '{"summary":"a tote"}', liveContext: 'THE ORDER: one canvas tote', replyProtocol: 'json', attempt: 1, callContext };
  return { input, diags, swallows };
}

describe('llmCritiqueOutcomeSchema / parseLlmCritiqueOutcomeLever()', () => {
  it('accepts a pass and a fail with feedback', () => {
    expect(llmCritiqueOutcomeSchema({ pass: true })).toEqual({ pass: true });
    expect(parseLlmCritiqueOutcomeLever({ pass: false, feedback: 'name the tote' })).toEqual({ pass: false, feedback: 'name the tote' });
  });

  it('rejects a fail without feedback, or with blank feedback', () => {
    expect(llmCritiqueOutcomeSchema({ pass: false })).toBeInstanceOf(type.errors);
    expect(llmCritiqueOutcomeSchema({ pass: false, feedback: '   ' })).toBeInstanceOf(type.errors);
    expect(parseLlmCritiqueOutcomeLever({ pass: false })).toBeUndefined();
    expect(parseLlmCritiqueOutcomeLever({ pass: false, feedback: '   ' })).toBeUndefined();
  });
});

describe('renderLlmCritiqueContext()', () => {
  it('renders the goal and both fences, and no evidence section without evidence', () => {
    const text = joinLlmLiveContextBlocks(renderLlmCritiqueContext({ goal: 'G', liveContext: 'THE-D', replyText: 'THE-REPLY' }));

    expect(text).toContain('## Goal');
    expect(text).toContain('<<<CONTEXT\nTHE-D\nCONTEXT');
    expect(text).toContain('<<<REPLY\nTHE-REPLY\nREPLY');
    expect(text).not.toContain('## Evidence');
  });

  it('renders trimmed evidence', () => {
    const text = joinLlmLiveContextBlocks(renderLlmCritiqueContext({ goal: 'G', evidence: '  steer toward the sale price  ', liveContext: 'THE-D', replyText: 'THE-REPLY' }));
    expect(text).toContain('## Evidence\n\nsteer toward the sale price');
  });

  it('pins the block keys', () => {
    expect(renderLlmCritiqueContext({ goal: 'G', liveContext: 'THE-D', replyText: 'THE-REPLY' }).map((block) => block.key)).toEqual(['goal', 'goal-2', 'evidence-lines', 'context-fence', 'under-review', 'fence']);
  });
});

describe('llmCriticFor()', () => {
  it('returns {} without a binding', () => {
    expect(llmCriticFor({ binding: undefined, capability: 'summarize', goal: 'G' })).toEqual({});
  });

  it('returns {} when the policy does not name the capability', () => {
    expect(llmCriticFor({ binding: bindingOf(fakeDispatch('{}')), capability: 'draft-copy', goal: 'G' })).toEqual({});
  });

  it('returns a critic and the rule attempt budget on a match', () => {
    const fields = llmCriticFor({ binding: bindingOf(fakeDispatch('{}')), capability: 'summarize', goal: 'G' });
    expect(typeof fields.critique).toBe('function');
    expect(fields.maxAttempts).toBe(3);
  });

  it('carries no maxAttempts key when the rule sets none', () => {
    const fields = llmCriticFor({ binding: bindingOf(fakeDispatch('{}'), { capabilities: ['summarize'] }), capability: 'summarize', goal: 'G' });
    expect(typeof fields.critique).toBe('function');
    expect('maxAttempts' in fields).toBe(false);
  });
});

describe('makeLlmSemanticCritic()', () => {
  const rule: LlmCritiqueRule = { capabilities: ['summarize'], tier: 'fast' };

  it('passes after exactly one judge request carrying the goal and the subject live context, and no critique or meta', async () => {
    const fake = fakeDispatch('{"pass":true}');
    const { input } = recordingInput();
    const critic = makeLlmSemanticCritic({ binding: bindingOf(fake), rule, goal: 'name the ordered product' });

    await expect(critic(input)).resolves.toBe(true);
    expect(fake.requests).toHaveLength(1);

    const request = fake.requests[0];
    expect(request.capability).toBe(LLM_CRITIQUE_REPLY_CAPABILITY);
    expect(request.subjectCapability).toBe('summarize');
    expect(request.tier).toBe('fast');
    expect(request.callContext).toBe(input.callContext);
    expect('critique' in request).toBe(false);
    expect('meta' in request).toBe(false);
    expect('maxAttempts' in request).toBe(false);

    const rendered = joinLlmLiveContextBlocks(request.renderLiveContext());
    expect(rendered).toContain('name the ordered product');
    expect(rendered).toContain('THE ORDER: one canvas tote');
    expect(request.validate?.({ pass: false })).not.toBe(true);
  });

  it("lets the rule's goal override the capability's", async () => {
    const fake = fakeDispatch('{"pass":true}');
    const critic = makeLlmSemanticCritic({ binding: bindingOf(fake), rule: { ...rule, goal: 'RULE GOAL' }, goal: 'CAPABILITY GOAL' });

    await critic(recordingInput().input);
    const rendered = joinLlmLiveContextBlocks(fake.requests[0].renderLiveContext());
    expect(rendered).toContain('RULE GOAL');
    expect(rendered).not.toContain('CAPABILITY GOAL');
  });

  it('returns the feedback verbatim on a fail', async () => {
    const fake = fakeDispatch(JSON.stringify({ pass: false, feedback: 'you wrote "the blue mug"; the order lists only a tote.' }));
    const critic = makeLlmSemanticCritic({ binding: bindingOf(fake), rule, goal: 'G' });

    await expect(critic(recordingInput().input)).resolves.toEqual({ error: 'you wrote "the blue mug"; the order lists only a tote.' });
  });

  it('accepts an unusable reply and records a critique-unusable diag', async () => {
    const critic = makeLlmSemanticCritic({ binding: bindingOf(fakeDispatch('no json at all')), rule, goal: 'G' });
    const { input, diags } = recordingInput();

    await expect(critic(input)).resolves.toBe(true);
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ level: 'warn', code: 'critique-unusable', fields: { capability: 'summarize', attempt: 1 } });
  });

  it('accepts on a throwing judge, recording the swallow and a critique-error diag', async () => {
    const critic = makeLlmSemanticCritic({
      binding: bindingOf(
        fakeDispatch(() => {
          throw new Error('judge down');
        })
      ),
      rule,
      goal: 'G'
    });
    const { input, diags, swallows } = recordingInput();

    await expect(critic(input)).resolves.toBe(true);
    expect(swallows).toEqual(['llm/critique-reply.judge']);
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ code: 'critique-error', fields: { capability: 'summarize', attempt: 1, error: 'judge down' } });
  });

  it('reads an enveloped verdict through the binding envelope, and a declining envelope as unusable', async () => {
    const enveloped = makeLlmSemanticCritic({ binding: bindingOf(fakeDispatch('{"answerable":true,"lever":{"pass":false,"feedback":"name the tote"}}'), rule, true), rule, goal: 'G' });
    await expect(enveloped(recordingInput().input)).resolves.toEqual({ error: 'name the tote' });

    const declining = makeLlmSemanticCritic({ binding: bindingOf(fakeDispatch('{"answerable":false}'), rule, true), rule, goal: 'G' });
    const { input, diags } = recordingInput();
    await expect(declining(input)).resolves.toBe(true);
    expect(diags[0]?.code).toBe('critique-unusable');
  });
});

describe('critiqueLlmReply()', () => {
  it('returns the parsed outcome, or undefined for an unusable reply', async () => {
    const config = { goal: 'G', liveContext: 'D', replyText: 'R', subjectCapability: 'summarize', callContext: noopLlmCallContext() };

    await expect(critiqueLlmReply({ ...config, dispatch: fakeDispatch('{"pass":true}').dispatch })).resolves.toEqual({ pass: true });
    await expect(critiqueLlmReply({ ...config, dispatch: fakeDispatch('nothing').dispatch })).resolves.toBeUndefined();
  });
});

describe('LLM_CRITIQUE_REPLY_DESCRIPTOR', () => {
  it('declares the judge controls', () => {
    expect(LLM_CRITIQUE_REPLY_DESCRIPTOR).toMatchObject({ capability: LLM_CRITIQUE_REPLY_CAPABILITY, mustResolve: true, rawJsonContext: true, maxOutputTokens: 1024 });
  });

  it('projects its hints from the un-narrowed hint schema', () => {
    expect(LLM_CRITIQUE_REPLY_DESCRIPTOR.responseSchemaHint()).toEqual({ type: 'object', properties: { pass: { type: 'boolean' }, feedback: { type: 'string' } }, required: ['pass'], additionalProperties: false });
  });

  it('keys its template to the capability as instructions', () => {
    expect(LLM_CRITIQUE_REPLY_TEMPLATE).toEqual({ key: 'critique-reply.instructions', role: 'instructions', capability: LLM_CRITIQUE_REPLY_CAPABILITY, text: DEFAULT_LLM_CRITIQUE_REPLY_INSTRUCTIONS });
  });

  it('composes on library defaults alone', async () => {
    const fake = fakeDispatch('{"pass":true}');
    await critiqueLlmReply({ goal: 'G', liveContext: 'THE-D', replyText: 'THE-REPLY', subjectCapability: 'summarize', callContext: noopLlmCallContext(), dispatch: fake.dispatch });

    const composed = await composeLlmCapabilityPrompt({
      request: fake.requests[0],
      descriptorOf: () => LLM_CRITIQUE_REPLY_DESCRIPTOR,
      templateResolver: tieredLlmPromptTemplateResolver({ tiers: [{ source: 'llm', templates: [LLM_CRITIQUE_REPLY_TEMPLATE] }] })
    });

    expect(composed.prompt).toContain(DEFAULT_LLM_CRITIQUE_REPLY_INSTRUCTIONS);
    expect(composed.prompt).toContain(DEFAULT_LLM_MUST_RESOLVE_CLAUSE);
    expect(composed.prompt).toContain('## Output contract');
    expect(composed.prompt).toContain('<<<CONTEXT\nTHE-D\nCONTEXT');
    expect(composed.prompt).toContain('<<<REPLY\nTHE-REPLY\nREPLY');
  });
});
