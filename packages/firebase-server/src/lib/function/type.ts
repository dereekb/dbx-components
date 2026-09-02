import { type PromiseOrValue } from '@dereekb/util';
import { type CallableFunction } from 'firebase-functions/v2/https';

/**
 * Firebase Functions V2 - CallableFunction with output as an optional type.
 */
export type CallableHttpFunction<I, O = unknown> = CallableFunction<I, PromiseOrValue<O>>;
