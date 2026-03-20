import { type NestContextCallableRequest } from '../function/nest';

/**
 * Context passed to a {@link AssertDevelopmentRequestFunction} before a development
 * function handler executes.
 *
 * Provides the original request and the specifier identifying which dev function
 * is being called, enabling assertions to gate access on a per-function basis.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam I - The input data type of the request.
 */
export interface AssertDevelopmentRequestFunctionContext<N, I = unknown> {
  /**
   * The original callable request including the NestJS context and caller data.
   */
  readonly request: NestContextCallableRequest<N, I>;
  /**
   * The development function specifier string identifying which dev operation was requested.
   */
  readonly specifier: string;
}

/**
 * Pre-assertion hook invoked before a development function handler executes.
 *
 * Throw an error to reject the request. Useful for restricting which development
 * functions are accessible in certain environments or to specific callers.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam I - The input data type of the request.
 */
export type AssertDevelopmentRequestFunction<N, I = unknown> = (context: AssertDevelopmentRequestFunctionContext<N, I>) => void;
