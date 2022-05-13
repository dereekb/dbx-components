import { DbxActionContextStoreSourceInstance } from './action.store.source';
import { Work, WorkInstanceDelegate } from '@dereekb/rxjs';

/**
 * WorkInstanceDelegate implementation using an DbxActionContextStoreSourceInstance.
 */
export class DbxActionWorkInstanceDelegate<T = any, O = any> implements WorkInstanceDelegate<O> {

  constructor(readonly source: DbxActionContextStoreSourceInstance<T, O>) { }

  startWorking(): void {
    this.source.startWorking();
  }

  success(result: O): void {
    this.source.resolve(result);
  }

  reject(error: any): void {
    this.source.reject(error);
  }

}

export type HandleActionFunction<T = any, O = any> = Work<T, O>;
