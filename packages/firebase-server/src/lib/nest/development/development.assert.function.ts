import { NestContextCallableRequest, NestContextCallableRequestWithAuth } from '../function/nest';

export interface AssertDevelopmentRequestFunctionContext<N, I = unknown> {
  request: NestContextCallableRequest<N, I>;
  specifier: string;
}

/**
 * Function that asserts something given the input request.
 */
export type AssertDevelopmentRequestFunction<N, I = unknown> = (context: AssertDevelopmentRequestFunctionContext<N, I>) => void;
