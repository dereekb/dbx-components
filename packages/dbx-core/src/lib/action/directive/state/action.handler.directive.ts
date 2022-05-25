import { Directive, Host, Input, OnDestroy, OnInit } from '@angular/core';
import { map, shareReplay, switchMap, tap } from 'rxjs';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { DbxActionWorkInstanceDelegate, HandleActionWithFunctionOrContext } from '../../action.handler';
import { Maybe } from '@dereekb/util';
import { filterMaybe, workFactory } from '@dereekb/rxjs';
import { BehaviorSubject } from 'rxjs';


/**
 * Context used for defining a function that performs an action using the input function on ValueReady.
 */
@Directive({
  selector: '[dbxActionHandler]',
})
export class DbxActionHandlerDirective<T = unknown, O = unknown> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  private _handlerFunction = new BehaviorSubject<Maybe<HandleActionWithFunctionOrContext<T, O>>>(undefined);
  readonly handlerFunction$ = this._handlerFunction.pipe(filterMaybe(), shareReplay(1));

  @Input('dbxActionHandler')
  get handlerFunction(): Maybe<HandleActionWithFunctionOrContext<T, O>> {
    return this._handlerFunction.value;
  }

  set handlerFunction(handlerFunction: Maybe<HandleActionWithFunctionOrContext<T, O>>) {
    this._handlerFunction.next(handlerFunction);
  }

  private _delegate = new DbxActionWorkInstanceDelegate<T, O>(this.source);

  constructor(@Host() public readonly source: DbxActionContextStoreSourceInstance<T, O>) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.handlerFunction$.pipe(
      switchMap(work => this.source.valueReady$.pipe(
        tap((value) => {
          const context = workFactory({ work, delegate: this._delegate })(value);

          if (context) {

            // Add the action to the lockSet for the source to prevent it from being destroyed until the action completes.
            this.source.lockSet.addLock('dbxActionHandler', context.isComplete$.pipe(map(x => !x)));
          }
        })
      ))
    ).subscribe();
  }

  override ngOnDestroy(): void {
    this.source.lockSet.onNextUnlock(() => {
      super.ngOnDestroy();
      this._handlerFunction.complete();
    });
  }

}
