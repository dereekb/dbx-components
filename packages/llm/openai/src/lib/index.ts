/**
 * `@dereekb/llm/openai` — the OpenAI-compatible chat strategy (OpenAI, ZenMux chat, a local vLLM) and its completion adapter.
 *
 * The `openai` SDK is an optional peer loaded lazily from one boundary module, `lib/openai.sdk.ts` (left out of this
 * barrel), so importing this entry never evaluates it.
 */
export * from './openai.chat';
export * from './openai.strategy';
export * from './openai.adapter';
export * from './openai.swallow';
