import { map, tap, shareReplay, switchMap, BehaviorSubject } from 'rxjs';
import { filterMaybe } from '@dereekb/rxjs';
import { Directive, Host, Input, OnInit, OnDestroy } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';

/**
 * Performs the action on success.
 */
export type DbxActionSuccessHandlerFunction<O> = (value: O) => void;

/**
 * Directive that executes a function on ActionContextStore Success.
 */
@Directive({
  selector: '[dbxActionSuccessHandler]',
})
export class DbxActionSuccessHandlerDirective<T, O> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  private _successFunction = new BehaviorSubject<Maybe<DbxActionSuccessHandlerFunction<O>>>(undefined);
  readonly successFunction$ = this._successFunction.pipe(filterMaybe(), shareReplay(1));

  @Input('dbxActionSuccessHandler')
  get successFunction(): Maybe<DbxActionSuccessHandlerFunction<O>> {
    return this._successFunction.value;
  }

  set successFunction(successFunction: Maybe<DbxActionSuccessHandlerFunction<O>>) {
    this._successFunction.next(successFunction);
  }

  constructor(@Host() public readonly source: DbxActionContextStoreSourceInstance<T, O>) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.successFunction$.pipe(
      switchMap(successFunction => this.source.success$.pipe(
        map(x => ([successFunction, x] as [DbxActionSuccessHandlerFunction<O>, O])),
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
