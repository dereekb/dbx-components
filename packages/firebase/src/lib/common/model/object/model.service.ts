import { Getter, cachedGetter, build } from '@dereekb/util';
import { FirestoreDocument } from '../../firestore/accessor/document';
import { FirebaseModelCollectionLoader, firebaseModelLoader, FirebaseModelLoader, InContextFirebaseModelLoader } from '../model/model.loader';
import { InContextFirebaseModelPermissionService, FirebasePermissionContext, firebaseModelPermissionService, FirebaseModelPermissionService, FirebasePermissionServiceInstanceDelegate } from '../permission';

export type FirebaseModelServiceContext = FirebasePermissionContext;

export interface FirebaseModelService<C extends FirebaseModelServiceContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> extends FirebaseModelPermissionService<C, T, D, R>, FirebaseModelLoader<C, T, D> {}
export type FirebaseModelServiceGetter<C extends FirebaseModelServiceContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> = Getter<FirebaseModelService<C, T, D, R>>;

export interface FirebaseModelServiceConfig<C extends FirebaseModelServiceContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> extends Omit<FirebasePermissionServiceInstanceDelegate<C, T, D, R>, 'loadModelForKey'>, FirebaseModelCollectionLoader<C, T, D> {}

export function firebaseModelService<C extends FirebaseModelServiceContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string>(config: FirebaseModelServiceConfig<C, T, D, R>): FirebaseModelService<C, T, D, R> {
  const permissionServiceDelegate = build<FirebasePermissionServiceInstanceDelegate<C, T, D, R>>({
    base: firebaseModelLoader(config.getFirestoreCollection),
    build: (x) => {
      x.rolesMapForModel = config.rolesMapForModel;
    }
  });

  const permissionService = firebaseModelPermissionService(permissionServiceDelegate);

  const service: FirebaseModelService<C, T, D, R> = {
    rolesMapForModelContext: (model, context) => permissionService.rolesMapForModelContext(model, context),
    rolesMapForKeyContext: (key, context) => permissionService.rolesMapForKeyContext(key, context),
    loadModelForKey: permissionServiceDelegate.loadModelForKey
  };

  return service;
}

export type FirebaseModelServiceFactory<C extends FirebaseModelServiceContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> = Getter<FirebaseModelService<C, T, D, R>>;

export function firebaseModelServiceFactory<C extends FirebaseModelServiceContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string>(config: FirebaseModelServiceConfig<C, T, D, R>): FirebaseModelServiceFactory<C, T, D, R> {
  return cachedGetter(() => firebaseModelService(config));
}

// MARK: InContext
export interface InContextFirebaseModelService<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> extends InContextFirebaseModelPermissionService<C, T, D, R>, InContextFirebaseModelLoader<T, D> {}
export type InContextFirebaseModelServiceFactory<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> = (context: C) => InContextFirebaseModelService<C, T, D, R>;

export function inContextFirebaseModelServiceFactory<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string>(factory: FirebaseModelServiceGetter<C, T, D, R>): InContextFirebaseModelServiceFactory<C, T, D, R> {
  return (context: C) => {
    const firebaseModelService = factory();

    const service: InContextFirebaseModelService<C, T, D, R> = {
      rolesMapForModel: (model) => firebaseModelService.rolesMapForModelContext(model, context),
      rolesMapForKey: (key) => firebaseModelService.rolesMapForKeyContext(key, context),
      loadModelForKey: (key) => firebaseModelService.loadModelForKey(key, context)
    };

    return service;
  };
}

// MARK: Service
export type FirebaseModelsServiceFactory<C extends FirebaseModelServiceContext, T extends string = string> = {
  [K in T]: FirebaseModelServiceGetter<C, any>;
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
export function firebaseModelsService<X extends FirebaseModelsServiceFactory<C, T>, C extends FirebaseModelServiceContext, T extends string = string>(services: X): FirebaseModelsService<X, C> {
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
export function inContextFirebaseModelsServiceFactory<X extends FirebaseModelsServiceFactory<C, T>, C extends FirebaseModelServiceContext, T extends string = string>(service: FirebaseModelsService<X, C>): InContextFirebaseModelsServiceFactory<FirebaseModelsService<X, C>> {
  const inContextFirebaseModelsServiceFactory: InContextFirebaseModelsServiceFactory<FirebaseModelsService<X, C>> = <K extends keyof X>(context: C) => {
    return (type: K) => service(type, context);
  };

  return inContextFirebaseModelsServiceFactory;
}
