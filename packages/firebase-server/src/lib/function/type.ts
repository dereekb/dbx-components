import { type PromiseOrValue } from '@dereekb/util';
import { type Runnable, type HttpsFunction } from 'firebase-functions/v1';
import { type CallableFunction } from 'firebase-functions/v2/https';

/**
 * Firebase Functions V1 - Union of firebase-functions HttpsFunction and Runnable.
 */
export type RunnableHttpFunction<I> = HttpsFunction & Runnable<I>;

/**
 * Firebase Functions V2 - CallableFunction with output as an optional type.
 */
export type CallableHttpFunction<I, O = unknown> = CallableFunction<I, PromiseOrValue<O>>;
