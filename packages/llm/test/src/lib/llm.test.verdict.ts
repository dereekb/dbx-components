/**
 * The credential and quota verdict codecs — how a live lane's setup carries what it learned (one probe, one quota read)
 * to the test workers, which decide per spec but cannot make their own network call at module-evaluation time.
 *
 * Both verdicts FAIL OPEN: an absent or unrecognized value reads `unchecked`, and `unchecked` never vetoes. That makes
 * every propagation risk a no-op regression rather than a false skip of a run someone paid for.
 */

import { type Maybe, type PercentDecimal } from '@dereekb/util';
import { llmCredentialReportErrorText, type LlmQuotaGateVerdict, type LlmStrategiesHealthReport } from '@dereekb/llm';
import { firstLlmEnvValue, type LlmEnvView } from '@dereekb/llm/node';
import { DEFAULT_LLM_LIVE_LANE_ENV_NAMES, type LlmLiveLaneEnvNames } from './llm.test.env';

// MARK: Shared
/**
 * Config for the verdict readers.
 */
export interface LlmVerdictEnvReadConfig {
  /**
   * The environment to read; defaults to `process.env`.
   */
  readonly env?: Maybe<LlmEnvView>;
  /**
   * The lane's names; defaults to {@link DEFAULT_LLM_LIVE_LANE_ENV_NAMES}.
   */
  readonly names?: Maybe<LlmLiveLaneEnvNames>;
}

// MARK: Credential
/**
 * What a credential probe concluded. `unchecked` is the FAIL-OPEN default: nobody probed, so nobody may veto.
 */
export type LlmCredentialVerdict = 'live' | 'dead' | 'unchecked';

/**
 * A credential verdict plus, when it is `dead`, the provider's own explanation.
 */
export interface LlmCredentialVerdictResult {
  /**
   * The verdict.
   */
  readonly verdict: LlmCredentialVerdict;
  /**
   * The provider's OWN words behind a `dead` verdict — carried so an operator reads "User not found." rather than a
   * synthesized "auth failed". Only ever set on `dead`.
   */
  readonly detail?: string;
}

/**
 * Fold a credential report into a verdict.
 *
 * An EMPTY `checked` set is `unchecked`, not `live` — nothing was asked, and reporting a keyless machine as verified
 * would let the verdict outrank the presence gate that owns that case. A `ready` report (including the lenient arm: a
 * gateway that does not implement the probe endpoint reports `ready` with a warning) is `live`. An unreachable host
 * folds to `dead` alongside a 401; the probe's verbatim "could not reach …" text rides in the detail, so the two are
 * never confused.
 *
 * @param report - The report to fold (absent ⇒ `unchecked`).
 * @returns The verdict.
 */
export function llmCredentialVerdictFromReport(report: Maybe<LlmStrategiesHealthReport>): LlmCredentialVerdictResult {
  let result: LlmCredentialVerdictResult;

  if (report == null || report.checked.length === 0) {
    result = { verdict: 'unchecked' };
  } else if (report.ready) {
    result = { verdict: 'live' };
  } else {
    const detail = llmCredentialReportErrorText(report);
    result = { verdict: 'dead', ...(detail.length === 0 ? {} : { detail }) };
  }

  return result;
}

/**
 * Read a credential verdict a prior probe stamped into an environment. Absent / unrecognized ⇒ `unchecked`; a detail
 * only rides a `dead` verdict.
 *
 * @param config - The environment and the lane's names.
 * @returns The verdict a prior probe recorded, or `unchecked`.
 */
export function llmCredentialVerdictFromEnv(config?: Maybe<LlmVerdictEnvReadConfig>): LlmCredentialVerdictResult {
  const env = config?.env;
  const names = config?.names ?? DEFAULT_LLM_LIVE_LANE_ENV_NAMES;
  const raw = firstLlmEnvValue({ env, names: [names.credentialVerdict] })?.toLowerCase();
  const verdict: LlmCredentialVerdict = raw === 'live' || raw === 'dead' ? raw : 'unchecked';
  const detail = firstLlmEnvValue({ env, names: [names.credentialDetail] });
  return { verdict, ...(verdict !== 'dead' || detail == null ? {} : { detail }) };
}

/**
 * Config for {@link toLlmCredentialVerdictEnv}.
 */
export interface ToLlmCredentialVerdictEnvConfig {
  /**
   * The verdict to encode.
   */
  readonly result: LlmCredentialVerdictResult;
  /**
   * The lane's names; defaults to {@link DEFAULT_LLM_LIVE_LANE_ENV_NAMES}.
   */
  readonly names?: Maybe<LlmLiveLaneEnvNames>;
}

/**
 * The env entries carrying a credential verdict to a worker — the inverse of {@link llmCredentialVerdictFromEnv}.
 *
 * @param config - The verdict and the lane's names.
 * @returns The env entries to assign.
 */
