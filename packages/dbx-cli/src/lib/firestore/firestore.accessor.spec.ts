import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { type FirebaseAppModelContext, type FirestoreCollection, type FirestoreDocument, firebaseModelServiceFactory, firebaseModelsService, type FirebaseModelServiceGetter } from '@dereekb/firebase';
import { type CliContext } from '../context/cli.context';
import { setCliVerbose } from '../util/output';
import { cliFirestoreAccessorFactory } from './firestore.accessor';
import { cliFirestoreBinding, createCliFirestoreModels, type CliFirestoreBinding } from './firestore.models';
import { getMultipleModelsOverFirestore } from './firestore.read';
import { type CliFirestoreSessionContext } from './firestore.session';

// MARK: A miniature app, standing in for demo-firebase
interface TestGuestbook {
  readonly name: string;
}

type TestGuestbookDocument = FirestoreDocument<TestGuestbook>;

interface TestCollections {
  readonly guestbookCollection: FirestoreCollection<TestGuestbook, TestGuestbookDocument>;
}

type TestFirebaseContext = FirebaseAppModelContext<TestCollections>;

const TEST_MODEL_SERVICE_FACTORIES = {
  guestbook: firebaseModelServiceFactory<TestFirebaseContext, TestGuestbook, TestGuestbookDocument>({
    getFirestoreCollection: (c) => c.app.guestbookCollection,
    roleMapForModel: () => ({})
  }) as FirebaseModelServiceGetter<TestFirebaseContext, TestGuestbook, TestGuestbookDocument>
};

const testFirebaseModelServices = firebaseModelsService<typeof TEST_MODEL_SERVICE_FACTORIES, TestFirebaseContext>(TEST_MODEL_SERVICE_FACTORIES);

/**
 * A stub `guestbookCollection` whose accessor hands back a document reporting the key it was loaded
 * for, so a read can be traced back to the collection it went through.
 */
function buildTestCollections(): TestCollections {
  const guestbookCollection = {
    modelIdentity: { modelType: 'guestbook', collectionName: 'gb' },
    documentAccessor: () => ({
      loadDocumentForKey: (key: string) => ({ snapshotData: async () => ({ name: key }) })
    })
  } as unknown as FirestoreCollection<TestGuestbook, TestGuestbookDocument>;

  return { guestbookCollection };
}

const SESSION = { fromCache: true, firestoreContext: {} as never } as unknown as CliFirestoreSessionContext;

interface BuildContextInput {
  /**
   * The binding to wire the context with. Omit for a context with no binding at all.
   */
  readonly binding?: CliFirestoreBinding<TestCollections>;
}

/**
 * Builds a `CliContext` whose `getFirestoreModels` is memoized the way `createCliContext`'s is, so the
 * accessor's reuse branch is exercised against a realistic context rather than a fresh view per call.
 */
function buildContext(input: BuildContextInput = {}): CliContext {
  const binding = input.binding;
  let memo: ReturnType<typeof createCliFirestoreModels> | undefined;

  return {
    cliName: 'demo-cli',
    envName: 'local',
    env: { apiBaseUrl: 'http://localhost/api' } as never,
    accessToken: 'token',
    callModel: (async () => undefined) as never,
    getModel: (async () => undefined) as never,
    getMultipleModels: (async () => undefined) as never,
    getFirestoreSession: async () => SESSION,
    getFirestoreContext: async () => SESSION.firestoreContext,
    getFirestoreModels:
      binding == null
        ? undefined
        : async () => {
            memo = memo ?? createCliFirestoreModels({ binding, session: SESSION });
            return memo;
          }
  };
}

