/* eslint-disable @typescript-eslint/no-explicit-any */
// The use of any here does not degrade the type-safety. The correct type is inferred in most cases.

import { type GrantedRole } from '@dereekb/model';
import { type Getter, cachedGetter, build, type SetIncludesMode, type ArrayOrValue, usePromise, type UseAsync, type UsePromiseFunction, type Building } from '@dereekb/util';
import { type FirestoreDocument } from '../firestore/accessor/document';
import { type FirestoreModelIdentity, firestoreModelIdentityTypeMap, type FirestoreModelKey, type FirestoreModelType, type FirestoreModelTypes, readFirestoreModelKey, type ReadFirestoreModelKeyInput } from '../firestore/collection/collection';
import { type FirebaseModelCollectionLoader, firebaseModelLoader, type FirebaseModelLoader, type InContextFirebaseModelCollectionLoader, type InContextFirebaseModelLoader } from './model/model.loader';
import { type InContextFirebaseModelPermissionService, type FirebasePermissionContext, firebaseModelPermissionService, type FirebaseModelPermissionService, type FirebasePermissionServiceInstanceDelegate, type InModelContextFirebaseModelPermissionService, type FirebasePermissionErrorContext } from './permission';
import { type ContextGrantedModelRolesReader, contextGrantedModelRolesReader } from './permission/permission.service.role';

export type FirebaseModelServiceContext = FirebasePermissionContext & FirebasePermissionErrorContext;

export interface FirebaseModelService<C extends FirebaseModelServiceContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> extends FirebaseModelPermissionService<C, T, D, R>, FirebaseModelLoader<C, T, D>, FirebaseModelCollectionLoader<any, T, D> {}
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
    getFirestoreCollection: config.getFirestoreCollection,
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
export type LimitedInContextFirebaseModelService<C extends FirebasePermissionErrorContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = InContextFirebaseModelPermissionService<C, T, D, R> &
  InContextFirebaseModelLoader<T, D> &
  InContextFirebaseModelCollectionLoader<T, D> & {
    forKey: (key: FirestoreModelKey) => InModelContextFirebaseModelService<C, T, D, R>;
  };
export type InContextFirebaseModelService<C extends FirebasePermissionErrorContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = InModelContextFirebaseModelServiceFactory<C, T, D, R> & LimitedInContextFirebaseModelService<C, T, D, R>;
export type InContextFirebaseModelServiceFactory<C extends FirebasePermissionErrorContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = (context: C) => InContextFirebaseModelService<C, T, D, R>;
export type InModelContextFirebaseModelServiceFactory<C extends FirebasePermissionErrorContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = (modelOrKey: D | FirestoreModelKey) => InModelContextFirebaseModelService<C, T, D, R>;
export type InModelContextFirebaseModelService<C extends FirebasePermissionErrorContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = InModelContextFirebaseModelPermissionService<C, T, D, R> &
  InModelContextFirebaseModelServiceUseFunction<C, T, D, R> &
  InContextFirebaseModelCollectionLoader<T, D> & {
    roleReader: () => Promise<ContextGrantedModelRolesReader<C, T, D, R>>;
    requireRole: (roles: ArrayOrValue<R>, setIncludes?: SetIncludesMode) => Promise<ContextGrantedModelRolesReader<C, T, D, R>>;
    requireUse: InModelContextFirebaseModelServiceUseFunction<C, T, D, R>;
    use: UsePromiseFunction<ContextGrantedModelRolesReader<C, T, D, R>>;
  };

export type InModelContextFirebaseModelServiceUseFunction<C extends FirebasePermissionErrorContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = (roles: ArrayOrValue<R>, setIncludes?: SetIncludesMode) => UsePromiseFunction<ContextGrantedModelRolesReader<C, T, D, R>>;

export function inContextFirebaseModelServiceFactory<C extends FirebaseModelServiceContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole>(factory: FirebaseModelServiceGetter<C, T, D, R>): InContextFirebaseModelServiceFactory<C, T, D, R> {
  return (context: C) => {
    const firebaseModelService = factory();
    const getFirestoreCollection = () => firebaseModelService.getFirestoreCollection(context);

    const base: InModelContextFirebaseModelServiceFactory<C, T, D, R> = (modelOrKey: D | FirestoreModelKey) => {
      const model = typeof modelOrKey === 'string' ? firebaseModelService.loadModelForKey(modelOrKey, context) : modelOrKey;

      const roleReader = () => contextGrantedModelRolesReader(inModelContextService);
      const requireRole = (roles: ArrayOrValue<R>, setIncludes: SetIncludesMode = 'all') => roleReader().then((x) => x.assertExists() && x.assertHasRoles(setIncludes, roles));
      const requireUse = (roles: ArrayOrValue<R>, setIncludes?: SetIncludesMode) => usePromise(requireRole(roles, setIncludes));

      const inModelContextService: InModelContextFirebaseModelService<C, T, D, R> = build<InModelContextFirebaseModelService<C, T, D, R>>({
        base: requireUse as InModelContextFirebaseModelService<C, T, D, R>,
        build: (x) => {
          x.model = model;
          x.roleMap = () => service.roleMapForModel(model);
          x.roleReader = roleReader;
          x.requireRole = requireRole;
          x.requireUse = requireUse;
          x.getFirestoreCollection = getFirestoreCollection;
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
        x.getFirestoreCollection = getFirestoreCollection;
      }
    });

    return service;
  };
}

// MARK: Service
export type FirebaseModelsServiceFactory<C extends FirebaseModelServiceContext, I extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [J in FirestoreModelTypes<I>]: FirebaseModelServiceGetter<C, any>;
};

