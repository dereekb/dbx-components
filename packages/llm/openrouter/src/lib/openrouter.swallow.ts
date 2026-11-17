import { makeLlmSwallowSiteRegistry, type LlmSwallowSiteRegistry } from '@dereekb/llm';

/**
 * The swallow sites whose code is in `@dereekb/llm/openrouter`. Each is health-channel: the verdict carries the
 * failure, so no sink is called. A host registers them beside the root's:
 *
 * ```ts
 * makeLlmSwallowSiteRegistry([...Object.values(LLM_SWALLOW_SITES), ...Object.values(LLM_OPENROUTER_SWALLOW_SITES), …]);
 * ```
 */
export const LLM_OPENROUTER_SWALLOW_SITES: LlmSwallowSiteRegistry = makeLlmSwallowSiteRegistry([
  // `makeLlmOpenRouterStrategy`'s healthCheck — the verdict carries the construction failure.
  { id: 'llm/openrouter-strategy.client', protects: 'a client that cannot be constructed reports unready rather than throwing out of a health check', onError: 'report', expectation: 'fault', channel: 'health' },
  // `makeLlmOpenRouterDecisionStrategy`'s healthCheck — the verdict carries the construction failure.
  { id: 'llm/openrouter-decision.client', protects: 'a decisions client that cannot be constructed reports unready rather than throwing out of a health check', onError: 'report', expectation: 'fault', channel: 'health' }
]);
