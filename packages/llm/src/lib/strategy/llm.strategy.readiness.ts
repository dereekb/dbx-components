/**
 * The readiness aggregators over a strategy registry of either lane ({@link LlmStrategyRegistry}): run one optional
 * seam across a set of required strategies and report.
 *
 * - {@link verifyLlmStrategies} — `healthCheck` (no network). Throws when a required strategy is missing or not
 *   ready; the startup gate.
 * - {@link probeLlmCredentials} — `credentialProbe` (one free authenticated request each). Reports, never throws.
 * - {@link readLlmProviderStatus} — `providerStatus` (account windows and balance, one read per account). Reports,
 *   never throws.
 *
 * The first two read any registry of {@link LlmStrategyBase}s, so they serve either lane: a host gates its decision
 * backends with the same call, passing `lane: LLM_DECISION_STRATEGY_READINESS_LANE` (from `/decision`) to word the
 * report for decision strategies. This module never imports the decision contract.
 *
 * And the quota gate, {@link evaluateLlmQuotaGate}, which draws the throttle line over a provider-status report.
 */

import { errorMessageOf, type Maybe, type PercentDecimal, runAsyncTasksForValues } from '@dereekb/util';
import { type LlmStrategyId } from '../model/llm.value';
import { type LlmProviderStatus, type LlmProviderStatusProviderId, type LlmQuotaWindow, tightestLlmQuotaWindow } from './llm.provider.status';
import { type LlmCredentialProbeOptions, type LlmStrategyBase } from './llm.strategy';
import { type LlmStrategyHealth } from './llm.strategy.health';
import { type LlmStrategyRegistry } from './llm.strategy.registry';

/**
 * Per-strategy entry in the aggregated readiness report.
 */
export interface LlmStrategyHealthReport {
  /**
   * The required strategy id this entry reports on.
   */
  readonly id: LlmStrategyId;
  /**
   * `false` ⇒ the id was not registered (a hard, not-ready failure synthesized by the aggregator).
   */
  readonly registered: boolean;
  /**
   * The strategy's readiness verdict (synthesized as `ready:false` when unregistered or its healthCheck threw).
   */
  readonly health: LlmStrategyHealth;
}

/**
 * The aggregated readiness report across the checked (required) ids.
 */
export interface LlmStrategiesHealthReport {
  /**
   * `true` ⇒ every checked strategy is `ready` (so a host may serve). Always `true` for an empty required set.
   */
  readonly ready: boolean;
  /**
   * One entry per required id, in input order.
   */
  readonly checked: ReadonlyArray<LlmStrategyHealthReport>;
}

/**
 * The read side of a strategy registry the readiness aggregators need: the id lookup over {@link LlmStrategyBase}s,
 * which carries both readiness seams. A registry of either lane satisfies it — {@link LlmStrategyRegistry} and the
 * decision lane's `LlmDecisionStrategyRegistry` alike.
 */
export type LlmReadinessStrategyRegistry = Pick<LlmStrategyRegistry<LlmStrategyBase>, 'get'>;

/**
 * The wording a readiness aggregator uses for the strategies it checks, in the issues it synthesizes and the error
 * it throws.
 */
export interface LlmReadinessLane {
  /**
   * One strategy of this lane — `'LLM strategy'`.
   */
  readonly singular: string;
  /**
   * Several strategies of this lane — `'LLM strategies'`.
   */
  readonly plural: string;
}

/**
 * The completion lane's wording, and the default {@link VerifyLlmStrategiesConfig.lane}.
 */
export const LLM_STRATEGY_READINESS_LANE: LlmReadinessLane = { singular: 'LLM strategy', plural: 'LLM strategies' };

/**
 * Config for {@link verifyLlmStrategies}.
 */
export interface VerifyLlmStrategiesConfig {
  /**
   * The registry to check. REQUIRED: there is no shared default to fall back to, and a verify that silently
   * checked an empty table would report a keyless host as ready.
   *
   * Any registry of {@link LlmStrategyBase}s, so a decision registry is accepted too; pass
   * `lane: LLM_DECISION_STRATEGY_READINESS_LANE` (from `/decision`) to word the report for decision strategies.
   */
  readonly strategies: LlmReadinessStrategyRegistry;
  /**
   * The ids that MUST be ready. Empty ⇒ no-op (resolves a ready, empty report; touches no strategy).
   */
  readonly required: ReadonlyArray<LlmStrategyId>;
  /**
   * The wording for the synthesized issues and the thrown error. Defaults to {@link LLM_STRATEGY_READINESS_LANE}.
   */
  readonly lane?: LlmReadinessLane;
  /**
   * Optional hook handed the FULL report (errors + warnings) BEFORE any throw — for host-side logging.
   *
   * @param report - The aggregated readiness report.
   */
  readonly onReport?: (report: LlmStrategiesHealthReport) => void;
}

