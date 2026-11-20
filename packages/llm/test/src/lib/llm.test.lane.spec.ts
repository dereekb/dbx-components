import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type ConfiguredFetch } from '@dereekb/util/fetch';
import { type LlmAdapter, type LlmCompletionAdapterConfig, type LlmModelConfigFile, type LlmProviderStatus, type LlmStrategy, makeLlmAdapterRegistry, makeLlmModelConfigSchema, makeLlmQuotaWindow, probeLlmCredentialEndpoint } from '@dereekb/llm';
import { DEFAULT_LLM_ENV_NAMES, type LlmEnvNames, resolveLlmProvidersFromEnv } from '@dereekb/llm/node';
import { type LlmLiveLaneConfig, makeLlmLiveLane } from './llm.test.lane';
import { makeLlmScriptedDecisionStrategy, LLM_SCRIPTED_DECISION_STRATEGY_ID } from './llm.test.scripted.decision';

const FAKE_URL = 'https://fake.example/v1';
const METERED_URL = 'https://metered.example/v1';
const REJECTED_BODY = '{"error":{"message":"User not found."}}';

const schema = makeLlmModelConfigSchema({ label: 'test models', transports: ['fake', 'plain'] });

const envNames: LlmEnvNames = {
  ...DEFAULT_LLM_ENV_NAMES,
  providers: [
    { id: 'alpha', transport: 'fake', apiKey: ['ALPHA_API_KEY'], baseUrl: ['ALPHA_BASE_URL'] },
    { id: 'beta', transport: 'fake', apiKey: ['BETA_API_KEY'], fallback: true }
  ]
};

/**
 * The adapters and what the completion adapter received.
 *
 * @param usedFraction - The metered account's used fraction.
 * @returns The registry and the recorded completion configs.
 */
function fakeAdaptersOf(usedFraction = 0.3) {
  const received: LlmCompletionAdapterConfig[] = [];
  const completionAdapter = (kind: string, defaultBaseUrl?: string): LlmAdapter => ({
    facet: 'completion',
    kind,
    ...(defaultBaseUrl == null ? {} : { defaultBaseUrl }),
    make: (config) => {
      received.push(config);
      const { provider, baseUrl, fetch, providerStatusSource } = config;
      const strategy: LlmStrategy = {
        id: provider.id,
        kind,
        describe: `${kind} at ${baseUrl ?? '(default)'}`,
        caching: 'none',
        complete: async (request) => ({ text: 'live reply', strategyId: provider.id, capability: request.capability, ...(config.defaultModel == null ? {} : { model: config.defaultModel }) }),
        credentialProbe: config.credentialProbe ?? ((options) => probeLlmCredentialEndpoint({ strategyId: provider.id, url: `${baseUrl}/key`, apiKey: provider.apiKey, fetch, signal: options?.signal })),
        ...(providerStatusSource == null ? {} : { providerStatusId: providerStatusSource.providerId, providerStatus: (options) => providerStatusSource.read(options) })
      };
      return strategy;
    }
  });
  const status: LlmProviderStatus = { providerId: 'meter', available: true, windows: [makeLlmQuotaWindow({ id: 'rolling-7d', label: 'rolling 7 days', usedFraction })], issues: [] };
  const adapters = makeLlmAdapterRegistry([
    completionAdapter('fake', FAKE_URL),
    completionAdapter('plain', 'https://plain.example/v1'),
    { facet: 'metering', kind: 'meter', isAccountBaseUrl: (url) => new URL(url).host === 'metered.example', make: () => ({ providerId: 'meter', read: async () => status }) },
    { facet: 'credentialProbe', kind: 'meter', make: (input) => (options) => probeLlmCredentialEndpoint({ strategyId: input.provider.id, url: `${input.baseUrl}/account/auth`, apiKey: input.provider.apiKey, fetch: input.fetch, signal: options?.signal }) },
    { facet: 'decision', kind: 'fake-decision', strategyKind: LLM_SCRIPTED_DECISION_STRATEGY_ID, transports: ['fake'], make: ({ provider }) => makeLlmScriptedDecisionStrategy({ id: provider.id, script: () => ({}) }) }
  ]);
  return { adapters, received };
}

