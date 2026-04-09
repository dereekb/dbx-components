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
import { build, type BuildFunction, type Getter, performAsyncTasks } from '@dereekb/util';
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

  /**
   * Loads a model document by key, checks permissions against the requested roles,
   * and optionally transforms the result via a `use` function.
   *
   * When called without a `use` function, returns the {@link ContextGrantedModelRolesReader}
   * which provides access to the document and its granted roles.
   *
   * @throws Throws {@link nestFirebaseDoesNotExistError} if the document does not exist.
   * @throws Throws {@link nestFirebaseForbiddenPermissionError} if the caller lacks the requested roles.
   *
   * @param type - The model type string (e.g., 'profile', 'guestbook').
   * @param select - Selection params including key, roles, and optional use function.
   * @returns The result of the `use` function, or the roles reader if no `use` function is provided.
   */
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

  /**
   * Loads and checks permissions for multiple models of the same type in parallel.
   *
   * Uses {@link performAsyncTasks} internally. The `use` function receives the array of
   * successful {@link ContextGrantedModelRolesReader} values and an array of failed items.
   *
   * Individual documents that do not exist throw {@link nestFirebaseDoesNotExistError},
   * and documents where the caller lacks the requested roles throw
   * {@link nestFirebaseForbiddenPermissionError}. These errors are captured per-key
   * and passed to the `use` function via the failure array (unless `throwOnFirstError` is true).
   *
   * @param type - the model type to load
   * @param select - selection params including keys array, roles, and use function
   * @returns the result of the use function
   *
   * @example
   * ```ts
   * const result = await nest.useMultipleModels('storageFile', {
   *   request,
   *   keys: ['storageFile/abc', 'storageFile/def'],
   *   roles: 'download',
   *   throwOnFirstError: false,
   *   use: (successful, failed) => ({
   *     documents: successful.map((r) => r.document),
   *     errors: failed
   *   })
   * });
   * ```
   */
  async useMultipleModels<T extends FirebaseModelsServiceTypes<Y>, O>(type: T, select: UseMultipleModelsInput<FirebaseAppModelContext<A>, Y, T, O>): Promise<O> {
    const context: FirebaseAppModelContext<A> = this.makeModelContext(select.request, select.buildFn);
    const { keys, use, throwOnFirstError, useOnFirstError } = select;

    const taskResult = await performAsyncTasks(
      keys,
      async (key) => {
        const usePromise = useFirebaseModelsService(this.firebaseModelsService, type, {
          context,
          key,
          roles: select.roles,
          rolesSetIncludes: select.rolesSetIncludes
        } as unknown as UseFirebaseModelsServiceSelection<Y, T>);

        return usePromise((x) => x) as unknown as Promise<FirebaseModelsServiceSelectionResultRolesReader<Y, T>>;
      },
      { throwError: false }
    );

    const successful = taskResult.results.map(([, reader]) => reader);
    const errors = taskResult.errors.map(([key, error]) => ({ key, error }) as UseMultipleModelsFailedItem<Y, T>);
    const hasErrors = errors.length > 0;

    // throwOnFirstError (default when useOnFirstError is not set): throw the first error directly
    if (hasErrors && (throwOnFirstError ?? !useOnFirstError)) {
      throw errors[0].error;
    }

    // useOnFirstError: call use() with empty successes and abortedEarly: true on first error
    if (hasErrors && useOnFirstError) {
      return use([], { errors, abortedEarly: true });
    }

    return use(successful, { errors, abortedEarly: false });
  }
}

/**
 * Input for {@link AbstractFirebaseNestContext.useModel} when only a roles reader is needed (no custom use function).
 */
export type UseModelInputForRolesReader<C extends FirebaseModelServiceContext, Y extends FirebaseModelsService<any, C>, T extends FirebaseModelsServiceTypes<Y>> = Omit<UseFirebaseModelsServiceSelection<Y, T>, 'type' | 'context'> & {
  readonly request: AuthDataRef;
  readonly buildFn?: BuildFunction<C>;
};

/**
 * Input for {@link AbstractFirebaseNestContext.useModel} with a custom use function that transforms the selection result.
 */
export type UseModelInput<C extends FirebaseModelServiceContext, Y extends FirebaseModelsService<any, C>, T extends FirebaseModelsServiceTypes<Y>, O> = UseModelInputForRolesReader<C, Y, T> & {
  readonly use: UseFirebaseModelsServiceSelectionUseFunction<Y, T, O>;
};

/**
 * Extracts the key type from a {@link UseFirebaseModelsServiceSelection} for a given model type.
 */
export type UseFirebaseModelsServiceSelectionKeyType<Y extends FirebaseModelsService<any, any>, T extends FirebaseModelsServiceTypes<Y>> = UseFirebaseModelsServiceSelection<Y, T> extends { key: infer K } ? K : never;

/**
 * Input for {@link AbstractFirebaseNestContext.useMultipleModels}.
 *
 * Takes an array of keys and a `use` function that receives the successful roles readers
 * and a {@link UseMultipleModelsFailure} describing any errors. Shared `roles` and `rolesSetIncludes` apply to all keys.
 */
export type UseMultipleModelsInput<C extends FirebaseModelServiceContext, Y extends FirebaseModelsService<any, C>, T extends FirebaseModelsServiceTypes<Y>, O> = Omit<UseModelInputForRolesReader<C, Y, T>, 'key'> & {
  readonly keys: UseFirebaseModelsServiceSelectionKeyType<Y, T>[];
  readonly use: UseMultipleModelsUseFunction<Y, T, O>;
  /**
   * When true, throws the first error directly without calling `use`.
   *
   * Defaults to true (unless `useOnFirstError` is set).
   */
  readonly throwOnFirstError?: boolean;
  /**
   * When true, calls `use` on the first error with an empty successful array
   * and `abortedEarly: true` in the failure object.
   *
   * Takes precedence over `throwOnFirstError` when both are set.
   */
  readonly useOnFirstError?: boolean;
};

/**
 * Use function for {@link UseMultipleModelsInput}.
 *
 * Receives the successful roles readers and a failure object containing any errors.
 */
export type UseMultipleModelsUseFunction<Y extends FirebaseModelsService<any, any>, T extends FirebaseModelsServiceTypes<Y>, O> = (successful: FirebaseModelsServiceSelectionResultRolesReader<Y, T>[], failure: UseMultipleModelsFailure<Y, T>) => Promise<O> | O;

/**
 * Failure information passed to the {@link UseMultipleModelsUseFunction}.
 *
 * Contains the array of failed items and whether the operation was aborted early
 * (via `useOnFirstError`) before all keys were processed.
 */
export interface UseMultipleModelsFailure<Y extends FirebaseModelsService<any, any>, T extends FirebaseModelsServiceTypes<Y>> {
  readonly errors: UseMultipleModelsFailedItem<Y, T>[];
  /**
   * True when the operation was aborted on the first error (via `useOnFirstError`).
   *
   * When true, the successful array will be empty and not all keys may have been attempted.
   */
  readonly abortedEarly: boolean;
}

/**
 * Represents a key that failed permission checking in {@link AbstractFirebaseNestContext.useMultipleModels}.
 */
export interface UseMultipleModelsFailedItem<Y extends FirebaseModelsService<any, any>, T extends FirebaseModelsServiceTypes<Y>> {
  readonly key: UseFirebaseModelsServiceSelectionKeyType<Y, T>;
  readonly error: unknown;
}
