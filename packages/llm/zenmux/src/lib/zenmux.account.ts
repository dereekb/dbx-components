/**
 * Which URLs and providers are ZenMux, and what a ZenMux provider's synchronous cost means — the ONE place that answers
 * "is this provider on the ZenMux account?", so the cost basis, the account reads and the credential probe can never
 * disagree about which gateway a provider is on.
 */

import { type LlmCostBasis, type LlmProviderStatusProviderId } from '@dereekb/llm';
import { isNotBlankString, type Maybe } from '@dereekb/util';
import { DEFAULT_ZENMUX_BASE_URL, ZENMUX_PROVIDER_ID } from './zenmux.constants';

/**
 * The host that identifies a base URL as ZenMux.
 */
export const ZENMUX_HOST = 'zenmux.ai';

/**
 * What ZenMux's SYNCHRONOUS `usage.cost` is: the pre-discount LIST (origin) amount, not the bill ({@link LlmCostBasis}).
 *
 * Every completion carries it (a numeric string, with `cost_details`). Measured 2026-10-21 against `management/generation`'s
 * `ratingResponses.billAmount` over 406 calls: 14 of 17 slugs billed exactly that figure, and three
 * (`deepseek/deepseek-v4.1-flash`, `google/gemini-3.8-flash`, `google/gemini-4-argon`) billed exactly half
 * (`discountAmount = originAmount / 2`). Every provider metered by ZenMux reports its cost with this basis, so a reader should
 * treat the figure as an upper bound instead of a measured bill.
 */
export const ZENMUX_SYNC_COST_BASIS: LlmCostBasis = 'list';

/**
 * Whether a base URL points at ZenMux — the inference for a provider that declared no `metering`.
 *
 * Parsed rather than substring-matched, so a look-alike host (`zenmux.ai.example.com`) does not qualify, while a regional
 * subdomain (`eu.zenmux.ai`) does. Tolerant of a malformed URL: an unparseable value is simply not ZenMux, never a throw.
 *
 * @param baseUrl - The provider's effective base URL.
 * @returns True when the URL is a ZenMux origin.
 */
export function isZenmuxBaseUrl(baseUrl: Maybe<string>): boolean {
  let zenmux = false;

  if (isNotBlankString(baseUrl)) {
    try {
      const { hostname } = new URL(baseUrl);
      zenmux = hostname === ZENMUX_HOST || hostname.endsWith(`.${ZENMUX_HOST}`);
    } catch {
      // Swallow site `llm/zenmux-account.base-url`. An unparseable base URL is a configuration problem the transport itself
      // will report; for THIS question it simply is not ZenMux. Never a throw — a host asks this while assembling a strategy.
      zenmux = false;
    }
  }

  return zenmux;
}

/**
 * The two provider facts the ZenMux metering decision reads.
 */
export interface ZenmuxMeteringInput {
  /**
   * The provider's DECLARED metering id, absent when it declared none.
   */
  readonly metering?: Maybe<LlmProviderStatusProviderId>;
  /**
   * The provider's EFFECTIVE base URL — its own `baseUrl`, else its transport's default.
   */
  readonly baseUrl: Maybe<string>;
}

/**
 * Whether a provider is METERED BY ZenMux. A DECLARED `metering` wins (`'zenmux'` ⇒ yes; anything else ⇒ no), and only a
 * provider that declared none falls back to its base URL ({@link isZenmuxBaseUrl}).
 *
 * @param input - The provider's declared metering and its effective base URL.
 * @returns True when the provider bills the ZenMux account.
 */
export function isZenmuxMeteredProvider(input: ZenmuxMeteringInput): boolean {
  return input.metering == null ? isZenmuxBaseUrl(input.baseUrl) : input.metering === ZENMUX_PROVIDER_ID;
}

/**
 * The {@link LlmCostBasis} a provider's synchronous cost carries — {@link ZENMUX_SYNC_COST_BASIS} when the provider is
 * metered by ZenMux ({@link isZenmuxMeteredProvider}), else `undefined` (the figure is the bill).
 *
 * The registry-free form of `resolveLlmProviderAccount(…).costBasis` with the ZenMux adapters registered: the same two facts,
 * read in the same order, so the cost a provider reports and the account it reads agree.
 *
 * @param input - The provider's declared metering and its effective base URL.
 * @returns The cost basis, or `undefined` when the provider's figure is the bill.
 */
export function zenmuxCostBasisFor(input: ZenmuxMeteringInput): Maybe<LlmCostBasis> {
  return isZenmuxMeteredProvider(input) ? ZENMUX_SYNC_COST_BASIS : undefined;
}

/**
 * The base URL the ZenMux ACCOUNT endpoints (quota status, bills) are read from for a provider.
 *
 * A ZenMux URL, a regional subdomain included, keeps its own host. Any other URL resolves to {@link DEFAULT_ZENMUX_BASE_URL}:
 * a provider DECLARED `metering: 'zenmux'` behind a non-ZenMux URL (a LAN proxy) still bills the ZenMux account, and that
 * account's `/management` routes live at ZenMux, not at the proxy.
 *
 * @param baseUrl - The provider's effective base URL.
 * @returns The base URL to read the account from.
 */
export function zenmuxAccountBaseUrlOf(baseUrl: Maybe<string>): string {
  return baseUrl != null && isZenmuxBaseUrl(baseUrl) ? baseUrl : DEFAULT_ZENMUX_BASE_URL;
}
