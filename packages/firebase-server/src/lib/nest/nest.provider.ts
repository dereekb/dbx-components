import {
  type FirebaseAppModelContext,
  type FirebaseModelServiceContext,
  type FirebaseModelsService,
  type FirebaseModelsServiceSelectionResultRolesReader,
  type FirebaseModelsServiceTypes,
  type InContextFirebaseModelsService,
  inContextFirebaseModelsServiceFactory,
  type UseFirebaseModelsServiceSelection,
  type UseFirebaseModelsServiceSelectionUseFunction,
  useFirebaseModelsService,
  type FirebasePermissionErrorContextErrorFunction,
  type FirebaseDoesNotExistErrorContextErrorFunction
} from '@dereekb/firebase';
import { build, type BuildFunction, type Getter } from '@dereekb/util';
import { type INestApplicationContext } from '@nestjs/common';
import { type AuthDataRef } from '../auth';
import { type FirebaseServerAuthService, type FirebaseServerAuthServiceRef } from '../auth/auth.service';
import { FirebaseServerStorageService, type FirebaseServerStorageServiceRef } from '../storage';
import { FirebaseServerEnvService, type FirebaseServerEnvServiceRef } from '../env';
import { type FirebaseServerActionsContext } from './function/context';
import { nestFirebaseDoesNotExistError, nestFirebaseForbiddenPermissionError } from './model/permission.error';

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
  private readonly _nest: INestApplicationContext;

  constructor(nest: INestApplicationContext) {
    this._nest = nest;
  }

  get nest(): INestApplicationContext {
    return this._nest;
  }
}

export abstract class AbstractFirebaseNestContext<A, Y extends FirebaseModelsService<any, FirebaseAppModelContext<A>>> extends AbstractNestContext implements FirebaseServerEnvServiceRef, FirebaseServerAuthServiceRef, FirebaseServerStorageServiceRef {
  /**
   * FirebasePermissionErrorContextErrorFunction to use with makeModelContext().
   *
   * Defaults to nestFirebaseForbiddenPermissionError().
   */
  protected makePermissionError: FirebasePermissionErrorContextErrorFunction = nestFirebaseForbiddenPermissionError;

  /**
   * FirebaseDoesNotExistErrorContextErrorFunction to use with makeModelContext().
   *
   * Defaults to nestFirebaseDoesNotExistError().
   *
   * Some configurations may prefer to use nestFirebaseForbiddenPermissionError instead, which returns a forbidden error instead.
   * This prevents the leaking of information about the existence of an object.
   */
  protected makeDoesNotExistError: FirebaseDoesNotExistErrorContextErrorFunction = nestFirebaseDoesNotExistError;

  get envService(): FirebaseServerEnvService {
    return this.nest.get(FirebaseServerEnvService);
  }

  abstract get actionContext(): FirebaseServerActionsContext;
  abstract get authService(): FirebaseServerAuthService;
  abstract get firebaseModelsService(): Y;
  abstract get app(): A;

  get storageService(): FirebaseServerStorageService {
    return this.nest.get(FirebaseServerStorageService);
  }

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
      makePermissionError: this.makePermissionError,
      makeDoesNotExistError: this.makeDoesNotExistError
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
    const context: FirebaseAppModelContext<A> = this.makeModelContext(select.request, select.buildFn);
    const usePromise = useFirebaseModelsService(this.firebaseModelsService, type, {
      context,
      key: select.key,
      roles: select.roles,
      rolesSetIncludes: select.rolesSetIncludes
    } as UseFirebaseModelsServiceSelection<Y, T>);

    const use: UseFirebaseModelsServiceSelectionUseFunction<Y, T, O> = (select as UseModelInput<FirebaseAppModelContext<A>, Y, T, O>).use ?? ((x) => x as unknown as O);
    return usePromise(use);
  }
}

export type UseModelInputForRolesReader<C extends FirebaseModelServiceContext, Y extends FirebaseModelsService<any, C>, T extends FirebaseModelsServiceTypes<Y>> = Omit<UseFirebaseModelsServiceSelection<Y, T>, 'type' | 'context'> & {
  readonly request: AuthDataRef;
  readonly buildFn?: BuildFunction<C>;
};

export type UseModelInput<C extends FirebaseModelServiceContext, Y extends FirebaseModelsService<any, C>, T extends FirebaseModelsServiceTypes<Y>, O> = UseModelInputForRolesReader<C, Y, T> & {
  readonly use: UseFirebaseModelsServiceSelectionUseFunction<Y, T, O>;
};
