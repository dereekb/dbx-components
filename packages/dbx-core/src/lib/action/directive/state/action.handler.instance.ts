import { map, shareReplay, switchMap, tap, BehaviorSubject, combineLatest } from 'rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { DbxActionWorkInstanceDelegate } from '../../action.handler';
import { Maybe, Destroyable, Initialized, GetterOrValue, asGetter, FactoryWithInput } from '@dereekb/util';
import { filterMaybe, SubscriptionObject, Work, workFactory } from '@dereekb/rxjs';

export const DBX_ACTION_HANDLER_LOCK_KEY = 'dbxActionHandler';

/**
 * Context used for defining a function that performs an action using the input function to handle valueReady$ events from an action context.
 */
export class DbxActionHandlerInstance<T = unknown, O = unknown> implements Initialized, Destroyable {
  private _sub = new SubscriptionObject();
  private _handlerFunction = new BehaviorSubject<Maybe<Work<T, O>>>(undefined);
  private _handlerValue = new BehaviorSubject<Maybe<GetterOrValue<O> | FactoryWithInput<O, T>>>(undefined);

  readonly handlerFunction$ = combineLatest([this._handlerValue, this._handlerFunction]).pipe(
    map(([handlerValue, handlerFunction]) => {
      let work: Maybe<Work<T, O>>;

      if (handlerFunction != null) {
        work = handlerFunction;
      } else if (handlerValue !== undefined) {
        const getter = asGetter(handlerValue) as FactoryWithInput<O, T>;

        work = (x, c) => {
          c.performTaskWithReturnValue(() => getter(x));
        };
      }

      return work;
    }),
    filterMaybe(),
    shareReplay(1)
  );

  get handlerFunction(): Maybe<Work<T, O>> {
    return this._handlerFunction.value;
  }

  set handlerFunction(handlerFunction: Maybe<Work<T, O>>) {
    this._handlerFunction.next(handlerFunction);
  }

  get handlerValue(): Maybe<GetterOrValue<O> | FactoryWithInput<O, T>> {
    return this._handlerValue.value;
  }

  set handlerValue(handlerValue: Maybe<GetterOrValue<O> | FactoryWithInput<O, T>>) {
    this._handlerValue.next(handlerValue);
  }

  private _delegate = new DbxActionWorkInstanceDelegate<T, O>(this.source);

  constructor(readonly source: DbxActionContextStoreSourceInstance<T, O>) {}

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
