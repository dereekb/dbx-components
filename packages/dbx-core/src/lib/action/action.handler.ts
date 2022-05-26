import { Maybe, ReadableError } from '@dereekb/util';
import { DbxActionContextStoreSourceInstance } from './action.store.source';
import { WorkUsingContext, WorkUsingObservable, WorkInstanceDelegate } from '@dereekb/rxjs';
import { Observable } from 'rxjs';

/**
 * WorkInstanceDelegate implementation using an DbxActionContextStoreSourceInstance.
 */
export class DbxActionWorkInstanceDelegate<T = unknown, O = unknown> implements WorkInstanceDelegate<O> {
  constructor(readonly source: DbxActionContextStoreSourceInstance<T, O>) {}

  startWorking(): void {
    this.source.startWorking();
  }

  success(result: O): void {
    this.source.resolve(result);
  }

  reject(error: Maybe<ReadableError | Observable<ReadableError>>): void {
    this.source.reject(error);
  }
}

export type HandleActionWithFunctionOrContext<T = unknown, O = unknown> = HandleActionFunction<T, O> | HandleActionWithContext<T, O>;

export type HandleActionFunction<T = unknown, O = unknown> = WorkUsingObservable<T, O>;
export type HandleActionWithContext<T = unknown, O = unknown> = WorkUsingContext<T, O>;
