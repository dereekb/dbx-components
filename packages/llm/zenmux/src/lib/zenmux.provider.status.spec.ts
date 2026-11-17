import { tightestLlmQuotaWindow, type LlmCredentialProbeFetch, type LlmCredentialProbeResponse } from '@dereekb/llm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZENMUX_PROVIDER_ID } from './zenmux.constants';
import { makeZenmuxProviderStatusSource } from './zenmux.provider.status';

/**
 * The `subscription/detail` payload shape ZenMux actually answers with (trimmed to the fields read).
 */
const SUBSCRIPTION_BODY = JSON.stringify({
  success: true,
  data: {
    currency: 'usd',
    base_usd_per_flow: 0.03283,
    effective_usd_per_flow: 0.03283,
    account_status: 'healthy',
    quota_5_hour: { usage_percentage: 0.0715, resets_at: '2026-08-25T08:35:09.000Z', max_flows: 800, used_flows: 57.2, remaining_flows: 742.8, used_value_usd: 1.88, max_value_usd: 26.27 },
    quota_7_day: { usage_percentage: 0.94, resets_at: '2026-08-27T02:15:05.000Z', max_flows: 6182, used_flows: 5811, remaining_flows: 371, used_value_usd: 190.78, max_value_usd: 202.99 },
    quota_monthly: { max_flows: 34560, max_value_usd: 1134.33 }
  }
});

const BALANCE_BODY = JSON.stringify({ success: true, data: { currency: 'usd', total_credits: 482.74, top_up_credits: 35, bonus_credits: 447.74 } });
const FLOW_RATE_BODY = JSON.stringify({ success: true, data: { base_usd_per_flow: 0.03283, effective_usd_per_flow: 0.03283 } });

/**
 * The literal body the account endpoints answer an INFERENCE key with — verified against a live account.
 */
const REJECTED_BODY = '{"success":false,"message":"Invalid API key","data":null}';

/**
 * Build a fetch seam that answers per-endpoint canned responses, keyed by the path fragment.
 *
 * @param routes - Path fragment → status + body.
 * @returns The seam plus the URLs and auth headers it was called with.
 */
function fakeFetch(routes: Readonly<Record<string, { readonly status: number; readonly body: string }>>): { readonly fetch: LlmCredentialProbeFetch; readonly urls: string[]; readonly auths: Array<string | undefined> } {
  const urls: string[] = [];
  const auths: Array<string | undefined> = [];
  const fetchImpl: LlmCredentialProbeFetch = async (url, init) => {
    urls.push(url);
    auths.push(init.headers['Authorization']);
    const key = Object.keys(routes).find((fragment) => url.includes(fragment));
    const route = key == null ? { status: 404, body: '{"message":"not found"}' } : routes[key];
    const answer: LlmCredentialProbeResponse = { ok: route.status >= 200 && route.status < 300, status: route.status, text: async () => route.body };
    return answer;
  };
  return { fetch: fetchImpl, urls, auths };
}

/**
 * The all-endpoints-healthy route table.
 */
const HEALTHY_ROUTES = { 'subscription/detail': { status: 200, body: SUBSCRIPTION_BODY }, 'payg/balance': { status: 200, body: BALANCE_BODY }, flow_rate: { status: 200, body: FLOW_RATE_BODY } };

