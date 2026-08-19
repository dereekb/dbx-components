import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// hoisted so the vi.mock factory below can reference it — the session module is the one dependency
// `createCliContext` reaches out to, and the memo behaviour under test is defined by how often it does.
const h = vi.hoisted(() => ({
  createSessionMock: vi.fn()
}));

vi.mock('../firestore/firestore.session', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, createCliFirestoreSessionContext: h.createSessionMock };
});

import { type CliEnvConfig } from '../config/env';
import { cliFirestoreBinding, type CliFirestoreBinding } from '../firestore/firestore.models';
import { createCliContext } from './cli.context';

const ENV = { apiBaseUrl: 'http://localhost/api' } as CliEnvConfig;

interface BuildBindingResult {
  readonly binding: CliFirestoreBinding<{ readonly tag: string }>;
  readonly builds: () => number;
}

function buildBinding(): BuildBindingResult {
  let builds = 0;

  const binding = cliFirestoreBinding<{ readonly tag: string }>({
    collections: () => {
      builds += 1;
      return { tag: `build-${builds}` };
    },
    models: (() => ({})) as never
  });

  return { binding, builds: () => builds };
}

function buildContext(binding?: CliFirestoreBinding) {
  return createCliContext({ cliName: 'demo-cli', envName: 'local', env: ENV, accessToken: 'token', firestore: binding });
}

describe('createCliContext()', () => {
  beforeEach(() => {
    h.createSessionMock.mockReset();
    h.createSessionMock.mockImplementation(async () => ({ fromCache: false, firestoreContext: {} }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getFirestoreModels() memo', () => {
    it('builds the app collections ONCE across repeated calls', async () => {
      const { binding, builds } = buildBinding();
      const context = buildContext(binding);

      const first = await context.getFirestoreModels?.();
      const second = await context.getFirestoreModels?.();
      const third = await context.getFirestoreModels?.();

      // the point of the memo: `createCliFirestoreModels` rebuilds the app's ENTIRE collections object,
      // so without it every `firestore-get` / `firestore-query` dispatch paid for a fresh one
      expect(builds()).toBe(1);
      expect(first).toBe(second);
      expect(second).toBe(third);
      expect(h.createSessionMock).toHaveBeenCalledTimes(1);
    });

    it('shares ONE session with getFirestoreSession()', async () => {
      const { binding } = buildBinding();
      const context = buildContext(binding);

      const models = await context.getFirestoreModels?.();
      const session = await context.getFirestoreSession?.();

      expect(h.createSessionMock).toHaveBeenCalledTimes(1);
      expect(models?.session).toBe(session);
    });

    it('is absent when the CLI was not given a binding', () => {
      expect(buildContext().getFirestoreModels).toBeUndefined();
    });

    it('drops BOTH memos on a session failure so a retry gets a fresh session', async () => {
      const { binding, builds } = buildBinding();
      h.createSessionMock.mockRejectedValueOnce(new Error('session down'));
      const context = buildContext(binding);

      await expect(context.getFirestoreModels?.()).rejects.toThrow('session down');

      // the retry must not replay the rejected promise, NOR rebuild the collections against the dead
      // session — both memos have to clear together
      const retried = await context.getFirestoreModels?.();

      expect(h.createSessionMock).toHaveBeenCalledTimes(2);
      expect(builds()).toBe(1);
      expect(retried?.collections).toEqual({ tag: 'build-1' });
    });

    it('drops the session memo too, so getFirestoreSession() retries after a failure', async () => {
      const { binding } = buildBinding();
      h.createSessionMock.mockRejectedValueOnce(new Error('session down'));
      const context = buildContext(binding);

      await expect(context.getFirestoreModels?.()).rejects.toThrow('session down');
      await expect(context.getFirestoreSession?.()).resolves.toEqual({ fromCache: false, firestoreContext: {} });
      expect(h.createSessionMock).toHaveBeenCalledTimes(2);
    });

    it('drops only the models memo when the collections build throws, keeping the session', async () => {
      let attempts = 0;
      const binding = cliFirestoreBinding<{ readonly tag: string }>({
        collections: () => {
          attempts += 1;

          if (attempts === 1) {
            throw new Error('collections exploded');
          }

          return { tag: 'recovered' };
        },
        models: (() => ({})) as never
      });
      const context = buildContext(binding);

      await expect(context.getFirestoreModels?.()).rejects.toThrow('collections exploded');
      const retried = await context.getFirestoreModels?.();

      expect(retried?.collections).toEqual({ tag: 'recovered' });
      // the session was never at fault, so the retry must NOT have paid to re-open it
      expect(h.createSessionMock).toHaveBeenCalledTimes(1);
    });
  });
});
