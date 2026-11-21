/**
 * Pins for D5 step 1 — `refactor(openrouter): decision body and reply read reuse llm's`: what
 * `openRouterDecisionRequestBody` builds, and what `openRouterDecision` sends, returns and throws. Every literal below
 * was CAPTURED from the code before that refactor (never hand-typed), so the refactor proves itself identical here.
 *
 * Each body pin checks `Object.keys` (the order — the body is public through `@dereekb/openrouter/decision`), then
 * `toStrictEqual` against the parsed bytes (no `undefined`-valued key anywhere), then `JSON.stringify` (the bytes).
 * Each wire pin checks the body the SDK actually sent: the fake records it parsed, and re-stringifying it gives the
 * wire bytes back, because the SDK sends compact `JSON.stringify` output and no fixture key is integer-like.
 *
 * Already pinned elsewhere, and not repeated: the stored body of a model-only request
 * (`openrouter.decision.stored.spec.ts`), the URL and method (`openrouter.decision.spec.ts`), and the fault classes'
 * identity through every entry (`openrouter.decision.compat.spec.ts`).
 */
import { LlmDecisionAnswerFaultError, type LlmDecisionQuestions, llmChoiceQuestion, llmNoulQuestion, llmScoreQuestion } from '@dereekb/llm/decision';
import { describe, expect, it } from 'vitest';
import { fakeOpenRouterDecisionClient } from '../test/openrouter.fake';
import { type OpenRouterDecisionRequest, openRouterDecisionRequestBody } from './openrouter.decision';
import { openRouterDecision } from './openrouter.decision.call';
import { OPENROUTER_JEV_1_13_MODEL_ID } from './openrouter.type';

// MARK: Fixtures
const JEV = OPENROUTER_JEV_1_13_MODEL_ID;
const STATE = { phrase: 'on the pile', rows: ['row-a', 'row-b'] };

const QUESTIONS = {
  entry: llmChoiceQuestion('Which entry means what `phrase` describes?', { 'row-a': 'the first row', 'row-b': null }),
  heat: llmScoreQuestion('How urgent is `phrase`?', ['idle', 'soon', 'now']),
  fits: llmNoulQuestion('At least one row means what `phrase` describes.', { true: 'one of them fits', false: 'none of them fit' }),
  reply: llmNoulQuestion('`phrase` asks for a reply.')
} satisfies LlmDecisionQuestions;

/**
 * A reply answering every fixture question inside its space. An answer to an id a request did not declare is ignored by the read.
 */
const ANSWERS = { entry: { type: 'choice', choice: 'row-a' }, heat: { type: 'score', score: 1 }, fits: { type: 'noul', noul: 0.8 }, reply: { type: 'noul', noul: 0.1 } };

const REQUESTS = {
  minimal: { config: { model: JEV }, state: 'x', questions: { fits: QUESTIONS.fits } },
  full: { config: { model: JEV, provider: { only: ['typesafe'] }, user: 'user-1', temperature: 0.2, requestTimeoutMs: 5000 }, state: STATE, questions: QUESTIONS, sessionId: 'session-1', trace: { runTaskKey: 'rt-1', span: 'pin' } },
  nullSessionAndTrace: { config: { model: JEV, user: 'user-1' }, state: STATE, questions: QUESTIONS, sessionId: null, trace: null },
  undefinedSessionAndTrace: { config: { model: JEV, provider: { only: ['typesafe'] } }, state: STATE, questions: QUESTIONS, sessionId: undefined, trace: undefined },
  nullProvider: { config: { model: JEV, provider: null }, state: STATE, questions: QUESTIONS },
  nullUser: { config: { model: JEV, user: null }, state: STATE, questions: QUESTIONS },
  noModel: { config: { provider: { only: ['typesafe'] }, user: 'user-1' }, state: STATE, questions: QUESTIONS }
} satisfies Record<string, OpenRouterDecisionRequest>;

type PinnedRequestName = keyof typeof REQUESTS;

/**
 * The requests that reach the wire. `nullUser` is refused by the SDK and `noModel` by validation, so neither is sent.
 */
const WIRE_PINNED: PinnedRequestName[] = ['minimal', 'full', 'nullSessionAndTrace', 'undefinedSessionAndTrace', 'nullProvider'];

/**
 * The success reply R1 reads: a richer `entry` answer and an `extra` answer to an id the request did not declare.
 */
