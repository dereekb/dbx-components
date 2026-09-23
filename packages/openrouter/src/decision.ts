/**
 * `@dereekb/openrouter/decision` — the System One (Jev) decision layer, loadable WITHOUT evaluating
 * `@openrouter/sdk`.
 *
 * The root `@dereekb/openrouter` entry re-exports SDK values (`callModel`, `responsesSend`,
 * `systemOneCreate`, …), so importing any value from it evaluates the SDK — a measurable cold-start cost
 * that a test runner isolating each spec file pays once per file. This entry carries everything a decision
 * is BUILT from and READ with, and nothing that sends one:
 *
 * - the declaration vocabulary — Choice / Score / Noul questions, answers, confidence bands, validation;
 * - the request, the wire mapping (`openRouterDecisionRequestBody`), the reply reader
 *   (`readOpenRouterDecisionAnswers`) and its faults, and the usage flattening;
 * - the model config and the model ids, including the System One routing guard
 *   (`isOpenRouterSystemOneModelId`).
 *
 * The transport, `openRouterDecision`, stays on the root entry because it is the one `systemOneCreate`
 * caller. A consumer that owns its own transport pairs this entry with its own lazily-loaded client.
 *
 * Everything here is ALSO exported from the root entry, from the same modules — the two entries share one
 * chunk, so a class such as `OpenRouterDecisionAnswerFaultError` has one identity whichever entry a value
 * was imported through.
 */
export * from './lib/openrouter.config';
export * from './lib/openrouter.decision';
export * from './lib/openrouter.decision.question';
export * from './lib/openrouter.type';
