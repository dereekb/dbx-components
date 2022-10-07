import { FirestoreCollection, FirestoreDocument, DocumentReference, FirestoreModelId, FirestoreModelKey } from '@dereekb/firebase';
import { Getter, GetterOrValue, getValueFromGetter, Maybe, PromiseOrValue } from '@dereekb/util';
import { JestTestContextFixture, useJestContextFixture, AbstractChildJestTestContextFixture } from '@dereekb/util/test';
import { FirebaseAdminTestContext } from './firebase.admin';

/**
 * Testing context for a single model.
 */
export interface ModelTestContext<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  get documentId(): FirestoreModelId;
  get documentKey(): FirestoreModelKey;
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

  get documentRef(): DocumentReference<T> {
    return this.instance.documentRef;
  }

  get document(): D {
    return this.instance.document;
  }
}

export class ModelTestContextInstance<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, PI extends FirebaseAdminTestContext = FirebaseAdminTestContext> implements ModelTestContext<T, D> {
  constructor(readonly collection: FirestoreCollection<T, D>, readonly ref: DocumentReference<T>, readonly testContext: PI) {}

  get documentId(): FirestoreModelId {
    return this.ref.id;
  }

  get documentKey(): FirestoreModelKey {
    return this.ref.path;
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
export interface ModelTestContextFactoryParams<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, C = any, PI extends FirebaseAdminTestContext = FirebaseAdminTestContext, PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>, I extends ModelTestContextInstance<T, D, PI> = ModelTestContextInstance<T, D, PI>, F extends ModelTestContextFixture<T, D, PI, PF, I> = ModelTestContextFixture<T, D, PI, PF, I>, CL extends FirestoreCollection<T, D> = FirestoreCollection<T, D>> {
  /**
   * Creates a ModelTestContextInstanceDelegate from the parent instance.
   */
  getCollection: (parentInstance: PI, config: C) => CL;

  /**
   * Creates the custom fixture. If not defined, a ModelTestContextFixture is created.
   */
  makeFixture?: (parent: PF) => F;

  /**
   * Optional function to try and get an existing reference from the input config. This model will be considered to be fully initialized.
   */
  useRef?: (config: C, parentInstance: PI) => Promise<Maybe<DocumentReference<T>>>;

  /**
   * Optional function to create a DocumentReference.
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
}

export type ModelTestContextParams<C = any, PI extends FirebaseAdminTestContext = FirebaseAdminTestContext, PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>> = { f: PF; ref?: GetterOrValue<Maybe<DocumentReference<any>>> } & C;

/**
 * Creates a new Jest Context that has a random user for authorization for use in firebase server tests.
 */
export function modelTestContextFactory<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, C = any, PI extends FirebaseAdminTestContext = FirebaseAdminTestContext, PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>, I extends ModelTestContextInstance<T, D, PI> = ModelTestContextInstance<T, D, PI>, F extends ModelTestContextFixture<T, D, PI, PF, I> = ModelTestContextFixture<T, D, PI, PF, I>, CL extends FirestoreCollection<T, D> = FirestoreCollection<T, D>>(
  config: ModelTestContextFactoryParams<T, D, C, PI, PF, I, F, CL>
): (params: ModelTestContextParams<C, PI, PF>, buildTests: (u: F) => void) => void {
  const { getCollection, useRef: loadRef, makeRef = (collection) => collection.documentAccessor().newDocument().documentRef, makeInstance = (collection, ref, testInstance) => new ModelTestContextInstance(collection, ref, testInstance) as I, makeFixture = (f: PF) => new ModelTestContextFixture<T, D, PI, PF, I>(f), initDocument } = config;

  return (params: ModelTestContextParams<C, PI, PF>, buildTests: (u: F) => void) => {
    const { f } = params;
    return useJestContextFixture<F, I>({
      fixture: makeFixture(f) as F,
      buildTests,
      initInstance: async () => {
        const parentInstance = f.instance;
        const collection = getCollection(parentInstance, params);

        let ref: Maybe<DocumentReference<T>> = getValueFromGetter(params.ref);
        let init = ref == null;

        if (ref != null && loadRef != null) {
          ref = await loadRef(params, parentInstance);
          init = false;
        }

        if (!ref) {
          ref = await makeRef(collection, params, parentInstance);
        }

        const instance: I = await makeInstance(collection, ref, parentInstance);

        if (init && initDocument) {
          await initDocument(instance, params);
        }

        return instance;
      }
    });
  };
}
