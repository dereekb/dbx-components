/**
 * The live lane's own environment names — the switches that opt a billed spec run in and the verdict variables its setup
 * stamps for the workers — and the one flag parse every lane switch uses.
 */

import { type Maybe } from '@dereekb/util';

/**
 * The environment variable names a live lane reads and writes. Single names rather than lists: the verdict names are
 * WRITTEN as well as read, and a lane switch has no vendor alias to honor.
 */
export interface LlmLiveLaneEnvNames {
  /**
   * Opts the billed lane in (`1` / `true`). Absent ⇒ every live spec skips and the setup strips provider keys.
   */
  readonly unlock: string;
  /**
   * Runs the lane without the credential probe (`1` / `true`), clearing any stale credential verdict.
   */
  readonly skipCredentialProbe: string;
  /**
   * Runs the lane without the quota read (`1` / `true`), clearing any stale quota verdict.
   */
  readonly skipQuotaProbe: string;
  /**
   * The credential verdict the setup stamps (`live` / `dead` / `unchecked`) and the workers read.
   */
  readonly credentialVerdict: string;
  /**
   * The provider's own words behind a `dead` credential verdict.
   */
  readonly credentialDetail: string;
  /**
   * The quota verdict the setup stamps (`ok` / `exhausted` / `unchecked`) and the workers read.
   */
  readonly quotaVerdict: string;
  /**
   * The measured headroom line behind a quota verdict.
   */
  readonly quotaDetail: string;
  /**
   * The 0–1 ceiling of the tightest quota window above which the lane refuses to start.
   */
  readonly quotaMaxUsed: string;
}

/**
 * The default {@link LlmLiveLaneEnvNames} — the `LLM_LIVE_SPECS` family.
 */
export const DEFAULT_LLM_LIVE_LANE_ENV_NAMES: LlmLiveLaneEnvNames = {
  unlock: 'LLM_LIVE_SPECS',
  skipCredentialProbe: 'LLM_LIVE_SPECS_SKIP_CREDENTIAL_PROBE',
  skipQuotaProbe: 'LLM_LIVE_SPECS_SKIP_QUOTA_PROBE',
  credentialVerdict: 'LLM_CREDENTIAL_VERDICT',
  credentialDetail: 'LLM_CREDENTIAL_DETAIL',
  quotaVerdict: 'LLM_QUOTA_VERDICT',
  quotaDetail: 'LLM_QUOTA_DETAIL',
  quotaMaxUsed: 'LLM_QUOTA_MAX_USED'
};

/**
 * Whether a lane switch is on: `1` or `true`, trimmed and case-insensitive. Anything else — `0`, `yes`, blank, absent —
 * is off, so a billed lane is only ever opted into deliberately.
 *
 * @param raw - The raw environment value.
 * @returns `true` when the switch is on.
 *
 * @example
 * ```ts
 * isLlmEnvFlagEnabled(' TRUE '); // true
 * isLlmEnvFlagEnabled('yes'); // false
 * ```
 */
export function isLlmEnvFlagEnabled(raw: Maybe<string>): boolean {
  const value = (raw ?? '').trim().toLowerCase();
  return value === '1' || value === 'true';
}
