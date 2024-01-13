import { type Getter } from './getter';

/**
 * Type of the result of a Getter
 */
export type GetterResult<G> = G extends Getter<infer Result> ? Result : never;
