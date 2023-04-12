import { FirestoreCollection, FirestoreDocument, DocumentReference, FirestoreModelId, FirestoreModelKey, FirestoreCollectionLike, FlatFirestoreModelKey, flatFirestoreModelKey, TwoWayFlatFirestoreModelKey, twoWayFlatFirestoreModelKey } from '@dereekb/firebase';
import { AsyncGetterOrValue, Getter, GetterOrValue, getValueFromGetter, Maybe, PromiseOrValue } from '@dereekb/util';
import { JestTestContextFixture, useJestContextFixture, AbstractChildJestTestContextFixture } from '@dereekb/util/test';
import { FirebaseAdminTestContext } from './firebase.admin';

/**
 * Testing context for a single model.
 */
export interface ModelTestContext<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  get documentId(): FirestoreModelId;
  get documentKey(): FirestoreModelKey;
  get documentFlatKey(): FlatFirestoreModelKey;
  get documentTwoWayFlatKey(): TwoWayFlatFirestoreModelKey;
  get documentRef(): DocumentReference<T>;
  get document(): D;
}

export class ModelTestContextFixture<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, PI extends FirebaseAdminTestContext = FirebaseAdminTestContext, PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>, I extends ModelTestContextInstance<T, D, PI> = ModelTestContextInstance<T, D, PI>> extends AbstractChildJestTestContextFixture<I, PF> implements ModelTestContext<T, D> {
  // MARK: ModelTestContext (Forwarded)
  get documentId(): FirestoreModelId {
    return this.instance.documentId;
  }

  get documentKey(): FirestoreModelKey {
    return this.instance.documentKey;
  }

  get documentFlatKey(): FlatFirestoreModelKey {
    return this.instance.documentFlatKey;
  }

  get documentTwoWayFlatKey(): TwoWayFlatFirestoreModelKey {
    return this.instance.documentTwoWayFlatKey;
  }

  get documentRef(): DocumentReference<T> {
    return this.instance.documentRef;
  }

  get document(): D {
    return this.instance.document;
  }
}

export class ModelTestContextInstance<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, PI extends FirebaseAdminTestContext = FirebaseAdminTestContext> implements ModelTestContext<T, D> {
  constructor(readonly collection: FirestoreCollectionLike<T, D>, readonly ref: DocumentReference<T>, readonly testContext: PI) {}

  get documentId(): FirestoreModelId {
    return this.ref.id;
  }

  get documentKey(): FirestoreModelKey {
    return this.ref.path;
  }

  get documentFlatKey(): FlatFirestoreModelKey {
    return flatFirestoreModelKey(this.documentKey);
  }

  get documentTwoWayFlatKey(): TwoWayFlatFirestoreModelKey {
    return twoWayFlatFirestoreModelKey(this.documentKey);
  }

  get documentRef(): DocumentReference<T> {
    return this.ref;
  }

  get document(): D {
    return this.collection.documentAccessor().loadDocument(this.ref);
  }
}

/**
 * authorizedUserContext/authorizedUserContextFactory parameters.
 */
export interface ModelTestContextFactoryParams<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, C = any, PI extends FirebaseAdminTestContext = FirebaseAdminTestContext, PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>, I extends ModelTestContextInstance<T, D, PI> = ModelTestContextInstance<T, D, PI>, F extends ModelTestContextFixture<T, D, PI, PF, I> = ModelTestContextFixture<T, D, PI, PF, I>, CL extends FirestoreCollectionLike<T, D> = FirestoreCollectionLike<T, D>> {
  /**
   * Creates a ModelTestContextInstanceDelegate from the parent instance.
   */
  getCollection: (parentInstance: PI, config: C) => CL;

  /**
   * Creates the custom fixture. If not defined, a ModelTestContextFixture is created.
   */
  makeFixture?: (parent: PF) => F;

  /**
   * Optional function to create a DocumentReference.
   *
   * If not provided, expects the input CL type to be a full FirestoreCollection, instead of a FirestoreCollectionLike.
   */
  makeRef?: (collection: CL, config: C, parentInstance: PI) => Promise<DocumentReference<T>>;

