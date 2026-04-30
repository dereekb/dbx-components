import { type BlockingFunction, type CloudFunction as CloudFunctionV1Input } from 'firebase-functions/v1';
import { type CloudFunction as CloudFunctionV2, type CloudEvent } from 'firebase-functions/v2';
import { type CallableContextOptions, type WrappedFunction, type WrappedScheduledFunction, type WrappedV2Function } from 'firebase-functions-test/lib/main';
import { type Getter, type PromiseOrValue } from '@dereekb/util';
import { type FeaturesList } from 'firebase-functions-test/lib/features';
import { type BlockingFunctionMaybeWithHandler, type CallableHttpFunction } from '@dereekb/firebase-server';
import { type CallableRequest } from 'firebase-functions/https';

/**
 * Type fix used for compatability with firebase-functions/v2 the CloudFunction types in unions.
 *
 * The v1 `CloudFunction` type includes a `__trigger` property whose shape conflicts with the v2
 * `CloudFunction` type, making them impossible to use in the same union. This type omits the
 * conflicting property and replaces it with an optional `any`, allowing v1 functions to participate
 * in shared union types alongside v2 functions.
 */
export type CloudFunctionV1TypeFix<T> = Omit<CloudFunctionV1Input<T>, '__trigger'> & { __trigger?: any };

/**
 * Alias for {@link CloudFunctionV1TypeFix} representing a gen 1 Firebase Cloud Function
 * with the union-compatibility fix applied.
 */
export type CloudFunctionV1<T> = CloudFunctionV1TypeFix<T>;

// gen 1
/**
 * @deprecated deprecated gen 1 firebase function type
 */
export type WrappedCloudFunctionV1<T> = WrappedScheduledFunction | WrappedFunction<T>;

/**
 * @deprecated deprecated gen 1 firebase function type
 */
export type WrapCloudFunctionV1 = <T>(cloudFunction: CloudFunctionV1<T>) => WrappedCloudFunctionV1<T>;

/**
 * @deprecated deprecated gen 1 firebase function type
 */
export type WrapCloudFunctionV1Input<T> = CloudFunctionV1<T>;

// gen 2
/**
 * Wrapped callable function that only takes in data and options that are used to simulate a Firebase request, then returns the result.
 */
export type WrappedCallableRequest<I, O = unknown> = (data: I, options: CallableContextOptions) => PromiseOrValue<O>;

/**
 * Extracts the input (params) type from a {@link WrappedCallableRequest}.
 *
 * Useful when you need to derive the request payload type from an already-wrapped callable
 * without importing the original input type separately.
 */
export type WrappedCallableRequestParams<W extends WrappedCallableRequest<any, any>> = W extends WrappedCallableRequest<infer I> ? I : unknown | undefined | void;

/**
 * Extracts the output (return) type from a {@link WrappedCallableRequest}.
 *
 * Useful when you need to derive the response type from an already-wrapped callable
 * without importing the original output type separately.
 */
export type WrappedCallableRequestOutput<W extends WrappedCallableRequest<any, any>> = W extends WrappedCallableRequest<infer _, infer O> ? O : unknown;

// export type WrappedCallableRequestOutput<W extends WrappedCallableRequest<any, any>> = W extends WrappedCallableRequest<infer _, infer O> ? O extends unknown ? any : O : any;

/**
 * WrapCallableRequestV2 input.
 */
export type WrapCallableRequestInput<I, O = unknown> = CallableHttpFunction<I, O>;

/**
 * Function to wrap a CallableHttpFunction into a WrappedV2CallableRequestDataOnly type.
 */
export type WrapCallableRequest = <I, O>(callable: WrapCallableRequestInput<I, O>) => WrappedCallableRequest<I, O>;

/**
 * Function to wrap a gen 2 CloudFunction into a WrappedV2Function type.
 */
export type WrapCloudFunctionV2 = <T extends CloudEvent<any>>(cloudFunction: CloudFunctionV2<T>) => WrappedV2Function<T>;

