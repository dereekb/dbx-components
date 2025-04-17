import { BlockingFunction, CloudFunction as CloudFunctionV1 } from 'firebase-functions/v1';
import { CloudFunction as CloudFunctionV2, CloudEvent } from 'firebase-functions/v2';
import { CallableContextOptions, wrap, WrappedFunction, WrappedScheduledFunction, WrappedV2Function } from 'firebase-functions-test/lib/main';
import { Getter, PromiseOrValue } from '@dereekb/util';
import { FeaturesList } from 'firebase-functions-test/lib/features';
import { BlockingFunctionMaybeWithHandler, CallableHttpFunction } from '@dereekb/firebase-server';
import { CallableRequest } from 'firebase-functions/https';

// gen 1
/**
 * @deprecated deprecated gen 1 firebase function type
 */
export type WrapCloudFunctionV1 = <T>(cloudFunction: CloudFunctionV1<T>) => WrappedScheduledFunction | WrappedFunction<T>;

/**
 * @deprecated deprecated gen 1 firebase function type
 */
export type WrapCloudFunctionV1Input<T> = CloudFunctionV1<T>;

/**
 * @deprecated deprecated gen 1 firebase function type
 */
export type WrappedCloudFunctionV1<T> = WrappedScheduledFunction | WrappedFunction<T>;

// gen 2
/**
 * Wrapped callable function that only takes in data and options that are used to simulate a Firebase request, then returns the result.
 */
export type WrappedCallableRequest<I, O = unknown> = (data: I, options: CallableContextOptions) => PromiseOrValue<O>; // NOTE: This is typically/usually the same as WrappedFunction<I>;

export type WrappedCallableRequestParams<W extends WrappedCallableRequest<any, any>> = W extends WrappedCallableRequest<infer I> ? I : unknown | undefined | void;
export type WrappedCallableRequestOutput<W extends WrappedCallableRequest<any, any>> = W extends WrappedCallableRequest<any, infer O> ? O : unknown | undefined | void;

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
export type WrapCloudFunctionV2 = <T extends CloudEvent<unknown>>(cloudFunction: CloudFunctionV2<T>) => WrappedV2Function<T>;

export type WrapCloudFunctionV2Input<E extends CloudEvent<unknown>> = CloudFunctionV2<E>;
export type WrappedCloudFunctionV2<E extends CloudEvent<unknown>> = WrappedV2Function<E>;

export type WrappedBlockingFunctionWithHandler<E extends object, O> = (input: E) => Promise<O>;
export type WrappedBlockingFunction = () => Promise<void>;
export type WrapBlockingFunctionWithHandlerFunction = <T extends BlockingFunctionMaybeWithHandler<any, any>>(blockingFunction: T) => T extends BlockingFunctionMaybeWithHandler<infer E, infer O> ? WrappedBlockingFunctionWithHandler<E, O> : never;
export type WrapBlockingFunctionWithoutHandlerFunction = (blockingFunction: BlockingFunction) => WrappedBlockingFunction;

export interface WrapBlockingFunction extends WrapBlockingFunctionWithHandlerFunction, WrapBlockingFunctionWithoutHandlerFunction {}

// MARK: Wrapped
/**
 * A common interface that both gen 1 and gen 2 share.
 */
export type WrappedCloudFunction<I, O = unknown> = WrappedCloudFunctionV1<I> & WrappedCallableRequest<I, O>;
export type WrappedCloudFunctionParams<W extends WrappedCloudFunction<any, any>> = W extends WrappedCloudFunction<infer I> ? I : unknown | undefined | void;
export type WrappedCloudFunctionOutput<W extends WrappedCloudFunction<any, any>> = W extends WrappedCloudFunction<any, infer O> ? O : unknown | undefined | void;

// MARK: Wrapper
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
   * WrapCloudFunctionV2 function. Use for wrapping a gen 2 CloudFunction.
   */
  readonly wrapCloudFunction: WrapCloudFunctionV2;
  /**
   * WrapBlockingFunction function. Use for wrapping a gen 2 BlockingFunction.
   */
  readonly wrapBlockingFunction: WrapBlockingFunction;
}

export function firebaseAdminCloudFunctionWrapper(instance: FeaturesList): FirebaseAdminCloudFunctionWrapper {
  const wrapV1CloudFunction: FirebaseAdminCloudFunctionWrapper['wrapV1CloudFunction'] = (x) => {
    return instance.wrap(x);
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

      const result = (await wrappedCloudFunction(request)) as O;
      return result;
    };
  };

  const wrapV2CloudFunction: WrapCloudFunctionV2 = (x) => {
    return instance.wrap(x);
  };

  const wrapBlockingFunction: WrapBlockingFunction = ((blockingFunction: any) => {
    return instance.wrap(blockingFunction);
  }) as WrapBlockingFunction;

  const wrapper: FirebaseAdminCloudFunctionWrapper = {
    wrapV1CloudFunction,
    wrapV2CloudFunction,
    wrapV2CallableRequest,
    wrapCallableRequest: wrapV2CallableRequest,
    wrapCloudFunction: wrapV2CloudFunction,
    wrapBlockingFunction
  };

  return wrapper;
}

export function wrapCloudFunctionV1ForTests<I, T extends WrapCloudFunctionV1Input<I> = WrapCloudFunctionV1Input<I>>(wrapper: FirebaseAdminCloudFunctionWrapper, getter: Getter<T>): Getter<WrappedCloudFunctionV1<I>> {
  return () => wrapper.wrapV1CloudFunction(getter());
}

export function wrapCloudFunctionV2ForTests<E extends CloudEvent<unknown>, T extends WrapCloudFunctionV2Input<E> = WrapCloudFunctionV2Input<E>>(wrapper: FirebaseAdminCloudFunctionWrapper, getter: Getter<T>): Getter<WrappedCloudFunctionV2<E>> {
  return () => wrapper.wrapCloudFunction(getter());
}

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
