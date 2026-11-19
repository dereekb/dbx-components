/**
 * `@dereekb/llm/openrouter` — the OpenRouter chat strategy (`cache_control`, strict `response_format`, usage
 * accounting), the OpenRouter decision strategy and their adapters.
 *
 * Both SDKs are optional peers loaded lazily, so importing this entry never evaluates either: `openai` is reached
 * through `@dereekb/llm/openai` (the chat strategy is built on its OpenAI-compatible chat base, and `/openai` holds the
 * family's one `openai` boundary), and `@openrouter/sdk` is loaded from `lib/openrouter.sdk.ts` (left out of this
 * barrel).
 */
export * from './openrouter.chat';
export * from './openrouter.strategy';
export * from './openrouter.decision';
export * from './openrouter.adapter';
export * from './openrouter.swallow';
