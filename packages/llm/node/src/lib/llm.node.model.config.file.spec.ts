import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type LlmModelConfigExtensionInput, type LlmModelConfigFile, type LlmModelConfigTypes, llmModelReasoningOffEncodings, makeLlmModelConfigSchema, resolveLlmModelProfile } from '@dereekb/llm';
import { DEFAULT_LLM_ENV_NAMES, type LlmEnvNames } from './llm.node.env';
import { loadEffectiveLlmModelConfigFile, loadLlmModelConfigFile, resolveLlmModelConfigFilePath, writeLlmModelConfigFile } from './llm.node.model.config.file';
import { resolveLlmModelProfileFromEnv } from './llm.node.model.profile';

interface TestFields {
  readonly region?: string;
}

interface TestTypes extends LlmModelConfigTypes {
  readonly providerFields: TestFields;
  readonly extensionProviderEntry: never;
  readonly modelFields: object;
}

function parseRegion(input: LlmModelConfigExtensionInput): TestFields {
  const region = input.entry['region'];

  if (region !== undefined && (typeof region !== 'string' || region.trim().length === 0)) {
    throw new Error(`${input.schemaLabel}: ${input.label}.region must be a non-empty string.`);
  }

  return region === undefined ? {} : { region };
}

function parseRegionPatch(input: LlmModelConfigExtensionInput): TestFields {
  for (const key of Object.keys(input.entry)) {
    if (key !== 'region') {
      throw new Error(`${input.schemaLabel}: ${input.label} is a region patch, but '${key}' is not a region key.`);
    }
  }

  return parseRegion(input);
}

const schema = makeLlmModelConfigSchema<TestTypes>({
  label: 'test models',
  transports: ['openai', 'openrouter'],
  meterings: ['gateway'],
  extension: {
    providerKeys: ['region'],
    parseProviderFields: parseRegion,
    parseProviderPatch: parseRegionPatch
  }
});

/**
 * An entry of the `media` transport the second test extension owns — a provider that serves no completions.
 */
interface TestMediaEntry extends TestFields {
  readonly transport: 'media';
  readonly baseUrl: string;
}

interface TestMediaTypes extends LlmModelConfigTypes {
  readonly providerFields: TestFields;
  readonly extensionProviderEntry: TestMediaEntry;
  readonly modelFields: object;
}

/**
 * The region extension plus an owned `media` transport, so one file carries completion entries, owned entries and
 * patches.
 */
const mediaSchema = makeLlmModelConfigSchema<TestMediaTypes>({
  label: 'test models',
  transports: ['openai'],
  extension: {
    providerKeys: ['region'],
    parseProviderFields: parseRegion,
    providerTransports: ['media'],
    parseProviderEntry: (input) => ({ transport: 'media', baseUrl: input.baseUrl ?? '', ...input.fields }),
    parseProviderPatch: parseRegionPatch
  }
});

/**
 * The host's built-ins: one gateway provider, two profiles, one per-slug fact, and no `active`.
 */
const BASE: LlmModelConfigFile<TestTypes> = {
  providers: { gateway: { transport: 'openai', baseUrl: 'https://gateway.example/v1', apiKeyEnv: 'GATEWAY_API_KEY' } },
  profiles: { cheap: { tiers: { fast: 'vendor/small-free', strong: 'vendor/large-free' } }, wide: { tiers: { fast: 'vendor/wide', strong: 'vendor/wider' } } },
  models: { 'vendor/small-free': { provider: 'gateway', reasoningOff: 'effort-minimal' } }
};

/**
 * An operator's on-disk file: a LAN provider, a `cheap` profile replacing the built-in one wholesale, and a binding.
 */
const OPERATOR_FILE = {
  active: 'cheap',
  providers: { local: { transport: 'openai', baseUrl: 'http://192.168.1.50:8000/v1', apiKeyEnv: 'LOCAL_API_KEY' } },
  profiles: { cheap: { fast: 'local/qwen' } },
  models: { 'local/qwen': { provider: 'local' } }
};

