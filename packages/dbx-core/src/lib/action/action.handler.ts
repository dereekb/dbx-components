import { Maybe, ReadableError } from '@dereekb/util';
import { DbxActionContextStoreSourceInstance } from './action.store.source';
import { WorkInstanceDelegate } from '@dereekb/rxjs';
import { Observable } from 'rxjs';

/**
 * WorkInstanceDelegate implementation using an DbxActionContextStoreSourceInstance.
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
