/**
 * The dispatcher's public surface: the factory, its config and hooks, the request, the structured fault, the published
 * retry / correction / backoff vocabulary and its tuning constants. Stage modules are internal; specs import them by path.
 */
export * from './llm.dispatcher';
export * from './llm.dispatcher.config';
export * from './llm.dispatcher.pipeline';
export * from './llm.dispatch.fault';
export * from './llm.dispatch.request';
export * from './llm.retry.lever';
export type { LlmDispatchAttemptFault, LlmReplyRepairRefusal } from './llm.dispatch.attempt';
export { LLM_TRANSPORT_RETRY_AFTER_MAX_MS, LLM_TRANSPORT_RETRY_BASE_DELAY_MS, LLM_TRANSPORT_RETRY_MAX_DELAY_MS, llmTransportBackoffMs } from './llm.dispatch.control';
export type { LlmDispatchPauseSignal, LlmDispatchTransportBackoff, LlmDispatchTransportBackoffInput } from './llm.dispatch.control';
export { DEFAULT_LLM_DISPATCH_CORRECTION_TEXTS } from './llm.dispatch.correction';
export type { LlmCorrectionKind, LlmDispatchCorrectionTextOverrides, LlmDispatchCorrectionTexts, LlmPromptCorrectionSegmentOrigin } from './llm.dispatch.correction';
export { LLM_DECIDE_STAMP_SWALLOW_SITE } from './llm.dispatch.decision';
export type { LlmPromptDecisionSegmentOrigin } from './llm.dispatch.decision';
export { DEFAULT_LLM_DISPATCH_MAX_ATTEMPTS } from './llm.dispatch.run';
