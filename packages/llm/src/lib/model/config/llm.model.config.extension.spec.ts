import { describe, expect, it } from 'vitest';
import { mergeLlmModelConfigFiles, overlayLlmModelConfigFile } from './llm.model.config.merge';
import { parseLlmModelConfigFile } from './llm.model.config.parse';
import { llmModelProviderBindings, llmModelPromptAddenda, llmModelReasoningOffEncodings, llmModelVisionCapabilities, resolveLlmProviderConfigs } from './llm.model.config.resolve';
import { LLM_PROVIDER_COMPLETION_ONLY_KEYS, llmCompletionProviderEntries, type LlmModelConfigExtensionInput, type LlmModelConfigFile, type LlmModelConfigTypes, makeLlmModelConfigSchema } from './llm.model.config.schema';

/**
 * A media-like test extension: speech routes on any provider, a `none` transport for speech-only providers, speech
 * patches over a built-in provider, a `voice-vendor` metering source, and a `voice` per-slug fact.
 */
type SpeechRoute = 'vendor-a' | 'vendor-b' | 'none';

const SPEECH_ROUTES: ReadonlyArray<string> = ['vendor-a', 'vendor-b', 'none'];
const SPEECH_KEYS: ReadonlyArray<string> = ['speech', 'speechModel'];

interface TestSpeechFields {
  readonly speech?: SpeechRoute;
  readonly speechModel?: string;
}

interface TestSpeechProviderEntry extends TestSpeechFields {
  readonly transport: 'none';
  readonly baseUrl: string;
  readonly apiKeyEnv?: string;
  readonly metering?: string;
}

interface TestMediaTypes extends LlmModelConfigTypes {
  readonly providerFields: TestSpeechFields;
  readonly extensionProviderEntry: TestSpeechProviderEntry;
  readonly modelFields: { readonly voice?: boolean };
}

function parseSpeechFields(input: LlmModelConfigExtensionInput): TestSpeechFields {
  const { schemaLabel, label, entry } = input;
  const speech = entry['speech'];
  const speechModel = entry['speechModel'];

  if (speech !== undefined && (typeof speech !== 'string' || !SPEECH_ROUTES.includes(speech))) {
    throw new Error(`${schemaLabel}: ${label}.speech must be one of ${SPEECH_ROUTES.join(', ')}.`);
  }

  if (speechModel !== undefined && (typeof speechModel !== 'string' || speechModel.trim().length === 0)) {
    throw new Error(`${schemaLabel}: ${label}.speechModel must be a non-empty string.`);
  }

  return { ...(speech === undefined ? {} : { speech: speech as SpeechRoute }), ...(speechModel === undefined ? {} : { speechModel: speechModel as string }) };
}

function servesSpeech(fields: TestSpeechFields): boolean {
  return fields.speech != null && fields.speech !== 'none';
}

const schema = makeLlmModelConfigSchema<TestMediaTypes>({
  label: 'test models',
  transports: ['openai', 'openrouter'],
  meterings: ['zenmux'],
  decisionRoutes: ['zenmux', 'openrouter'],
  implicitProviders: ['openai', 'openrouter'],
  retiredKeys: { provider: new Map([['legacyRoute', 'renamed speech.']]) },
  extension: {
    providerKeys: SPEECH_KEYS,
    parseProviderFields: parseSpeechFields,
    providerTransports: ['none'],
    parseProviderEntry: (input) => {
      const { schemaLabel, label, entry, baseUrl, fields, meterings } = input;

      if (baseUrl == null) {
        throw new Error(`${schemaLabel}: ${label}.baseUrl is required on a speech-only provider.`);
      }

      for (const key of LLM_PROVIDER_COMPLETION_ONLY_KEYS) {
        if (entry[key] !== undefined) {
          throw new Error(`${schemaLabel}: ${label}.${key} does not apply to a speech-only provider.`);
        }
      }

      if (!servesSpeech(fields)) {
        throw new Error(`${schemaLabel}: ${label} serves no speech route.`);
      }

      const metering = entry['metering'];

      if (metering !== undefined && (typeof metering !== 'string' || !meterings.includes(metering))) {
        throw new Error(`${schemaLabel}: ${label}.metering must be one of ${meterings.join(', ')}.`);
      }

      const apiKeyEnv = entry['apiKeyEnv'];
      return { transport: 'none', baseUrl: baseUrl.trim(), ...(typeof apiKeyEnv === 'string' ? { apiKeyEnv } : {}), ...(metering === undefined ? {} : { metering }), ...fields };
    },
    isProviderBindable: (entry) => entry.speech === 'vendor-b',
    parseProviderPatch: (input) => {
      for (const key of Object.keys(input.entry)) {
        if (!SPEECH_KEYS.includes(key)) {
          throw new Error(`${input.schemaLabel}: ${input.label} is a speech patch, but '${key}' is not a speech key.`);
        }
      }

      const fields = parseSpeechFields(input);

      if (!servesSpeech(fields)) {
        throw new Error(`${input.schemaLabel}: ${input.label} declares no speech route.`);
      }

      return fields;
    },
    patchKeysNoun: 'speech route',
    meterings: ['voice-vendor'],
    modelKeys: ['voice'],
    parseModelFields: (input) => {
      const voice = input.entry['voice'];

      if (voice !== undefined && typeof voice !== 'boolean') {
        throw new Error(`${input.schemaLabel}: ${input.label}.voice must be a boolean.`);
      }

      return voice === undefined ? {} : { voice };
    }
  }
});

