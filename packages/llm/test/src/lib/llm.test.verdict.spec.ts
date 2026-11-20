import { describe, expect, it } from 'vitest';
import { evaluateLlmQuotaGate, type LlmProviderStatus, type LlmProviderStatusReport, makeLlmQuotaWindow } from '@dereekb/llm';
import { DEFAULT_LLM_LIVE_LANE_ENV_NAMES, type LlmLiveLaneEnvNames } from './llm.test.env';
import { type LlmCredentialVerdictResult, llmCredentialVerdictFromEnv, llmCredentialVerdictFromReport, llmQuotaVerdictFromEnv, llmQuotaVerdictFromGate, parseLlmQuotaMaxUsed, toLlmCredentialVerdictEnv, toLlmQuotaVerdictEnv } from './llm.test.verdict';

function reportOf(status: LlmProviderStatus): LlmProviderStatusReport {
  return { checked: [{ id: 'alpha', metered: true, status }] };
}

function spentTo(usedFraction: number): LlmProviderStatus {
  return { providerId: 'meter', available: true, windows: [makeLlmQuotaWindow({ id: 'rolling-7d', label: 'rolling 7 days', usedFraction, resetsAt: '2026-08-27T02:15:05.000Z' })], issues: [] };
}

describe('llmCredentialVerdictFromReport()', () => {
  it('should read an absent or empty report as unchecked: nothing was asked', () => {
    expect(llmCredentialVerdictFromReport(undefined)).toEqual({ verdict: 'unchecked' });
    expect(llmCredentialVerdictFromReport({ ready: true, checked: [] })).toEqual({ verdict: 'unchecked' });
  });

  it('should read a ready report as live, including a warning-only probe', () => {
    const report = { ready: true, checked: [{ id: 'alpha', registered: true, health: { ready: true, issues: [{ severity: 'warning' as const, message: 'probe endpoint not implemented' }] } }] };
    expect(llmCredentialVerdictFromReport(report)).toEqual({ verdict: 'live' });
  });

  it("should read a report that is not ready as dead, carrying the provider's own words", () => {
    const report = { ready: false, checked: [{ id: 'alpha', registered: true, health: { ready: false, issues: [{ severity: 'error' as const, message: 'HTTP 401: User not found.' }] } }] };
    expect(llmCredentialVerdictFromReport(report)).toEqual({ verdict: 'dead', detail: 'alpha: HTTP 401: User not found.' });
  });
});

describe('the credential verdict codec', () => {
  it('should round-trip every verdict through the environment', () => {
    const results: ReadonlyArray<LlmCredentialVerdictResult> = [{ verdict: 'live' }, { verdict: 'unchecked' }, { verdict: 'dead', detail: 'alpha: HTTP 401: User not found.' }];

    results.forEach((result) => expect(llmCredentialVerdictFromEnv({ env: toLlmCredentialVerdictEnv({ result }) })).toEqual(result));
  });

  it('should read an absent or unrecognized verdict as UNCHECKED: the fail-open default', () => {
    expect(llmCredentialVerdictFromEnv({ env: {} })).toEqual({ verdict: 'unchecked' });
    expect(llmCredentialVerdictFromEnv({ env: { LLM_CREDENTIAL_VERDICT: 'probably?' } })).toEqual({ verdict: 'unchecked' });
    // A stale detail must never promote a non-dead verdict into carrying an explanation of nothing.
    expect(llmCredentialVerdictFromEnv({ env: { LLM_CREDENTIAL_VERDICT: 'LIVE', LLM_CREDENTIAL_DETAIL: 'stale' } })).toEqual({ verdict: 'live' });
  });
});

describe('parseLlmQuotaMaxUsed()', () => {
  it('should accept a 0–1 fraction', () => {
    expect(parseLlmQuotaMaxUsed('0.75')).toBe(0.75);
    expect(parseLlmQuotaMaxUsed('1')).toBe(1);
  });

  it('should REJECT a percent-shaped value, which would silently disable the gate it was meant to tighten', () => {
    expect(parseLlmQuotaMaxUsed('90')).toBeUndefined();
  });

  it('should reject a non-number, a negative, a zero, and an absent value', () => {
    expect(parseLlmQuotaMaxUsed('tight')).toBeUndefined();
    expect(parseLlmQuotaMaxUsed('-0.5')).toBeUndefined();
    expect(parseLlmQuotaMaxUsed('0')).toBeUndefined();
    expect(parseLlmQuotaMaxUsed(undefined)).toBeUndefined();
  });
});

describe('the quota verdict codec', () => {
  it('should round-trip an exhausted verdict through the environment', () => {
    const result = llmQuotaVerdictFromGate(evaluateLlmQuotaGate({ report: reportOf(spentTo(0.99)) }));
    expect(result.verdict).toBe('exhausted');
    expect(llmQuotaVerdictFromEnv({ env: toLlmQuotaVerdictEnv({ result }) })).toEqual(result);
  });

  it('should fold a MEASURED allow to `ok`, keeping the headroom line for the advisory log', () => {
    const result = llmQuotaVerdictFromGate(evaluateLlmQuotaGate({ report: reportOf(spentTo(0.3)) }));
    expect(result.verdict).toBe('ok');
    expect(result.detail).toContain('rolling 7 days');
  });

  it("should fold an UNMEASURED allow to `unchecked`, never `ok`: a caller must tell 'there is headroom' from 'we could not look'", () => {
    expect(llmQuotaVerdictFromGate(evaluateLlmQuotaGate({ report: { checked: [] } })).verdict).toBe('unchecked');
  });

  it('should read an ABSENT / unrecognized env verdict as unchecked, so a propagation failure is a no-op', () => {
    expect(llmQuotaVerdictFromEnv({ env: {} }).verdict).toBe('unchecked');
    expect(llmQuotaVerdictFromEnv({ env: { LLM_QUOTA_VERDICT: 'maybe' } }).verdict).toBe('unchecked');
  });
});

describe('custom verdict names', () => {
  const names: LlmLiveLaneEnvNames = { ...DEFAULT_LLM_LIVE_LANE_ENV_NAMES, credentialVerdict: 'HOST_CRED', credentialDetail: 'HOST_CRED_DETAIL', quotaVerdict: 'HOST_QUOTA', quotaDetail: 'HOST_QUOTA_DETAIL' };

  it('should write and read under the injected names', () => {
    const credential = toLlmCredentialVerdictEnv({ result: { verdict: 'dead', detail: 'nope' }, names });
    const quota = toLlmQuotaVerdictEnv({ result: { verdict: 'exhausted', detail: 'spent' }, names });

    expect(credential).toEqual({ HOST_CRED: 'dead', HOST_CRED_DETAIL: 'nope' });
    expect(quota).toEqual({ HOST_QUOTA: 'exhausted', HOST_QUOTA_DETAIL: 'spent' });
    expect(llmCredentialVerdictFromEnv({ env: credential, names })).toEqual({ verdict: 'dead', detail: 'nope' });
    expect(llmQuotaVerdictFromEnv({ env: quota, names })).toEqual({ verdict: 'exhausted', detail: 'spent' });
    expect(llmCredentialVerdictFromEnv({ env: credential })).toEqual({ verdict: 'unchecked' });
  });
});
