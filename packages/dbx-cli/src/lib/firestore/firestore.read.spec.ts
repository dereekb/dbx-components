import { describe, expect, it } from 'vitest';
import { MAX_MODEL_ACCESS_MULTI_READ_KEYS } from '../api/call-model.client';
import { type CliEnvConfig } from '../config/env';
import { type CliContext } from '../context/cli.context';
import { type CliModelManifest, type CliModelManifestEntry } from '../manifest/types';
import { CliError } from '../util/output';
import { type CliFirestoreModels } from './firestore.models';
import { MODEL_IS_SERVER_ONLY_CODE, assertCliModelIsNotServerOnly, cliReadResultMeta, coerceCliReadVia, getModelOverFirestore, getMultipleModelsOverFirestore, resolveCliReadSource, type CliReadVia } from './firestore.read';

const COMPLETE_FIREBASE = { apiKey: 'k', projectId: 'p', appId: 'a' };

function buildEntry(input: Partial<CliModelManifestEntry> & { readonly modelType: string }): CliModelManifestEntry {
  return {
    modelName: input.modelType,
    identityConst: `${input.modelType}Identity`,
    collectionPrefix: input.collectionPrefix ?? input.modelType.slice(0, 2),
    sourcePackage: 'demo-firebase',
    sourceFile: 'x.ts',
    fields: [],
    ...input
  } as CliModelManifestEntry;
}

const MANIFEST: CliModelManifest = [buildEntry({ modelType: 'guestbook', collectionPrefix: 'gb' }), buildEntry({ modelType: 'systemState', collectionPrefix: 'sys', serverOnly: true })];

function buildModels(loadModelForKey?: (key: string) => unknown): CliFirestoreModels {
  return {
    session: { fromCache: true } as never,
    collections: {},
    binding: { collections: () => ({}), models: (() => ({})) as never },
    allTypes: () => ['guestbook'],
    serviceFor: () =>
      ({
        loadModelForKey: ((key: string) => ({ snapshotData: async () => (loadModelForKey ? loadModelForKey(key) : { name: key }) })) as never,
        getFirestoreCollection: (() => undefined) as never
      }) as never,
    modelTypeForCollection: (collectionName) => collectionName
  };
}

interface BuildContextInput {
  readonly withBinding?: boolean;
  readonly firebaseComplete?: boolean;
  readonly sessionError?: unknown;
  readonly models?: CliFirestoreModels;
}

function buildContext(input: BuildContextInput = {}): CliContext {
  const withBinding = input.withBinding !== false;
  const models = input.models ?? buildModels();

  return {
    cliName: 'demo-cli',
    envName: 'local',
    env: { apiBaseUrl: 'http://localhost/api', ...(input.firebaseComplete === false ? {} : { firebase: COMPLETE_FIREBASE }) } as CliEnvConfig,
    accessToken: 'token',
    callModel: (async () => undefined) as never,
    getModel: (async (modelType: string, key: string) => ({ key, data: { over: 'api', modelType } })) as never,
    getMultipleModels: (async (_modelType: string, keys: readonly string[]) => ({ results: keys.map((key) => ({ key, data: { over: 'api' } })), errors: [] })) as never,
    modelManifest: MANIFEST,
    ...(withBinding
      ? {
          getFirestoreModels: async () => {
            if (input.sessionError !== undefined) throw input.sessionError;
            return models;
          }
        }
      : {})
  };
}

describe('coerceCliReadVia()', () => {
  it('defaults to auto', () => {
    expect(coerceCliReadVia(undefined)).toBe('auto');
    expect(coerceCliReadVia('')).toBe('auto');
  });

  it.each(['auto', 'firestore', 'api'] as CliReadVia[])('accepts %s', (via) => {
    expect(coerceCliReadVia(via)).toBe(via);
  });

  it('rejects an unknown value', () => {
    let error: unknown;
    try {
      coerceCliReadVia('grpc');
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).code).toBe('INVALID_ARGUMENT');
  });
});

