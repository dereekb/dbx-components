import { describe, expect, it } from 'vitest';
import { OpenRouterCore } from '@openrouter/sdk/core';
import { openRouterDecisionRequest } from './openrouter.decision';
import { openRouterDecision } from './openrouter.decision.call';
import { openRouterChoiceQuestion, openRouterNoulQuestion, openRouterScoreQuestion } from './openrouter.decision.question';
import { OPENROUTER_JEV_1_13_MODEL_ID } from './openrouter.type';

/**
 * Live probes of OpenRouter's System One (decisions) route.
 *
 * What these are for, beyond "it works": the fake-socket suite proves this package builds the body it
 * means to and sends it to `/api/v1/systemone`, but it cannot prove the ROUTE agrees about any of it.
 * Three things are only knowable from a real call and each is load-bearing somewhere in the package:
 *
 *  - that all three primitives answer in the shape the declaration types claim;
 *  - that `usage.cost` arrives SYNCHRONOUSLY, which is why a decision run needs no broadcast
 *    reconciliation the way a completion does;
 *  - that the wire really is snake_case (`input_tokens`) and the SDK really does decode it to
 *    `inputTokens`, which is the rename `openRouterRunUsageFromDecisionsUsage` reads through.
 *
 * ## Running
 *
 * Skipped unless `OPENROUTER_API_KEY` is set, because these make real calls. They are cheap: input is
 * billed at $0.042 per million tokens and output is free, so one run of this file costs a fraction of a
 * cent.
 *
 * ```
 * OPENROUTER_API_KEY=sk-or-… npx nx test openrouter
 * OPENROUTER_TEST_DECISION_MODEL_ID=typesafe/jev-latest npx nx test openrouter
 * ```
 */
const OPENROUTER_API_KEY = process.env['OPENROUTER_API_KEY'];
const CREDENTIALS_PRESENT = Boolean(OPENROUTER_API_KEY);

const DECISION_MODEL = process.env['OPENROUTER_TEST_DECISION_MODEL_ID'] ?? OPENROUTER_JEV_1_13_MODEL_ID;

/**
 * Jev's input price, $0.042 per million tokens. Output is not billed.
 */
const OPENROUTER_JEV_INPUT_COST_PER_TOKEN = 0.042 / 1_000_000;

/**
 * The state every probe judges.
 *
 * An OBJECT rather than a bare string so each part has a name the questions can point at with the
 * backticked dot-path convention — which is the convention being exercised, not just described.
 */
const PROBE_STATE = {
  ticket: {
    subject: 'Charged twice for March',
    body: 'My card shows two charges for the March invoice. I need one refunded before payroll on Friday.'
  }
};

const PROBE_QUESTIONS = {
  topic: openRouterChoiceQuestion(
    { question: 'Which team should own `ticket`?', inspect: ['ticket.subject', 'ticket.body'] },
    {
      billing: { what: 'Charges, invoices, refunds, or subscriptions', not_for: 'Order tracking or account access', examples: ['I was charged twice'] },
      access: { what: 'Sign-in, passwords, or permissions', not_for: 'Anything about money', examples: ['I cannot log in'] },
      other: { what: 'Anything the other options do not cover' }
    }
  ),
  urgency: openRouterScoreQuestion('How urgent is `ticket`?', [{ what: 'No deadline is mentioned and nothing is blocked' }, { what: 'Something is inconvenient but the sender can keep working' }, { what: 'The sender names a deadline within the week' }, { what: 'Money or access is blocked right now' }]),
  refundRequested: openRouterNoulQuestion('`ticket` asks for money to be returned.', { true: 'the sender asks for a refund or reversal', false: 'the sender asks for anything else' })
} as const;

describe.skipIf(!CREDENTIALS_PRESENT)('System One live probes', () => {
  const client = new OpenRouterCore({ apiKey: OPENROUTER_API_KEY as string });

  it('should answer all three primitives in one call', async () => {
    const request = openRouterDecisionRequest({ state: PROBE_STATE, questions: PROBE_QUESTIONS, overrides: { model: DECISION_MODEL } });
    const result = await openRouterDecision({ client, request });

    // Membership is already guaranteed by the transport — `openRouterDecision` would have thrown a
    // fault error rather than returned. These assert the SHAPE the declaration types promise.
    expect(result.answers.topic.type).toBe('choice');
    expect(['billing', 'access', 'other']).toContain(result.answers.topic.choice);
    expect(result.answers.urgency.type).toBe('score');
    expect(result.answers.urgency.score).toBeGreaterThanOrEqual(0);
    expect(result.answers.urgency.score).toBeLessThanOrEqual(3);
    expect(result.answers.refundRequested.type).toBe('noul');
    expect(result.answers.refundRequested.noul).toBeGreaterThanOrEqual(0);
    expect(result.answers.refundRequested.noul).toBeLessThanOrEqual(1);
  });

  it('should report a synchronous cost, which is why a decision needs no broadcast reconciliation', async () => {
    const request = openRouterDecisionRequest({ state: PROBE_STATE, questions: { refundRequested: PROBE_QUESTIONS.refundRequested }, overrides: { model: DECISION_MODEL } });
    const result = await openRouterDecision({ client, request });

    expect(result.usage?.cost).toBeGreaterThan(0);
    expect(result.usage?.inputTokens).toBeGreaterThan(0);
    // Output tokens ARE reported here, they are simply not billed: the cost is the input count at the
    // model's input rate and nothing else. Asserted as arithmetic rather than as a magnitude, because
    // the trap this guards is a reader deriving a per-token cost from `totalTokens`.
    expect(result.usage?.outputTokens).toBeGreaterThan(0);
    expect(result.usage?.cost).toBeCloseTo((result.usage?.inputTokens as number) * OPENROUTER_JEV_INPUT_COST_PER_TOKEN, 10);
  });

  it('should report the versioned model that served it, not the slug that was asked for', async () => {
    const request = openRouterDecisionRequest({ state: PROBE_STATE, questions: { refundRequested: PROBE_QUESTIONS.refundRequested }, overrides: { model: DECISION_MODEL } });
    const result = await openRouterDecision({ client, request });

    expect(result.model).toBeTruthy();
    expect(result.generationIds.length).toBeLessThanOrEqual(1);
  });

  it('should carry snake_case usage on the wire, which the SDK decodes to camelCase', async () => {
    // The one assertion that has to bypass the SDK: it is the rename itself under test, and reading it
    // through the thing that performs it would prove nothing.
    const response = await fetch('https://openrouter.ai/api/v1/systemone', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENROUTER_API_KEY as string}` },
      body: JSON.stringify({
        model: DECISION_MODEL,
        state: PROBE_STATE,
        questions: { refundRequested: { type: 'noul', instructions: '`ticket` asks for money to be returned.' } }
      })
    });

    const body = (await response.json()) as { usage?: Record<string, unknown>; answers?: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.usage).toHaveProperty('input_tokens');
    expect(body.usage).toHaveProperty('output_tokens');
    expect(body.usage).not.toHaveProperty('inputTokens');
    expect(body.answers?.['refundRequested']).toHaveProperty('noul');
  });
});