export type WrapCloudFunctionV2Input<E extends CloudEvent<unknown>> = CloudFunctionV2<E>;
export type WrappedCloudFunctionV2<E extends CloudEvent<unknown>> = WrappedV2Function<E>;

/**
 * A wrapped gen 2 blocking function that accepts an event input and returns a result.
 *
 * This is the test-time representation of a blocking function that includes a handler
 * (e.g., `beforeUserCreated` with a handler callback).
 */
export type WrappedBlockingFunctionWithHandler<E extends object, O> = (input: E) => Promise<O>;

/**
 * A wrapped gen 2 blocking function with no handler — invocation simply triggers side effects.
 *
 * This is the test-time representation of a blocking function registered without a handler callback.
 */
export type WrappedBlockingFunction = () => Promise<void>;

/**
 * Wrapping function for a {@link BlockingFunctionMaybeWithHandler} that has a handler.
 *
 * Infers the event and output types from the blocking function and returns a
 * correspondingly typed {@link WrappedBlockingFunctionWithHandler}.
 */
export type WrapBlockingFunctionWithHandlerFunction = <T extends BlockingFunctionMaybeWithHandler<any, any>>(blockingFunction: T) => T extends BlockingFunctionMaybeWithHandler<infer E, infer O> ? WrappedBlockingFunctionWithHandler<E, O> : never;

/**
 * Wrapping function for a gen 1 {@link BlockingFunction} (no handler).
 *
 * Returns a {@link WrappedBlockingFunction} that can be invoked in tests.
 */
export type WrapBlockingFunctionWithoutHandlerFunction = (blockingFunction: BlockingFunction) => WrappedBlockingFunction;

/**
 * Combined wrapping function interface for blocking functions.
 *
 * Overloaded to handle both blocking functions with handlers
 * ({@link WrapBlockingFunctionWithHandlerFunction}) and without
 * ({@link WrapBlockingFunctionWithoutHandlerFunction}), allowing a single
 * `wrapBlockingFunction` call to wrap either variant.
 */
export interface WrapBlockingFunction extends WrapBlockingFunctionWithHandlerFunction, WrapBlockingFunctionWithoutHandlerFunction {}

/**
 * Union of all possible wrapped gen 2 function types for a given input.
 *
 * When `I` extends `CloudEvent`, the result may be a wrapped cloud function or a wrapped
 * blocking function (with or without handler). Otherwise it is restricted to blocking function variants.
 */
export type WrappedGen2CloudOrBlockingFunction<I extends object> = I extends CloudEvent<unknown> ? WrappedCloudFunctionV2<I> | WrappedBlockingFunctionWithHandler<I, unknown> | WrappedBlockingFunction : WrappedBlockingFunction | WrappedBlockingFunctionWithHandler<I, unknown>;

/**
 * Union of wrapping function types for gen 2 cloud functions and blocking functions.
 */
export type WrapGen2CloudOrBlockingFunction = WrapCloudFunctionV2 | WrapBlockingFunction;

// MARK: Wrapped
/**
 * A common interface for a all known types of wrapped cloud functions that excludes WrappedCallableRequest.
 *
 * All of these functions are wrapped by FirebaseAdminCloudFunctionWrapper.
 */
export type WrappedCloudFunction<I extends object, O = unknown> = (input: I, context?: CallableContextOptions) => Promise<O>; //WrappedGen2CloudOrBlockingFunction<I> | WrappedCloudFunctionV1<I>;
/**
 * Unified wrapping function type that can wrap any generation of cloud function.
 *
 * Combines {@link WrapGen2CloudOrBlockingFunction} (gen 2 / blocking) with
 * {@link WrapCloudFunctionV1} (gen 1) into a single callable type.
 */
export type WrapCloudFunction = WrapGen2CloudOrBlockingFunction & WrapCloudFunctionV1;