export function toLlmCredentialVerdictEnv(config: ToLlmCredentialVerdictEnvConfig): Readonly<Record<string, string>> {
  const names = config.names ?? DEFAULT_LLM_LIVE_LANE_ENV_NAMES;
  const detail = config.result.detail;
  return { [names.credentialVerdict]: config.result.verdict, ...(detail == null || detail.length === 0 ? {} : { [names.credentialDetail]: detail }) };
}

// MARK: Quota
/**
 * What a quota read concluded. `unchecked` is the FAIL-OPEN default: nobody asked, so nobody may veto.
 */
export type LlmQuotaVerdict = 'ok' | 'exhausted' | 'unchecked';

/**
 * A quota verdict plus the human line behind it.
 */
export interface LlmQuotaVerdictResult {
  /**
   * The verdict.
   */
  readonly verdict: LlmQuotaVerdict;
  /**
   * The measured headroom line — set on `exhausted` (the refusal reason) and on an `ok` that actually MEASURED something
   * (the advisory a lane logs so an operator sees the number before it becomes a refusal).
   */
  readonly detail?: string;
}

/**
 * Parse a quota ceiling. Accepts a `0`–`1` fraction; anything else — a non-number, zero or less, a value above 1 — reads
 * as ABSENT so the caller's default applies. Rejecting `> 1` matters: someone will write `90` meaning 90%, and honoring
 * it literally would produce a ceiling no window can exceed, silently disabling the gate they meant to tighten.
 *
 * @param raw - The raw environment value.
 * @returns The ceiling, or `undefined` when unset or unusable.
 */
export function parseLlmQuotaMaxUsed(raw: Maybe<string>): Maybe<PercentDecimal> {
  const value = Number((raw ?? '').trim());
  return Number.isFinite(value) && value > 0 && value <= 1 ? value : undefined;
}

/**
 * Fold a quota gate verdict into the transportable form. No measured fraction ⇒ nothing was readable ⇒ `unchecked`,
 * never `ok`: a caller must be able to tell "we looked and there is headroom" from "we could not look".
 *
 * @param verdict - The gate verdict (`evaluateLlmQuotaGate`).
 * @returns The stampable result.
 */
export function llmQuotaVerdictFromGate(verdict: LlmQuotaGateVerdict): LlmQuotaVerdictResult {
  const detail = verdict.reason;
  let state: LlmQuotaVerdict;

  if (verdict.usedFraction == null) {
    state = 'unchecked';
  } else {
    state = verdict.allowed ? 'ok' : 'exhausted';
  }

  return { verdict: state, ...(detail.length === 0 ? {} : { detail }) };
}

/**
 * Read a quota verdict a prior read stamped into an environment. Absent / unrecognized ⇒ `unchecked`; the detail rides
 * any verdict.
 *
 * @param config - The environment and the lane's names.
 * @returns The verdict a prior read recorded, or `unchecked`.
 */
export function llmQuotaVerdictFromEnv(config?: Maybe<LlmVerdictEnvReadConfig>): LlmQuotaVerdictResult {
  const env = config?.env;
  const names = config?.names ?? DEFAULT_LLM_LIVE_LANE_ENV_NAMES;
  const raw = firstLlmEnvValue({ env, names: [names.quotaVerdict] })?.toLowerCase();
  const verdict: LlmQuotaVerdict = raw === 'ok' || raw === 'exhausted' ? raw : 'unchecked';
  const detail = firstLlmEnvValue({ env, names: [names.quotaDetail] });
  return { verdict, ...(detail == null ? {} : { detail }) };
}

/**
 * Config for {@link toLlmQuotaVerdictEnv}.
 */
export interface ToLlmQuotaVerdictEnvConfig {
  /**
   * The verdict to encode.
   */
  readonly result: LlmQuotaVerdictResult;
  /**
   * The lane's names; defaults to {@link DEFAULT_LLM_LIVE_LANE_ENV_NAMES}.
   */
  readonly names?: Maybe<LlmLiveLaneEnvNames>;
}

/**
 * The env entries carrying a quota verdict to a worker — the inverse of {@link llmQuotaVerdictFromEnv}.
 *
 * @param config - The verdict and the lane's names.
 * @returns The env entries to assign.
 */
export function toLlmQuotaVerdictEnv(config: ToLlmQuotaVerdictEnvConfig): Readonly<Record<string, string>> {
  const names = config.names ?? DEFAULT_LLM_LIVE_LANE_ENV_NAMES;
  const detail = config.result.detail;
  return { [names.quotaVerdict]: config.result.verdict, ...(detail == null || detail.length === 0 ? {} : { [names.quotaDetail]: detail }) };
}