export type FirebaseModelsServiceTypesAccessor = {
  allTypes(): FirestoreModelType[];
};

/**
 * Function that returns a configured service corresponding with the requested function, and for that context.
 */
export type FirebaseModelsService<X extends FirebaseModelsServiceFactory<C>, C extends FirebaseModelServiceContext> = (<K extends keyof X>(type: K, context: C) => X[K] extends FirebaseModelServiceGetter<C, infer T, infer D, infer R> ? InContextFirebaseModelService<C, T, D, R> : never) & FirebaseModelsServiceTypesAccessor;
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
  const firebaseModelsServiceFunction: Building<FirebaseModelsService<X, C>> = <K extends keyof X>(type: K, context: C) => {
    const firebaseModelService = services[type] as FirebaseModelServiceGetter<C, unknown>;
    const contextWithService = {
      ...context,
      service: firebaseModelsServiceFunction
    };

    const service = inContextFirebaseModelServiceFactory(firebaseModelService)(contextWithService);
    return service as any;
  };

  firebaseModelsServiceFunction.allTypes = cachedGetter(() => Object.keys(services));

  return firebaseModelsServiceFunction as FirebaseModelsService<X, C>;
}

export type InContextFirebaseModelsService<Y> = FirebaseModelsServiceTypesAccessor & (Y extends FirebaseModelsService<infer X, infer C> ? <K extends keyof X>(type: K) => X[K] extends FirebaseModelServiceGetter<C, infer T, infer D, infer R> ? InContextFirebaseModelService<C, T, D, R> : never : never);
export type InContextFirebaseModelsServiceFactory<Y> = FirebaseModelsServiceTypesAccessor & (Y extends FirebaseModelsService<infer X, infer C> ? (context: C) => InContextFirebaseModelsService<Y> : never);

/**
 * Creates a InContextFirebaseModelsServiceFactory for a particular service.
 *
 * @param service
 * @returns
 */
export function inContextFirebaseModelsServiceFactory<X extends FirebaseModelsServiceFactory<C, I>, C extends FirebaseModelServiceContext, I extends FirestoreModelIdentity = FirestoreModelIdentity>(service: FirebaseModelsService<X, C>): InContextFirebaseModelsServiceFactory<FirebaseModelsService<X, C>> {
  const newInContextFirebaseModelsServiceFactory: Building<InContextFirebaseModelsServiceFactory<FirebaseModelsService<X, C>>> = <K extends keyof X>(context: C) => {
    const result = (type: K) => service(type, context);
    result.allTypes = service.allTypes;
    return result;
  };

  newInContextFirebaseModelsServiceFactory.allTypes = service.allTypes;
  return newInContextFirebaseModelsServiceFactory as InContextFirebaseModelsServiceFactory<FirebaseModelsService<X, C>>;
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
        key: X[T] extends FirebaseModelServiceGetter<C, infer M> ? ReadFirestoreModelKeyInput<M> : ReadFirestoreModelKeyInput;
        roles?: X[T] extends FirebaseModelServiceGetter<C, any, any, infer R> ? ArrayOrValue<R> : never;
        rolesSetIncludes?: SetIncludesMode;
      }
    : never
  : never;

export type UseFirebaseModelsServiceSelectionResult<Y extends FirebaseModelsService<any, any>, T extends FirebaseModelsServiceTypes<Y>> = Y extends FirebaseModelsService<infer X, infer C> ? (T extends keyof X ? (X[T] extends FirebaseModelServiceGetter<C, infer T, infer D, infer R> ? UsePromiseFunction<ContextGrantedModelRolesReader<C, T, D, R>> : never) : never) : never;
export type UseFirebaseModelsServiceSelectionUseFunction<Y extends FirebaseModelsService<any, any>, T extends FirebaseModelsServiceTypes<Y>, O> = Y extends FirebaseModelsService<infer X, infer C> ? (T extends keyof X ? (X[T] extends FirebaseModelServiceGetter<C, infer T, infer D, infer R> ? UseAsync<ContextGrantedModelRolesReader<C, T, D, R>, O> : never) : never) : never;

export function selectFromFirebaseModelsService<Y extends FirebaseModelsService<any, any>, T extends FirebaseModelsServiceTypes<Y>>(service: Y, type: T, select: FirebaseModelsServiceSelection<Y, T>): FirebaseModelsServiceSelectionResult<Y, T> {
  const key = readFirestoreModelKey(select.key, true);
  return service(type, select.context).forKey(key) as FirebaseModelsServiceSelectionResult<Y, T>;
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

// MARK: Entity Map
export function buildFirebaseCollectionTypeModelTypeMap<Y extends FirebaseModelsService<any, any>>(inContextFirebaseModelsService: InContextFirebaseModelsService<Y>) {
  const allTypes = inContextFirebaseModelsService.allTypes();
  const modelIdentities = allTypes.map((type) => {
    const service = inContextFirebaseModelsService(type);
    return service.getFirestoreCollection().modelIdentity;
  });

  return firestoreModelIdentityTypeMap(modelIdentities);
}