describe('model config file', () => {
  let dir: string;
  let defaultPath: string;

  function writeJson(path: string, value: unknown): void {
    writeFileSync(path, JSON.stringify(value), 'utf8');
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'llm-node-'));
    defaultPath = join(dir, 'models.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe('resolveLlmModelConfigFilePath()', () => {
    it('should answer the default path when nothing exists', () => {
      expect(resolveLlmModelConfigFilePath({ env: {}, defaultPath })).toBe(defaultPath);
    });

    it('should prefer the explicit env path and not throw when it is missing', () => {
      const explicit = join(dir, 'missing', 'models.json');
      expect(resolveLlmModelConfigFilePath({ env: { LLM_MODELS_FILE: ` ${explicit} ` }, defaultPath })).toBe(explicit);
    });
  });

  describe('loadLlmModelConfigFile()', () => {
    it('should return undefined when no file exists', () => {
      expect(loadLlmModelConfigFile({ env: {}, defaultPath, schema })).toBeUndefined();
    });

    it('should load the default path', () => {
      writeJson(defaultPath, OPERATOR_FILE);
      const loaded = loadLlmModelConfigFile({ env: {}, defaultPath, schema });
      expect(loaded?.filePath).toBe(defaultPath);
      expect(loaded?.file.active).toBe('cheap');
      expect(loaded?.file.profiles?.['cheap']).toEqual({ tiers: { fast: 'local/qwen' } });
    });

    it('should prefer the explicit env path over the default path', () => {
      const explicit = join(dir, 'other.json');
      writeJson(defaultPath, OPERATOR_FILE);
      writeJson(explicit, { active: 'wide' });
      const loaded = loadLlmModelConfigFile({ env: { LLM_MODELS_FILE: explicit }, defaultPath, schema });
      expect(loaded?.filePath).toBe(explicit);
      expect(loaded?.file).toEqual({ active: 'wide' });
    });

    it('should throw naming the variable when the explicit path is missing', () => {
      const explicit = join(dir, 'missing.json');
      writeJson(defaultPath, OPERATOR_FILE);
      expect(() => loadLlmModelConfigFile({ env: { LLM_MODELS_FILE: explicit }, defaultPath, schema })).toThrow(`test models: LLM_MODELS_FILE points at a missing file: ${explicit}`);
    });

    it('should throw naming the path on malformed JSON, keeping the cause', () => {
      writeFileSync(defaultPath, '{ "active": ', 'utf8');
      let error: unknown;

      try {
        loadLlmModelConfigFile({ env: {}, defaultPath, schema });
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/failed to parse/);
      expect((error as Error).message).toContain(defaultPath);
      expect((error as Error).cause).toBeInstanceOf(SyntaxError);
    });

    it('should throw naming the path when the file does not match the schema', () => {
      writeJson(defaultPath, { activ: 'cheap' });
      expect(() => loadLlmModelConfigFile({ env: {}, defaultPath, schema })).toThrow(defaultPath);
    });

    it('should honour custom models-file names', () => {
      const names: LlmEnvNames = { ...DEFAULT_LLM_ENV_NAMES, modelsFile: ['HOST_MODELS', 'LLM_MODELS_FILE'] };
      const explicit = join(dir, 'host.json');
      writeJson(explicit, { active: 'wide' });
      const loaded = loadLlmModelConfigFile({ env: { HOST_MODELS: explicit, LLM_MODELS_FILE: join(dir, 'missing.json') }, names, defaultPath, schema });
      expect(loaded?.filePath).toBe(explicit);
      expect(() => loadLlmModelConfigFile({ env: { HOST_MODELS: join(dir, 'missing.json') }, names, defaultPath, schema })).toThrow(/HOST_MODELS points at a missing file/);
    });
  });

  describe('loadEffectiveLlmModelConfigFile()', () => {
    it('should lay the file over the base and report the user file', () => {
      writeJson(defaultPath, OPERATOR_FILE);
      const loaded = loadEffectiveLlmModelConfigFile({ env: {}, defaultPath, schema, base: BASE });
      expect(loaded.fileExists).toBe(true);
      expect(loaded.filePath).toBe(defaultPath);
      expect(loaded.userFile?.providers).toEqual({ local: OPERATOR_FILE.providers.local });
      expect(Object.keys(loaded.file.providers ?? {})).toEqual(['gateway', 'local']);
      expect(loaded.file.models?.['vendor/small-free']).toEqual(BASE.models?.['vendor/small-free']);
      expect(loaded.file.models?.['local/qwen']).toEqual({ provider: 'local' });
    });

    it('should replace a base profile wholesale, never half-swapping its tiers', () => {
      writeJson(defaultPath, OPERATOR_FILE);
      const loaded = loadEffectiveLlmModelConfigFile({ env: {}, defaultPath, schema, base: BASE });
      expect(loaded.file.profiles?.['cheap']).toEqual({ tiers: { fast: 'local/qwen' } });
      expect(loaded.file.profiles?.['wide']).toEqual(BASE.profiles?.['wide']);
      expect(resolveLlmModelProfile({ file: loaded.file, source: loaded.filePath, schema })).toEqual({ profileName: 'cheap', tiers: { fast: 'local/qwen' }, selectedBy: 'file' });
    });

    it('should return the base alone when no file exists, selecting nothing', () => {
      const loaded = loadEffectiveLlmModelConfigFile({ env: {}, defaultPath, schema, base: BASE });
      expect(loaded.fileExists).toBe(false);
      expect(loaded.userFile).toBeUndefined();
      expect('userFile' in loaded).toBe(false);
      expect(loaded.filePath).toBe(defaultPath);
      expect(loaded.file.profiles).toEqual(BASE.profiles);
      expect(resolveLlmModelProfile({ file: loaded.file, source: loaded.filePath, schema })).toBeUndefined();
    });

    it('should answer an empty file with no base and no file', () => {
      const loaded = loadEffectiveLlmModelConfigFile({ env: {}, defaultPath, schema });
      expect(loaded.fileExists).toBe(false);
      expect(loaded.file.profiles ?? {}).toEqual({});
    });

    it('should carry the base per-slug facts with no file', () => {
      const loaded = loadEffectiveLlmModelConfigFile({ env: {}, defaultPath, schema, base: BASE });
      expect(llmModelReasoningOffEncodings(loaded.file)).toEqual({ 'vendor/small-free': 'effort-minimal' });
    });

    it('should resolve an env-selected base profile on a machine with no file', () => {
      const env = { LLM_MODEL_PROFILE: 'wide' };
      const loaded = loadEffectiveLlmModelConfigFile({ env, defaultPath, schema, base: BASE });
      expect(resolveLlmModelProfileFromEnv({ env, file: loaded.file, source: loaded.filePath, schema })).toEqual({ profileName: 'wide', tiers: BASE.profiles?.['wide']?.tiers, selectedBy: 'override', overrideEnv: 'LLM_MODEL_PROFILE' });
    });

    it('should fail loud on an explicit missing path', () => {
      expect(() => loadEffectiveLlmModelConfigFile({ env: { LLM_MODELS_FILE: join(dir, 'missing.json') }, defaultPath, schema, base: BASE })).toThrow(/points at a missing file/);
    });
  });

  describe('writeLlmModelConfigFile()', () => {
    it('should create the directory and write 2-space JSON with a trailing newline that round-trips', () => {
      const filePath = join(dir, 'nested', 'deeper', 'models.json');
      const file: LlmModelConfigFile<TestTypes> = { active: 'cheap', profiles: { cheap: { tiers: { fast: 'vendor/a' } } } };
      const written = writeLlmModelConfigFile({ file, filePath, schema });
      const text = readFileSync(filePath, 'utf8');
      expect(text).toBe(`${JSON.stringify({ active: 'cheap', profiles: { cheap: { fast: 'vendor/a' } } }, null, 2)}\n`);
      expect(written).toEqual(file);
      expect(loadLlmModelConfigFile({ env: {}, defaultPath: filePath, schema })?.file).toEqual(file);
    });

    it('should refuse an active naming an undefined profile and write nothing', () => {
      expect(() => writeLlmModelConfigFile({ file: { active: 'ghost', profiles: { cheap: { tiers: { fast: 'vendor/a' } } } }, filePath: defaultPath, schema, base: BASE })).toThrow(/names profile 'ghost'/);
      expect(existsSync(defaultPath)).toBe(false);
      expect(readdirSync(dir)).toEqual([]);
    });

    it('should refuse a payload the schema rejects and write nothing', () => {
      // A blank key var type-checks (a string) but the schema rejects it — the payload is well-typed and still refused.
      const file: LlmModelConfigFile<TestTypes> = { providers: { broken: { transport: 'openai', baseUrl: 'http://x/v1', apiKeyEnv: '' } } };
      expect(() => writeLlmModelConfigFile({ file, filePath: defaultPath, schema })).toThrow(/apiKeyEnv/);
      expect(readdirSync(dir)).toEqual([]);
    });

    it('should write the keys in a fixed order, keeping notes and $schema', () => {
      const file: LlmModelConfigFile<TestTypes> = {
        models: { 'local/qwen': { provider: 'local' } },
        profiles: { cheap: { tiers: { fast: 'local/qwen' } } },
        providers: { local: { transport: 'openai', apiKeyEnv: 'LOCAL_API_KEY' } },
        active: 'cheap',
        notes: 'hand-written note',
        $schema: './models.schema.json'
      };

      writeLlmModelConfigFile({ file, filePath: defaultPath, schema });
      const onDisk = JSON.parse(readFileSync(defaultPath, 'utf8')) as Record<string, unknown>;
      expect(Object.keys(onDisk)).toEqual(['$schema', 'notes', 'active', 'providers', 'profiles', 'models']);
      expect(onDisk['notes']).toBe('hand-written note');
      expect(onDisk['$schema']).toBe('./models.schema.json');
    });

    it('should write profiles flat, with no tiers key', () => {
      writeLlmModelConfigFile({ file: { profiles: { cheap: { tiers: { fast: 'vendor/a', strong: { model: 'vendor/b', maxOutputTokens: 512 } } } } }, filePath: defaultPath, schema });
      const onDisk = JSON.parse(readFileSync(defaultPath, 'utf8')) as { profiles: Record<string, unknown> };
      expect(onDisk.profiles['cheap']).toEqual({ fast: 'vendor/a', strong: { model: 'vendor/b', maxOutputTokens: 512 } });
    });

    it('should carry providers and models through a profile-only write', () => {
      writeJson(defaultPath, OPERATOR_FILE);
      const loaded = loadEffectiveLlmModelConfigFile({ env: {}, defaultPath, schema, base: BASE });
      const userFile = loaded.userFile ?? {};
      writeLlmModelConfigFile({ file: { ...userFile, profiles: { ...userFile.profiles, mixed: { tiers: { fast: 'local/qwen', strong: 'vendor/wider' } } } }, filePath: loaded.filePath, schema, base: BASE });
      const reread = loadLlmModelConfigFile({ env: {}, defaultPath, schema });
      expect(reread?.file.providers).toEqual(OPERATOR_FILE.providers);
      expect(reread?.file.models).toEqual(OPERATOR_FILE.models);
      expect(Object.keys(reread?.file.profiles ?? {})).toEqual(['cheap', 'mixed']);
    });

    it('should keep a binding through an active-only write over a provider-bearing file', () => {
      writeJson(defaultPath, OPERATOR_FILE);
      const loaded = loadEffectiveLlmModelConfigFile({ env: {}, defaultPath, schema, base: BASE });
      writeLlmModelConfigFile({ file: { ...loaded.userFile, active: 'cheap' }, filePath: loaded.filePath, schema, base: BASE });
      const effective = loadEffectiveLlmModelConfigFile({ env: {}, defaultPath, schema, base: BASE });
      expect(effective.file.models?.['local/qwen']).toEqual({ provider: 'local' });
      expect(effective.file.providers?.['local']).toEqual(OPERATOR_FILE.providers.local);
    });

    it('should accept an active naming a base profile', () => {
      const written = writeLlmModelConfigFile({ file: { active: 'wide' }, filePath: defaultPath, schema, base: BASE });
      expect(written).toEqual({ active: 'wide' });
      expect(JSON.parse(readFileSync(defaultPath, 'utf8'))).toEqual({ active: 'wide' });
    });

    it('should fold a patch back after the full entries, with no providerPatches key on disk', () => {
      const file: LlmModelConfigFile<TestTypes> = { providers: { local: OPERATOR_FILE.providers.local }, providerPatches: { gateway: { region: 'eu' } } };
      const written = writeLlmModelConfigFile({ file, filePath: defaultPath, schema, base: BASE });
      const onDisk = JSON.parse(readFileSync(defaultPath, 'utf8')) as Record<string, unknown>;
      expect(onDisk).toEqual({ providers: { local: OPERATOR_FILE.providers.local, gateway: { region: 'eu' } } });
      expect(Object.keys(onDisk['providers'] as object)).toEqual(['local', 'gateway']);
      expect('providerPatches' in onDisk).toBe(false);
      expect(written.providerPatches).toEqual({ gateway: { region: 'eu' } });
      expect(loadEffectiveLlmModelConfigFile({ env: {}, defaultPath, schema, base: BASE }).file.providers?.['gateway']).toEqual({ ...BASE.providers?.['gateway'], region: 'eu' });
    });

    it('should write completion entries, then extension-owned entries, then patches', () => {
      const speaker = { transport: 'media', baseUrl: 'http://192.168.1.60:9000' };
      writeJson(defaultPath, { providers: { gateway: { region: 'eu' }, speaker, local: OPERATOR_FILE.providers.local } });
      const mediaBase: LlmModelConfigFile<TestMediaTypes> = { providers: { gateway: { transport: 'openai', baseUrl: 'https://gateway.example/v1', apiKeyEnv: 'GATEWAY_API_KEY' } } };
      const loaded = loadLlmModelConfigFile({ env: {}, defaultPath, schema: mediaSchema });
      expect(Object.keys(loaded?.file.providers ?? {})).toEqual(['local']);
      expect(loaded?.file.extensionProviders).toEqual({ speaker });
      expect(loaded?.file.providerPatches).toEqual({ gateway: { region: 'eu' } });

      const written = writeLlmModelConfigFile({ file: loaded?.file ?? {}, filePath: defaultPath, schema: mediaSchema, base: mediaBase });
      const onDisk = JSON.parse(readFileSync(defaultPath, 'utf8')) as { providers: Record<string, unknown> };
      expect(Object.keys(onDisk.providers)).toEqual(['local', 'speaker', 'gateway']);
      expect(onDisk.providers).toEqual({ local: OPERATOR_FILE.providers.local, speaker, gateway: { region: 'eu' } });
      expect(written).toEqual(loaded?.file);
    });

    it('should leave no temp file behind', () => {
      writeLlmModelConfigFile({ file: { active: 'wide' }, filePath: defaultPath, schema, base: BASE });
      expect(readdirSync(dir)).toEqual(['models.json']);
    });

    it('should propagate a failed rename and remove the temp file', () => {
      mkdirSync(defaultPath);
      writeFileSync(join(defaultPath, 'occupied'), 'x', 'utf8');
      expect(() => writeLlmModelConfigFile({ file: { active: 'wide' }, filePath: defaultPath, schema, base: BASE })).toThrow();
      expect(readdirSync(dir)).toEqual(['models.json']);
      expect(readdirSync(dir).some((name) => name.endsWith('.writing'))).toBe(false);
    });
  });
});
