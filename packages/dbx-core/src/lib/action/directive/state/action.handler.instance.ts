import { map, shareReplay, switchMap, tap, BehaviorSubject, combineLatest } from 'rxjs';
import { type DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { DbxActionWorkInstanceDelegate } from '../../action.handler';
import { type Maybe, type Destroyable, type Initialized, type GetterOrValue, asGetter, type FactoryWithInput } from '@dereekb/util';
import { filterMaybe, SubscriptionObject, type Work, workFactory } from '@dereekb/rxjs';

export const DBX_ACTION_HANDLER_LOCK_KEY = 'dbxActionHandler';

/**
 * Context used for defining a function that performs an action using the input function to handle valueReady$ events from an action context.
 */
export class DbxActionHandlerInstance<T = unknown, O = unknown> implements Initialized, Destroyable {
  private readonly _delegate: DbxActionWorkInstanceDelegate<T, O>;

  private readonly _sub = new SubscriptionObject();
  private readonly _handlerFunction = new BehaviorSubject<Maybe<Work<T, O>>>(undefined);
  private readonly _handlerValue = new BehaviorSubject<Maybe<GetterOrValue<O> | FactoryWithInput<O, T>>>(undefined);

  readonly handlerFunction$ = combineLatest([this._handlerValue, this._handlerFunction]).pipe(
    map(([handlerValue, handlerFunction]) => {
      let work: Maybe<Work<T, O>>;

      if (handlerFunction != null) {
        work = handlerFunction;
      } else if (handlerValue !== undefined) {
        const getter = asGetter(handlerValue) as FactoryWithInput<O, T>;
        work = (x, c) => c.performTaskWithReturnValue(() => getter(x));
      }

      return work;
    }),
    filterMaybe(),
    shareReplay(1)
  );

  constructor(source: DbxActionContextStoreSourceInstance<T, O>) {
    this._delegate = new DbxActionWorkInstanceDelegate<T, O>(source);
  }

  get source(): DbxActionContextStoreSourceInstance<T, O> {
    return this._delegate.source;
  }

  get handlerFunction(): Maybe<Work<T, O>> {
    return this._handlerFunction.value;
  }

  get handlerValue(): Maybe<GetterOrValue<O> | FactoryWithInput<O, T>> {
    return this._handlerValue.value;
  }

  setHandlerFunction(handlerFunction: Maybe<Work<T, O>>): void {
    this._handlerFunction.next(handlerFunction);
  }

  setHandlerValue(handlerValue: Maybe<GetterOrValue<O> | FactoryWithInput<O, T>>): void {
    this._handlerValue.next(handlerValue);
  }

  init(): void {
    this._sub.subscription = this.handlerFunction$
      .pipe(
        switchMap((work) =>
          this.source.valueReady$.pipe(
            tap((value) => {
              const context = workFactory({ work, delegate: this._delegate })(value);

              if (context) {
                // Add the action to the lockSet for the source to prevent it from being destroyed until the action completes.
                this.source.lockSet.addLock(DBX_ACTION_HANDLER_LOCK_KEY, context.isComplete$.pipe(map((x) => !x)));
              }
            })
          )
        )
      )
      .subscribe();
  }

  destroy(): void {
    this.source.lockSet.onNextUnlock(() => {
      this._sub.destroy();
      this._handlerFunction.complete();
    });
  }
}