describe('assertCliModelIsNotServerOnly()', () => {
  it('passes a model with no serverOnly flag', () => {
    expect(() => assertCliModelIsNotServerOnly({ manifest: MANIFEST, modelType: 'guestbook' })).not.toThrow();
  });

  it('passes a model absent from the manifest', () => {
    expect(() => assertCliModelIsNotServerOnly({ manifest: MANIFEST, modelType: 'notInManifest' })).not.toThrow();
  });

  it('passes when there is no manifest at all', () => {
    expect(() => assertCliModelIsNotServerOnly({ manifest: undefined, modelType: 'systemState' })).not.toThrow();
  });

  it('refuses a serverOnly model, naming the collection', () => {
    let error: unknown;
    try {
      assertCliModelIsNotServerOnly({ manifest: MANIFEST, modelType: 'systemState' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).code).toBe(MODEL_IS_SERVER_ONLY_CODE);
    expect((error as CliError).suggestion).toContain('sys');
  });
});

describe('resolveCliReadSource()', () => {
  describe('with a session available', () => {
    it('goes direct under auto', async () => {
      const result = await resolveCliReadSource({ context: buildContext(), via: 'auto', modelType: 'guestbook' });
      expect(result.source).toBe('firestore');
      expect(result.reason).toBe('session-available');
      expect(result.models).toBeDefined();
    });

    it('goes direct under an explicit --via firestore', async () => {
      const result = await resolveCliReadSource({ context: buildContext(), via: 'firestore', modelType: 'guestbook' });
      expect(result.source).toBe('firestore');
      expect(result.reason).toBe('explicit');
    });

    it('still uses the api under an explicit --via api, without opening a session', async () => {
      const result = await resolveCliReadSource({ context: buildContext(), via: 'api', modelType: 'guestbook' });
      expect(result.source).toBe('api');
      expect(result.reason).toBe('explicit');
      expect(result.models).toBeUndefined();
    });
  });

  describe('with no session available', () => {
    it('falls back to the api under auto when the CLI has no firestore binding', async () => {
      const result = await resolveCliReadSource({ context: buildContext({ withBinding: false }), via: 'auto', modelType: 'guestbook' });
      expect(result.source).toBe('api');
      expect(result.reason).toBe('no-firestore-binding');
    });

    it('falls back to the api under auto when the firebase config is incomplete', async () => {
      const result = await resolveCliReadSource({ context: buildContext({ firebaseComplete: false }), via: 'auto', modelType: 'guestbook' });
      expect(result.source).toBe('api');
      expect(result.reason).toBe('firebase-config-incomplete');
    });

    it('falls back to the api under auto on a CAPABILITY failure', async () => {
      const context = buildContext({ sessionError: new CliError({ message: 'not an admin', code: 'AUTH_FORBIDDEN' }) });
      const result = await resolveCliReadSource({ context, via: 'auto', modelType: 'guestbook' });
      expect(result.source).toBe('api');
      expect(result.reason).toBe('session-unavailable');
      expect(result.fallbackError).toBe('not an admin');
    });

    it('does NOT fall back on a per-document permission error', async () => {
      const context = buildContext({ sessionError: new CliError({ message: 'denied for gb/x', code: 'PERMISSION_DENIED' }) });
      await expect(resolveCliReadSource({ context, via: 'auto', modelType: 'guestbook' })).rejects.toThrow('denied for gb/x');
    });

    it('errors rather than degrading under an explicit --via firestore', async () => {
      const context = buildContext({ sessionError: new CliError({ message: 'no session module', code: 'NOT_FOUND' }) });
      await expect(resolveCliReadSource({ context, via: 'firestore', modelType: 'guestbook' })).rejects.toThrow('no session module');
    });

    it('errors under --via firestore when the CLI has no binding', async () => {
      const context = buildContext({ withBinding: false });
      await expect(resolveCliReadSource({ context, via: 'firestore', modelType: 'guestbook' })).rejects.toThrow('not configured for generic direct-Firestore reads');
    });
  });

  describe('server-only refusal', () => {
    it.each(['auto', 'firestore', 'api'] as CliReadVia[])('refuses on --via %s, before a transport is chosen', async (via) => {
      let error: unknown;
      try {
        await resolveCliReadSource({ context: buildContext(), via, modelType: 'systemState' });
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).code).toBe(MODEL_IS_SERVER_ONLY_CODE);
    });
  });
});

