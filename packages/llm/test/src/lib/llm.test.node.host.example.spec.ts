/**
 * Runs `docs/node.md` `## A complete Node host` against inline adapters that stand in for `LLM_OPENAI_ADAPTERS` /
 * `LLM_OPENROUTER_ADAPTERS`. Lint forbids provider entries in this project, and `/node` specs may not import `/test`.
 * Every other statement is the doc's, plus an explicit `env` on each `/node` call and a `defaultPath` inside the
 * spec's temp dir (so no real home file is read) — change the two together.
 *
 * It also compiles and runs the `## Nest hosts` keys-from-elsewhere literal (`LlmProviderConfig` into
 * `makeLlmProviderStrategies`).
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type } from 'arktype';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_LLM_MAX_OUTPUT_TOKENS,
  defineLlmCapability,
  llmModelProviderBindings,
  llmModelReasoningOffEncodings,
  llmModelVisionCapabilities,
  makeLlmAdapterRegistry,
  makeLlmDispatcher,
  makeLlmModelConfigSchema,
  makeLlmProviderStrategies,
  makeLlmTieredPromptTemplateResolver,
  readLlmModelConfigLists,
  resolveLlmModelTier,
  resolveLlmModelTiers,
  toLlmCallLogPayload,
  type LlmCallLogPayloadWrite,
  type LlmCapabilityDescriptor,
  type LlmCompletionAdapter,
  type LlmProviderConfig
} from '@dereekb/llm';
import { loadEffectiveLlmModelConfigFile, makeLlmStrategiesFromEnv, resolveLlmModelProfileFromEnv, resolveLlmModelTierEnv } from '@dereekb/llm/node';
import { makeLlmScriptedStrategy } from './llm.test.scripted';

/**
 * The `models.json` the doc shows.
 */
const MODELS_JSON = {
  active: 'balanced',
  providers: { local: { transport: 'openai', baseUrl: 'http://127.0.0.1:8000/v1', apiKeyEnv: 'LOCAL_LLM_API_KEY' } },
  profiles: { balanced: { fast: 'local/small', strong: 'vendor/large' } },
  models: { 'local/small': { provider: 'local' } }
};

/**
 * The README quick start's capability and resolver, copied.
 */
const summarySchema = type({ summary: 'string' });
const SUMMARIZE = defineLlmCapability({
  capability: 'summarize',
  responseSchema: summarySchema,
  parseValue: (value) => {
    const out = summarySchema(value);
    return out instanceof type.errors ? undefined : out;
  }
});
const DESCRIPTORS: Readonly<Record<string, LlmCapabilityDescriptor>> = { summarize: SUMMARIZE };
const templateResolver = makeLlmTieredPromptTemplateResolver({
  tiers: [{ source: 'app', templates: [{ key: 'summarize-instructions', role: 'instructions', capability: 'summarize', text: 'Summarize the subject in one sentence.' }] }]
});

/**
 * A completion adapter standing in for a provider entry's: it mints a scripted strategy under the provider's own id.
 *
 * @param kind - The transport kind it serves.
 * @returns The adapter.
 */
function standIn(kind: string): LlmCompletionAdapter {
  return { facet: 'completion', kind, make: ({ provider }) => makeLlmScriptedStrategy({ id: provider.id, byCapability: { summarize: '{"summary":"ok"}' } }) };
}

describe('docs/node.md: a complete Node host', () => {
  let dir: string;
  let env: Record<string, string>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'llm-node-host-'));
    const modelsFile = join(dir, 'models.json');
    writeFileSync(modelsFile, JSON.stringify(MODELS_JSON), 'utf8');
    env = { LLM_MODELS_FILE: modelsFile, LOCAL_LLM_API_KEY: 'sk-local', OPENROUTER_API_KEY: 'sk-or', LLM_PROVIDER: 'openrouter' };
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('builds a dispatcher from the env and the models file, and routes each tier', async () => {
    const adapters = makeLlmAdapterRegistry([standIn('openai'), standIn('openrouter')]);
    const schema = makeLlmModelConfigSchema({ ...readLlmModelConfigLists(adapters), label: 'my-app models' });

    // LLM_MODELS_FILE, else ~/.my-app/models.json, else the base tiers alone.
    const loaded = loadEffectiveLlmModelConfigFile({ env, schema, defaultPath: join(dir, 'default-models.json') });

    // Tiers: env over the active profile over the host's base.
    const profile = resolveLlmModelProfileFromEnv({ env, file: loaded.file, source: loaded.filePath, schema });
    const tierEnv = resolveLlmModelTierEnv({ env });
    const { tiers, defaultTier } = resolveLlmModelTiers({ base: { fast: 'vendor/small', strong: 'vendor/large' }, modelTiers: { ...profile?.tiers, ...tierEnv.modelTiers }, defaultTier: tierEnv.defaultTier });

    // Providers: the env defaults plus the file's own, each keyed from the env.
    const { strategies, ids, defaultProviderId, gaps } = makeLlmStrategiesFromEnv({
      env,
      file: loaded.file,
      schema,
      adapters,
      defaultModel: resolveLlmModelTier(tiers, defaultTier),
      reasoningOffByModel: llmModelReasoningOffEncodings(loaded.file),
      visionByModel: llmModelVisionCapabilities(loaded.file)
    });

    if (defaultProviderId == null) {
      throw new Error('No LLM provider is configured.');
    }

    const rows: LlmCallLogPayloadWrite[] = [];
    const dispatcher = makeLlmDispatcher({
      strategies,
      defaultStrategyId: defaultProviderId,
      defaultMaxOutputTokens: DEFAULT_LLM_MAX_OUTPUT_TOKENS,
      modelTiers: tiers,
      defaultTier,
      decodeRetryTier: tierEnv.decodeRetryTier,
      providerByModel: llmModelProviderBindings(loaded.file),
      descriptorOf: (capability) => DESCRIPTORS[capability], // the README quick start's
      templateResolver, // the README quick start's
      recorder: { recordCall: (record) => rows.push(toLlmCallLogPayload(record)) }
    });

    // What the doc's env yields: no `openai` strategy (OPENAI_API_KEY is unset), the explicit default, no gaps.
    expect(loaded.fileExists).toBe(true);
    expect(ids).toEqual(['local', 'openrouter']);
    expect(defaultProviderId).toBe('openrouter');
    expect(gaps).toEqual([]);
    expect(tiers).toEqual({ fast: 'local/small', strong: 'vendor/large' });
    expect(defaultTier).toBe('fast');

    // `fast` → `local/small` on the file's `local` provider; `strong` → `vendor/large` on the default provider.
    const renderLiveContext = () => [{ key: 'subject', text: 'Subject: a brass desk lamp' }];
    await dispatcher.dispatch({ capability: 'summarize', tier: 'fast', renderLiveContext });
    await dispatcher.dispatch({ capability: 'summarize', tier: 'strong', renderLiveContext });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ capability: 'summarize', strategyId: 'local', model: 'local/small' });
    expect(rows[1]).toMatchObject({ capability: 'summarize', strategyId: 'openrouter', model: 'vendor/large' });
  });

  it('builds a strategy from a key that never touched the env (## Nest hosts)', () => {
    const secret = 'sk-from-a-secret-manager';
    const provider: LlmProviderConfig = { id: 'openrouter', transport: 'openrouter', apiKeyEnv: 'OPENROUTER_API_KEY', apiKey: secret };
    const strategies = makeLlmProviderStrategies({ providers: [provider], adapters: makeLlmAdapterRegistry([standIn('openrouter')]) });

    expect(strategies.map((x) => x.id)).toEqual(['openrouter']);
  });
});
