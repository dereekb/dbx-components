/**
 * The readiness aggregators over an {@link LlmDecisionStrategyRegistry} — the decision lane's siblings of
 * `verifyLlmStrategies` / `probeLlmCredentials`, so a host gates launch on its decision backends with one call per
 * seam instead of a hand-rolled loop.
 *
 * - {@link verifyLlmDecisionStrategies} — `healthCheck` (no network). Throws when a required decision strategy is
 *   missing or not ready; the startup gate.
 * - {@link probeLlmDecisionCredentials} — `credentialProbe` (one free authenticated request each). Reports, never
 *   throws.
 *
 * Both delegate to the completion aggregators (a decision strategy declares the same two seams with the same
 * `LlmStrategyHealth` verdict), so the per-strategy verdict logic lives once and the reports share one shape,
 * {@link LlmStrategiesHealthReport}. Only the wording differs: issues and errors name a "decision strategy".
 */

import { type LlmReadinessLane, type LlmStrategiesHealthReport, probeLlmCredentials, type ProbeLlmCredentialsConfig, verifyLlmStrategies, type VerifyLlmStrategiesConfig } from '../strategy/llm.strategy.readiness';
import { type LlmDecisionStrategyRegistry } from './llm.decision.strategy';

/**
 * The decision lane's wording for the readiness aggregators.
 */
export const LLM_DECISION_STRATEGY_READINESS_LANE: LlmReadinessLane = { singular: 'LLM decision strategy', plural: 'LLM decision strategies' };

/**
 * Config for {@link verifyLlmDecisionStrategies} — `VerifyLlmStrategiesConfig` over a decision registry, with the
 * lane wording fixed.
 */
export interface VerifyLlmDecisionStrategiesConfig extends Omit<VerifyLlmStrategiesConfig, 'strategies' | 'lane'> {
  /**
   * The decision registry to check. REQUIRED, for the completion aggregator's reason: a verify that silently checked
   * an empty table would report a keyless host as ready.
   */
  readonly strategies: LlmDecisionStrategyRegistry;
}

/**
 * Run each REQUIRED decision strategy's `LlmDecisionStrategy.healthCheck` and throw ONE aggregated error when any is
 * missing or not ready — `verifyLlmStrategies` over the decision lane, with the same contract: a strategy with no
 * healthCheck is ready, a contract-violating throw is recorded rather than propagated raw, `onReport` sees the full
 * report before any throw, and an empty required set touches nothing.
 *
 * @param config - The decision registry, the required ids, and an optional report hook.
 * @returns The aggregated readiness report (on success).
 */
export function verifyLlmDecisionStrategies(config: VerifyLlmDecisionStrategiesConfig): Promise<LlmStrategiesHealthReport> {
  return verifyLlmStrategies({ ...config, lane: LLM_DECISION_STRATEGY_READINESS_LANE });
}

/**
 * Config for {@link probeLlmDecisionCredentials} — `ProbeLlmCredentialsConfig` over a decision registry, with the
 * lane wording fixed.
 */
export interface ProbeLlmDecisionCredentialsConfig extends Omit<ProbeLlmCredentialsConfig, 'strategies' | 'lane'> {
  /**
   * The decision registry to probe. REQUIRED, for {@link VerifyLlmDecisionStrategiesConfig.strategies}' reason.
   */
  readonly strategies: LlmDecisionStrategyRegistry;
}

/**
 * Run each named decision strategy's `LlmDecisionStrategy.credentialProbe` and aggregate the verdicts —
 * `probeLlmCredentials` over the decision lane. Makes real (free) network round-trips, and NEVER throws: an
 * unregistered id reports `ready:false`, a strategy with no probe is ready, and a contract-violating throw is
 * recorded as an error issue.
 *
 * @param config - The decision registry, the ids to probe, and optional cancellation / report hook.
 * @returns The aggregated credential report.
 */
export function probeLlmDecisionCredentials(config: ProbeLlmDecisionCredentialsConfig): Promise<LlmStrategiesHealthReport> {
  return probeLlmCredentials({ ...config, lane: LLM_DECISION_STRATEGY_READINESS_LANE });
}
