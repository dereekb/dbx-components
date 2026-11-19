import { describe, expect, it, vi } from 'vitest';
import { llmChoiceQuestion, llmDecisionRequestBody, llmNoulQuestion, llmScoreQuestion, requireLlmDecisionAnswers, type LlmCredentialProbeRequestInit } from '@dereekb/llm';
import { makeLlmSystemOneWireFake, toLlmSystemOneWireReply } from './llm.test.systemone';

const ROUTE_URL = 'https://gateway.test/api/v1/systemone';

const QUESTIONS = {
  pick: llmChoiceQuestion('Which?', { alpha: 'the first', beta: null }),
  heat: llmScoreQuestion('How urgent?', ['idle', 'soon', 'now']),
  fits: llmNoulQuestion('Does it fit?')
};

const BODY = llmDecisionRequestBody({ model: 'typesafe/jev-1.14', state: 'x', questions: QUESTIONS });

function initOf(body?: string, signal?: AbortSignal): LlmCredentialProbeRequestInit {
  return { method: 'POST', headers: { Authorization: 'Bearer k' }, ...(body == null ? {} : { body }), ...(signal == null ? {} : { signal }) };
}

describe('toLlmSystemOneWireReply()', () => {
  it('answers each primitive validly and echoes the model', () => {
    const reply = toLlmSystemOneWireReply(BODY);

    expect(reply).toEqual({ model: 'typesafe/jev-1.14', answers: { pick: { type: 'choice', choice: 'alpha' }, heat: { type: 'score', score: 0 }, fits: { type: 'noul', noul: 0.5 } } });
    expect(requireLlmDecisionAnswers({ questions: QUESTIONS, raw: reply.answers ?? {} }).pick.choice).toBe('alpha');
  });

  it('answers nothing for an absent body', () => {
    expect(toLlmSystemOneWireReply(undefined)).toEqual({ answers: {} });
  });
});

describe('makeLlmSystemOneWireFake()', () => {
  it('records each request — url, init and parsed body — and answers 200 with a well-formed reply by default', async () => {
    const fake = makeLlmSystemOneWireFake();
    const init = initOf(JSON.stringify(BODY));
    const response = await fake.fetch(ROUTE_URL, init);

    expect(fake.requests).toEqual([{ url: ROUTE_URL, init, body: BODY }]);
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(JSON.parse(await response.text())).toEqual(toLlmSystemOneWireReply(BODY));
  });

  it('uses a fixed answer for every request', async () => {
    const fake = makeLlmSystemOneWireFake({ respond: { status: 429, body: { error: { message: 'slow down' } } } });
    const first = await fake.fetch(ROUTE_URL, initOf('{}'));
    const second = await fake.fetch(ROUTE_URL, initOf('{}'));

    for (const response of [first, second]) {
      expect(response.ok).toBe(false);
      expect(response.status).toBe(429);
      expect(await response.text()).toBe('{"error":{"message":"slow down"}}');
    }
  });

  it('calls a function answer per request', async () => {
    const respond = vi.fn((request: { readonly url: string }) => ({ body: { model: request.url } }));
    const fake = makeLlmSystemOneWireFake({ respond });
    await fake.fetch('https://a.test/systemone', initOf());
    const second = await fake.fetch('https://b.test/systemone', initOf());

    expect(respond).toHaveBeenCalledTimes(2);
    expect(await second.text()).toBe('{"model":"https://b.test/systemone"}');
  });

  it('sends a string body verbatim and records an unparseable request body as undefined', async () => {
    const fake = makeLlmSystemOneWireFake({ respond: { body: '<html>gateway</html>' } });
    const response = await fake.fetch(ROUTE_URL, initOf('not json'));

    expect(await response.text()).toBe('<html>gateway</html>');
    expect(fake.requests[0]?.body).toBeUndefined();
    expect(fake.requests[0]?.init.body).toBe('not json');
  });

  it('reads headers case-insensitively, a missing one as null', async () => {
    const fake = makeLlmSystemOneWireFake({ respond: { headers: { 'X-Request-Id': 'req-1' } } });
    const response = await fake.fetch(ROUTE_URL, initOf());

    expect(response.headers?.get('x-request-id')).toBe('req-1');
    expect(response.headers?.get('X-REQUEST-ID')).toBe('req-1');
    expect(response.headers?.get('x-other')).toBeNull();
  });

  it('rejects the fetch when respond throws, still recording the request', async () => {
    const cause = new TypeError('fetch failed');
    const fake = makeLlmSystemOneWireFake({
      respond: () => {
        throw cause;
      }
    });

    await expect(fake.fetch(ROUTE_URL, initOf('{}'))).rejects.toBe(cause);
    expect(fake.requests).toHaveLength(1);
  });

  it("'hang' rejects with the signal's reason on abort, and at once for an already-aborted signal", async () => {
    const fake = makeLlmSystemOneWireFake({ respond: 'hang' });
    const controller = new AbortController();
    const pending = fake.fetch(ROUTE_URL, initOf(undefined, controller.signal));
    const reason = new Error('stop');
    controller.abort(reason);
    const aborted = new AbortController();
    aborted.abort();

    await expect(pending).rejects.toBe(reason);
    await expect(fake.fetch(ROUTE_URL, initOf(undefined, aborted.signal))).rejects.toBe(aborted.signal.reason);
  });
});