describe('cliReadResultMeta()', () => {
  it('reports the source, the requested via, and the session-cache state for a direct read', async () => {
    const resolved = await resolveCliReadSource({ context: buildContext(), via: 'auto', modelType: 'guestbook' });
    expect(cliReadResultMeta(resolved)).toEqual({ source: 'firestore', via: 'auto', reason: 'session-available', sessionFromCache: true });
  });

  it('reports the fallback error for an auto read that degraded', async () => {
    const context = buildContext({ sessionError: new CliError({ message: 'incomplete config', code: 'INVALID_ARGUMENT' }) });
    const resolved = await resolveCliReadSource({ context, via: 'auto', modelType: 'guestbook' });
    expect(cliReadResultMeta(resolved)).toEqual({ source: 'api', via: 'auto', reason: 'session-unavailable', fallbackError: 'incomplete config' });
  });
});

describe('getModelOverFirestore()', () => {
  it('emits the GetModelOverHttpResult envelope', async () => {
    const result = await getModelOverFirestore({ models: buildModels(), modelType: 'guestbook', key: 'gb/abc' });
    expect(result).toEqual({ key: 'gb/abc', data: { name: 'gb/abc' } });
  });

  it('emits data: null for a missing document', async () => {
    const result = await getModelOverFirestore({ models: buildModels(() => undefined), modelType: 'guestbook', key: 'gb/abc' });
    expect(result).toEqual({ key: 'gb/abc', data: null });
  });

  it('wraps a key/path mismatch into an INVALID_ARGUMENT CliError', async () => {
    const models = buildModels(() => {
      throw new Error('unexpected key/path "gb/abc" for expected type guestbookEntry');
    });

    let error: unknown;
    try {
      await getModelOverFirestore({ models, modelType: 'guestbookEntry', key: 'gb/abc' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).code).toBe('INVALID_ARGUMENT');
  });
});

describe('getMultipleModelsOverFirestore()', () => {
  it('emits the GetMultipleModelsOverHttpResult envelope', async () => {
    const result = await getMultipleModelsOverFirestore({ models: buildModels(), modelType: 'guestbook', keys: ['gb/a', 'gb/b'] });
    expect(result).toEqual({
      results: [
        { key: 'gb/a', data: { name: 'gb/a' } },
        { key: 'gb/b', data: { name: 'gb/b' } }
      ],
      errors: []
    });
  });

  it("caps concurrency at the API path's batch width while preserving key order", async () => {
    // `get-many -` reads unbounded keys from stdin, so one Promise.all over the whole list would open
    // thousands of concurrent reads. The batches are sequential; reads within a batch are not.
    let inFlight = 0;
    let peak = 0;
    const keys = Array.from({ length: MAX_MODEL_ACCESS_MULTI_READ_KEYS * 2 + 20 }, (_unused, index) => `gb/${index}`);
    const models = buildModels(async (key) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      // a REAL suspension point between the increment and the decrement. Without one, the counter
      // would rise and fall inside a single synchronous block and observe a peak of 1 no matter how
      // the reads were scheduled -- the assertion below would then pass vacuously against a fully
      // serial implementation.
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
      return { name: key };
    });

    const result = await getMultipleModelsOverFirestore({ models, modelType: 'guestbook', keys });

    expect(result.results).toHaveLength(keys.length);
    expect(result.results.map((r) => r.key)).toEqual(keys);
    // exactly the batch width: `toBe` pins BOTH halves at once -- above 1 proves the reads within a
    // batch really do overlap, and not `keys.length` proves the batching caps them.
    expect(peak).toBe(MAX_MODEL_ACCESS_MULTI_READ_KEYS);
  });

  it('partitions a per-key failure into errors and still returns the rest', async () => {
    const models = buildModels((key) => {
      if (key === 'gb/bad') throw new Error('unexpected key/path "gb/bad" for expected type guestbook');
      return { name: key };
    });

    const result = await getMultipleModelsOverFirestore({ models, modelType: 'guestbook', keys: ['gb/a', 'gb/bad'] });
    expect(result.results).toEqual([{ key: 'gb/a', data: { name: 'gb/a' } }]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.key).toBe('gb/bad');
    expect(result.errors[0]?.code).toBe('INVALID_ARGUMENT');
  });
});
