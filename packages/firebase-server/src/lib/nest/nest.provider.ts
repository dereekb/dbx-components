import { FirebaseAppModelContext, FirebaseModelServiceContext, FirebaseModelsService, FirebaseModelsServiceSelectionResultRolesReader, FirebaseModelsServiceTypes, InContextFirebaseModelsService, inContextFirebaseModelsServiceFactory, UseFirebaseModelsServiceSelection, UseFirebaseModelsServiceSelectionUseFunction, useFirebaseModelsService } from '@dereekb/firebase';
import { build, BuildFunction, Getter } from '@dereekb/util';
import { INestApplicationContext } from '@nestjs/common';
import { AuthDataRef } from '../auth';
import { FirebaseServerAuthService } from '../auth/auth.service';
import { FirebaseServerActionsContext } from './function/context';
import { nestFirebaseForbiddenPermissionError } from './model/permission.error';

/**
 * Getter for an INestApplicationContext promise. Nest should be initialized when the promise resolves.
 */
export type NestApplicationPromiseGetter = Getter<Promise<INestApplicationContext>>;

/**
 * Generates a function from the passed NestApplicationPromiseGetter/context.
 *
 * This pattern is available to allow generating similar content for differenting contexts, such as production and testing.
 */
export type NestApplicationFunctionFactory<F> = (nestAppPromiseGetter: NestApplicationPromiseGetter) => F;

/**
 * Getter for an INestApplicationContext promise. Nest should be initialized when the promise resolves.
 */
export type MakeNestContext<C> = (nest: INestApplicationContext) => C;

/**
 * Abstract class that wraps an INestApplicationContext value.
 */
export abstract class AbstractNestContext {
  constructor(readonly nest: INestApplicationContext) {}
}

export abstract class AbstractFirebaseNestContext<A, Y extends FirebaseModelsService<any, FirebaseAppModelContext<A>>> extends AbstractNestContext {
  abstract get actionContext(): FirebaseServerActionsContext;
  abstract get authService(): FirebaseServerAuthService;
  abstract get firebaseModelsService(): Y;
  abstract get app(): A;

  /**
   * Creates a FirebaseAppModelContext instance.
   *
   * @param auth
   * @param buildFn
   * @returns
   */
  makeModelContext(auth: AuthDataRef, buildFn?: BuildFunction<FirebaseAppModelContext<A>>): FirebaseAppModelContext<A> {
    const base: FirebaseAppModelContext<A> = {
      auth: this.authService.authContextInfo(auth),
      app: this.app,
      makePermissionError: nestFirebaseForbiddenPermissionError
    };

    return buildFn
      ? build({
          base,
          build: buildFn
        })
      : base;
  }

  /**
   * Creates a InContextFirebaseModelsService given the input context and parameters.
   *
   * @param context
   * @param buildFn
   * @returns
   */
  model(context: AuthDataRef, buildFn?: BuildFunction<FirebaseAppModelContext<A>>): InContextFirebaseModelsService<Y> {
    const firebaseModelContext = this.makeModelContext(context, buildFn);
    return inContextFirebaseModelsServiceFactory(this.firebaseModelsService)(firebaseModelContext) as InContextFirebaseModelsService<Y>;
  }

  async useModel<T extends FirebaseModelsServiceTypes<Y>, O>(type: T, select: UseModelInput<FirebaseAppModelContext<A>, Y, T, O>): Promise<O>;
  async useModel<T extends FirebaseModelsServiceTypes<Y>>(type: T, select: UseModelInputForRolesReader<FirebaseAppModelContext<A>, Y, T>): Promise<FirebaseModelsServiceSelectionResultRolesReader<Y, T>>;
  async useModel<T extends FirebaseModelsServiceTypes<Y>, O>(type: T, select: UseModelInput<FirebaseAppModelContext<A>, Y, T, O> | UseModelInputForRolesReader<FirebaseAppModelContext<A>, Y, T>): Promise<any> {
    const appModelContext: FirebaseAppModelContext<A> = this.makeModelContext(select.context, select.buildFn);
    const usePromise = useFirebaseModelsService(this.firebaseModelsService, type, {
      context: appModelContext,
      key: select.key,
      roles: select.roles,
      rolesSetIncludes: select.rolesSetIncludes
    } as UseFirebaseModelsServiceSelection<Y, T>);

    const use: UseFirebaseModelsServiceSelectionUseFunction<Y, T, O> = (select as UseModelInput<FirebaseAppModelContext<A>, Y, T, O>).use ?? ((x) => x as unknown as O);
    return usePromise(use);
  }
}

export type UseModelInputForRolesReader<C extends FirebaseModelServiceContext, Y extends FirebaseModelsService<any, C>, T extends FirebaseModelsServiceTypes<Y>> = Omit<UseFirebaseModelsServiceSelection<Y, T>, 'type' | 'context'> & {
  context: AuthDataRef;
  buildFn?: BuildFunction<C>;
};

export type UseModelInput<C extends FirebaseModelServiceContext, Y extends FirebaseModelsService<any, C>, T extends FirebaseModelsServiceTypes<Y>, O> = UseModelInputForRolesReader<C, Y, T> & {
  use: UseFirebaseModelsServiceSelectionUseFunction<Y, T, O>;
};
