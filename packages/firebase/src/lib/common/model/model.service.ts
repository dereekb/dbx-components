import { GrantedRole } from '@dereekb/model';
import { Getter, cachedGetter, build } from '@dereekb/util';
import { FirestoreDocument } from '../firestore/accessor/document';
import { FirestoreModelIdentity, FirestoreModelNames } from '../firestore/collection/collection';
import { FirebaseModelCollectionLoader, firebaseModelLoader, FirebaseModelLoader, InContextFirebaseModelLoader } from './model/model.loader';
import { InContextFirebaseModelPermissionService, FirebasePermissionContext, firebaseModelPermissionService, FirebaseModelPermissionService, FirebasePermissionServiceInstanceDelegate, InModelContextFirebaseModelPermissionService, FirebasePermissionErrorContext } from './permission';
import { ContextGrantedModelRolesReader, contextGrantedModelRolesReader } from './permission/permission.service.role';

export type FirebaseModelServiceContext = FirebasePermissionContext & FirebasePermissionErrorContext;

export interface FirebaseModelService<C extends FirebaseModelServiceContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> extends FirebaseModelPermissionService<C, T, D, R>, FirebaseModelLoader<C, T, D> {}
export type FirebaseModelServiceGetter<C extends FirebaseModelServiceContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = Getter<FirebaseModelService<C, T, D, R>>;

export interface FirebaseModelServiceConfig<C extends FirebaseModelServiceContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> extends Omit<FirebasePermissionServiceInstanceDelegate<C, T, D, R>, 'loadModelForKey'>, FirebaseModelCollectionLoader<C, T, D> {}

export function firebaseModelService<C extends FirebaseModelServiceContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole>(config: FirebaseModelServiceConfig<C, T, D, R>): FirebaseModelService<C, T, D, R> {
  const permissionServiceDelegate = build<FirebasePermissionServiceInstanceDelegate<C, T, D, R>>({
    base: firebaseModelLoader(config.getFirestoreCollection),
    build: (x) => {
      x.roleMapForModel = config.roleMapForModel;
    }
  });

  const permissionService = firebaseModelPermissionService(permissionServiceDelegate);

  const service: FirebaseModelService<C, T, D, R> = {
    roleMapForModelContext: (model, context) => permissionService.roleMapForModelContext(model, context),
    roleMapForKeyContext: (key, context) => permissionService.roleMapForKeyContext(key, context),
    loadModelForKey: permissionServiceDelegate.loadModelForKey
  };

  return service;
}

export type FirebaseModelServiceFactory<C extends FirebaseModelServiceContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = Getter<FirebaseModelService<C, T, D, R>>;

export function firebaseModelServiceFactory<C extends FirebaseModelServiceContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole>(config: FirebaseModelServiceConfig<C, T, D, R>): FirebaseModelServiceFactory<C, T, D, R> {
  return cachedGetter(() => firebaseModelService(config));
}

// MARK: InContext
export type LimitedInContextFirebaseModelService<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = InContextFirebaseModelPermissionService<C, T, D, R> & InContextFirebaseModelLoader<T, D>;
export type InModelContextFirebaseModelServiceFactory<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = (model: D) => InModelContextFirebaseModelService<C, T, D, R>;
export type InModelContextFirebaseModelService<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = InModelContextFirebaseModelPermissionService<C, T, D, R> & {
  roleReader: () => Promise<ContextGrantedModelRolesReader<C, T, D, R>>;
};
export type InContextFirebaseModelService<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = InModelContextFirebaseModelServiceFactory<C, T, D, R> & LimitedInContextFirebaseModelService<C, T, D, R>;
export type InContextFirebaseModelServiceFactory<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = (context: C) => InContextFirebaseModelService<C, T, D, R>;

export function inContextFirebaseModelServiceFactory<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole>(factory: FirebaseModelServiceGetter<C, T, D, R>): InContextFirebaseModelServiceFactory<C, T, D, R> {
  return (context: C) => {
    const firebaseModelService = factory();

    const base: InModelContextFirebaseModelServiceFactory<C, T, D, R> = (model: D) => {
      const inModelContextService: InModelContextFirebaseModelService<C, T, D, R> = {
        model,
        roleMap: () => service.roleMapForModel(model),
        roleReader: () => contextGrantedModelRolesReader(inModelContextService)
      };

      return inModelContextService;
    };

    const service = build<InContextFirebaseModelService<C, T, D, R>>({
      base: base as InContextFirebaseModelService<C, T, D, R>,
      build: (x) => {
        x.roleMapForModel = (model) => firebaseModelService.roleMapForModelContext(model, context);
        x.roleMapForKey = (key) => firebaseModelService.roleMapForKeyContext(key, context);
        x.loadModelForKey = (key) => firebaseModelService.loadModelForKey(key, context);
      }
    });

    return service;
  };
}

// MARK: Service
export type FirebaseModelsServiceFactory<C extends FirebaseModelServiceContext, K extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [J in FirestoreModelNames<K>]: FirebaseModelServiceGetter<C, any>;
};