/**
 * One readiness seam, as {@link checkLlmReadinessSeam} runs it.
 */
interface LlmReadinessSeamCheck {
  /**
   * The seam's member name, quoted when a contract-violating call throws.
   */
  readonly name: 'healthCheck' | 'credentialProbe';
  /**
   * Run the seam on one strategy, as a method call.
   *
   * @param strategy - The registered strategy.
   * @returns The pending verdict, or `undefined` when the strategy does not declare the seam.
   */
  readonly run: (strategy: LlmStrategyBase) => Maybe<Promise<LlmStrategyHealth>>;
}

/**
 * Config for {@link checkLlmReadinessSeam}.
 */
interface CheckLlmReadinessSeamConfig {
  readonly strategies: LlmReadinessStrategyRegistry;
  readonly required: ReadonlyArray<LlmStrategyId>;
  readonly lane: LlmReadinessLane;
  readonly seam: LlmReadinessSeamCheck;
}

/**
 * The per-strategy verdict logic both aggregators share, in required-id order: an unregistered id is a synthesized
 * `ready:false`, a strategy without the seam is ready (the seam is opt-in), and a contract-violating throw is caught
 * and recorded as an error issue (never propagated raw).
 *
 * @param config - The registry, the required ids, the lane wording and the seam to run.
 * @returns One report entry per required id.
 */
async function checkLlmReadinessSeam(config: CheckLlmReadinessSeamConfig): Promise<ReadonlyArray<LlmStrategyHealthReport>> {
  const { strategies, required, lane, seam } = config;

  async function checkOne(id: LlmStrategyId): Promise<LlmStrategyHealthReport> {
    const strategy = strategies.get(id);
    let entry: LlmStrategyHealthReport;

    if (strategy == null) {
      entry = { id, registered: false, health: { ready: false, issues: [{ severity: 'error', message: `no ${lane.singular} registered for '${id}'` }] } };
    } else {
      let health: LlmStrategyHealth;

      try {
        const pending = seam.run(strategy);
        health = pending == null ? { ready: true, issues: [] } : await pending;
      } catch (error) {
        // The contract says neither seam throws; be robust anyway and record the violation as an error. The verdict
        // IS the report, so a caller sees the violation instead of a raw rejection.
        health = { ready: false, issues: [{ severity: 'error', message: `${seam.name} threw: ${errorMessageOf(error)}` }] };
      }

      entry = { id, registered: true, health };
    }

    return entry;
  }

  // Sequential: one probe (one network round-trip) at a time, results in required-id order. checkOne never rejects.
  return runAsyncTasksForValues([...required], checkOne, { sequential: true });
}

/**
 * Run each REQUIRED strategy's `LlmStrategyBase.healthCheck` and FAIL LOUDLY (throw one aggregated error)
 * when any required backend is missing or not ready — a startup gate, instead of a lazy throw mid-run.
 * A required id that is unregistered, or whose healthCheck returns `ready:false`, blocks; a strategy with no
 * healthCheck is treated as ready (the seam is opt-in). Defensive: a contract-violating healthCheck throw is
 * caught and recorded as an error issue (never propagated raw). `onReport` (if given) sees the full report —
 * including warnings on ready strategies — on BOTH paths, before any throw. An empty required set is a true
 * no-op (no strategy touched) ⇒ resolves `{ ready: true, checked: [] }`.
 *
 * @param config - The registry, required ids, optional lane wording, and optional report hook.
 * @returns The aggregated readiness report (on success).
 */
