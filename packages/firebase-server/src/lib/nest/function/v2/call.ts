import { type CallableRequest } from 'firebase-functions/v2/https';
import { https } from 'firebase-functions/v2';
import { type CallableHttpFunction } from '../../../function/type';
import { type MakeNestContext, type NestApplicationFunctionFactory, type NestApplicationPromiseGetter } from '../../nest.provider';
import { type OnCallWithNestApplication, type OnCallWithNestContext, setNestContextOnRequest } from '../call';

// NOTE: If you're looking for onRequest() handling, that is usually handled by Nest and configured with the top-level onRequest by passing express. There is no factory method.

// MARK: Nest
/**
 * A {@link NestApplicationFunctionFactory} that produces a typed {@link CallableHttpFunction}.
 *
 * @typeParam I - The expected input data type for the callable request.
 * @typeParam O - The return type of the callable function.
 */
export type NestApplicationCallableHttpFunctionFactory<I = unknown, O = unknown> = NestApplicationFunctionFactory<CallableHttpFunction<I, O>>;

/**
 * Factory function for generating a NestApplicationFunctionFactory for a HttpsFunctions/Runnable firebase function.
 */
export type OnCallHandlerWithNestApplicationFactory = <I = unknown, O = unknown>(fn: OnCallWithNestApplication<I, O>, opts?: https.CallableOptions<I>) => NestApplicationCallableHttpFunctionFactory<I, O>;

/**
 * Creates an {@link OnCallHandlerWithNestApplicationFactory} that registers Firebase v2 callable functions
 * with automatic NestJS application context injection.
 *
 * The `defaultOpts` are merged with per-function options, allowing shared configuration (e.g., CORS settings,
 * memory allocation) to be set once at the factory level.
 *
 * @example
 * ```ts
 * const callFactory = onCallHandlerWithNestApplicationFactory({ cors: true });
 * const myFunction = callFactory<InputType, OutputType>(
 *   (request) => request.nestApplication.get(MyService).handle(request.data),
 *   { memory: '256MiB' }
 * );
 * ```
 *
 * @param defaultOpts - Default {@link https.CallableOptions} applied to all functions created by this factory.
 * @returns A factory that creates nest-application-aware callable functions.
 */
export function onCallHandlerWithNestApplicationFactory(defaultOpts: https.CallableOptions = {}): OnCallHandlerWithNestApplicationFactory {
  return <I = unknown, O = unknown>(fn: OnCallWithNestApplication<I, O>, opts?: https.CallableOptions<I>) => {
    return (nestAppPromiseGetter: NestApplicationPromiseGetter) =>
      https.onCall({ ...defaultOpts, ...opts }, (request: CallableRequest<I>) =>
        nestAppPromiseGetter().then((nestApplication) =>
          fn({
            ...request,
            nestApplication
          })
        )
      );
  };
}

/**
 * Factory function for generating HttpsFunctions/Runnable firebase function that returns the value from the input OnCallWithNestContext function.
 */
export type OnCallHandlerWithNestContextFactory<C> = <I = unknown, O = unknown>(fn: OnCallWithNestContext<C, I, O>, opts?: https.CallableOptions<I>) => NestApplicationCallableHttpFunctionFactory<I, O>;

/**
 * Creates an {@link OnCallHandlerWithNestContextFactory} that builds on an existing
 * {@link OnCallHandlerWithNestApplicationFactory} by additionally injecting a typed nest context.
 *
 * This is the standard way to create callable functions that receive a domain-specific context
 * (e.g., `MyApiNestContext`) rather than the raw NestJS application context.
 *
 * @example
 * ```ts
 * const appFactory = onCallHandlerWithNestApplicationFactory();
 * const contextFactory = onCallHandlerWithNestContextFactory(appFactory, makeMyContext);
 * const myFunction = contextFactory<InputType, OutputType>((request) => {
 *   // request.nest is MyApiNestContext
 *   return request.nest.someService.handle(request.data);
 * });
 * ```
 *
 * @param appFactory - The base application-level callable factory.
 * @param makeNestContext - Factory that creates the typed context from the application context.
 * @returns A factory that creates typed-context-aware callable functions.
 */
export function onCallHandlerWithNestContextFactory<C>(appFactory: OnCallHandlerWithNestApplicationFactory, makeNestContext: MakeNestContext<C>): OnCallHandlerWithNestContextFactory<C> {
  return <I, O>(fn: OnCallWithNestContext<C, I, O>, opts?: https.CallableOptions<I>) => appFactory<I, O>((request) => fn(setNestContextOnRequest(makeNestContext, request)), opts);
}
