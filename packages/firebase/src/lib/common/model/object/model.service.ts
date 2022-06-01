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

export function inContextFirebaseModelService<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string>(factory: FirebaseModelServiceGetter<C, T, D, R>): InContextFirebaseModelServiceFactory<C, T, D, R> {
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

export type FirebaseModelsService<X extends FirebaseModelsServiceFactory<C>, C extends FirebaseModelServiceContext> = {
  service<K extends keyof X>(type: K, context: C): X[K] extends FirebaseModelServiceGetter<C, infer T, infer D, infer R> ? InContextFirebaseModelService<C, T, D, R> : never;
};

export function firebaseModelsService<X extends FirebaseModelsServiceFactory<C, T>, C extends FirebaseModelServiceContext, T extends string = string>(services: X): FirebaseModelsService<X, C> {
  return {
    service: <K extends keyof X>(type: K, context: C) => {
      const firebaseModelService = services[type] as FirebaseModelServiceGetter<C, unknown>;
      const service = inContextFirebaseModelService(firebaseModelService)(context);
      return service as any;
    }
  };
}
