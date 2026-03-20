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
 * Factory type that creates a function from a {@link NestApplicationPromiseGetter}.
 *
 * This pattern enables generating the same function shape for different contexts
 * (e.g., production vs testing) by parameterizing on the Nest application source.
 */
export type NestApplicationFunctionFactory<F> = (nestAppPromiseGetter: NestApplicationPromiseGetter) => F;

/**
 * Factory function that creates a typed context from an initialized {@link INestApplicationContext}.
 */
export type MakeNestContext<C> = (nest: INestApplicationContext) => C;

/**
 * Abstract class that wraps an INestApplicationContext value.
 */
export abstract class AbstractNestContext {
  private readonly _nestApplication: INestApplicationContext;

  constructor(nestApplication: INestApplicationContext) {
    this._nestApplication = nestApplication;
  }

  /**
   * Returns the NestJS application context.
   *
   * @deprecated use nestApplication instead.
   * @returns The NestJS application context.
   */
  get nest(): INestApplicationContext {
    return this._nestApplication;
  }

  /**
   * Returns the NestJS application context.
   *
   * @returns The NestJS application context.
   */
  get nestApplication(): INestApplicationContext {
    return this._nestApplication;
  }
}

/**
 * Abstract class used for the top-level NestJS context for Firebase services.
 *
 * Your API implementation of this class is usually <AppPrefix>ApiNestContext (e.g. `DemoApiNestContext`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- FirebaseModelsService generic requires `any` for SDK compatibility
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
    return this.nestApplication.get(FirebaseServerEnvService);
  }

  abstract get actionContext(): FirebaseServerActionsContext;
  abstract get authService(): FirebaseServerAuthService;
  abstract get firebaseModelsService(): Y;
  abstract get app(): A;

  get storageService(): FirebaseServerStorageService {
    return this.nestApplication.get(FirebaseServerStorageService);
  }

  /**
   * Creates a {@link FirebaseAppModelContext} from request auth data.
   *
   * The context includes auth info, app reference, and error factories for permissions/existence checks.
   *
   * @param auth - The request's auth data reference.
   * @param buildFn - Optional builder to customize the context.
   * @returns A model context with auth, app, and error factories.
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
   * Creates an {@link InContextFirebaseModelsService} bound to the given auth context,
   * enabling scoped model selection and permission checking.
   *
   * @param context - The request's auth data reference.
   * @param buildFn - Optional builder to customize the model context.
   * @returns An in-context models service scoped to the given auth context.
   */
  model(context: AuthDataRef, buildFn?: BuildFunction<FirebaseAppModelContext<A>>): InContextFirebaseModelsService<Y> {
    const firebaseModelContext = this.makeModelContext(context, buildFn);
    return inContextFirebaseModelsServiceFactory(this.firebaseModelsService)(firebaseModelContext) as InContextFirebaseModelsService<Y>;
  }

  async useModel<T extends FirebaseModelsServiceTypes<Y>, O>(type: T, select: UseModelInput<FirebaseAppModelContext<A>, Y, T, O>): Promise<O>;
  async useModel<T extends FirebaseModelsServiceTypes<Y>>(type: T, select: UseModelInputForRolesReader<FirebaseAppModelContext<A>, Y, T>): Promise<FirebaseModelsServiceSelectionResultRolesReader<Y, T>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- implementation signature uses `any` to unify overload return types
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

/**
 * Input for {@link AbstractFirebaseNestContext.useModel} when only a roles reader is needed (no custom use function).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- FirebaseModelsService generic requires `any` for SDK compatibility
export type UseModelInputForRolesReader<C extends FirebaseModelServiceContext, Y extends FirebaseModelsService<any, C>, T extends FirebaseModelsServiceTypes<Y>> = Omit<UseFirebaseModelsServiceSelection<Y, T>, 'type' | 'context'> & {
  readonly request: AuthDataRef;
  readonly buildFn?: BuildFunction<C>;
};

/**
 * Input for {@link AbstractFirebaseNestContext.useModel} with a custom use function that transforms the selection result.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- FirebaseModelsService generic requires `any` for SDK compatibility
export type UseModelInput<C extends FirebaseModelServiceContext, Y extends FirebaseModelsService<any, C>, T extends FirebaseModelsServiceTypes<Y>, O> = UseModelInputForRolesReader<C, Y, T> & {
  readonly use: UseFirebaseModelsServiceSelectionUseFunction<Y, T, O>;
};