describe('cliFirestoreAccessorFactory()', () => {
  let collectionsBuilt: number;
  let stderr: string[];
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  function buildAccessor() {
    return cliFirestoreAccessorFactory({
      collections: () => {
        collectionsBuilt += 1;
        return buildTestCollections();
      },
      models: testFirebaseModelServices
    });
  }

  beforeEach(() => {
    collectionsBuilt = 0;
    stderr = [];
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
      stderr.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    }) as typeof process.stderr.write);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    setCliVerbose(false);
  });

  describe('types', () => {
    it('hands back the app collections type, not `object`', async () => {
      const accessor = buildAccessor();
      const { collections } = await accessor(buildContext({ binding: accessor.binding }));

      expectTypeOf(collections).toEqualTypeOf<TestCollections>();
      // the runtime half of the same claim -- a typed member is reachable without a cast
      expect(collections.guestbookCollection.modelIdentity.collectionName).toBe('gb');
    });

    it('types a document loaded through serviceFor() as the app document', async () => {
      const accessor = buildAccessor();
      const models = await accessor(buildContext({ binding: accessor.binding }));

      // THE direct test of requirement #2: the app's real `D` survives the dbx-cli boundary rather
      // than arriving as `FirestoreDocument<unknown>`
      expectTypeOf(models.serviceFor('guestbook').loadModelForKey('gb/a')).toEqualTypeOf<TestGuestbookDocument>();
      expectTypeOf(models.models).toEqualTypeOf<typeof testFirebaseModelServices>();
    });

    it('reads a document through the collection accessor', async () => {
      const accessor = buildAccessor();
      const models = await accessor(buildContext({ binding: accessor.binding }));
      const data = await models.serviceFor('guestbook').loadModelForKey('gb/a').snapshotData();

      expect(data).toEqual({ name: 'gb/a' });
    });
  });

  describe('resolution', () => {
    it('reuses the context view when wired with THIS binding, building the collections once', async () => {
      const accessor = buildAccessor();
      const context = buildContext({ binding: accessor.binding });

      const first = await accessor(context);
      const second = await accessor(context);

      // one binding identity across index.ts / doctor / fixture is exactly what makes this fire
      expect(collectionsBuilt).toBe(1);
      expect(first.collections).toBe(second.collections);
      expect(first.binding).toBe(accessor.binding);
    });

    it('builds its own view on a context with NO binding', async () => {
      const accessor = buildAccessor();
      const models = await accessor(buildContext());

      expect(collectionsBuilt).toBe(1);
      expect(models.collections.guestbookCollection.modelIdentity.collectionName).toBe('gb');
      expect(models.session).toBe(SESSION);
    });

    it('builds a second view LOUDLY for a foreign binding', async () => {
      setCliVerbose(true);
      const accessor = buildAccessor();
      let foreignBuilt = 0;
      const foreign = cliFirestoreBinding<TestCollections>({
        collections: () => {
          foreignBuilt += 1;
          return buildTestCollections();
        },
        models: testFirebaseModelServices
      });

      const models = await accessor(buildContext({ binding: foreign }));

      // the foreign binding built the context's view; the accessor then built its OWN rather than
      // asserting someone else's `collections` is a `TestCollections`
      expect(foreignBuilt).toBe(1);
      expect(collectionsBuilt).toBe(1);
      expect(models.binding).toBe(accessor.binding);
      expect(stderr.join('')).toContain('DIFFERENT binding');
    });
  });

  describe('reads', () => {
    it('delegates readMultipleModels to getMultipleModelsOverFirestore', async () => {
      const accessor = buildAccessor();
      const models = await accessor(buildContext({ binding: accessor.binding }));
      const keys = ['gb/a', 'gb/b'];

      const viaAccessor = await models.readMultipleModels('guestbook', keys);
      const viaFreeFunction = await getMultipleModelsOverFirestore({ models, modelType: 'guestbook', keys });

      // pins DELEGATION, not a parallel implementation of the partition
      expect(viaAccessor).toEqual(viaFreeFunction);
      expect(viaAccessor).toEqual({
        results: [
          { key: 'gb/a', data: { name: 'gb/a' } },
          { key: 'gb/b', data: { name: 'gb/b' } }
        ],
        errors: []
      });
    });

    it('delegates readModel to getModelOverFirestore', async () => {
      const accessor = buildAccessor();
      const models = await accessor(buildContext({ binding: accessor.binding }));

      expect(await models.readModel('guestbook', 'gb/a')).toEqual({ key: 'gb/a', data: { name: 'gb/a' } });
    });
  });
});
