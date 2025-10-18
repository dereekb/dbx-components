import { type BlockingFunction, type CloudFunction as CloudFunctionV1Input } from 'firebase-functions/v1';
import { type CloudFunction as CloudFunctionV2, type CloudEvent } from 'firebase-functions/v2';
import { type CallableContextOptions, type WrappedFunction, type WrappedScheduledFunction, type WrappedV2Function } from 'firebase-functions-test/lib/main';
import { type Getter, type PromiseOrValue } from '@dereekb/util';
import { type FeaturesList } from 'firebase-functions-test/lib/features';
import { type BlockingFunctionMaybeWithHandler, type CallableHttpFunction } from '@dereekb/firebase-server';
import { type CallableRequest } from 'firebase-functions/https';

/**
 * Type fix used for compatability with firebase-functions/v2 the CloudFunction types in unions.
 */
export type CloudFunctionV1TypeFix<T> = Omit<CloudFunctionV1Input<T>, '__trigger'> & { __trigger?: any };
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

export type WrappedCallableRequestParams<W extends WrappedCallableRequest<any, any>> = W extends WrappedCallableRequest<infer I> ? I : unknown | undefined | void;
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

export type WrappedBlockingFunctionWithHandler<E extends object, O> = (input: E) => Promise<O>;
export type WrappedBlockingFunction = () => Promise<void>;
export type WrapBlockingFunctionWithHandlerFunction = <T extends BlockingFunctionMaybeWithHandler<any, any>>(blockingFunction: T) => T extends BlockingFunctionMaybeWithHandler<infer E, infer O> ? WrappedBlockingFunctionWithHandler<E, O> : never;
export type WrapBlockingFunctionWithoutHandlerFunction = (blockingFunction: BlockingFunction) => WrappedBlockingFunction;

export interface WrapBlockingFunction extends WrapBlockingFunctionWithHandlerFunction, WrapBlockingFunctionWithoutHandlerFunction {}

export type WrappedGen2CloudOrBlockingFunction<I extends object> = I extends CloudEvent<unknown> ? WrappedCloudFunctionV2<I> | WrappedBlockingFunctionWithHandler<I, unknown> | WrappedBlockingFunction : WrappedBlockingFunction | WrappedBlockingFunctionWithHandler<I, unknown>;
export type WrapGen2CloudOrBlockingFunction = WrapCloudFunctionV2 | WrapBlockingFunction;

// MARK: Wrapped
/**
 * A common interface for a all known types of wrapped cloud functions that excludes WrappedCallableRequest.
 *
 * All of these functions are wrapped by FirebaseAdminCloudFunctionWrapper.
 */
export type WrappedCloudFunction<I extends object, O = unknown> = (input: I, context?: CallableContextOptions) => Promise<O>; //WrappedGen2CloudOrBlockingFunction<I> | WrappedCloudFunctionV1<I>;
export type WrapCloudFunction = WrapGen2CloudOrBlockingFunction & WrapCloudFunctionV1;

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
   * WrapBlockingFunction function. Use for wrapping a gen 2 BlockingFunction.
   */
  readonly wrapBlockingFunction: WrapBlockingFunction;
  /**
   * WrapCloudFunction function. Use for wrapping a gen 2 CloudFunction or gen 1 CloudFunction.
   */
  readonly wrapCloudFunction: WrapCloudFunction;
}

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

export function wrapCloudFunctionV1ForTests<I, T extends WrapCloudFunctionV1Input<I> = WrapCloudFunctionV1Input<I>>(wrapper: FirebaseAdminCloudFunctionWrapper, getter: Getter<T>): Getter<WrappedCloudFunctionV1<I>> {
  return () => wrapper.wrapV1CloudFunction(getter());
}

export function wrapCloudFunctionV2ForTests<E extends CloudEvent<unknown>, T extends WrapCloudFunctionV2Input<E> = WrapCloudFunctionV2Input<E>>(wrapper: FirebaseAdminCloudFunctionWrapper, getter: Getter<T>): Getter<WrappedCloudFunctionV2<E>> {
  return () => wrapper.wrapV2CloudFunction(getter());
}

export function wrapCloudFunctionTests<I extends object>(wrapper: FirebaseAdminCloudFunctionWrapper, getter: Getter<any>): Getter<WrappedCloudFunction<I>> {
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