export async function verifyLlmStrategies(config: VerifyLlmStrategiesConfig): Promise<LlmStrategiesHealthReport> {
  const lane = config.lane ?? LLM_STRATEGY_READINESS_LANE;
  const checked = await checkLlmReadinessSeam({ strategies: config.strategies, required: config.required, lane, seam: { name: 'healthCheck', run: (strategy) => strategy.healthCheck?.() } });
  const ready = checked.every((entry) => entry.health.ready);
  const report: LlmStrategiesHealthReport = { ready, checked };
  config.onReport?.(report);

  if (!ready) {
    const lines = checked
      .filter((entry) => !entry.health.ready)
      .map(
        (entry) =>
          `  - ${entry.id}: ${entry.health.issues
            .filter((issue) => issue.severity === 'error')
            .map((issue) => issue.message)
            .join('; ')}`
      );
    const subject = checked.length === 1 ? `${lane.singular} is` : `${lane.plural} are`;
    throw new Error(`required ${subject} not ready:\n${lines.join('\n')}`);
  }

  return report;
}

/**
 * Config for {@link probeLlmCredentials}.
 */
export interface ProbeLlmCredentialsConfig {
  /**
   * The registry to probe. REQUIRED, for {@link VerifyLlmStrategiesConfig.strategies}' reason. Any registry of
   * {@link LlmStrategyBase}s, so a decision registry is accepted too (pass `lane: LLM_DECISION_STRATEGY_READINESS_LANE`).
   */
  readonly strategies: LlmReadinessStrategyRegistry;
  /**
   * The ids whose CREDENTIALS to verify. Empty ⇒ no-op (resolves a ready, empty report; opens no socket).
   */
  readonly required: ReadonlyArray<LlmStrategyId>;
  /**
   * The wording for the synthesized issues. Defaults to {@link LLM_STRATEGY_READINESS_LANE}.
   */
  readonly lane?: LlmReadinessLane;
  /**
   * An EXTERNAL cancellation signal threaded to every probe.
   */
  readonly signal?: AbortSignal;
  /**
   * Optional hook handed the FULL report — the logging seam, mirroring {@link VerifyLlmStrategiesConfig.onReport}.
   *
   * @param report - The aggregated credential report.
   */
  readonly onReport?: (report: LlmStrategiesHealthReport) => void;
}

/**
 * Run each named strategy's `LlmStrategyBase.credentialProbe` and aggregate the verdicts — the LIVE-credential
 * sibling of {@link verifyLlmStrategies}, in the same {@link LlmStrategiesHealthReport} shape.
 *
 * Two deliberate differences from `verifyLlmStrategies`:
 * - It makes REAL network round-trips (free, non-billable auth endpoints — never a completion). Callers opt in.
 * - It NEVER throws, on any path. It is a gate's evidence, not a gate: the caller decides whether an unready
 *   verdict refuses, warns, or is ignored.
 *
 * A required id that is unregistered reports `ready:false`; a strategy with no `credentialProbe` is treated as
 * ready (the seam is opt-in, exactly as with `healthCheck`).
 *
 * @param config - The registry, the ids to probe, optional lane wording, and optional cancellation / report hook.
 * @returns The aggregated credential report.
 */
export async function probeLlmCredentials(config: ProbeLlmCredentialsConfig): Promise<LlmStrategiesHealthReport> {
  const options: Maybe<LlmCredentialProbeOptions> = config.signal == null ? undefined : { signal: config.signal };
  const checked = await checkLlmReadinessSeam({ strategies: config.strategies, required: config.required, lane: config.lane ?? LLM_STRATEGY_READINESS_LANE, seam: { name: 'credentialProbe', run: (strategy) => strategy.credentialProbe?.(options) } });
  const report: LlmStrategiesHealthReport = { ready: checked.every((entry) => entry.health.ready), checked };
  config.onReport?.(report);
  return report;
}

/**
 * Render the blocking `'error'` issues of an unready {@link LlmStrategiesHealthReport} as one human line — the
 * shared message body a caller (a launch gate) puts behind its own refusal wording, so the provider's
 * own words reach the operator instead of a synthesized summary.
 *
 * @param report - The report to render.
 * @returns The joined error text (empty when the report is ready / carries no errors).
 */
export function llmCredentialReportErrorText(report: LlmStrategiesHealthReport): string {
  return report.checked
    .filter((entry) => !entry.health.ready)
    .flatMap((entry) => entry.health.issues.filter((issue) => issue.severity === 'error').map((issue) => `${entry.id}: ${issue.message}`))
    .join('; ');
}

/**
 * Config for {@link readLlmProviderStatus}.
 */