// MARK: Wrapper
/**
 * Provides access to a {@link FirebaseAdminCloudFunctionWrapper} via the `fnWrapper` property.
 *
 * Implemented by test fixture classes that need to expose cloud function wrapping capabilities
 * to their consumers.
 */
export interface FirebaseAdminCloudFunctionWrapperSource {
  readonly fnWrapper: FirebaseAdminCloudFunctionWrapper;
}

export interface FirebaseAdminCloudFunctionWrapper {
  /**
   * @deprecated deprecated gen 1 firebase function type. Use wrapV2CallableRequest and wrapV2CloudFunction instead.
   */
  readonly wrapV1CloudFunction: WrapCloudFunctionV1;
  /**
   * @deprecated use wrapCallableRequest
   */
  readonly wrapV2CallableRequest: WrapCallableRequest;
  /**
   * @deprecated use wrapCloudFunction
   */
  readonly wrapV2CloudFunction: WrapCloudFunctionV2;
  /**
   * WrapCallableRequestV2 function. Use for wrapping a CallableHttpFunction.
   */
  readonly wrapCallableRequest: WrapCallableRequest;
  /**
   * WrapBlockingFunction function. Use for wrapping a gen 2 BlockingFunction.
   */
  readonly wrapBlockingFunction: WrapBlockingFunction;
  /**
   * WrapCloudFunction function. Use for wrapping a gen 2 CloudFunction or gen 1 CloudFunction.
   */
  readonly wrapCloudFunction: WrapCloudFunction;
}

/**
 * Creates a {@link FirebaseAdminCloudFunctionWrapper} from a `firebase-functions-test` {@link FeaturesList} instance.
 *
 * The returned wrapper provides methods to wrap gen 1 cloud functions, gen 2 cloud functions,
 * callable requests, and blocking functions for use in integration tests. Each method delegates
 * to the underlying `FeaturesList.wrap()` with appropriate type coercion.
 *
 * @example
 * ```ts
 * const testEnv = functionsTest();
 * const wrapper = firebaseAdminCloudFunctionWrapper(testEnv);
 * const wrapped = wrapper.wrapCallableRequest(myCallable);
 * const result = await wrapped({ foo: 'bar' }, { auth: { uid: 'test-user' } });
 * ```
 */
export function firebaseAdminCloudFunctionWrapper(instance: FeaturesList): FirebaseAdminCloudFunctionWrapper {
  const wrapV1CloudFunction: FirebaseAdminCloudFunctionWrapper['wrapV1CloudFunction'] = (x) => {
    return instance.wrap(x as CloudFunctionV1Input<any>);
  };

  const wrapV2CallableRequest: WrapCallableRequest = (x) => {
    const wrappedCloudFunction = instance.wrap(x);

    // context is marked optional here to better match the gen 1 callable function signature
    return async <I, O>(data: I, context?: CallableContextOptions) => {
      const request: CallableRequest = {
        ...context,
        data,
        // NOTE: These will typically not be used/available as they are express.js properties that are not available or useful to the handlers
        rawRequest: context?.rawRequest ?? ({} as Required<CallableContextOptions>['rawRequest']),
        acceptsStreaming: false
      };

      return (await wrappedCloudFunction(request)) as O;
    };
  };

  const wrapV2CloudFunction: WrapCloudFunctionV2 = (x) => {
    return instance.wrap(x);
  };

  const wrapBlockingFunction: WrapBlockingFunction = ((blockingFunction: any) => {
    return instance.wrap(blockingFunction);
  }) as WrapBlockingFunction;

  const wrapCloudFunction: WrapCloudFunction = (x: any) => {
    return instance.wrap(x);
  };

  const wrapper: FirebaseAdminCloudFunctionWrapper = {
    wrapV1CloudFunction,
    wrapV2CloudFunction,
    wrapV2CallableRequest,
    wrapCallableRequest: wrapV2CallableRequest,
    wrapBlockingFunction,
    wrapCloudFunction
  };

  return wrapper;
}

