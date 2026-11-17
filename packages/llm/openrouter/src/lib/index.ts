/**
 * `@dereekb/llm/openrouter` — the OpenRouter chat strategy (`cache_control`, strict `response_format`, usage accounting), the OpenRouter decision
 * strategy and their adapters.
 *
 * Both SDKs are optional peers loaded lazily, each from one boundary module: `openai` from
 * `lib/openrouter.openai.sdk.ts` and `@openrouter/sdk` from `lib/openrouter.sdk.ts` (both left out of this barrel), so
 * importing this entry never evaluates either.
 */
export * from './openrouter.chat';
export * from './openrouter.strategy';
export * from './openrouter.decision';
export * from './openrouter.adapter';
export * from './openrouter.swallow';
