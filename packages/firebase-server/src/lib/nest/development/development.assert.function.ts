import { type NestContextCallableRequest } from '../function/nest';

export interface AssertDevelopmentRequestFunctionContext<N, I = unknown> {
  readonly request: NestContextCallableRequest<N, I>;
  readonly specifier: string;
}

/**
 * Function that asserts something given the input request.
 */
export type AssertDevelopmentRequestFunction<N, I = unknown> = (context: AssertDevelopmentRequestFunctionContext<N, I>) => void;
