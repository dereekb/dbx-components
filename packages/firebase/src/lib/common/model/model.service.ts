import { GrantedRole } from '@dereekb/model';
import { Getter, cachedGetter, build, SetIncludesMode, ArrayOrValue, usePromise, UseAsync, UsePromiseFunction } from '@dereekb/util';
import { FirestoreDocument } from '../firestore/accessor/document';
import { FirestoreModelIdentity, FirestoreModelKey, FirestoreModelNames } from '../firestore/collection/collection';
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
export type LimitedInContextFirebaseModelService<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = InContextFirebaseModelPermissionService<C, T, D, R> &
  InContextFirebaseModelLoader<T, D> & {
    forKey: (key: FirestoreModelKey) => InModelContextFirebaseModelService<C, T, D, R>;
  };
export type InContextFirebaseModelService<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = InModelContextFirebaseModelServiceFactory<C, T, D, R> & LimitedInContextFirebaseModelService<C, T, D, R>;
export type InContextFirebaseModelServiceFactory<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = (context: C) => InContextFirebaseModelService<C, T, D, R>;
export type InModelContextFirebaseModelServiceFactory<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = (modelOrKey: D | FirestoreModelKey) => InModelContextFirebaseModelService<C, T, D, R>;
export type InModelContextFirebaseModelService<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = InModelContextFirebaseModelPermissionService<C, T, D, R> &
  InModelContextFirebaseModelServiceUseFunction<C, T, D, R> & {
    roleReader: () => Promise<ContextGrantedModelRolesReader<C, T, D, R>>;
    requireRole: (roles: ArrayOrValue<R>, setIncludes?: SetIncludesMode) => Promise<ContextGrantedModelRolesReader<C, T, D, R>>;
    requireUse: InModelContextFirebaseModelServiceUseFunction<C, T, D, R>;
    use: UsePromiseFunction<ContextGrantedModelRolesReader<C, T, D, R>>;
  };

export type InModelContextFirebaseModelServiceUseFunction<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = (roles: ArrayOrValue<R>, setIncludes?: SetIncludesMode) => UsePromiseFunction<ContextGrantedModelRolesReader<C, T, D, R>>;

export function inContextFirebaseModelServiceFactory<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole>(factory: FirebaseModelServiceGetter<C, T, D, R>): InContextFirebaseModelServiceFactory<C, T, D, R> {
  return (context: C) => {
    const firebaseModelService = factory();

    const base: InModelContextFirebaseModelServiceFactory<C, T, D, R> = (modelOrKey: D | FirestoreModelKey) => {
      const model = typeof modelOrKey === 'string' ? firebaseModelService.loadModelForKey(modelOrKey, context) : modelOrKey;

      const roleReader = () => contextGrantedModelRolesReader(inModelContextService);
      const requireRole = (roles: ArrayOrValue<R>, setIncludes: SetIncludesMode = 'all') => roleReader().then((x) => x.assertHasRoles(setIncludes, roles));
      const requireUse = (roles: ArrayOrValue<R>, setIncludes?: SetIncludesMode) => usePromise(requireRole(roles, setIncludes));

      const inModelContextService: InModelContextFirebaseModelService<C, T, D, R> = build<InModelContextFirebaseModelService<C, T, D, R>>({
        base: requireUse as InModelContextFirebaseModelService<C, T, D, R>,
        build: (x) => {
          x.model = model;
          x.roleMap = () => service.roleMapForModel(model);
          x.roleReader = roleReader;
          x.requireRole = requireRole;
          x.requireUse = requireUse;
          x.use = usePromise(roleReader);
        }
      });

      return inModelContextService;
    };

    const service = build<InContextFirebaseModelService<C, T, D, R>>({
      base: base as InContextFirebaseModelService<C, T, D, R>,
      build: (x) => {
        x.forKey = (key) => service(firebaseModelService.loadModelForKey(key, context));
        x.roleMapForModel = (model) => firebaseModelService.roleMapForModelContext(model, context);
        x.roleMapForKey = (key) => firebaseModelService.roleMapForKeyContext(key, context);
        x.loadModelForKey = (key) => firebaseModelService.loadModelForKey(key, context);
      }
    });

    return service;
  };
}

// MARK: Service
export type FirebaseModelsServiceFactory<C extends FirebaseModelServiceContext, I extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [J in FirestoreModelNames<I>]: FirebaseModelServiceGetter<C, any>;
};

/**
 * Function that returns a configured service corresponding with the requested function, and for that context.
 */
export type FirebaseModelsService<X extends FirebaseModelsServiceFactory<C>, C extends FirebaseModelServiceContext> = <K extends keyof X>(type: K, context: C) => X[K] extends FirebaseModelServiceGetter<C, infer T, infer D, infer R> ? InContextFirebaseModelService<C, T, D, R> : never;
export type FirebaseModelsServiceTypes<S extends FirebaseModelsService<any, any>> = S extends FirebaseModelsService<infer X, any> ? keyof X : never;

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
export function firebaseModelsService<X extends FirebaseModelsServiceFactory<C, I>, C extends FirebaseModelServiceContext, I extends FirestoreModelIdentity = FirestoreModelIdentity>(services: X): FirebaseModelsService<X, C> {
  const firebaseModelsServiceFunction: FirebaseModelsService<X, C> = <K extends keyof X>(type: K, context: C) => {
    const firebaseModelService = services[type] as FirebaseModelServiceGetter<C, unknown>;

    const contextWithService = {
      ...context,
      service: firebaseModelsServiceFunction
    };

    const service = inContextFirebaseModelServiceFactory(firebaseModelService)(contextWithService);
    return service as any;
  };

  return firebaseModelsServiceFunction;
}

