import { type Maybe, type ReadableError } from '@dereekb/util';
import { type DbxActionContextStoreSourceInstance } from './action.store.source';
import { type WorkInstanceDelegate } from '@dereekb/rxjs';
import { type Observable } from 'rxjs';

/**
 * {@link WorkInstanceDelegate} implementation that bridges the `@dereekb/rxjs` work execution
 * system with the action context store.
 *
 * This delegate translates work lifecycle events (startWorking, success, reject) into
 * corresponding state transitions on the {@link DbxActionContextStoreSourceInstance},
 * allowing {@link workFactory} to drive the action state machine.
 *
 * @typeParam T - The input value type for the action.
 * @typeParam O - The output result type for the action.
 *
 * @see {@link DbxActionHandlerInstance} which uses this delegate to handle value-ready events.
 */
export class DbxActionWorkInstanceDelegate<T = unknown, O = unknown> implements WorkInstanceDelegate<O> {
  private _source: DbxActionContextStoreSourceInstance<T, O>;

  constructor(source: DbxActionContextStoreSourceInstance<T, O>) {
    this._source = source;
  }

  get source() {
    return this._source;
  }

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