const SPEECH_PROVIDER = { transport: 'none', baseUrl: 'https://speech.example.com/v1', apiKeyEnv: 'SPEECH_API_KEY', metering: 'voice-vendor', speech: 'vendor-a' };

function parse(raw: unknown) {
  return parseLlmModelConfigFile({ raw, source: 'models.json', schema });
}

const BASE: LlmModelConfigFile<TestMediaTypes> = parse({
  providers: {
    gateway: { transport: 'openai', baseUrl: 'https://gateway.example.com/v1', apiKeyEnv: 'GATEWAY_API_KEY' },
    speech: SPEECH_PROVIDER
  }
});

describe('the model config extension seam', () => {
  it('prefixes every message with the schema label', () => {
    expect(() => parse([])).toThrow('test models: models.json must contain a JSON object.');
  });

  it('parses the extension keys on a completion entry, after the base keys', () => {
    const file = parse({ providers: { local: { speech: 'vendor-a', apiKeyEnv: 'LOCAL_API_KEY', speechModel: 'voice-1' } } });

    expect(file.providers?.['local']).toEqual({ transport: 'openai', apiKeyEnv: 'LOCAL_API_KEY', speech: 'vendor-a', speechModel: 'voice-1' });
    expect(Object.keys(file.providers?.['local'] ?? {})).toEqual(['transport', 'apiKeyEnv', 'speech', 'speechModel']);
    expect(() => parse({ providers: { local: { apiKeyEnv: 'K', speech: 'vendor-z' } } })).toThrow(`test models: models.json providers['local'].speech must be one of vendor-a, vendor-b, none.`);
  });

  it('hands an entry of an owned transport to the extension, whole', () => {
    expect(parse({ providers: { speech: SPEECH_PROVIDER } }).providers?.['speech']).toEqual(SPEECH_PROVIDER);
    expect(() => parse({ providers: { speech: { ...SPEECH_PROVIDER, reasoningOff: 'omit' } } })).toThrow(/reasoningOff does not apply to a speech-only provider/);
    expect(() => parse({ providers: { speech: { ...SPEECH_PROVIDER, metering: 'zenmux-x' } } })).toThrow(`test models: models.json providers['speech'].metering must be one of zenmux, voice-vendor, none.`);
    expect(() => parse({ providers: { local: { apiKeyEnv: 'K', transport: 'vllm' } } })).toThrow(/transport must be one of openai, openrouter, none \(got "vllm"\)/);
  });

  it('accepts the extension meterings on a completion entry', () => {
    expect(parse({ providers: { local: { apiKeyEnv: 'K', metering: 'voice-vendor' } } }).providers?.['local']).toMatchObject({ metering: 'voice-vendor' });
    expect(() => parse({ providers: { local: { apiKeyEnv: 'K', metering: 'other' } } })).toThrow(/metering must be one of zenmux, voice-vendor, none/);
  });

  it('drops the owned-transport entries from the completion providers', () => {
    expect(Object.keys(llmCompletionProviderEntries({ providers: BASE.providers, schema }))).toEqual(['gateway']);
    expect(resolveLlmProviderConfigs({ providers: BASE.providers, schema, apiKeyOf: () => 'k' }).providers.map((x) => x.id)).toEqual(['gateway']);
  });

  it('refuses a slug bound to an owned-transport entry unless the extension says it is bindable', () => {
    expect(() => overlayLlmModelConfigFile({ base: BASE, file: { models: { 'vendor/x': { provider: 'speech' } } }, schema })).toThrow(`test models: models.json models['vendor/x'].provider names provider 'speech', which serves no completions (transport 'none').`);

    const bindable = parse({ providers: { speech: { ...SPEECH_PROVIDER, speech: 'vendor-b' } }, models: { 'vendor/x': { provider: 'speech' } } });
    expect(() => overlayLlmModelConfigFile({ base: BASE, file: bindable, schema })).not.toThrow();
  });

  it('splits an identity-less entry off as a patch, never a provider', () => {
    const file = parse({ providers: { gateway: { speech: 'vendor-b' } } });

    expect(file.providers).toBeUndefined();
    expect(file.providerPatches).toEqual({ gateway: { speech: 'vendor-b' } });
    expect(() => parse({ providers: { gateway: { speech: 'none' } } })).toThrow(/declares no speech route/);
  });

  it("fails a patch's retired provider key with its remedy", () => {
    expect(() => parse({ providers: { gateway: { legacyRoute: 'vendor-a' } } })).toThrow(`test models: models.json providers['gateway'] has retired key 'legacyRoute'. renamed speech.`);
  });

  it('adds the patch hint to the missing-apiKeyEnv message', () => {
    expect(() => parse({ providers: { local: { baseUrl: 'http://x/v1', speech: 'vendor-a' } } })).toThrow(
      `test models: models.json providers['local'].apiKeyEnv must name the env var supplying this provider's key (got undefined). A declared provider is never billed on another provider's key. To extend a built-in provider with speech route keys only, carry those keys alone.`
    );
  });

  it('lays a patch over the base entry, keeping its transport, URL and key var, and drops the patches', () => {
    const merged = overlayLlmModelConfigFile({ base: BASE, file: parse({ providers: { gateway: { speech: 'vendor-b', speechModel: 'voice-2' } } }), schema });

    expect(merged.providers?.['gateway']).toEqual({ transport: 'openai', baseUrl: 'https://gateway.example.com/v1', apiKeyEnv: 'GATEWAY_API_KEY', speech: 'vendor-b', speechModel: 'voice-2' });
    expect(merged).not.toHaveProperty('providerPatches');
  });

  it('fails a patch that names no provider at merge, and no BUILT-IN at overlay', () => {
    const patch = parse({ providers: { nowhere: { speech: 'vendor-a' } } });

    expect(() => mergeLlmModelConfigFiles({ base: BASE, overlay: patch, schema })).toThrow(`test models: providers['nowhere'] carries only speech route keys, which extends an existing provider, but none is named 'nowhere'.`);
    expect(() => overlayLlmModelConfigFile({ base: BASE, file: patch, schema })).toThrow(
      `test models: models.json providers['nowhere'] carries only speech route keys, which extends a BUILT-IN provider, but no built-in is named 'nowhere' (built-ins: gateway, speech). Declare it in full (transport / baseUrl / apiKeyEnv).`
    );
    expect(() => overlayLlmModelConfigFile({ base: {}, file: patch, schema })).toThrow(/\(built-ins: \(none\)\)/);
  });

  it('parses the extension model key, which no base projection reads', () => {
    const file = parse({ models: { 'vendor/x': { voice: true } } });

    expect(file.models?.['vendor/x']).toEqual({ voice: true });
    expect(llmModelReasoningOffEncodings(file)).toBeUndefined();
    expect(llmModelVisionCapabilities(file)).toBeUndefined();
    expect(llmModelPromptAddenda(file)).toBeUndefined();
    expect(llmModelProviderBindings(file)).toBeUndefined();
  });

  it('lists the extension model key among the allowed keys', () => {
    expect(() => parse({ models: { 'vendor/x': { voices: true } } })).toThrow(`test models: models.json models['vendor/x'] has unknown key 'voices' (allowed: provider, reasoningOff, vision, promptAddendum, voice).`);
  });
});