/**
 * Function that returns a configured service corresponding with the requested function, and for that context.
 */
export type FirebaseModelsService<X extends FirebaseModelsServiceFactory<C>, C extends FirebaseModelServiceContext> = <K extends keyof X>(type: K, context: C) => X[K] extends FirebaseModelServiceGetter<C, infer T, infer D, infer R> ? InContextFirebaseModelService<C, T, D, R> : never;

/**
 * Creates a new FirebaseModelsService.
 *
 * When a context is passed, it is extended and the services are available in the context too as a services function.
 *
 * This allows the services function to reference itself in usage. You do this by creating another type that extends the context. Example:
 *
 * export type DemoFirebaseBaseContext = FirebaseAppModelContext<DemoFirestoreCollections>;
 * ...
 * export const demoFirebaseModelServices = firebaseModelsService<typeof DEMO_FIREBASE_MODEL_SERVICE_FACTORIES, DemoFirebaseBaseContext, DemoFirebaseModelTypes>(DEMO_FIREBASE_MODEL_SERVICE_FACTORIES);
 * export type DemoFirebaseContext = DemoFirebaseBaseContext & { service: typeof demoFirebaseModelServices };
 *
 * @param services
 * @returns
 */
export function firebaseModelsService<X extends FirebaseModelsServiceFactory<C, K>, C extends FirebaseModelServiceContext, K extends FirestoreModelIdentity = FirestoreModelIdentity>(services: X): FirebaseModelsService<X, C> {
  const firebaseModelsService = <K extends keyof X>(type: K, context: C) => {
    const firebaseModelService = services[type] as FirebaseModelServiceGetter<C, unknown>;

    const contextWithService = {
      ...context,
      service: firebaseModelsService
    };

    const service = inContextFirebaseModelServiceFactory(firebaseModelService)(contextWithService);
    return service as any;
  };

  return firebaseModelsService;
}

export type InContextFirebaseModelsService<Y> = Y extends FirebaseModelsService<infer X, infer C> ? <K extends keyof X>(type: K) => X[K] extends FirebaseModelServiceGetter<C, infer T, infer D, infer R> ? InContextFirebaseModelService<C, T, D, R> : never : never;
export type InContextFirebaseModelsServiceFactory<Y> = Y extends FirebaseModelsService<infer X, infer C> ? (context: C) => InContextFirebaseModelsService<Y> : never;

/**
 * Creates a InContextFirebaseModelsServiceFactory for a particular service.
 *
 * @param service
 * @returns
 */
export function inContextFirebaseModelsServiceFactory<X extends FirebaseModelsServiceFactory<C, K>, C extends FirebaseModelServiceContext, K extends FirestoreModelIdentity = FirestoreModelIdentity>(service: FirebaseModelsService<X, C>): InContextFirebaseModelsServiceFactory<FirebaseModelsService<X, C>> {
  const inContextFirebaseModelsServiceFactory: InContextFirebaseModelsServiceFactory<FirebaseModelsService<X, C>> = <K extends keyof X>(context: C) => {
    return (type: K) => service(type, context);
  };

  return inContextFirebaseModelsServiceFactory;
}

/*
// TODO: there may be a way to set this up, and it would be ideal (to just pass in the model and get the model's collection name and return a properly typed object) but the collection name isn't available in typing so 
export interface InModelContextFirebaseModelsService<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> extends InModelContextFirebaseModelPermissionService<C, T, D, R> {}
export type InModelContextFirebaseModelsServiceFactory<Z, K extends FirestoreModelIdentity = FirestoreModelIdentity> = Z extends InContextFirebaseModelsService<infer Y> ? (Y extends FirebaseModelsService<infer X, infer C> ? (K extends keyof X ? (type: K) => X[K] extends FirebaseModelServiceGetter<C, infer T, infer D, infer R> ? (model: D) => InModelContextFirebaseModelsService<C, T, D, R> : never : never) : never) : never;

export function inModelContextFirebaseModelsServiceFactory<Z extends InContextFirebaseModelsService<FirebaseModelsService<X, C>>, X extends FirebaseModelsServiceFactory<C, K>, C extends FirebaseModelServiceContext, K extends FirestoreModelIdentity = FirestoreModelIdentity>(firebaseModelsService: Z): InModelContextFirebaseModelsServiceFactory<FirebaseModelsService<X, C>, K> {
  // the typings break down here when getting the intended FirestoreDocument type, but the InModelContextFirebaseModelServiceFactory will infer the correct typings in use.
  const inModelContextFirebaseModelsServiceFactory: InModelContextFirebaseModelsServiceFactory<Z, K> = (<K extends keyof X, T, D extends FirestoreDocument<T>, R extends GrantedRole = GrantedRole>(model: D) => {

    firebaseModelsService(model.modelType as K)

      const inModelContextService: InModelContextFirebaseModelService<C, T, D, R> = {
        roleMap: () => typeService.roleMapForModel(model)
      };

      return inModelContextService;
    };
  }) as unknown as InModelContextFirebaseModelServiceFactory<Z, K>;

  return inModelContextFirebaseModelsServiceFactory;
}
*/