/**
 * Creates a lazy getter that wraps a gen 1 cloud function for testing each time it is called.
 *
 * The returned getter re-wraps on every invocation, so it always reflects the latest function
 * reference from the provided getter — useful when the function under test is re-created between tests.
 *
 * @example
 * ```ts
 * const getWrapped = wrapCloudFunctionV1ForTests(wrapper, () => myV1Function);
 * const result = await getWrapped()({ /* event data *\/ });
 * ```
 *
 * @deprecated Prefer gen 2 functions and {@link wrapCloudFunctionV2ForTests} or {@link wrapCloudFunctionTests}.
 */
export function wrapCloudFunctionV1ForTests<I, T extends WrapCloudFunctionV1Input<I> = WrapCloudFunctionV1Input<I>>(wrapper: FirebaseAdminCloudFunctionWrapper, getter: Getter<T>): Getter<WrappedCloudFunctionV1<I>> {
  return () => wrapper.wrapV1CloudFunction(getter());
}

/**
 * Creates a lazy getter that wraps a gen 2 cloud function for testing each time it is called.
 *
 * Re-wraps on every invocation so it always reflects the latest function reference,
 * which is important when the function under test is re-created between test cases.
 *
 * @example
 * ```ts
 * const getWrapped = wrapCloudFunctionV2ForTests(wrapper, () => myV2CloudFunction);
 * const result = await getWrapped()({ data: payload });
 * ```
 */
export function wrapCloudFunctionV2ForTests<E extends CloudEvent<unknown>, T extends WrapCloudFunctionV2Input<E> = WrapCloudFunctionV2Input<E>>(wrapper: FirebaseAdminCloudFunctionWrapper, getter: Getter<T>): Getter<WrappedCloudFunctionV2<E>> {
  return () => wrapper.wrapV2CloudFunction(getter());
}

/**
 * Creates a lazy getter that wraps any cloud function (gen 1 or gen 2) for testing using
 * the unified {@link WrapCloudFunction} interface.
 *
 * This is the most general wrapper — use it when you do not need to distinguish between
 * function generations in your test setup.
 *
 * @example
 * ```ts
 * const getWrapped = wrapCloudFunctionTests(wrapper, () => myFunction);
 * const result = await getWrapped()(eventInput);
 * ```
 */
export function wrapCloudFunctionTests<I extends object>(wrapper: FirebaseAdminCloudFunctionWrapper, getter: Getter<any>): Getter<WrappedCloudFunction<I>> {
  return () => wrapper.wrapCloudFunction(getter());
}

/**
 * Creates a lazy getter that wraps a {@link CallableHttpFunction} for testing each time it is called.
 *
 * The wrapped callable accepts raw data and {@link CallableContextOptions} (e.g., auth context),
 * simulating an incoming HTTP callable request without needing a running server.
 *
 * @example
 * ```ts
 * const getWrapped = wrapCallableRequestForTests(wrapper, () => myCallable);
 * const result = await getWrapped()({ input: 'value' }, { auth: { uid: 'user-1' } });
 * ```
 */
export function wrapCallableRequestForTests<I, O = unknown, T extends WrapCallableRequestInput<I, O> = WrapCallableRequestInput<I, O>>(wrapper: FirebaseAdminCloudFunctionWrapper, getter: Getter<T>): Getter<WrappedCallableRequest<I, O>> {
  return () => wrapper.wrapCallableRequest(getter());
}

// MARK: Compat
/**
 * @deprecated use WrappedCallableRequest instead.
 */
export type WrappedV2CallableRequestDataOnly<I, O = unknown> = WrappedCallableRequest<I, O>;

/**
 * @deprecated use WrapCallableRequest instead.
 */
export type WrapCallableRequestV2Input<I, O = unknown> = WrapCallableRequestInput<I, O>;

/**
 * @deprecated use WrapCallableRequest instead.
 */
export type WrapCallableRequestV2 = WrapCallableRequest;
