import { makeLlmSwallowSiteRegistry, type LlmSwallowSiteRegistry } from '@dereekb/llm';

/**
 * The swallow sites whose code is in `@dereekb/llm/node` — the audit table a host merges beside the root's:
 *
 * ```ts
 * makeLlmSwallowSiteRegistry([...Object.values(LLM_SWALLOW_SITES), ...Object.values(LLM_NODE_SWALLOW_SITES)]);
 * ```
 */
export const LLM_NODE_SWALLOW_SITES: LlmSwallowSiteRegistry = makeLlmSwallowSiteRegistry([
  // `loadLlmCraftNotes` — the folder read's catch.
  { id: 'llm/craft-notes.folder-read', protects: 'an unreadable craft-notes folder loads as no notes and names the folder in a warning; the host still boots', onError: 'degrade', expectation: 'degraded', channel: 'warn' }
]);
