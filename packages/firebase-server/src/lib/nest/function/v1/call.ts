import * as functions from 'firebase-functions';
import { INestApplicationContext } from '@nestjs/common';
import { RunnableHttpFunction } from '../../../function/type';
import { MakeNestContext, NestApplicationFunctionFactory, NestApplicationPromiseGetter } from '../../nest.provider';

// MARK: Nest
export type NestApplicationRunnableHttpFunctionFactory<I> = NestApplicationFunctionFactory<RunnableHttpFunction<I>>;

/**
 * Runnable function that is passed an INestApplicationContext in addition to the usual data/context provided by firebase.
 */
export type OnCallWithNestApplication<I = unknown, O = unknown> = (nest: INestApplicationContext, data: I, context: functions.https.CallableContext) => O;

/**
 * Factory function for generating a NestApplicationFunctionFactory for a HttpsFunctions/Runnable firebase function.
 */
export type OnCallWithNestApplicationFactory = <I, O>(fn: OnCallWithNestApplication<I, O>) => NestApplicationRunnableHttpFunctionFactory<I>;

/**
 * Creates a factory for generating OnCallWithNestApplication functions.
 * 
 * @param nestAppPromiseGetter 
 * @returns 
 */
export function onCallWithNestApplicationFactory(): OnCallWithNestApplicationFactory {
  return <I, O>(fn: OnCallWithNestApplication<I, O>) => {
    return (nestAppPromiseGetter: NestApplicationPromiseGetter) => functions.https.onCall((data: I, context: functions.https.CallableContext) => nestAppPromiseGetter().then(x => fn(x, data, context)));
  };
}

/**
 * Runnable function that is passed an arbitrary nest context object in addition to the usual data/context provided by firebase.
 */
export type OnCallWithNestContext<C, I = unknown, O = unknown> = (nestContext: C, data: I, context: functions.https.CallableContext) => O;

/**
 * Factory function for generating HttpsFunctions/Runnable firebase function that returns the value from the input OnCallWithNestContext function.
 */
export type OnCallWithNestContextFactory<C> = <I, O>(fn: OnCallWithNestContext<C, I, O>) => NestApplicationRunnableHttpFunctionFactory<I>;

/**
 * Creates a factory for generating OnCallWithNestContext functions with a nest context object that is generated by the input function.
 * 
 * @param appFactory 
 * @param makeNestContext 
 * @returns 
 */
export function onCallWithNestContextFactory<C>(appFactory: OnCallWithNestApplicationFactory, makeNestContext: MakeNestContext<C>): OnCallWithNestContextFactory<C> {
  return <I, O>(fn: OnCallWithNestContext<C, I, O>) => appFactory<I, O>((nest, data, context) => fn(makeNestContext(nest), data, context));
}
