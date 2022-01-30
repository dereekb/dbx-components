import { map, tap, shareReplay, switchMap } from 'rxjs/operators';
import { filterMaybe } from '@dereekb/rxjs';
import { BehaviorSubject } from 'rxjs';
import { Directive, Host, Input, OnInit, OnDestroy } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { ActionContextStoreSourceInstance } from '../../action.store.source';

/**
 * Performs the action on success.
 */
export type SuccessActionFunction<O> = (value: O) => void;

/**
 * Directive that executes a function on ActionContextStore Success.
 */
@Directive({
  selector: '[dbxActionSuccess]',
})
export class DbxActionSuccessDirective<T, O> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  private _successFunction = new BehaviorSubject<Maybe<SuccessActionFunction<O>>>(undefined);
  readonly successFunction$ = this._successFunction.pipe(filterMaybe(), shareReplay(1));

  @Input('dbxActionSuccess')
  get successFunction(): Maybe<SuccessActionFunction<O>> {
    return this._successFunction.value;
  }

  set successFunction(successFunction: Maybe<SuccessActionFunction<O>>) {
    this._successFunction.next(successFunction);
  }

  constructor(@Host() public readonly source: ActionContextStoreSourceInstance) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.successFunction$.pipe(
      switchMap(successFunction => this.source.success$.pipe(
        map(x => ([successFunction, x])),
        tap(([successFn, result]) => {
          successFn(result);
        })
      ))
    ).subscribe();
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._successFunction.complete();
  }

}
