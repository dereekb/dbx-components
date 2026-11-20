/**
 * Which URLs are ZenMux, and what a ZenMux provider's synchronous cost means. Whether a PROVIDER is on the ZenMux account
 * (and so its cost basis) is answered by the core `resolveLlmProviderAccount` with the ZenMux adapters registered, whose
 * metering adapter reads {@link isLlmZenmuxBaseUrl}; the account reads and the credential probe use {@link resolveLlmZenmuxAccountBaseUrl}.
 */

import { type LlmCostBasis } from '@dereekb/llm';
import { isWebsiteUrlOnDomain, type Maybe, type WebsiteUrlWithPrefix, type WebsiteUrl } from '@dereekb/util';
import { DEFAULT_LLM_ZENMUX_BASE_URL } from './zenmux.constants';

/**
 * The host that identifies a base URL as ZenMux.
 */
export const LLM_ZENMUX_HOST = 'zenmux.ai';

/**
 * What ZenMux's SYNCHRONOUS `usage.cost` is: the pre-discount LIST (origin) amount, not the bill ({@link LlmCostBasis}).
 *
 * Every completion carries it (a numeric string, with `cost_details`). Measured 2026-10-21 against `management/generation`'s
 * `ratingResponses.billAmount` over 406 calls: 14 of 17 slugs billed exactly that figure, and three
 * (`deepseek/deepseek-v4.1-flash`, `google/gemini-3.8-flash`, `google/gemini-4-argon`) billed exactly half
 * (`discountAmount = originAmount / 2`). Every provider metered by ZenMux reports its cost with this basis, so a reader should
 * treat the figure as an upper bound instead of a measured bill.
 */
export const LLM_ZENMUX_SYNC_COST_BASIS: LlmCostBasis = 'list';

/**
 * Whether a base URL points at ZenMux — the inference for a provider that declared no `metering`.
 *
 * Parsed rather than substring-matched, so a look-alike host (`zenmux.ai.example.com`) does not qualify, while a regional
 * subdomain (`eu.zenmux.ai`) does. Tolerant of a malformed URL: an unparseable value is simply not ZenMux, never a throw.
 *
 * @param baseUrl - The provider's effective base URL.
 * @returns True when the URL is a ZenMux origin.
 */
export function isLlmZenmuxBaseUrl(baseUrl: Maybe<WebsiteUrl>): boolean {
  // Swallow site `llm/zenmux-account.base-url`, now inside `@dereekb/util`'s `isWebsiteUrlOnDomain`. An unparseable base URL
  // is a configuration problem the transport itself will report; for THIS question it simply is not ZenMux. Never a throw —
  // a host asks this while assembling a strategy.
  return isWebsiteUrlOnDomain(baseUrl, LLM_ZENMUX_HOST);
}

/**
 * The base URL the ZenMux ACCOUNT endpoints (quota status, bills) are read from for a provider.
 *
 * A ZenMux URL, a regional subdomain included, keeps its own host. Any other URL resolves to {@link DEFAULT_LLM_ZENMUX_BASE_URL}:
 * a provider DECLARED `metering: 'zenmux'` behind a non-ZenMux URL (a LAN proxy) still bills the ZenMux account, and that
 * account's `/management` routes live at ZenMux, not at the proxy.
 *
 * @param baseUrl - The provider's effective base URL.
 * @returns The base URL to read the account from.
 */
export function resolveLlmZenmuxAccountBaseUrl(baseUrl: Maybe<WebsiteUrl>): WebsiteUrlWithPrefix {
  return baseUrl != null && isLlmZenmuxBaseUrl(baseUrl) ? baseUrl : DEFAULT_LLM_ZENMUX_BASE_URL;
}
