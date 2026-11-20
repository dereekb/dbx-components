/**
 * `@dereekb/llm/test` — test infrastructure: tape replay, scripted completion and decision strategies, the decision
 * answer builders (`makeLlmDecisionChoiceAnswer`, `makeLlmDecisionScoreAnswer`, `makeLlmDecisionNoulAnswer`), the fakes
 * (`makeLlmFetchFake` + `readLlmFetchFakeHeader` for the fetch seam, `makeLlmOpenAiChatClientFake` for the
 * OpenAI-compatible chat client, `makeLlmCompletionAdapterFake`, `makeLlmDispatcherFake`, the `/systemone` wire fake),
 * and the billed live lane (live strategy, credential / quota gate setup, verdict codecs, A/B gate).
 * Node-only, and free of any vitest import, so a plain Node harness (a benchmark CLI) can use it too.
 */
export * from './llm.test.ab';
export * from './llm.test.adapter';
export * from './llm.test.chat';
export * from './llm.test.decision.answer';
export * from './llm.test.dispatcher';
export * from './llm.test.env';
export * from './llm.test.fetch';
export * from './llm.test.lane';
export * from './llm.test.live';
export * from './llm.test.scripted';
export * from './llm.test.scripted.decision';
export * from './llm.test.systemone';
export * from './llm.test.tape';
export * from './llm.test.verdict';