describe('makeZenmuxProviderStatusSource()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps all three endpoints onto windows + balance', async () => {
    const seam = fakeFetch(HEALTHY_ROUTES);
    const status = await makeZenmuxProviderStatusSource({ managementApiKey: 'mgmt-key', fetch: seam.fetch }).read();

    expect(status.providerId).toBe(ZENMUX_PROVIDER_ID);
    expect(status.available).toBe(true);
    expect(status.windows.map((window) => window.id)).toEqual(['rolling-5h', 'rolling-7d', 'monthly']);
    expect(status.windows[0]).toMatchObject({ usedFraction: 0.0715, usedUnits: 57.2, maxUnits: 800, remainingUnits: 742.8, unit: 'flow', usedUsd: 1.88, maxUsd: 26.27, resetsAt: '2026-08-25T08:35:09.000Z' });
    expect(status.balance).toEqual({
      currency: 'usd',
      total: 482.74,
      parts: [
        { label: 'top-up', amount: 35 },
        { label: 'bonus', amount: 447.74 }
      ]
    });
    expect(status.issues).toEqual([]);
    expect(seam.urls).toHaveLength(3);
  });

  it('authenticates every GET with the management key', async () => {
    const seam = fakeFetch(HEALTHY_ROUTES);
    await makeZenmuxProviderStatusSource({ managementApiKey: ' mgmt-key ', fetch: seam.fetch }).read();

    expect(seam.auths).toEqual(['Bearer mgmt-key', 'Bearer mgmt-key', 'Bearer mgmt-key']);
  });

  it('reads the management routes under a regional base URL', async () => {
    const seam = fakeFetch(HEALTHY_ROUTES);
    await makeZenmuxProviderStatusSource({ managementApiKey: 'mgmt-key', baseUrl: 'https://eu.zenmux.ai/api/v1/', fetch: seam.fetch }).read();

    expect(seam.urls).toEqual(['https://eu.zenmux.ai/api/v1/management/subscription/detail', 'https://eu.zenmux.ai/api/v1/management/payg/balance', 'https://eu.zenmux.ai/api/v1/management/flow_rate']);
  });

  it('surfaces the 7-day window as the tightest: the AND across windows a gate must honour', async () => {
    const status = await makeZenmuxProviderStatusSource({ managementApiKey: 'k', fetch: fakeFetch(HEALTHY_ROUTES).fetch }).read();
    expect(tightestLlmQuotaWindow(status)?.id).toBe('rolling-7d');
  });

  it('reports the monthly ceiling WITHOUT a fraction, so an unmeasured ceiling can never be the binding constraint', async () => {
    const status = await makeZenmuxProviderStatusSource({ managementApiKey: 'k', fetch: fakeFetch(HEALTHY_ROUTES).fetch }).read();
    const monthly = status.windows.find((window) => window.id === 'monthly');
    expect(monthly?.maxUnits).toBe(34560);
    expect(monthly?.usedFraction).toBeUndefined();
  });

  it('reports an ABSENT management key as unavailable + an error naming the default env var, and opens NO socket', async () => {
    const seam = fakeFetch(HEALTHY_ROUTES);
    const status = await makeZenmuxProviderStatusSource({ fetch: seam.fetch }).read();

    expect(status.available).toBe(false);
    expect(status.windows).toEqual([]);
    expect(status.issues[0]?.severity).toBe('error');
    expect(status.issues[0]?.message).toContain('Set ZENMUX_MANAGEMENT_API_KEY ');
    expect(seam.urls).toEqual([]);
  });

  it('names the env var the HOST resolved the key from, so an operator is told what THEY set', async () => {
    const status = await makeZenmuxProviderStatusSource({ managementApiKeyEnv: 'HOST_ZENMUX_MANAGEMENT_KEY', fetch: fakeFetch(HEALTHY_ROUTES).fetch }).read();
    expect(status.issues[0]?.message).toContain('HOST_ZENMUX_MANAGEMENT_KEY');
  });

  it("carries the provider's own words when the key is REJECTED (an inference key passed here)", async () => {
    const rejected = { status: 403, body: REJECTED_BODY };
    const status = await makeZenmuxProviderStatusSource({ managementApiKey: 'inference-key', fetch: fakeFetch({ 'subscription/detail': rejected, 'payg/balance': rejected, flow_rate: rejected }).fetch }).read();

    expect(status.available).toBe(false);
    expect(status.issues.every((issue) => issue.severity === 'warning')).toBe(true);
    expect(status.issues.map((issue) => issue.message).join(' ')).toContain('Invalid API key');
  });

  it('stays AVAILABLE on a partial read, warning per failed endpoint', async () => {
    const status = await makeZenmuxProviderStatusSource({ managementApiKey: 'k', fetch: fakeFetch({ 'subscription/detail': { status: 200, body: SUBSCRIPTION_BODY }, 'payg/balance': { status: 500, body: '{"message":"upstream error"}' }, flow_rate: { status: 200, body: FLOW_RATE_BODY } }).fetch }).read();

    expect(status.available).toBe(true);
    expect(status.windows).toHaveLength(3);
    expect(status.balance).toBeUndefined();
    expect(status.issues).toHaveLength(1);
    expect(status.issues[0]).toMatchObject({ severity: 'warning' });
    expect(status.issues[0]?.message).toContain('upstream error');
  });

  it('warns when the account is being charged ABOVE the base flow rate', async () => {
    const status = await makeZenmuxProviderStatusSource({ managementApiKey: 'k', fetch: fakeFetch({ ...HEALTHY_ROUTES, flow_rate: { status: 200, body: JSON.stringify({ success: true, data: { base_usd_per_flow: 0.03283, effective_usd_per_flow: 0.05 } }) } }).fetch }).read();
    expect(status.issues.some((issue) => issue.message.includes('above the base rate'))).toBe(true);
  });

  it('REPORTS a thrown transport rather than propagating it', async () => {
    const throwing: LlmCredentialProbeFetch = async () => {
      throw new Error('ECONNREFUSED');
    };
    const status = await makeZenmuxProviderStatusSource({ managementApiKey: 'k', fetch: throwing }).read();

    expect(status.available).toBe(false);
    expect(status.issues).toHaveLength(3);
    expect(status.issues[0]?.message).toContain('ECONNREFUSED');
  });

  it('treats a pay-as-you-go-only account (no subscription) as available on its balance alone', async () => {
    const status = await makeZenmuxProviderStatusSource({ managementApiKey: 'k', fetch: fakeFetch({ 'subscription/detail': { status: 200, body: JSON.stringify({ success: true, data: {} }) }, 'payg/balance': { status: 200, body: BALANCE_BODY }, flow_rate: { status: 200, body: FLOW_RATE_BODY } }).fetch }).read();

    expect(status.available).toBe(true);
    expect(status.windows).toEqual([]);
    expect(status.balance?.total).toBe(482.74);
  });

  it('never rejects on an engine without AbortSignal.timeout: each read becomes a warning', async () => {
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      throw new TypeError('AbortSignal.timeout is not a function');
    });

    const status = await makeZenmuxProviderStatusSource({ managementApiKey: 'k', fetch: fakeFetch(HEALTHY_ROUTES).fetch }).read();

    expect(status.available).toBe(false);
    expect(status.issues).toHaveLength(3);
    expect(status.issues.every((issue) => issue.severity === 'warning')).toBe(true);
  });
});
