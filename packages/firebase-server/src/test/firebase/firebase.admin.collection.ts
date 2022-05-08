import { FirestoreCollection, FirestoreDocument, DocumentReference } from '@dereekb/firebase';
import { JestTestContextFixture, asGetter, useJestContextFixture, AbstractChildJestTestContextFixture, PromiseOrValue, ModelKey } from "@dereekb/util";
import { FirebaseAdminTestContext } from "./firebase.admin";

/**
 * Testing context for a single model.
 */
export interface ModelTestContext<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  get documentId(): ModelKey;
  get documentRef(): DocumentReference<T>;
  get document(): D;
}

export class ModelTestContextFixture<
  T, D extends FirestoreDocument<T> = FirestoreDocument<T>,
  PI extends FirebaseAdminTestContext = FirebaseAdminTestContext,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>,
  I extends ModelTestContextInstance<T, D, PI> = ModelTestContextInstance<T, D, PI>
  >
  extends AbstractChildJestTestContextFixture<I, PF>
  implements ModelTestContext<T, D> {

  // MARK: ModelTestContext (Forwarded)
  get documentId(): ModelKey {
    return this.instance.documentId;
  }

  get documentRef(): DocumentReference<T> {
    return this.instance.documentRef;
  }

  get document(): D {
    return this.instance.document;
  }

}

export class ModelTestContextInstance<
  T, D extends FirestoreDocument<T> = FirestoreDocument<T>,
  PI extends FirebaseAdminTestContext = FirebaseAdminTestContext
  > implements ModelTestContext<T, D> {

  constructor(readonly collection: FirestoreCollection<T, D>, readonly ref: DocumentReference<T>, readonly testContext: PI) { }

  get documentId(): ModelKey {
    return this.ref.id;
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
export interface ModelTestContextFactoryParams<
  T, D extends FirestoreDocument<T> = FirestoreDocument<T>,
  C = any,
  PI extends FirebaseAdminTestContext = FirebaseAdminTestContext,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>,
  I extends ModelTestContextInstance<T, D, PI> = ModelTestContextInstance<T, D, PI>,
  F extends ModelTestContextFixture<T, D, PI, PF, I> = ModelTestContextFixture<T, D, PI, PF, I>
  > {

  /**
   * Creates a ModelTestContextInstanceDelegate from the parent instance.
   */
  getCollection: (parentInstance: PI) => FirestoreCollection<T, D>;

  /**
   * Creates the custom fixture. If not defined, a ModelTestContextFixture is created.
   */
  makeFixture?: (parent: PF) => F;

  /**
   * Optional function to create a DocumentReference.
   */
  makeRef?: (collection: FirestoreCollection<T, D>, config: C, parentInstance: PI) => Promise<DocumentReference<T>>;

  /**
   * Custom make instance function. If not defined, a ModelTestContextInstance will be generated.
   */
  makeInstance?: (collection: FirestoreCollection<T, D>, ref: DocumentReference<T>, testInstance: PI) => PromiseOrValue<I>;

  /**
   * Optional function to initialize the document for this instance.
   */
  initDocument?: (instance: I, config: C) => Promise<void>;

}

export type ModelTestContextParams<
  C = any,
  PI extends FirebaseAdminTestContext = FirebaseAdminTestContext,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>
  > = { f: PF } & C;

/**
 * Creates a new Jest Context that has a random user for authorization for use in firebase server tests.
 */
export function modelTestContextFactory<
  T, D extends FirestoreDocument<T> = FirestoreDocument<T>,
  C = any,
  PI extends FirebaseAdminTestContext = FirebaseAdminTestContext,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>,
  I extends ModelTestContextInstance<T, D, PI> = ModelTestContextInstance<T, D, PI>,
  F extends ModelTestContextFixture<T, D, PI, PF, I> = ModelTestContextFixture<T, D, PI, PF, I>
>(config: ModelTestContextFactoryParams<T, D, C, PI, PF, I, F>): (params: ModelTestContextParams<C, PI, PF>, buildTests: (u: F) => void) => void {
  const {
    getCollection,
    makeRef = (collection) => collection.documentAccessor().newDocument().documentRef,
    makeInstance = (collection, ref, testInstance) => new ModelTestContextInstance(collection, ref, testInstance) as I,
    makeFixture = (f: PF) => new ModelTestContextFixture<T, D, PI, PF, I>(f),
    initDocument
  } = config;

  return (params: ModelTestContextParams<C, PI, PF>, buildTests: (u: F) => void) => {
    const { f } = params;
    return useJestContextFixture<F, I>({
      fixture: makeFixture(f) as F,
      buildTests,
      initInstance: async () => {
        const parentInstance = f.instance;
        const collection = getCollection(parentInstance);
        const ref = await makeRef(collection, params, parentInstance);
        const instance: I = await makeInstance(collection, ref, parentInstance);

        if (initDocument) {
          await initDocument(instance, params);
        }

        return instance;
      }
    });
  }
};