export interface ReadLlmProviderStatusConfig {
  /**
   * The registry to read. REQUIRED, for {@link VerifyLlmStrategiesConfig.strategies}' reason.
   */
  readonly strategies: LlmStrategyRegistry;
  /**
   * The ids whose ACCOUNT STATUS to read. Empty ⇒ no-op (resolves an empty report; opens no socket).
   */
  readonly required: ReadonlyArray<LlmStrategyId>;
  /**
   * An EXTERNAL cancellation signal threaded to every read.
   */
  readonly signal?: AbortSignal;
  /**
   * Optional hook handed the FULL report — the logging seam, mirroring {@link ProbeLlmCredentialsConfig.onReport}.
   *
   * @param report - The aggregated status report.
   */
  readonly onReport?: (report: LlmProviderStatusReport) => void;
}

/**
 * One strategy's entry in a {@link LlmProviderStatusReport}.
 */
export interface LlmProviderStatusEntry {
  /**
   * The strategy id this entry reports on.
   */
  readonly id: LlmStrategyId;
  /**
   * Whether the strategy IMPLEMENTS the metering seam at all. `false` ⇒ it declared no `providerStatus` (or was
   * unregistered), which is a statement about the BACKEND, not about the account — the distinction the
   * {@link LlmProviderStatus.available} flag cannot carry on its own.
   */
  readonly metered: boolean;
  /**
   * What the provider said, when {@link metered}.
   */
  readonly status?: LlmProviderStatus;
  /**
   * The OTHER instance whose read this entry is quoting — set when a preceding instance already asked the SAME
   * account, so this one carries its answer without having asked again.
   *
   * Two instances can be different transports onto one account: two instances on one gateway account differ only
   * in which inference key pays. Both are metered and both must appear here — an operator who bound a model to
   * one of them needs to see that instance named — but the account
   * behind them has one quota window, so reading it twice buys nothing and printing it twice invites the reader
   * to add two numbers that are the same number. A renderer collapses on this; a gate can ignore it (its reduce
   * takes the tightest window, and a duplicate of the tightest window is still the tightest window).
   */
  readonly sharedWithId?: LlmStrategyId;
}

/**
 * The aggregated account-status report — the {@link LlmStrategiesHealthReport} analogue for the metering axis.
 *
 * Deliberately NOT collapsed to a `ready` boolean. Readiness is a gate's conclusion, and different gates draw
 * different lines from the same numbers (a billed test lane refuses at a threshold; a status display never does).
 * So this reports FACTS and {@link evaluateLlmQuotaGate} draws the line.
 */
export interface LlmProviderStatusReport {
  /**
   * One entry per required id, in input order.
   */
  readonly checked: ReadonlyArray<LlmProviderStatusEntry>;
}

/**
 * Read each named strategy's `LlmStrategy.providerStatus` and aggregate — the metering sibling of
 * {@link probeLlmCredentials}, on the same contract: real network round-trips against free account endpoints,
 * opt-in, and NEVER throwing on any path.
 *
 * A strategy with no `providerStatus` is reported `metered: false` rather than as a failure (the seam is opt-in,
 * exactly as with `healthCheck` / `credentialProbe`), because a backend that meters nothing is a normal,
 * fully-supported configuration and must never look like a fault.
 *
 * @param config - The registry, the ids to read, and optional cancellation / report hook.
 * @returns The aggregated status report.
 */
export async function readLlmProviderStatus(config: ReadLlmProviderStatusConfig): Promise<LlmProviderStatusReport> {
  const registry = config.strategies;
  const options = config.signal == null ? undefined : { signal: config.signal };
  const checked: LlmProviderStatusEntry[] = [];
  // ONE read per ACCOUNT, not per instance. Keyed on the metering provider id the strategy exposes ahead of the
  // call (`LlmStrategy.providerStatusId`) — without that the duplication is only discoverable from the
  // answers, by which point the redundant round-trip has already been made.
  const readByAccount = new Map<LlmProviderStatusProviderId, { readonly id: LlmStrategyId; readonly status: LlmProviderStatus }>();

  for (const id of config.required) {
    const strategy = registry.get(id);
    let entry: LlmProviderStatusEntry;

    if (strategy?.providerStatus == null) {
      entry = { id, metered: false };
    } else {
      const account = strategy.providerStatusId;
      const already = account == null ? undefined : readByAccount.get(account);

      if (already == null) {
        let status: LlmProviderStatus;

        try {
          status = await strategy.providerStatus(options);
        } catch (error) {
          // The contract says providerStatus never throws; be robust anyway and record the violation as an issue
          // on an UNAVAILABLE status. Report channel: this function never propagates.
          status = { providerId: id, available: false, windows: [], issues: [{ severity: 'error', message: `providerStatus threw: ${errorMessageOf(error)}` }] };
        }

        if (account != null) {
          readByAccount.set(account, { id, status });
        }

        entry = { id, metered: true, status };
      } else {
        entry = { id, metered: true, status: already.status, sharedWithId: already.id };
      }
    }

    checked.push(entry);
  }

  const report: LlmProviderStatusReport = { checked };
  config.onReport?.(report);
  return report;
}

