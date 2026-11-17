import { type LlmProviderStatusProviderId, type LlmStrategyId } from '@dereekb/llm';
import { type WebsiteUrlWithPrefix } from '@dereekb/util';

/**
 * The ZenMux metering id — the `providerId` every status and bill from this entry carries, and the `metering` value a
 * provider declares to bill the ZenMux account.
 */
export const ZENMUX_PROVIDER_ID: LlmProviderStatusProviderId = 'zenmux';

/**
 * The ZenMux decision route — the `decision` value a provider declares to serve decisions through ZenMux's
 * `POST /systemone`. Declared, never derived from a transport: an OpenAI-transport provider is not on ZenMux by default.
 */
export const ZENMUX_DECISION_ROUTE: LlmStrategyId = 'zenmux';

/**
 * The ZenMux API base URL — the inference origin, which the account endpoints (`/management/…`) and the decision route
 * (`/systemone`) also hang off.
 */
export const DEFAULT_ZENMUX_BASE_URL: WebsiteUrlWithPrefix = 'https://zenmux.ai/api/v1';

/**
 * The conventional env var NAME for the ZenMux **Management API Key** — the third credential, beside the subscription and
 * pay-as-you-go inference keys, and the only one the account endpoints accept.
 *
 * A LABEL only: this entry never reads the environment. The host resolves the key and passes the value in, and this name is
 * what a missing-key report tells an operator to set when the host names no other.
 */
export const ZENMUX_MANAGEMENT_API_KEY_ENV = 'ZENMUX_MANAGEMENT_API_KEY';
