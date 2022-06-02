import { FirebaseAppModelContext, firebaseModelServiceFactory, firebaseModelsService, FirebasePermissionServiceModel, FirestoreContext } from '@dereekb/firebase';
import { GrantedRoleMap, noAccessRoleMap } from '@dereekb/model';
import { PromiseOrValue } from '@dereekb/util';
import { Example, ExampleDocument, ExampleRoles, ExampleTypes, exampleFirestoreCollection, ExampleFirestoreCollection, ExampleFirestoreCollections } from './example';

export abstract class APP_CODE_PREFIXFirestoreCollections implements ExampleFirestoreCollections {
  abstract readonly exampleFirestoreCollection: ExampleFirestoreCollection;
}

export function makeAPP_CODE_PREFIXFirestoreCollections(firestoreContext: FirestoreContext): APP_CODE_PREFIXFirestoreCollections {
  return {
    exampleFirestoreCollection: exampleFirestoreCollection(firestoreContext)
  };
}

// MARK: Example
export const exampleFirebaseModelServiceFactory = firebaseModelServiceFactory<APP_CODE_PREFIXFirebaseContext, Example, ExampleDocument, ExampleRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<Example, ExampleDocument>, context: APP_CODE_PREFIXFirebaseContext, model: ExampleDocument): PromiseOrValue<GrantedRoleMap<ExampleRoles>> {
    let roles: GrantedRoleMap<ExampleRoles> = noAccessRoleMap();

    // set roles here

    return roles;
  },
  getFirestoreCollection: (c) => c.app.exampleCollection
});

// MARK: Services
export type APP_CODE_PREFIXFirebaseModelTypes = ExampleTypes;

export type APP_CODE_PREFIXFirebaseContextAppContext = APP_CODE_PREFIXFirestoreCollections;

export type APP_CODE_PREFIXFirebaseBaseContext = FirebaseAppModelContext<APP_CODE_PREFIXFirebaseContextAppContext>;

export const APP_CODE_PREFIX_UPPER_FIREBASE_MODEL_SERVICE_FACTORIES = {
  example: exampleFirebaseModelServiceFactory
};

export const demoFirebaseModelServices = firebaseModelsService<typeof APP_CODE_PREFIX_UPPER_FIREBASE_MODEL_SERVICE_FACTORIES, APP_CODE_PREFIXFirebaseBaseContext, APP_CODE_PREFIXFirebaseModelTypes>(APP_CODE_PREFIX_UPPER_FIREBASE_MODEL_SERVICE_FACTORIES);

export type APP_CODE_PREFIXFirebaseContext = APP_CODE_PREFIXFirebaseBaseContext & { service: typeof demoFirebaseModelServices };