export type InContextFirebaseModelsService<Y> = Y extends FirebaseModelsService<infer X, infer C> ? <K extends keyof X>(type: K) => X[K] extends FirebaseModelServiceGetter<C, infer T, infer D, infer R> ? InContextFirebaseModelService<C, T, D, R> : never : never;
export type InContextFirebaseModelsServiceFactory<Y> = Y extends FirebaseModelsService<infer X, infer C> ? (context: C) => InContextFirebaseModelsService<Y> : never;

/**
 * Creates a InContextFirebaseModelsServiceFactory for a particular service.
 *
 * @param service
 * @returns
 */
export function inContextFirebaseModelsServiceFactory<X extends FirebaseModelsServiceFactory<C, I>, C extends FirebaseModelServiceContext, I extends FirestoreModelIdentity = FirestoreModelIdentity>(service: FirebaseModelsService<X, C>): InContextFirebaseModelsServiceFactory<FirebaseModelsService<X, C>> {
  const inContextFirebaseModelsServiceFactory: InContextFirebaseModelsServiceFactory<FirebaseModelsService<X, C>> = <K extends keyof X>(context: C) => {
    return (type: K) => service(type, context);
  };

  return inContextFirebaseModelsServiceFactory;
}

// MARK: Service Selection
export type FirebaseModelsServiceSelection<Y extends FirebaseModelsService<any, any>, T extends FirebaseModelsServiceTypes<Y>> = Omit<UseFirebaseModelsServiceSelection<Y, T>, 'roles' | 'rolesSetIncludes'>;
export type FirebaseModelsServiceSelectionResult<Y extends FirebaseModelsService<any, any>, T extends FirebaseModelsServiceTypes<Y>> = Y extends FirebaseModelsService<infer X, infer C> ? (T extends keyof X ? (X[T] extends FirebaseModelServiceGetter<C, infer T, infer D, infer R> ? InModelContextFirebaseModelService<C, T, D, R> : never) : never) : never;
export type FirebaseModelsServiceSelectionResultRolesReader<Y extends FirebaseModelsService<any, any>, T extends FirebaseModelsServiceTypes<Y>> = Y extends FirebaseModelsService<infer X, infer C> ? (T extends keyof X ? (X[T] extends FirebaseModelServiceGetter<C, infer T, infer D, infer R> ? ContextGrantedModelRolesReader<C, T, D, R> : never) : never) : never;
export type FirebaseModelsServiceSelectionResultDocumentType<Y extends FirebaseModelsService<any, any>, T extends FirebaseModelsServiceTypes<Y>> = Y extends FirebaseModelsService<infer X, infer C> ? (T extends keyof X ? (X[T] extends FirebaseModelServiceGetter<C, infer T, infer D> ? D : never) : never) : never;

export type UseFirebaseModelsServiceSelection<Y extends FirebaseModelsService<any, any>, T extends FirebaseModelsServiceTypes<Y>> = Y extends FirebaseModelsService<infer X, infer C>
  ? X extends FirebaseModelsServiceFactory<C, FirestoreModelIdentity<T>>
    ? {
        context: C;
        key: FirestoreModelKey;
        roles?: X[T] extends FirebaseModelServiceGetter<C, any, any, infer R> ? ArrayOrValue<R> : never;
        rolesSetIncludes?: SetIncludesMode;
      }
    : never
  : never;

export type UseFirebaseModelsServiceSelectionResult<Y extends FirebaseModelsService<any, any>, T extends FirebaseModelsServiceTypes<Y>> = Y extends FirebaseModelsService<infer X, infer C> ? (T extends keyof X ? (X[T] extends FirebaseModelServiceGetter<C, infer T, infer D, infer R> ? UsePromiseFunction<ContextGrantedModelRolesReader<C, T, D, R>> : never) : never) : never;
export type UseFirebaseModelsServiceSelectionUseFunction<Y extends FirebaseModelsService<any, any>, T extends FirebaseModelsServiceTypes<Y>, O> = Y extends FirebaseModelsService<infer X, infer C> ? (T extends keyof X ? (X[T] extends FirebaseModelServiceGetter<C, infer T, infer D, infer R> ? UseAsync<ContextGrantedModelRolesReader<C, T, D, R>, O> : never) : never) : never;

export function selectFromFirebaseModelsService<Y extends FirebaseModelsService<any, any>, T extends FirebaseModelsServiceTypes<Y>>(service: Y, type: T, select: FirebaseModelsServiceSelection<Y, T>): FirebaseModelsServiceSelectionResult<Y, T> {
  return service(type, select.context).forKey(select.key) as FirebaseModelsServiceSelectionResult<Y, T>;
}

export function useFirebaseModelsService<Y extends FirebaseModelsService<any, any>, T extends FirebaseModelsServiceTypes<Y>>(service: Y, type: T, select: UseFirebaseModelsServiceSelection<Y, T>): UseFirebaseModelsServiceSelectionResult<Y, T> {
  const inContextModelService = selectFromFirebaseModelsService(service, type, select);
  let result: UseFirebaseModelsServiceSelectionResult<Y, T>;

  if (select.roles && select.roles.length) {
    result = inContextModelService.requireUse(select.roles, select.rolesSetIncludes) as UseFirebaseModelsServiceSelectionResult<Y, T>;
  } else {
    result = inContextModelService.use as UseFirebaseModelsServiceSelectionResult<Y, T>;
  }

  return result;
}
