import { Getter } from '@dereekb/util';
import { INestApplication } from '@nestjs/common';
import * as functions from 'firebase-functions';
import { HttpsFunction, Runnable } from 'firebase-functions';

// MARK: Nest
/**
 * Generates a function from the passed NestAppPromiseGetter/context.
 * 
 * This pattern is available to allow generating similar content for differenting contexts, such as production and testing.
 */
export type NestAppFunctionFactory<F> = (nestAppPromiseGetter: NestAppPromiseGetter) => F;

/**
 * Runnable function that is passed an INestApplication in addition to the usual data/context provided by firebase.
 */
export type OnCallWithNestApp<I = any, O = any> = (nest: INestApplication, data: I, context: functions.https.CallableContext) => O;

/**
 * Factory function for generating a NestAppFunctionFactory for a HttpsFunctions/Runnable firebase function.
 */
export type OnCallWithNestAppFactory = <I, O>(fn: OnCallWithNestApp<I, O>) => NestAppFunctionFactory<HttpsFunction & Runnable<O>>;

/**
 * Getter for an INestApplication promise. Nest should be initialized when the promise resolves.
 */
export type NestAppPromiseGetter = Getter<Promise<INestApplication>>;

/**
 * Creates a factory for generating OnCallWithNestApp functions.
 * 
 * @param nestAppPromiseGetter 
 * @returns 
 */
export function onCallWithNestApplicationFactory(): OnCallWithNestAppFactory {
  return <I, O>(fn: OnCallWithNestApp<I, O>) => {
    return (nestAppPromiseGetter: NestAppPromiseGetter) => functions.https.onCall((data: I, context: functions.https.CallableContext) => nestAppPromiseGetter().then(x => fn(x, data, context)));
  };
}

/**
 * Runnable function that is passed an arbitrary nest context object in addition to the usual data/context provided by firebase.
 */
export type OnCallWithNestContext<C, I = any, O = any> = (nestContext: C, data: I, context: functions.https.CallableContext) => O;

/**
 * Factory function for generating HttpsFunctions/Runnable firebase function that returns the value from the input OnCallWithNestContext function.
 */
export type OnCallWithNestContextFactory<C> = <I, O>(fn: OnCallWithNestContext<C, I, O>) => NestAppFunctionFactory<HttpsFunction & Runnable<O>>;

/**
 * Getter for an INestApplication promise. Nest should be initialized when the promise resolves.
 */
export type MakeNestContext<C> = (nest: INestApplication) => C;

/**
 * Creates a factory for generating OnCallWithNestContext functions with a nest context object that is generated by the input function.
 * 
 * @param appFactory 
 * @param makeNestContext 
 * @returns 
 */
export function onCallWithNestContextFactory<C>(appFactory: OnCallWithNestAppFactory, makeNestContext: MakeNestContext<C>): OnCallWithNestContextFactory<C> {
  return <I, O>(fn: OnCallWithNestContext<C, I, O>) => appFactory<I, O>((nest, data, context) => fn(makeNestContext(nest), data, context));
}

/**
 * Abstract class that wraps an INestApplication value.
 */
export abstract class AbstractNestContext {
  constructor(readonly nest: INestApplication) { }
}
