import { Getter, cachedGetter, build } from '@dereekb/util';
import { FirestoreDocument } from '../../firestore/accessor/document';
import { FirebaseModelCollectionLoader, firebaseModelLoader, FirebaseModelLoader } from '../model/model.loader';
import { FirebasePermissionContext } from '../permission/permission.context';
import { firebaseModelPermissionService, FirebaseModelPermissionService, FirebasePermissionServiceInstanceDelegate } from '../permission/permission.service';

export type FirebaseModelServiceContext = FirebasePermissionContext;

export interface FirebaseModelService<C extends FirebaseModelServiceContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> extends FirebaseModelPermissionService<C, T, D, R>, FirebaseModelLoader<C, T, D> {}

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
