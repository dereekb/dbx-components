import { Getter } from '@dereekb/util';
import { INestApplicationContext } from '@nestjs/common';

/**
 * Getter for an INestApplicationContext promise. Nest should be initialized when the promise resolves.
 */
export type NestApplicationPromiseGetter = Getter<Promise<INestApplicationContext>>;

/**
 * Generates a function from the passed NestApplicationPromiseGetter/context.
 * 
 * This pattern is available to allow generating similar content for differenting contexts, such as production and testing.
 */
export type NestApplicationFunctionFactory<F> = (nestAppPromiseGetter: NestApplicationPromiseGetter) => F;

/**
 * Getter for an INestApplicationContext promise. Nest should be initialized when the promise resolves.
 */
export type MakeNestContext<C> = (nest: INestApplicationContext) => C;

/**
 * Abstract class that wraps an INestApplicationContext value.
 */
export abstract class AbstractNestContext {
  constructor(readonly nest: INestApplicationContext) { }
}