/**
 * The default headroom ceiling a billed lane refuses above — 90% of the tightest window consumed.
 *
 * Not lower, because the windows this reads are ROLLING: at 90% of a 5-hour window the remaining tenth is still
 * minutes from being partly refunded, and a stricter default would refuse runs an operator could in fact afford.
 * Not higher, because the point is to leave a margin an interactive session can still work in after an automated
 * lane has had its turn.
 */
export const DEFAULT_LLM_QUOTA_GATE_MAX_USED_FRACTION: PercentDecimal = 0.9;

/**
 * Config for {@link evaluateLlmQuotaGate}.
 */
export interface EvaluateLlmQuotaGateConfig {
  /**
   * The report to judge.
   */
  readonly report: LlmProviderStatusReport;
  /**
   * The fraction of the tightest window above which the gate CLOSES; defaults to
   * {@link DEFAULT_LLM_QUOTA_GATE_MAX_USED_FRACTION}.
   */
  readonly maxUsedFraction?: PercentDecimal;
}

/**
 * A quota gate's verdict.
 */
export interface LlmQuotaGateVerdict {
  /**
   * `true` ⇒ the caller may proceed. **Fails OPEN**: unknown, unmetered, and unreadable all allow.
   */
  readonly allowed: boolean;
  /**
   * Why — a human line for the refusal message or the advisory log. Empty when nothing was measured.
   */
  readonly reason: string;
  /**
   * The tightest measured fraction across every metered provider, when one was measured. Absent ⇒ nothing
   * measurable was found, which is the fail-open case.
   */
  readonly usedFraction?: PercentDecimal;
}

/**
 * Draw the throttle line over a {@link LlmProviderStatusReport} — the ONE place the "may this billed lane start?"
 * rule lives, so every gate that asks cannot drift apart on it.
 *
 * **It fails OPEN, deliberately and in every ambiguous case**: no metered backend, an `available: false` status
 * (an unconfigured management key, an unreachable endpoint), a window carrying no fraction. The cost of a false
 * refusal is an operator blocked from work they have already paid for, on the word of a diagnostic; the cost of a
 * false allow is one `402` — which is exactly the status quo this improves on, never worse than it. That
 * asymmetry is the whole design, and it is also why a missing management key must never read as "spent".
 *
 * @param config - The report and an optional ceiling.
 * @returns The verdict.
 */
export function evaluateLlmQuotaGate(config: EvaluateLlmQuotaGateConfig): LlmQuotaGateVerdict {
  const ceiling = config.maxUsedFraction ?? DEFAULT_LLM_QUOTA_GATE_MAX_USED_FRACTION;
  const tightest = config.report.checked.reduce<Maybe<{ readonly providerId: string; readonly window: LlmQuotaWindow }>>((worst, entry) => {
    const status = entry.status;
    const window = status?.available ? tightestLlmQuotaWindow(status) : undefined;
    return window == null || (worst != null && (worst.window.usedFraction as number) >= (window.usedFraction as number)) ? worst : { providerId: status?.providerId ?? entry.id, window };
  }, undefined);
  let verdict: LlmQuotaGateVerdict;

  if (tightest == null) {
    verdict = { allowed: true, reason: '' };
  } else {
    const fraction = tightest.window.usedFraction as number;
    const percent = `${(fraction * 100).toFixed(1)}%`;
    const resets = tightest.window.resetsAt == null ? '' : `, resets ${tightest.window.resetsAt}`;
    const detail = `${tightest.providerId} ${tightest.window.label} is ${percent} spent${resets}`;
    verdict = fraction > ceiling ? { allowed: false, reason: `${detail}, above the ${(ceiling * 100).toFixed(0)}% ceiling`, usedFraction: fraction } : { allowed: true, reason: detail, usedFraction: fraction };
  }

  return verdict;
}