/**
 * A fetch seam answering one status and recording every request.
 *
 * @param status - The HTTP status to answer.
 * @returns The seam and the recorded urls / authorization headers.
 */
function recordingFetchOf(status = 200) {
  const urls: string[] = [];
  const keys: Array<string | undefined> = [];
  const fetch: ConfiguredFetch = async (input, init) => {
    const url = String(input);
    urls.push(url);
    keys.push(new Headers(init?.headers).get('Authorization') ?? undefined);
    return new Response(status === 401 ? REJECTED_BODY : '{}', { status });
  };
  return { fetch, urls, keys };
}

function laneOf(overrides: Partial<LlmLiveLaneConfig> = {}) {
  const logged: string[] = [];
  const { adapters, received } = fakeAdaptersOf();
  const lane = makeLlmLiveLane({ envNames, schema, adapters, log: (message) => logged.push(message), ...overrides });
  return { lane, logged, received };
}

const UNLOCKED = { LLM_LIVE_SPECS: '1' };
const KEYED = { ...UNLOCKED, ALPHA_API_KEY: 'sk-fake-alpha', LLM_MODEL: 'vendor/model-pinned' };
const PROFILED_BASE: LlmModelConfigFile = { profiles: { cheap: { tiers: { fast: 'vendor/model-cheap' } } } };

