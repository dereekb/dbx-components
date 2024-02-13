import { type Maybe } from '@dereekb/util';
import { type NestContextCallableRequestWithAuth } from '../function/nest';
import { OnCallFunctionType } from '@dereekb/firebase';

export interface AssertModelCrudRequestFunctionContext<N, I = unknown> {
  readonly request: NestContextCallableRequestWithAuth<N, I>;
  /**
   * @deprecated use call instead.
   */
  readonly crud: 'call' | 'create' | 'read' | 'update' | 'delete';
  readonly call: OnCallFunctionType;
  readonly modelType: string;
  readonly specifier: Maybe<string>;
}

/**
 * Function that asserts something given the input request.
 */
export type AssertModelCrudRequestFunction<N, I = unknown> = (context: AssertModelCrudRequestFunctionContext<N, I>) => void;
