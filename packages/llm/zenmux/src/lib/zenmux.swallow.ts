import { makeLlmSwallowSiteRegistry, type LlmSwallowSiteRegistry } from '@dereekb/llm';

/**
 * The swallow sites whose code is in `@dereekb/llm/zenmux`. None calls a sink — the status, bill or base-URL verdict carries
 * the failure — so this is the audit table a host merges beside the root's:
 *
 * ```ts
 * makeLlmSwallowSiteRegistry([...Object.values(LLM_SWALLOW_SITES), ...Object.values(ZENMUX_SWALLOW_SITES)]);
 * ```
 */
export const ZENMUX_SWALLOW_SITES: LlmSwallowSiteRegistry = makeLlmSwallowSiteRegistry([
  // `isZenmuxBaseUrl` — the URL parse.
  { id: 'llm/zenmux-account.base-url', protects: 'an unparseable base URL is simply "not ZenMux"; this is asked while a host ASSEMBLES a strategy, so it must never throw', onError: 'degrade', expectation: 'expected', channel: 'health' },
  // `makeZenmuxProviderStatusSource` — one account read's outer catch.
  { id: 'llm/zenmux-provider-status.transport', protects: 'an unreachable account endpoint reports an unavailable status rather than throwing out of the gate that asked; the quota gate then FAILS OPEN', onError: 'report', expectation: 'degraded', channel: 'health' },
  // `makeZenmuxProviderStatusSource` — the envelope `JSON.parse`.
  { id: 'llm/zenmux-provider-status.envelope', protects: 'a 200 carrying a non-JSON body (a proxy error page) degrades to a per-endpoint issue; the other endpoints still report', onError: 'degrade', expectation: 'expected', channel: 'health' },
  // `makeZenmuxGenerationBillReader` — the read's outer catch.
  { id: 'llm/zenmux-generation-bill.transport', protects: 'an unreachable bill endpoint reads as a FAILED bill rather than throwing out of a reconcile', onError: 'report', expectation: 'degraded', channel: 'result' },
  // `makeZenmuxGenerationBillReader` — the envelope `JSON.parse`.
  { id: 'llm/zenmux-generation-bill.envelope', protects: 'a 200 carrying a non-JSON body (a proxy page) reads as a FAILED bill', onError: 'report', expectation: 'degraded', channel: 'result' }
]);
