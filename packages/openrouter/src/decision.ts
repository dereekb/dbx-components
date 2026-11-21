/**
 * `@dereekb/openrouter/decision` — the OpenRouter half of the System One (Jev) decision layer, loadable WITHOUT
 * evaluating `@openrouter/sdk`.
 *
 * The root `@dereekb/openrouter` entry re-exports SDK values (`callModel`, `responsesSend`,
 * `systemOneCreate`, …), so importing any value from it evaluates the SDK — a measurable cold-start cost
 * that a test runner isolating each spec file pays once per file.
 *
 * The decision vocabulary itself — Choice / Score / Noul questions, answers, confidence bands, validation, the wire
 * question, the reply reader and its faults, and the decision-model guard — lives in `@dereekb/llm/decision`, which
 * is SDK-free by construction. This entry adds what is OpenRouter's:
 *
 * - the request (`openRouterDecisionRequest`), the `/systemone` body (`openRouterDecisionRequestBody`) and the usage
 *   flattening;
 * - the model config and the model ids, including the pinned Jev slugs;
 * - the deprecated `OpenRouterDecision…` aliases of the moved vocabulary (the same values and classes).
 *
 * The transport, `openRouterDecision`, stays on the root entry because it is the one `systemOneCreate`
 * caller. A consumer that owns its own transport pairs this entry with its own lazily-loaded client.
 *
 * Everything here is ALSO exported from the root entry, from the same modules — the two entries share one
 * chunk, and the moved classes live once in `@dereekb/llm`, so a class such as `LlmDecisionAnswerFaultError` has
 * one identity whichever entry a value was imported through.
 */
export * from './lib/openrouter.config';
export * from './lib/openrouter.decision';
export * from './lib/openrouter.decision.compat';
export * from './lib/openrouter.type';