describe('makeLlmLiveLane()', () => {
  describe('liveStrategyFromEnv()', () => {
    it('should answer undefined when LOCKED, logging nothing and reading no file', () => {
      const dir = mkdtempSync(join(tmpdir(), 'llm-lane-'));
      const defaultPath = join(dir, 'models.json');
      writeFileSync(defaultPath, '{ not json');
      const { lane, logged } = laneOf({ modelConfig: { defaultPath } });

      expect(lane.liveStrategyFromEnv({ ALPHA_API_KEY: 'sk-fake-alpha', LLM_MODEL: 'vendor/model-pinned' })).toBeUndefined();
      expect(lane.isUnlocked({})).toBe(false);
      expect(logged).toEqual([]);
    });

    it('should keep the default unlock name when names passes an explicit undefined (B5)', () => {
      const { lane } = laneOf({ names: { unlock: undefined } });

      expect(lane.isUnlocked(UNLOCKED)).toBe(true);
      expect(lane.isUnlocked({ undefined: '1' })).toBe(false);
    });

    it('should answer undefined on an unlocked keyless environment: the gate skips cleanly', () => {
      const { lane, logged } = laneOf();
      expect(lane.liveStrategyFromEnv(UNLOCKED)).toBeUndefined();
      expect(logged).toEqual([]);
    });

    it('should skip on a dead credential verdict, naming the key variable, the detail and the skip flag', () => {
      const { lane, logged } = laneOf();
      expect(lane.liveStrategyFromEnv({ ...KEYED, LLM_CREDENTIAL_VERDICT: 'dead', LLM_CREDENTIAL_DETAIL: 'alpha: HTTP 401: User not found.' })).toBeUndefined();
      expect(logged).toHaveLength(1);
      expect(logged[0]).toContain('ALPHA_API_KEY');
      expect(logged[0]).toContain('User not found.');
      expect(logged[0]).toContain('LLM_LIVE_SPECS_SKIP_CREDENTIAL_PROBE');
    });

    it('should open on a live verdict, on NO verdict and on an unrecognized one (fail-open)', () => {
      const { lane } = laneOf();
      expect(lane.liveStrategyFromEnv({ ...KEYED, LLM_CREDENTIAL_VERDICT: 'live' })?.strategyId).toBe('alpha');
      expect(lane.liveStrategyFromEnv(KEYED)?.strategyId).toBe('alpha');
      expect(lane.liveStrategyFromEnv({ ...KEYED, LLM_CREDENTIAL_VERDICT: 'probably?' })?.apiKeyEnv).toBe('ALPHA_API_KEY');
    });

    it('should skip on an exhausted quota, naming the ceiling and the skip flag', () => {
      const { lane, logged } = laneOf();
      expect(lane.liveStrategyFromEnv({ ...KEYED, LLM_QUOTA_VERDICT: 'exhausted', LLM_QUOTA_DETAIL: 'meter rolling 7 days is 99.0% spent' })).toBeUndefined();
      expect(logged[0]).toContain('99.0% spent');
      expect(logged[0]).toContain('LLM_QUOTA_MAX_USED');
      expect(logged[0]).toContain('LLM_LIVE_SPECS_SKIP_QUOTA_PROBE');
    });

    it('should skip a keyed provider with no model, naming the model variable', () => {
      const { lane, logged } = laneOf();
      expect(lane.liveStrategyFromEnv({ ...UNLOCKED, ALPHA_API_KEY: 'sk-fake-alpha' })).toBeUndefined();
      expect(logged[0]).toContain('no model is pinned');
      expect(logged[0]).toContain('LLM_MODEL');
    });
  });

  describe('model precedence', () => {
    const keyed = { ...UNLOCKED, ALPHA_API_KEY: 'sk-fake-alpha' };

    it('should prefer LLM_MODEL over a profile over the host default', () => {
      const { lane } = laneOf({ modelConfig: { base: PROFILED_BASE }, defaultModel: 'vendor/model-flash' });

      expect(lane.resolve({ env: { ...keyed, LLM_MODEL: 'vendor/model-pinned', LLM_MODEL_PROFILE: 'cheap' } })).toMatchObject({ model: 'vendor/model-pinned', modelSource: 'env' });
      expect(lane.resolve({ env: { ...keyed, LLM_MODEL_PROFILE: 'cheap' } })).toMatchObject({ model: 'vendor/model-cheap', modelSource: 'profile' });
      expect(lane.resolve({ env: keyed })).toMatchObject({ model: 'vendor/model-flash', modelSource: 'host' });
    });

    it('should hand a defaultModel function the provider and its effective base URL, and skip when it answers undefined', () => {
      const seen: Array<string | undefined> = [];
      const { lane, logged } = laneOf({
        defaultModel: ({ provider, baseUrl }) => {
          seen.push(`${provider.id}@${baseUrl}`);
          return baseUrl === FAKE_URL ? undefined : 'vendor/model-flash';
        }
      });

      expect(lane.liveStrategyFromEnv(keyed)).toBeUndefined();
      expect(logged[0]).toContain('no model is pinned');
      expect(lane.liveStrategyFromEnv({ ...keyed, ALPHA_BASE_URL: METERED_URL })?.model).toBe('vendor/model-flash');
      expect(seen).toEqual([`alpha@${FAKE_URL}`, `alpha@${METERED_URL}`]);
    });

    it('should throw on an unknown profile', () => {
      const { lane } = laneOf({ modelConfig: { base: PROFILED_BASE } });
      expect(() => lane.liveStrategyFromEnv({ ...keyed, LLM_MODEL_PROFILE: 'nope' })).toThrow(/nope/);
    });

    it('should build with the lane model and the per-model reasoning-off encodings, a fresh instance per call', () => {
      const { lane, received } = laneOf({ modelConfig: { base: { models: { 'vendor/model-pinned': { reasoningOff: 'omit' } } } } });
      const live = lane.liveStrategyFromEnv(KEYED);
      const first = live?.makeStrategy();
      const second = live?.makeStrategy();

      expect(first).toBeDefined();
      expect(first).not.toBe(second);
      expect(received[0]?.defaultModel).toBe('vendor/model-pinned');
      expect(received[0]?.reasoningOffByModel).toEqual({ 'vendor/model-pinned': 'omit' });
      expect(first?.id).toBe('alpha');
    });
  });

  describe('makeLiveStrategy() and liveStrategyBinding()', () => {
    it('should throw when nothing resolves', () => {
      const { lane } = laneOf();
      expect(() => lane.makeLiveStrategy({})).toThrow(/LLM_LIVE_SPECS=1/);
    });

    it('should bind the built instance', async () => {
      const { lane } = laneOf();
      const binding = lane.liveStrategyBinding({ env: KEYED });

      expect(binding.defaultStrategyId).toBe('alpha');
      await expect(binding.strategies.get('alpha')?.complete({ prompt: 'p', capability: 'summarize' })).resolves.toMatchObject({ text: 'live reply', model: 'vendor/model-pinned' });
    });
  });

  it('should bill the provider an injected resolver adds', () => {
    const { lane } = laneOf({
      resolveProviders: (config) => {
        const resolved = resolveLlmProvidersFromEnv(config);
        const injected = { id: 'injected', transport: 'fake', apiKey: 'sk-fake-injected', apiKeyEnv: 'INJECTED_API_KEY' };
        return { ...resolved, providers: [...resolved.providers, injected], defaultProvider: injected, defaultProviderId: injected.id };
      }
    });

    expect(lane.liveStrategyFromEnv({ ...UNLOCKED, LLM_MODEL: 'vendor/model-pinned' })).toMatchObject({ strategyId: 'injected', apiKeyEnv: 'INJECTED_API_KEY' });
  });

  describe('liveDecisionStrategyFromEnv()', () => {
    it('should answer undefined when locked or keyless', () => {
      const { lane } = laneOf();
      expect(lane.liveDecisionStrategyFromEnv({ ALPHA_API_KEY: 'sk-fake-alpha' })).toBeUndefined();
      expect(lane.liveDecisionStrategyFromEnv(UNLOCKED)).toBeUndefined();
    });

    it('should serve a keyed fake provider, prefer provider order, and honour the decision pin', () => {
      const { lane } = laneOf();
      const both = { ...UNLOCKED, ALPHA_API_KEY: 'sk-fake-alpha', BETA_API_KEY: 'sk-fake-beta' };

      expect(lane.liveDecisionStrategyFromEnv({ ...UNLOCKED, ALPHA_API_KEY: 'sk-fake-alpha' })?.strategy.kind).toBe(LLM_SCRIPTED_DECISION_STRATEGY_ID);
      expect(lane.liveDecisionStrategyFromEnv(both)?.strategyId).toBe('alpha');
      expect(lane.liveDecisionStrategyFromEnv({ ...both, LLM_DECISION_PROVIDER: 'beta' })?.strategyId).toBe('beta');
    });

    it('should throw on a decision pin naming a strategy that is not registered', () => {
      const { lane } = laneOf();
      const keyed = { ...UNLOCKED, ALPHA_API_KEY: 'sk-fake-alpha', BETA_API_KEY: 'sk-fake-beta' };
      expect(() => lane.liveDecisionStrategyFromEnv({ ...keyed, LLM_DECISION_PROVIDER: 'gamma' })).toThrow("llm live specs: LLM_DECISION_PROVIDER names decision strategy 'gamma', which is not registered (have: alpha, beta).");
      expect(() => lane.liveDecisionStrategyFromEnv({ ...UNLOCKED, LLM_DECISION_PROVIDER: 'alpha' })).toThrow("llm live specs: LLM_DECISION_PROVIDER names decision strategy 'alpha', which is not registered (have: (none)).");
    });

    it('should serve a base-declared provider through its declared decision route', () => {
      const { lane } = laneOf({ modelConfig: { base: { providers: { gamma: { transport: 'plain', decision: 'fake-decision', apiKeyEnv: 'GAMMA_API_KEY' } } } } });
      expect(lane.liveDecisionStrategyFromEnv({ ...UNLOCKED, GAMMA_API_KEY: 'sk-fake-gamma' })?.strategyId).toBe('gamma');
    });
  });

  describe('probes', () => {
    it("should report a rejected key as dead with the provider's words, at the selected provider's URL", async () => {
      const { lane } = laneOf();
      const { fetch, urls } = recordingFetchOf(401);
      const report = await lane.probeCredentials({ env: KEYED, fetch });

      expect(report.ready).toBe(false);
      expect(urls).toEqual([`${FAKE_URL}/key`]);
      expect(JSON.stringify(report)).toContain('User not found.');
    });

    it('should report an accepted key as ready', async () => {
      const { lane } = laneOf();
      await expect(lane.probeCredentials({ env: KEYED, fetch: recordingFetchOf(200).fetch })).resolves.toMatchObject({ ready: true });
    });

    it('should ask nothing on a keyless environment', async () => {
      const { lane } = laneOf();
      const { fetch, urls } = recordingFetchOf();

      await expect(lane.probeCredentials({ env: UNLOCKED, fetch })).resolves.toEqual({ ready: true, checked: [] });
      await expect(lane.readProviderStatus({ env: UNLOCKED, fetch })).resolves.toEqual({ checked: [] });
      expect(urls).toEqual([]);
    });

    it("should probe a metered provider through its ACCOUNT's credential probe", async () => {
      const { lane } = laneOf();
      const { fetch, urls } = recordingFetchOf();
      await lane.probeCredentials({ env: { ...KEYED, ALPHA_BASE_URL: METERED_URL }, fetch });
      expect(urls).toEqual([`${METERED_URL}/account/auth`]);
    });

    it('should probe EVERY keyed provider in provider order, and a base-declared keyed one at its own endpoint, never a gap', async () => {
      const { lane } = laneOf({ modelConfig: { base: { providers: { gamma: { transport: 'fake', baseUrl: 'https://gamma.example/v1', apiKeyEnv: 'GAMMA_API_KEY' }, delta: { transport: 'fake', baseUrl: 'https://delta.example/v1', apiKeyEnv: 'DELTA_API_KEY' } } } } });
      const { fetch, urls, keys } = recordingFetchOf();
      await lane.probeCredentials({ env: { ...KEYED, BETA_API_KEY: 'sk-fake-beta', GAMMA_API_KEY: 'sk-fake-gamma' }, fetch });

      expect(keys.filter((key) => key?.includes('alpha') || key?.includes('beta'))).toEqual(['Bearer sk-fake-alpha', 'Bearer sk-fake-beta']);
      expect(urls).toContain('https://gamma.example/v1/key');
      expect(urls.some((url) => url.includes('delta'))).toBe(false);
    });
  });

  describe('makeGlobalSetup()', () => {
    const lockedEnv = () => ({ ALPHA_API_KEY: 'sk-fake-alpha', BETA_API_KEY: 'sk-fake-beta', GAMMA_API_KEY: 'sk-fake-gamma', EXTRA_API_KEY: 'sk-fake-extra', UNRELATED: 'kept' }) as Record<string, string | undefined>;
    const hermeticLane = () => laneOf({ modelConfig: { base: { providers: { gamma: { transport: 'fake', apiKeyEnv: 'GAMMA_API_KEY' } } } }, extraProviderKeyNames: ['EXTRA_API_KEY'] });

    it('should strip every provider key when locked, and make no request or verdict', async () => {
      const { lane, logged } = hermeticLane();
      const { fetch, urls } = recordingFetchOf();
      const env = lockedEnv();

      await lane.makeGlobalSetup({ env, fetch })();

      expect(env).toEqual({ UNRELATED: 'kept' });
      expect(urls).toEqual([]);
      expect(logged).toEqual([]);
    });

    it('should keep the keys when hermetic is off', async () => {
      const { lane } = hermeticLane();
      const env = lockedEnv();
      await lane.makeGlobalSetup({ env, hermetic: false, fetch: recordingFetchOf().fetch })();
      expect(env).toEqual(lockedEnv());
    });

    it('should stamp both verdicts when unlocked, logging the lane once and the measured headroom', async () => {
      const { lane, logged } = laneOf();
      const env: Record<string, string | undefined> = { ...KEYED, ALPHA_BASE_URL: METERED_URL };

      await lane.makeGlobalSetup({ env, fetch: recordingFetchOf().fetch })();

      expect(env['LLM_CREDENTIAL_VERDICT']).toBe('live');
      expect(env['LLM_QUOTA_VERDICT']).toBe('ok');
      expect(env['LLM_QUOTA_DETAIL']).toContain('rolling 7 days');
      expect(logged.filter((line) => line.includes("'alpha' via ALPHA_API_KEY on vendor/model-pinned (pinned by env)"))).toHaveLength(1);
      expect(logged.some((line) => line.includes('provider quota:'))).toBe(true);
    });

    it('should stamp unchecked and say so when unlocked with no key', async () => {
      const { lane, logged } = laneOf();
      const env: Record<string, string | undefined> = { ...UNLOCKED };

      await lane.makeGlobalSetup({ env, fetch: recordingFetchOf().fetch })();

      expect(env['LLM_CREDENTIAL_VERDICT']).toBe('unchecked');
      expect(logged[0]).toContain('no provider is keyed (ALPHA_API_KEY, BETA_API_KEY)');
    });

    it('should honour the skip flags: no request for that half, and its stale verdict cleared so the lane opens', async () => {
      const { lane } = laneOf();
      const { fetch, urls } = recordingFetchOf(401);
      const env: Record<string, string | undefined> = { ...KEYED, LLM_LIVE_SPECS_SKIP_CREDENTIAL_PROBE: '1', LLM_LIVE_SPECS_SKIP_QUOTA_PROBE: 'true', LLM_CREDENTIAL_VERDICT: 'dead', LLM_CREDENTIAL_DETAIL: 'stale', LLM_QUOTA_VERDICT: 'exhausted', LLM_QUOTA_DETAIL: 'stale' };

      await lane.makeGlobalSetup({ env, fetch })();

      expect(urls).toEqual([]);
      expect(env['LLM_CREDENTIAL_VERDICT']).toBeUndefined();
      expect(env['LLM_QUOTA_VERDICT']).toBeUndefined();
      expect(lane.liveStrategyFromEnv(env)?.strategyId).toBe('alpha');
    });

    it('should throw from the setup on a malformed models file', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'llm-lane-'));
      const defaultPath = join(dir, 'models.json');
      writeFileSync(defaultPath, '{ not json');
      const { lane } = laneOf({ modelConfig: { defaultPath } });

      await expect(lane.makeGlobalSetup({ env: { ...KEYED }, fetch: recordingFetchOf().fetch })()).rejects.toThrow();
    });
  });

  describe('the hermetic strip', () => {
    it('should remove exactly the key names and return them', () => {
      const { lane } = laneOf({ extraProviderKeyNames: ['EXTRA_API_KEY'] });
      const env: Record<string, string | undefined> = { ALPHA_API_KEY: 'a', EXTRA_API_KEY: 'e', UNRELATED: 'u' };

      expect(lane.providerKeyNames()).toEqual(['ALPHA_API_KEY', 'BETA_API_KEY', 'EXTRA_API_KEY']);
      expect(lane.stripProviderKeysUnlessUnlocked(env)).toEqual(['ALPHA_API_KEY', 'EXTRA_API_KEY']);
      expect(env).toEqual({ UNRELATED: 'u' });
    });

    it('should keep the keys when unlocked', () => {
      const { lane } = laneOf();
      const env: Record<string, string | undefined> = { ...UNLOCKED, ALPHA_API_KEY: 'a' };

      expect(lane.stripProviderKeysUnlessUnlocked(env)).toEqual([]);
      expect(env['ALPHA_API_KEY']).toBe('a');
    });
  });
});
