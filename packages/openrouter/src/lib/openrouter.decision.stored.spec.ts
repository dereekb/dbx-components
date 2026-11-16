/* eslint-disable @typescript-eslint/no-deprecated -- this spec pins the deprecated @dereekb/openrouter decision aliases */
import { type LlmDecisionAnswers, llmChoiceQuestion, llmDecisionRequestBody, llmNoulQuestion, llmScoreQuestion, readLlmDecisionAnswers, validateLlmDecisionQuestions } from '@dereekb/llm/decision';
import { mapObjectMap } from '@dereekb/util';
import { describe, expect, it } from 'vitest';
import { type OpenRouterDecisionAnswers, type OpenRouterDecisionQuestions, openRouterChoiceQuestion, openRouterDecisionRequestBody, openRouterDecisionWireQuestion, openRouterNoulQuestion, openRouterScoreQuestion, readOpenRouterDecisionAnswers, validateOpenRouterDecisionQuestions } from '../decision';

/**
 * The stored-question round-trip fixture.
 *
 * A prompt version stores its questions as `JSON.stringify(questions)` (`OpenRouterPromptVersion.q` /
 * `OpenRouterRunTask.q`), its state as `st` and the answers as `an`. The literals below were captured from the
 * code BEFORE the decision vocabulary moved to `@dereekb/llm` — never hand-typed — so this spec proves the move
 * changed no stored byte and no wire byte.
 */
const STORED_QUESTIONS_JSON =
  '{"team":{"type":"choice","instructions":{"question":"Which team should own `ticket`?","inspect":["ticket.subject","ticket.body"]},"options":{"billing":{"what":"Charges, invoices, refunds, or subscriptions","not_for":"Anything about signing in","examples":["I was charged twice"]},"access":{"what":"Sign-in, passwords, or permissions","not_for":"Anything about money"},"other":null}},"urgency":{"type":"score","instructions":"How urgent is `ticket`?","levels":[{"what":"Nothing is blocked"},{"what":"Money or access is blocked right now","signals":["locked out"]}]},"spam":{"type":"noul","instructions":"`ticket` is unsolicited marketing rather than a real support request.","means":{"true":"the message advertises something","false":"a person is asking for help"}},"reply":{"type":"noul","instructions":"`ticket` asks for a reply."},"tone":{"type":"choice","instructions":"Which tone does `ticket.body` take?","options":{"calm":"measured and polite","upset":"frustrated or angry"}}}';
const STORED_STATE_JSON = '{"ticket":{"subject":"Locked out","body":"I cannot sign in since this morning."}}';
const STORED_ANSWERS_JSON =
  '{"team":{"type":"choice","choice":"access","probabilities":{"billing":0.1,"access":0.85,"other":0.05},"confidence":0.8},"urgency":{"type":"score","score":1,"legend":{"0":{"what":"Nothing is blocked"},"1":{"what":"Money or access is blocked right now","signals":["locked out"]}},"probabilities":{"0":0.25,"1":0.75},"confidence":0.7},"spam":{"type":"noul","noul":0.05},"reply":{"type":"noul","noul":0.9},"tone":{"type":"choice","choice":"upset"}}';
const STORED_WIRE_JSON =
  '{"team":{"type":"choice","instructions":{"question":"Which team should own `ticket`?","inspect":["ticket.subject","ticket.body"]},"criteria":{"billing":{"what":"Charges, invoices, refunds, or subscriptions","not_for":"Anything about signing in","examples":["I was charged twice"]},"access":{"what":"Sign-in, passwords, or permissions","not_for":"Anything about money"},"other":null}},"urgency":{"type":"score","instructions":"How urgent is `ticket`?","criteria":[{"what":"Nothing is blocked"},{"what":"Money or access is blocked right now","signals":["locked out"]}]},"spam":{"type":"noul","instructions":"`ticket` is unsolicited marketing rather than a real support request.","criteria":{"true":"the message advertises something","false":"a person is asking for help"}},"reply":{"type":"noul","instructions":"`ticket` asks for a reply."},"tone":{"type":"choice","instructions":"Which tone does `ticket.body` take?","criteria":{"calm":"measured and polite","upset":"frustrated or angry"}}}';
const STORED_BODY_JSON =
  '{"model":"typesafe/jev-1.13","state":{"ticket":{"subject":"Locked out","body":"I cannot sign in since this morning."}},"questions":{"team":{"type":"choice","instructions":{"question":"Which team should own `ticket`?","inspect":["ticket.subject","ticket.body"]},"criteria":{"billing":{"what":"Charges, invoices, refunds, or subscriptions","not_for":"Anything about signing in","examples":["I was charged twice"]},"access":{"what":"Sign-in, passwords, or permissions","not_for":"Anything about money"},"other":null}},"urgency":{"type":"score","instructions":"How urgent is `ticket`?","criteria":[{"what":"Nothing is blocked"},{"what":"Money or access is blocked right now","signals":["locked out"]}]},"spam":{"type":"noul","instructions":"`ticket` is unsolicited marketing rather than a real support request.","criteria":{"true":"the message advertises something","false":"a person is asking for help"}},"reply":{"type":"noul","instructions":"`ticket` asks for a reply."},"tone":{"type":"choice","instructions":"Which tone does `ticket.body` take?","criteria":{"calm":"measured and polite","upset":"frustrated or angry"}}}}';

