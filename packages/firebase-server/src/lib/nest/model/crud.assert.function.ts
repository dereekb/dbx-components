import { PromiseOrValue } from '@dereekb/util';
import { Maybe } from '@dereekb/util';
import { NestContextCallableRequestWithAuth } from '../function/nest';

export interface AssertModelCrudRequestFunctionContext<N, I = unknown> {
  request: NestContextCallableRequestWithAuth<N, I>;
  crud: 'create' | 'update' | 'delete';
  modelType: string;
  specifier: Maybe<string>;
}

/**
 * Function that asserts something given the input request.
 */
export type AssertModelCrudRequestFunction<N, I = unknown> = (context: AssertModelCrudRequestFunctionContext<N, I>) => void;
