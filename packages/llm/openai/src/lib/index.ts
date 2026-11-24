/**
 * `@dereekb/llm/openai` — the OpenAI-compatible chat strategy (OpenAI, ZenMux chat, a local vLLM), its completion
 * adapter, and the OpenAI-compatible chat base `/openrouter` builds on (`makeLlmOpenAiCompatibleChatStrategy`).
 *
 * The `openai` SDK is an optional peer loaded lazily from one boundary module, `lib/openai.sdk.ts` (left out of this
 * barrel) — the ONE `openai` boundary of the family, so importing this entry never evaluates it.
 */
export * from './openai.chat';
export * from './openai.compatible.strategy';
export * from './openai.strategy';
export * from './openai.adapter';
export * from './openai.swallow';