const RESULT_REPLY = {
  id: 'gen_pin',
  provider: 'typesafe',
  answers: { ...ANSWERS, entry: { type: 'choice', choice: 'row-a', probabilities: { 'row-a': 0.9, 'row-b': 0.1 }, confidence: 0.8 }, extra: { type: 'noul', noul: 0.5 } },
  inputTokens: 350,
  outputTokens: 34,
  cost: 0.0000147
};

/**
 * The fault reply F1 reads: an off-option choice and distribution, an out-of-range score, a mistyped noul (the SDK
 * decodes it to its `UNKNOWN` fallback) and no answer to `reply`.
 */
const FAULT_REPLY = { answers: { entry: { type: 'choice', choice: 'row-z', probabilities: { 'row-a': 0.5, 'row-z': 0.5 } }, heat: { type: 'score', score: 9 }, fits: { type: 'noul', noul: '0.5' } } };

// MARK: Captured
const BODY_PINS: Record<PinnedRequestName, { readonly keys: string[]; readonly json: string }> = {
  minimal: { keys: ['model', 'state', 'questions'], json: '{"model":"typesafe/jev-1.13","state":"x","questions":{"fits":{"type":"noul","instructions":"At least one row means what `phrase` describes.","criteria":{"true":"one of them fits","false":"none of them fit"}}}}' },
  full: {
    keys: ['model', 'provider', 'user', 'state', 'questions', 'sessionId', 'trace'],
    json: '{"model":"typesafe/jev-1.13","provider":{"only":["typesafe"]},"user":"user-1","state":{"phrase":"on the pile","rows":["row-a","row-b"]},"questions":{"entry":{"type":"choice","instructions":"Which entry means what `phrase` describes?","criteria":{"row-a":"the first row","row-b":null}},"heat":{"type":"score","instructions":"How urgent is `phrase`?","criteria":["idle","soon","now"]},"fits":{"type":"noul","instructions":"At least one row means what `phrase` describes.","criteria":{"true":"one of them fits","false":"none of them fit"}},"reply":{"type":"noul","instructions":"`phrase` asks for a reply."}},"sessionId":"session-1","trace":{"additionalProperties":{"runTaskKey":"rt-1","span":"pin"}}}'
  },
  nullSessionAndTrace: {
    keys: ['model', 'user', 'state', 'questions'],
    json: '{"model":"typesafe/jev-1.13","user":"user-1","state":{"phrase":"on the pile","rows":["row-a","row-b"]},"questions":{"entry":{"type":"choice","instructions":"Which entry means what `phrase` describes?","criteria":{"row-a":"the first row","row-b":null}},"heat":{"type":"score","instructions":"How urgent is `phrase`?","criteria":["idle","soon","now"]},"fits":{"type":"noul","instructions":"At least one row means what `phrase` describes.","criteria":{"true":"one of them fits","false":"none of them fit"}},"reply":{"type":"noul","instructions":"`phrase` asks for a reply."}}}'
  },
  undefinedSessionAndTrace: {
    keys: ['model', 'provider', 'state', 'questions'],
    json: '{"model":"typesafe/jev-1.13","provider":{"only":["typesafe"]},"state":{"phrase":"on the pile","rows":["row-a","row-b"]},"questions":{"entry":{"type":"choice","instructions":"Which entry means what `phrase` describes?","criteria":{"row-a":"the first row","row-b":null}},"heat":{"type":"score","instructions":"How urgent is `phrase`?","criteria":["idle","soon","now"]},"fits":{"type":"noul","instructions":"At least one row means what `phrase` describes.","criteria":{"true":"one of them fits","false":"none of them fit"}},"reply":{"type":"noul","instructions":"`phrase` asks for a reply."}}}'
  },
  nullProvider: {
    keys: ['model', 'provider', 'state', 'questions'],
    json: '{"model":"typesafe/jev-1.13","provider":null,"state":{"phrase":"on the pile","rows":["row-a","row-b"]},"questions":{"entry":{"type":"choice","instructions":"Which entry means what `phrase` describes?","criteria":{"row-a":"the first row","row-b":null}},"heat":{"type":"score","instructions":"How urgent is `phrase`?","criteria":["idle","soon","now"]},"fits":{"type":"noul","instructions":"At least one row means what `phrase` describes.","criteria":{"true":"one of them fits","false":"none of them fit"}},"reply":{"type":"noul","instructions":"`phrase` asks for a reply."}}}'
  },
  nullUser: {
    keys: ['model', 'user', 'state', 'questions'],
    json: '{"model":"typesafe/jev-1.13","user":null,"state":{"phrase":"on the pile","rows":["row-a","row-b"]},"questions":{"entry":{"type":"choice","instructions":"Which entry means what `phrase` describes?","criteria":{"row-a":"the first row","row-b":null}},"heat":{"type":"score","instructions":"How urgent is `phrase`?","criteria":["idle","soon","now"]},"fits":{"type":"noul","instructions":"At least one row means what `phrase` describes.","criteria":{"true":"one of them fits","false":"none of them fit"}},"reply":{"type":"noul","instructions":"`phrase` asks for a reply."}}}'
  },
  noModel: {
    keys: ['provider', 'user', 'model', 'state', 'questions'],
    json: '{"provider":{"only":["typesafe"]},"user":"user-1","model":"","state":{"phrase":"on the pile","rows":["row-a","row-b"]},"questions":{"entry":{"type":"choice","instructions":"Which entry means what `phrase` describes?","criteria":{"row-a":"the first row","row-b":null}},"heat":{"type":"score","instructions":"How urgent is `phrase`?","criteria":["idle","soon","now"]},"fits":{"type":"noul","instructions":"At least one row means what `phrase` describes.","criteria":{"true":"one of them fits","false":"none of them fit"}},"reply":{"type":"noul","instructions":"`phrase` asks for a reply."}}}'
  }
};

