import { CloudFunction as CloudFunctionV1 } from 'firebase-functions';
import { CloudFunction as CloudFunctionV2, CloudEvent } from 'firebase-functions/v2';
import { wrap, WrappedFunction, WrappedScheduledFunction, WrappedV2Function } from 'firebase-functions-test/lib/main';
import { Getter } from '@dereekb/util';
import { FeaturesList } from 'firebase-functions-test/lib/features';

export type WrapCloudFunctionV1 = <T>(cloudFunction: CloudFunctionV1<T>) => (WrappedScheduledFunction | WrappedFunction<T>);
export type WrapCloudFunctionV2 = <T extends CloudEvent<unknown>>(cloudFunction: CloudFunctionV2<T>) => WrappedV2Function<T>;

export type WrapCloudFunctionV1Input<T> = CloudFunctionV1<T>;
export type WrappedCloudFunctionV1<T> = WrappedScheduledFunction | WrappedFunction<T>;

export type WrapCloudFunctionV2Input<E extends CloudEvent<unknown>> = CloudFunctionV2<E>;
export type WrappedCloudFunctionV2<E extends CloudEvent<unknown>> = WrappedV2Function<E>;

export type WrapBlockingFunction = typeof wrap;

export interface FirebaseAdminCloudFunctionWrapperSource {
  readonly fnWrapper: FirebaseAdminCloudFunctionWrapper;
}

export interface FirebaseAdminCloudFunctionWrapper {
  readonly wrapV1CloudFunction: WrapCloudFunctionV1;
  readonly wrapV2CloudFunction: WrapCloudFunctionV2;
  readonly wrapBlockingFunction: WrapBlockingFunction;
}

export function firebaseAdminCloudFunctionWrapper(instance: FeaturesList): FirebaseAdminCloudFunctionWrapper {
  const wrapper: FirebaseAdminCloudFunctionWrapper = {
    wrapV1CloudFunction(x) {
      return instance.wrap(x);
    },
    wrapV2CloudFunction(x) {
      return instance.wrap(x);
    },
    wrapBlockingFunction() {
      throw new Error('Not supported yet.');
    }
  };

  return wrapper;
}

export function wrapCloudFunctionV1ForTests<I, T extends WrapCloudFunctionV1Input<I> = WrapCloudFunctionV1Input<I>>(wrapper: FirebaseAdminCloudFunctionWrapper, getter: Getter<T>): Getter<WrappedCloudFunctionV1<I>> {
  return () => wrapper.wrapV1CloudFunction(getter());
}

export function wrapCloudFunctionV2ForTests<E extends CloudEvent<unknown>, T extends WrapCloudFunctionV2Input<E> = WrapCloudFunctionV2Input<E>>(wrapper: FirebaseAdminCloudFunctionWrapper, getter: Getter<T>): Getter<WrappedCloudFunctionV2<E>> {
  return () => wrapper.wrapV2CloudFunction(getter());
}
