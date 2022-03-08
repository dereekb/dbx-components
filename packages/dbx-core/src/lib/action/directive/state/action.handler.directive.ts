import { Directive, Host, Input, OnDestroy, OnInit } from '@angular/core';
import { map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { HandleActionFunction, WorkHandlerContextSourceDelegate, handleWorkValueReadyFn } from '../../action.handler';
import { Maybe } from '@dereekb/util';
import { filterMaybe } from '@dereekb/rxjs';
import { BehaviorSubject } from 'rxjs';


/**
 * Context used for defining a function that performs an action using the input function on ValueReady.
 */
@Directive({
  selector: '[dbxActionHandler]',
})
export class DbxActionHandlerDirective<T, O> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  private _handlerFunction = new BehaviorSubject<Maybe<HandleActionFunction<T, O>>>(undefined);
  readonly handlerFunction$ = this._handlerFunction.pipe(filterMaybe(), shareReplay(1));

  @Input('dbxActionHandler')
  get handlerFunction(): Maybe<HandleActionFunction<T, O>> {
    return this._handlerFunction.value;
  }

  set handlerFunction(handlerFunction: Maybe<HandleActionFunction<T, O>>) {
    this._handlerFunction.next(handlerFunction);
  }

  private _delegate = new WorkHandlerContextSourceDelegate<T, O>(this.source);

  constructor(@Host() public readonly source: DbxActionContextStoreSourceInstance<T, O>) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.handlerFunction$.pipe(
      switchMap(handlerFunction => this.source.valueReady$.pipe(
        map((x: T) => ([handlerFunction, x] as [HandleActionFunction<T, O>, T])),
        tap(([handlerFunction, value]) => {
          const context = handleWorkValueReadyFn({ handlerFunction, delegate: this._delegate })(value);

          if (context) {

            // Add the action to the lockSet for the source to prevent it from being destroyed until the action completes.
            this.source.lockSet.addLock('actionhandler', context.isComplete$.pipe(map(x => !x)));
          }
        })
      ))
    ).subscribe();
  }

  override ngOnDestroy(): void {
    this.source.lockSet.onNextUnlock(() => {
      super.ngOnDestroy();
    });
  }

}
