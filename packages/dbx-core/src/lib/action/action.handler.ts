import { Maybe, ReadableError } from '@dereekb/util';
import { DbxActionContextStoreSourceInstance } from './action.store.source';
import { WorkUsingContext, WorkUsingObservable, WorkInstanceDelegate, Work } from '@dereekb/rxjs';
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

// MARK: Compat
/**
 * @deprecated use Work instead.
 */
export type HandleActionWithFunctionOrContext<T = unknown, O = unknown> = Work<T, O>;

/**
 * @deprecated use WorkUsingObservable instead.
 */
export type HandleActionFunction<T = unknown, O = unknown> = WorkUsingObservable<T, O>;

/**
 * @deprecated use WorkUsingContext instead.
 */
export type HandleActionWithContext<T = unknown, O = unknown> = WorkUsingContext<T, O>;
