/**
 * `@dereekb/llm/openrouter` — the OpenRouter chat strategy (`cache_control`, strict `response_format`, usage
 * accounting), the OpenRouter decision strategy and their adapters.
 *
 * The entry loads no SDK of its own, so importing it never evaluates one: the chat strategy reaches `openai` through
 * `@dereekb/llm/openai` (it is built on that entry's OpenAI-compatible chat base, and `/openai` holds the family's one
 * `openai` boundary), and the decision strategy is a hook set over the core System One transport (a plain `fetch`).
 */
export * from './openrouter.chat';
export * from './openrouter.strategy';
export * from './openrouter.decision';
export * from './openrouter.adapter';
export * from './openrouter.swallow';