const WIRE_PINS: Partial<Record<PinnedRequestName, string>> = {
  minimal: '{"model":"typesafe/jev-1.13","questions":{"fits":{"criteria":{"false":"none of them fit","true":"one of them fits"},"instructions":"At least one row means what `phrase` describes.","type":"noul"}},"state":"x"}',
  full: '{"model":"typesafe/jev-1.13","provider":{"only":["typesafe"]},"questions":{"entry":{"criteria":{"row-a":"the first row","row-b":null},"instructions":"Which entry means what `phrase` describes?","type":"choice"},"heat":{"criteria":["idle","soon","now"],"instructions":"How urgent is `phrase`?","type":"score"},"fits":{"criteria":{"false":"none of them fit","true":"one of them fits"},"instructions":"At least one row means what `phrase` describes.","type":"noul"},"reply":{"instructions":"`phrase` asks for a reply.","type":"noul"}},"session_id":"session-1","state":{"phrase":"on the pile","rows":["row-a","row-b"]},"trace":{"runTaskKey":"rt-1","span":"pin"},"user":"user-1"}',
  nullSessionAndTrace:
    '{"model":"typesafe/jev-1.13","questions":{"entry":{"criteria":{"row-a":"the first row","row-b":null},"instructions":"Which entry means what `phrase` describes?","type":"choice"},"heat":{"criteria":["idle","soon","now"],"instructions":"How urgent is `phrase`?","type":"score"},"fits":{"criteria":{"false":"none of them fit","true":"one of them fits"},"instructions":"At least one row means what `phrase` describes.","type":"noul"},"reply":{"instructions":"`phrase` asks for a reply.","type":"noul"}},"state":{"phrase":"on the pile","rows":["row-a","row-b"]},"user":"user-1"}',
  undefinedSessionAndTrace:
    '{"model":"typesafe/jev-1.13","provider":{"only":["typesafe"]},"questions":{"entry":{"criteria":{"row-a":"the first row","row-b":null},"instructions":"Which entry means what `phrase` describes?","type":"choice"},"heat":{"criteria":["idle","soon","now"],"instructions":"How urgent is `phrase`?","type":"score"},"fits":{"criteria":{"false":"none of them fit","true":"one of them fits"},"instructions":"At least one row means what `phrase` describes.","type":"noul"},"reply":{"instructions":"`phrase` asks for a reply.","type":"noul"}},"state":{"phrase":"on the pile","rows":["row-a","row-b"]}}',
  nullProvider:
    '{"model":"typesafe/jev-1.13","provider":null,"questions":{"entry":{"criteria":{"row-a":"the first row","row-b":null},"instructions":"Which entry means what `phrase` describes?","type":"choice"},"heat":{"criteria":["idle","soon","now"],"instructions":"How urgent is `phrase`?","type":"score"},"fits":{"criteria":{"false":"none of them fit","true":"one of them fits"},"instructions":"At least one row means what `phrase` describes.","type":"noul"},"reply":{"instructions":"`phrase` asks for a reply.","type":"noul"}},"state":{"phrase":"on the pile","rows":["row-a","row-b"]}}'
};