  /**
   * Custom make instance function. If not defined, a ModelTestContextInstance will be generated.
   */
  makeInstance?: (collection: CL, ref: DocumentReference<T>, testInstance: PI) => PromiseOrValue<I>;

  /**
   * Optional function to initialize the document for this instance.
   */
  initDocument?: (instance: I, config: C) => Promise<void>;

  /**
   * Optional function to retrieve a collection given the input document.
   *
   * Required if using ModelTestContextDocumentRefParam as input.
   */
  collectionForDocument?: (parentInstance: PI, document: D) => CL;

  /**
   * Optional teardown function to cleanup after this object.
   */
  destroyInstance?(instance: I): PromiseOrValue<void>;
}

export interface ModelTestContextDocumentRefParams<D extends FirestoreDocument<any> = FirestoreDocument<any>> {
  /**
   * Custom document to use that is already initialized.
   */
  readonly doc: AsyncGetterOrValue<D>;
}

export type ModelTestContextParams<C = any, PI extends FirebaseAdminTestContext = FirebaseAdminTestContext, PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>> = { f: PF } & (C | ModelTestContextDocumentRefParams);

/**
 * Creates a new Jest Context that has a random user for authorization for use in firebase server tests.
 */
export function modelTestContextFactory<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, C = any, PI extends FirebaseAdminTestContext = FirebaseAdminTestContext, PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>, I extends ModelTestContextInstance<T, D, PI> = ModelTestContextInstance<T, D, PI>, F extends ModelTestContextFixture<T, D, PI, PF, I> = ModelTestContextFixture<T, D, PI, PF, I>, CL extends FirestoreCollectionLike<T, D> = FirestoreCollectionLike<T, D>>(
  config: ModelTestContextFactoryParams<T, D, C, PI, PF, I, F, CL>
): (params: ModelTestContextParams<C, PI, PF>, buildTests: (u: F) => void) => void {
  const {
    getCollection,
    collectionForDocument,
    makeRef = (collection) => {
      const accessor = (collection as unknown as FirestoreCollection<T, D>).documentAccessor();

      if (accessor.newDocument == null) {
        throw new Error('collection passed to makeRef() was not a full FirestoreCollection. Either supply a custom makeRef() function or a FirestoreCollection that has newDocument() available on the documentAccessor.');
      }

      return accessor.newDocument().documentRef;
    },
    makeInstance = (collection, ref, testInstance) => new ModelTestContextInstance(collection, ref, testInstance) as I,
    makeFixture = (f: PF) => new ModelTestContextFixture<T, D, PI, PF, I>(f),
    initDocument,
    destroyInstance
  } = config;

  return (params: ModelTestContextParams<C, PI, PF>, buildTests: (u: F) => void) => {
    const { f } = params;
    return useJestContextFixture<F, I>({
      fixture: makeFixture(f) as F,
      buildTests,
      initInstance: async () => {
        const parentInstance = f.instance;

        let ref: DocumentReference<T>;
        let collection: CL;
        let init: boolean;

        if ((params as ModelTestContextDocumentRefParams).doc) {
          const doc = await getValueFromGetter((params as ModelTestContextDocumentRefParams).doc);

          if (!collectionForDocument) {
            throw new Error('collectionForDocument() is required when using ModelTestContextDocumentRefParams values as input.');
          }

          collection = collectionForDocument(parentInstance, doc as D);
          const expectedCollectionName = collection.documentAccessor().modelIdentity.collectionName;

          if (expectedCollectionName !== doc.modelIdentity.collectionName) {
            throw new Error(`Input doc is in a different collection (${doc.modelIdentity.collectionName}) than expected (${expectedCollectionName}).`);
          }

          ref = doc.documentRef;
          init = false;
        } else {
          collection = getCollection(parentInstance, params as C);
          ref = await makeRef(collection, params as C, parentInstance);
          init = true;
        }

        const instance: I = await makeInstance(collection, ref, parentInstance);

        if (init && initDocument) {
          await initDocument(instance, params as C);
        }

        return instance;
      },
      destroyInstance
    });
  };
}
