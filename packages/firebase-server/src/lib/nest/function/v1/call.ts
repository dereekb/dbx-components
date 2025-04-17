import * as functions from 'firebase-functions/v1';
import { type INestApplicationContext } from '@nestjs/common';
import { type RunnableHttpFunction } from '../../../function/type';
import { type MakeNestContext, type NestApplicationFunctionFactory, type NestApplicationPromiseGetter } from '../../nest.provider';
import { type OnCallWithNestApplication, type OnCallWithNestApplicationRequest, type OnCallWithNestContext, setNestContextOnRequest } from '../call';
import { mapIdentityFunction } from '@dereekb/util';

/**
 * @deprecated deprecated gen 1 firebase function type
 *
 * @param nestApplication
 * @param data
 * @param context
 * @returns
 */
export function makeOnCallWithNestApplicationRequest<I>(nestApplication: INestApplicationContext, data: I, context: functions.https.CallableContext): OnCallWithNestApplicationRequest<I> {
  return {
    ...context,
    acceptsStreaming: false,
    nestApplication,
    data
  };
}

// MARK: Nest
/**
 * @deprecated deprecated gen 1 firebase function type
 *
 * @see NestApplicationCallableHttpFunctionFactory
 */
export type NestApplicationRunnableHttpFunctionFactory<I> = NestApplicationFunctionFactory<RunnableHttpFunction<I>>;

/**
 * Factory function for generating a NestApplicationFunctionFactory for a HttpsFunctions/Runnable firebase function.
 *
 * @deprecated deprecated gen 1 firebase function type
 */
export type OnCallWithNestApplicationFactory = <I = unknown, O = unknown>(fn: OnCallWithNestApplication<I, O>) => NestApplicationRunnableHttpFunctionFactory<I>;

/**
 * @deprecated deprecated gen 1 firebase function type
 */
export type OnCallWithNestApplicationFactoryConfigFunctionBuilderFunction = (builder: functions.FunctionBuilder) => functions.FunctionBuilder;

/**
 * Creates a factory for generating OnCallWithNestApplication functions.
 *
 * @deprecated move to firebase-functions v2 implementation that uses onCallHandlerWithNestApplicationFactory() instead.
 *
 * @see onCallHandlerWithNestApplicationFactory()
 *
 * @param nestAppPromiseGetter
 * @returns
 */
export function onCallWithNestApplicationFactory(builderFunction: OnCallWithNestApplicationFactoryConfigFunctionBuilderFunction = mapIdentityFunction()): OnCallWithNestApplicationFactory {
  const functionsBuilder = builderFunction(functions.runWith({}));
  return <I, O>(fn: OnCallWithNestApplication<I, O>) => {
    return (nestAppPromiseGetter: NestApplicationPromiseGetter) => functionsBuilder.https.onCall((data: I, context: functions.https.CallableContext) => nestAppPromiseGetter().then((x) => fn(makeOnCallWithNestApplicationRequest(x, data, context))));
  };
}

/**
 * Factory function for generating HttpsFunctions/Runnable firebase function that returns the value from the input OnCallWithNestContext function.
 *
 * @deprecated deprecated gen 1 firebase function type
 */
export type OnCallWithNestContextFactory<N> = <I = unknown, O = unknown>(fn: OnCallWithNestContext<N, I, O>) => NestApplicationRunnableHttpFunctionFactory<I>;

/**
 * Creates a factory for generating OnCallWithNestContext functions with a nest context object that is generated by the input function.
 *
 * @deprecated move to firebase-functions v2 implementation that uses onCallHandlerWithNestContextFactory() instead.
 *
 * @see onCallHandlerWithNestContextFactory()
 *
 * @param appFactory
 * @param makeNestContext
 * @returns
 */
export function onCallWithNestContextFactory<N>(appFactory: OnCallWithNestApplicationFactory, makeNestContext: MakeNestContext<N>): OnCallWithNestContextFactory<N> {
  return <I, O>(fn: OnCallWithNestContext<N, I, O>) => appFactory<I, O>((request) => fn(setNestContextOnRequest(makeNestContext, request)));
}