const NULL_USER_ERROR_NAME = 'SDKValidationError';
const RESULT_KEYS: string[] = ['answers', 'model', 'provider', 'generationIds', 'usage', 'response'];
const RESULT_JSON =
  '{"answers":{"entry":{"choice":"row-a","confidence":0.8,"probabilities":{"row-a":0.9,"row-b":0.1},"type":"choice"},"heat":{"score":1,"type":"score"},"fits":{"noul":0.8,"type":"noul"},"reply":{"noul":0.1,"type":"noul"},"extra":{"noul":0.5,"type":"noul"}},"model":"typesafe/jev-1.13","provider":"typesafe","generationIds":["gen_pin"],"usage":{"inputTokens":350,"outputTokens":34,"totalTokens":384,"cost":0.0000147},"response":{"answers":{"entry":{"choice":"row-a","confidence":0.8,"probabilities":{"row-a":0.9,"row-b":0.1},"type":"choice"},"heat":{"score":1,"type":"score"},"fits":{"noul":0.8,"type":"noul"},"reply":{"noul":0.1,"type":"noul"},"extra":{"noul":0.5,"type":"noul"}},"id":"gen_pin","model":"typesafe/jev-1.13","provider":"typesafe","usage":{"cost":0.0000147,"inputTokens":350,"outputTokens":34}}}';
const FAULT_MESSAGE =
  'The decision reply did not answer its declared questions: entry (choice-off-option): `row-z` was not one of the declared options; entry (choice-off-option): the distribution covers undeclared options `row-z`; heat (value-out-of-range): the score 9 is outside the declared 0..2; fits (answer-mistyped): a noul question was answered with a UNKNOWN; reply (answer-missing): no answer was returned';
const FAULTS_JSON =
  '[{"kind":"choice-off-option","question":"entry","detail":"`row-z` was not one of the declared options"},{"kind":"choice-off-option","question":"entry","detail":"the distribution covers undeclared options `row-z`"},{"kind":"value-out-of-range","question":"heat","detail":"the score 9 is outside the declared 0..2"},{"kind":"answer-mistyped","question":"fits","detail":"a noul question was answered with a UNKNOWN"},{"kind":"answer-missing","question":"reply","detail":"no answer was returned"}]';

// MARK: Pins
describe('openRouterDecisionRequestBody() pins', () => {
  it.each(Object.keys(REQUESTS) as PinnedRequestName[])('should build the %s body', (name) => {
    const body = openRouterDecisionRequestBody(REQUESTS[name]);
    expect(Object.keys(body)).toEqual(BODY_PINS[name].keys);
    expect(body).toStrictEqual(JSON.parse(BODY_PINS[name].json));
    expect(JSON.stringify(body)).toBe(BODY_PINS[name].json);
  });
});

describe('openRouterDecision() pins', () => {
  it.each(WIRE_PINNED)('should send the %s body', async (name) => {
    const fake = fakeOpenRouterDecisionClient({ answers: ANSWERS });
    await openRouterDecision({ client: fake.client, request: REQUESTS[name] });
    expect(fake.callCount).toBe(1);
    expect(JSON.stringify(fake.requests[0].body)).toBe(WIRE_PINS[name]);
  });

  it('should send nothing when the SDK refuses a null user', async () => {
    const fake = fakeOpenRouterDecisionClient({ answers: ANSWERS });
    const error = await openRouterDecision({ client: fake.client, request: REQUESTS.nullUser }).catch((e: unknown) => e);
    expect((error as Error).name).toBe(NULL_USER_ERROR_NAME);
    expect(fake.callCount).toBe(0);
  });

  it('should return the read answers, the served model and provider, the generation id and the usage', async () => {
    const fake = fakeOpenRouterDecisionClient(RESULT_REPLY);
    const result = await openRouterDecision({ client: fake.client, request: REQUESTS.full });
    expect(Object.keys(result)).toEqual(RESULT_KEYS);
    expect(result.answers).toBe(result.response.answers);
    expect(JSON.stringify(result)).toBe(RESULT_JSON);
  });

  it('should throw every fault of a reply that left its declared answer space', async () => {
    const fake = fakeOpenRouterDecisionClient(FAULT_REPLY);
    const error = await openRouterDecision({ client: fake.client, request: REQUESTS.full }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmDecisionAnswerFaultError);
    const fault = error as LlmDecisionAnswerFaultError;
    expect(fault.name).toBe('LlmDecisionAnswerFaultError');
    expect(fault.message).toBe(FAULT_MESSAGE);
    expect(fault.faults).toStrictEqual(JSON.parse(FAULTS_JSON));
    expect(fake.callCount).toBe(1);
  });
});
