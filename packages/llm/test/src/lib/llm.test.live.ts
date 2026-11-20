/**
 * The live lane's handle types and its auth-failure decoration — the pieces a billed spec holds once
 * `makeLlmLiveLane(...)` resolved a provider. Standalone so a host that builds its own live strategy can still decorate
 * it and bind it.
 */

import { readErrorMessage, type Maybe } from '@dereekb/util';
import { type LlmCompleteOptions, type LlmCompletion, type LlmDecisionStrategy, type LlmModelId, type LlmRequest, type LlmStrategy, type LlmStrategyId, type LlmStrategyRegistry, makeLlmStrategyRegistry } from '@dereekb/llm';

/**
 * What a live spec needs to bill a real provider.
 */
export interface LlmLiveStrategyFromEnv {
  /**
   * The provider id the lane bills — surfaced so a spec can name it in its describe title.
   */
  readonly strategyId: LlmStrategyId;
  /**
   * The model slug the run bills.
   */
  readonly model: LlmModelId;
  /**
   * The NAME of the variable that supplied the key — named in skip and failure messages, never the key itself.
   */
  readonly apiKeyEnv: string;
  /**
   * The effective base URL of the provider.
   */
  readonly baseUrl?: Maybe<string>;
  /**
   * Build a FRESH decorated strategy instance. Per call rather than shared: a fresh instance keeps each block's client
   * cache its own.
   *
   * @returns A new strategy for the resolved provider.
   */
  makeStrategy(): LlmStrategy;
}

/**
 * The registry + default-strategy pair a dispatcher needs to actually ROUTE at the live provider — both, together, or
 * neither. A spec that registered a one-off registry but left the default id alone would route elsewhere.
 */
export interface LlmLiveStrategyBinding {
  /**
   * A one-off registry holding just the live strategy.
   */
  readonly strategies: LlmStrategyRegistry;
  /**
   * The id a model-less dispatch routes to — the registered strategy's OWN id.
   */
  readonly defaultStrategyId: LlmStrategyId;
}

/**
 * Bind a strategy for routing. The id comes from the INSTANCE (not a re-resolution of the environment), so a wrapper —
 * a counting decorator, say — is routed to under whatever id it presents.
 *
 * @param strategy - The live (or wrapped) strategy.
 * @returns The registry + the default strategy id, ready to spread into a dispatcher config.
 */
export function toLlmLiveStrategyBinding(strategy: LlmStrategy): LlmLiveStrategyBinding {
  return { strategies: makeLlmStrategyRegistry([strategy]), defaultStrategyId: strategy.id };
}

/**
 * The live DECISION backend a billed decision spec uses — the decision-lane twin of {@link LlmLiveStrategyFromEnv}.
 */
export interface LlmLiveDecisionStrategyFromEnv {
  /**
   * The provider instance that serves it — named in a spec's printout.
   */
  readonly strategyId: LlmStrategyId;
  /**
   * The decision strategy itself.
   */
  readonly strategy: LlmDecisionStrategy;
}

/**
 * Config for {@link decorateLlmLiveStrategyAuthFailures}.
 */
export interface DecorateLlmLiveStrategyAuthFailuresConfig {
  /**
   * The live strategy to decorate.
   */
  readonly strategy: LlmStrategy;
  /**
   * The provider id named in the message.
   */
  readonly providerId: LlmStrategyId;
  /**
   * The NAME of the variable holding the key.
   */
  readonly apiKeyEnv: string;
  /**
   * The provider's effective base URL.
   */
  readonly baseUrl?: Maybe<string>;
  /**
   * The model the lane bills; falls back to the request's model.
   */
  readonly model?: Maybe<LlmModelId>;
  /**
   * The default-provider selection variable, named in the hint.
   */
  readonly selectEnv?: Maybe<string>;
  /**
   * The message prefix; defaults to `llm`.
   */
  readonly label?: Maybe<string>;
}

/**
 * Whether a thrown value is a provider AUTH rejection (`401` / `403`). Deliberately NARROW: the status is read off the
 * thrown value first, and the message fallback requires BOTH a 40x token AND an auth-shaped phrase. A mis-detected error
 * that gets rewritten is worse than one that passes through.
 *
 * @param error - The thrown value.
 * @returns Whether it reads as an auth rejection.
 */
function isLlmAuthFailure(error: unknown): boolean {
  const status = (error as Maybe<{ readonly status?: unknown }>)?.status;
  const message = error instanceof Error ? error.message : '';
  return status === 401 || status === 403 || (/\b40[13]\b/.test(message) && /unauthor|invalid api key|user not found|no auth credentials/i.test(message));
}

/**
 * Wrap a live strategy so an AUTH failure names the variable that supplied the credential.
 *
 * A setup probe cannot cover every window — a key revoked mid-run, a gateway that does not implement the probe endpoint
 * (reported ready), a run with the probe skipped, a spec driven outside the configured runner. In all of them the
 * operator's evidence would otherwise be a wall of identical `401` traces naming no variable to rotate.
 *
 * Not a swallow: every error is rethrown, an auth one re-dressed with `cause` set so the original stays reachable, any
 * other one untouched. The key itself is never printed — only the NAME of the variable holding it. Every other member
 * of the strategy is spread through unchanged (`id` is load-bearing for {@link toLlmLiveStrategyBinding}).
 *
 * @param config - The strategy and what to name in the message.
 * @returns A strategy identical to the input except that an auth failure carries the operator's next step.
 */
export function decorateLlmLiveStrategyAuthFailures(config: DecorateLlmLiveStrategyAuthFailuresConfig): LlmStrategy {
  const { strategy, providerId, apiKeyEnv, baseUrl, model, selectEnv } = config;
  const label = config.label ?? 'llm';

  return {
    ...strategy,
    async complete(request: LlmRequest, options?: LlmCompleteOptions): Promise<LlmCompletion> {
      let result: LlmCompletion;

      try {
        result = await strategy.complete(request, options);
      } catch (error) {
        if (isLlmAuthFailure(error)) {
          const message = readErrorMessage(error);
          const hint = selectEnv == null ? '' : ` (or repoint ${selectEnv} / ${apiKeyEnv})`;
          throw new Error(`${label} live spec: the '${providerId}' provider at ${baseUrl ?? 'its default endpoint'} REJECTED the credential from ${apiKeyEnv} while calling ${model ?? request.model ?? 'its default model'}. The provider said: ${message}. Rotate that key${hint}.`, { cause: error });
        }

        throw error;
      }

      return result;
    }
  };
}
