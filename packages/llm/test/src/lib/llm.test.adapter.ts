/**
 * **Completion-adapter fake** — a stand-in `LlmCompletionAdapter` for specs that exercise adapter registries and
 * provider resolution without building a real transport. It records every config it is asked to `make` a strategy from;
 * the strategies it mints never complete (a `complete` call is counted, then rejects).
 */

import { type Maybe, type WebsiteUrlWithPrefix } from '@dereekb/util';
import { type LlmAdapterKind, type LlmCompletionAdapter, type LlmCompletionAdapterConfig, type LlmStrategyId } from '@dereekb/llm';

/**
 * Configures a {@link makeLlmCompletionAdapterFake} fake.
 */
export interface LlmCompletionAdapterFakeConfig {
  /**
   * The transport kind the adapter claims (e.g. `'openai'`).
   */
  readonly kind: LlmAdapterKind;
  /**
   * The base URL the adapter declares as its default, if any.
   */
  readonly defaultBaseUrl?: Maybe<WebsiteUrlWithPrefix>;
  /**
   * The id every minted strategy carries. Defaults to the configured provider's id.
   */
  readonly mintId?: Maybe<LlmStrategyId>;
}

/**
 * Counts what the minted strategies were asked to do.
 */
export interface LlmCompletionAdapterFakeCalls {
  /**
   * How many times any minted strategy's `complete` was called.
   */
  complete: number;
}

/**
 * A fake: the adapter plus what it received.
 */
export interface LlmCompletionAdapterFake {
  readonly adapter: LlmCompletionAdapter;
  /**
   * Every config the adapter was asked to `make` a strategy from, in order.
   */
  readonly received: LlmCompletionAdapterConfig[];
  readonly calls: LlmCompletionAdapterFakeCalls;
}

/**
 * **Build a completion-adapter fake.** Each `make` records its config and mints a strategy under `mintId` (default: the
 * provider's id) whose `describe` names the kind and base URL, whose `complete` counts the call and rejects
 * `'not called'`, and which passes the config's `credentialProbe` through.
 *
 * @param config - The kind, default base URL and minted id.
 * @returns The adapter and its recordings.
 *
 * @example
 * ```ts
 * const openai = makeLlmCompletionAdapterFake({ kind: 'openai', defaultBaseUrl: 'https://api.openai.com/v1' });
 * const adapters = makeLlmAdapterRegistry([openai.adapter]);
 * makeLlmProviderStrategy({ provider, adapters });
 * openai.received[0]?.baseUrl;
 * ```
 */
export function makeLlmCompletionAdapterFake(config: LlmCompletionAdapterFakeConfig): LlmCompletionAdapterFake {
  const { kind, defaultBaseUrl, mintId } = config;
  const received: LlmCompletionAdapterConfig[] = [];
  const calls: LlmCompletionAdapterFakeCalls = { complete: 0 };
  const adapter: LlmCompletionAdapter = {
    facet: 'completion',
    kind,
    ...(defaultBaseUrl == null ? {} : { defaultBaseUrl }),
    make: (adapterConfig) => {
      received.push(adapterConfig);
      return {
        id: mintId ?? adapterConfig.provider.id,
        kind,
        describe: `${kind} at ${adapterConfig.baseUrl ?? '(default)'}`,
        caching: 'none',
        complete: () => {
          calls.complete += 1;
          return Promise.reject(new Error('not called'));
        },
        ...(adapterConfig.credentialProbe == null ? {} : { credentialProbe: adapterConfig.credentialProbe })
      };
    }
  };

  return { adapter, received, calls };
}
