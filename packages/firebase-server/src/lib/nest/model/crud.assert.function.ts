import { type Maybe } from '@dereekb/util';
import { NestContextCallableRequest } from '../function/nest';
import { type OnCallFunctionType } from '@dereekb/firebase';

export type AssertModelCrudRequestFunctionContextCrudType = 'call' | 'create' | 'read' | 'update' | 'delete';

export interface AssertModelCrudRequestFunctionContext<N, I = unknown> {
  readonly request: NestContextCallableRequest<N, I>;
  /**
   * @deprecated use call instead.
   */
  readonly crud: AssertModelCrudRequestFunctionContextCrudType;
  readonly call: OnCallFunctionType;
  readonly modelType: string;
  readonly specifier: Maybe<string>;
}

/**
 * Function that asserts something given the input request.
 */
export type AssertModelCrudRequestFunction<N, I = unknown> = (context: AssertModelCrudRequestFunctionContext<N, I>) => void;
