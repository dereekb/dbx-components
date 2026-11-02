import { describe, expect, it } from 'vitest';
import { OpenRouterCore } from '@openrouter/sdk/core';
import { type Maybe } from '@dereekb/util';
import { TEST_BAD_TEMPLATE_SCRIPTS, TEST_GOOD_TEMPLATE_SCRIPTS, TEST_JOB_REMINDER_TEMPLATE_TYPE } from '../test/openrouter.template.fixture';
import { openRouterDecisionRequest } from './openrouter.decision';
import { openRouterDecision } from './openrouter.decision.call';
import { openRouterTemplateContext } from './openrouter.template.context';
import { openRouterTemplateReviewPromptDefinition, openRouterTemplateReviewQuestions, openRouterTemplateReviewState, readOpenRouterTemplateReviewVerdict, type OpenRouterTemplateReviewVerdict } from './openrouter.template.review';
import { compileOpenRouterTemplateScript } from './openrouter.template.script.run';
import { OPENROUTER_JEV_1_13_MODEL_ID } from './openrouter.type';

/**
 * Live probes of the template review against Jev.
 *
 * The parser is the security boundary, but the review is what catches a script that is structurally valid and still wrong:
 * one that invents facts, wanders off its purpose, or addresses the reviewer. Every known-bad script is fed to it here,
 * including the ones the parser already refuses, and each must be flagged in EVERY run. The good templates must pass every
 * run.
 *
 * ## Running
 *
 * Skipped unless `OPENROUTER_API_KEY` is set, because these make real calls. Jev input is billed at $0.042 per million
 * tokens, so a run costs a fraction of a cent.
 *
 * ```
 * OPENROUTER_API_KEY=sk-or-… npx nx test openrouter --testFile=openrouter.template.review.spike.spec.ts
 * ```
 */
const OPENROUTER_API_KEY = process.env['OPENROUTER_API_KEY'];
const CREDENTIALS_PRESENT = Boolean(OPENROUTER_API_KEY);

const REVIEW_MODEL = process.env['OPENROUTER_TEST_DECISION_MODEL_ID'] ?? OPENROUTER_JEV_1_13_MODEL_ID;

/**
 * How many times each script is reviewed.
 */
const REVIEW_RUNS = 5;

const REVIEW_TIMEOUT = 120_000;

describe.skipIf(!CREDENTIALS_PRESENT)('template review live spike', () => {
  const client = new OpenRouterCore({ apiKey: OPENROUTER_API_KEY as string });
  const typeConfig = TEST_JOB_REMINDER_TEMPLATE_TYPE;

  async function sampleTextFor(script: string): Promise<Maybe<string>> {
    let sampleText: Maybe<string>;

    try {
      const compiled = compileOpenRouterTemplateScript({ code: script, typeConfig });
      const result = await compiled(openRouterTemplateContext({ typeConfig, data: typeConfig.samples?.data, notification: typeConfig.samples?.notification, accessorOverrides: typeConfig.samples?.accessor }));
      sampleText = typeof result === 'string' ? result : JSON.stringify(result);
    } catch {
      sampleText = undefined;
    }

    return sampleText;
  }

  async function reviewRuns(script: string): Promise<OpenRouterTemplateReviewVerdict[]> {
    const state = openRouterTemplateReviewState({ typeConfig, script, sampleText: await sampleTextFor(script) });
    const request = openRouterDecisionRequest({ prompt: openRouterTemplateReviewPromptDefinition(), state: state as unknown as Record<string, unknown>, questions: openRouterTemplateReviewQuestions(typeConfig), overrides: { model: REVIEW_MODEL } });

    return Promise.all(
      Array.from({ length: REVIEW_RUNS }, async () => {
        const result = await openRouterDecision({ client, request });
        return readOpenRouterTemplateReviewVerdict(result.answers);
      })
    );
  }

  Object.entries(TEST_BAD_TEMPLATE_SCRIPTS).forEach(([name, script]) => {
    it(
      `should flag the ${name} script in every run`,
      async () => {
        const verdicts = await reviewRuns(script);
        verdicts.forEach((verdict) => expect(verdict.approved).toBe(false));
      },
      REVIEW_TIMEOUT
    );
  });

  Object.entries(TEST_GOOD_TEMPLATE_SCRIPTS).forEach(([name, script]) => {
    it(
      `should approve the ${name} script in every run`,
      async () => {
        const verdicts = await reviewRuns(script);
        // Every flagged id across the runs, so a failure names the questions that misfired.
        expect([...new Set(verdicts.flatMap((verdict) => verdict.flagged))]).toEqual([]);
      },
      REVIEW_TIMEOUT
    );
  });
});