const STORED_MODEL = 'typesafe/jev-1.13';

const STORED_QUESTIONS = {
  team: openRouterChoiceQuestion(
    { question: 'Which team should own `ticket`?', inspect: ['ticket.subject', 'ticket.body'] },
    {
      billing: { what: 'Charges, invoices, refunds, or subscriptions', not_for: 'Anything about signing in', examples: ['I was charged twice'] },
      access: { what: 'Sign-in, passwords, or permissions', not_for: 'Anything about money' },
      other: null
    }
  ),
  urgency: openRouterScoreQuestion('How urgent is `ticket`?', [{ what: 'Nothing is blocked' }, { what: 'Money or access is blocked right now', signals: ['locked out'] }]),
  spam: openRouterNoulQuestion('`ticket` is unsolicited marketing rather than a real support request.', { true: 'the message advertises something', false: 'a person is asking for help' }),
  reply: openRouterNoulQuestion('`ticket` asks for a reply.'),
  tone: openRouterChoiceQuestion('Which tone does `ticket.body` take?', { calm: 'measured and polite', upset: 'frustrated or angry' })
} satisfies OpenRouterDecisionQuestions;

type StoredQuestions = typeof STORED_QUESTIONS;

function parsedStoredQuestions(): StoredQuestions {
  return JSON.parse(STORED_QUESTIONS_JSON) as StoredQuestions;
}

describe('stored decision questions', () => {
  describe('with the @dereekb/openrouter names', () => {
    it('should serialize the builders to the stored questions', () => {
      expect(JSON.stringify(STORED_QUESTIONS)).toBe(STORED_QUESTIONS_JSON);
    });

    it('should validate the parsed stored questions', () => {
      const validation = validateOpenRouterDecisionQuestions(parsedStoredQuestions());
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should map the parsed stored questions to the stored wire questions', () => {
      const wire = mapObjectMap(parsedStoredQuestions(), (question) => openRouterDecisionWireQuestion(question));
      expect(JSON.stringify(wire)).toBe(STORED_WIRE_JSON);
    });

    it('should build the stored OpenRouter body from the parsed stored questions and state', () => {
      const body = openRouterDecisionRequestBody({ config: { model: STORED_MODEL }, state: JSON.parse(STORED_STATE_JSON), questions: parsedStoredQuestions() });
      expect(JSON.stringify(body)).toBe(STORED_BODY_JSON);
    });

    it('should read the stored answers against the parsed stored questions', () => {
      const read = readOpenRouterDecisionAnswers({ questions: parsedStoredQuestions(), raw: JSON.parse(STORED_ANSWERS_JSON) as OpenRouterDecisionAnswers<StoredQuestions> });
      expect(read.faults).toBeUndefined();
      expect(read.answers?.team.choice).toBe('access');
      expect(read.answers?.urgency.score).toBe(1);
      expect(read.answers?.spam.noul).toBe(0.05);
      expect(JSON.stringify(read.answers)).toBe(STORED_ANSWERS_JSON);
    });
  });

  describe('with the @dereekb/llm names', () => {
    it('should serialize the llm builders to the same stored questions', () => {
      const questions = {
        team: llmChoiceQuestion(
          { question: 'Which team should own `ticket`?', inspect: ['ticket.subject', 'ticket.body'] },
          {
            billing: { what: 'Charges, invoices, refunds, or subscriptions', not_for: 'Anything about signing in', examples: ['I was charged twice'] },
            access: { what: 'Sign-in, passwords, or permissions', not_for: 'Anything about money' },
            other: null
          }
        ),
        urgency: llmScoreQuestion('How urgent is `ticket`?', [{ what: 'Nothing is blocked' }, { what: 'Money or access is blocked right now', signals: ['locked out'] }]),
        spam: llmNoulQuestion('`ticket` is unsolicited marketing rather than a real support request.', { true: 'the message advertises something', false: 'a person is asking for help' }),
        reply: llmNoulQuestion('`ticket` asks for a reply.'),
        tone: llmChoiceQuestion('Which tone does `ticket.body` take?', { calm: 'measured and polite', upset: 'frustrated or angry' })
      };

      expect(JSON.stringify(questions)).toBe(STORED_QUESTIONS_JSON);
    });

    it('should validate the parsed stored questions exactly as the alias does', () => {
      expect(validateLlmDecisionQuestions(parsedStoredQuestions())).toEqual(validateOpenRouterDecisionQuestions(parsedStoredQuestions()));
    });

    it('should build the stored OpenRouter body bytes with the neutral body builder', () => {
      const body = llmDecisionRequestBody({ model: STORED_MODEL, state: JSON.parse(STORED_STATE_JSON), questions: parsedStoredQuestions() });
      expect(JSON.stringify(body)).toBe(STORED_BODY_JSON);
    });

    it('should read the stored answers exactly as the alias does', () => {
      const raw = JSON.parse(STORED_ANSWERS_JSON) as LlmDecisionAnswers<StoredQuestions>;
      expect(readLlmDecisionAnswers({ questions: parsedStoredQuestions(), raw })).toEqual(readOpenRouterDecisionAnswers({ questions: parsedStoredQuestions(), raw }));
    });
  });
});
