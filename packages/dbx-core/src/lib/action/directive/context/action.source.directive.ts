import { filterMaybe } from '@dereekb/rxjs';
import { Directive, Input, OnDestroy } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { BehaviorSubject, switchMap } from 'rxjs';
import { SecondaryActionContextStoreSource, ActionContextStoreSource, actionContextStoreSourcePipe } from '../../action.store.source';
import { provideSecondaryActionStoreSource } from '../../action.store.source.provide';

/**
 * Directive that provides a DbxActionSourceDirective that is passed in.
 */
@Directive({
  selector: '[dbxActionSource]',
  providers: provideSecondaryActionStoreSource(DbxActionSourceDirective)
})
export class DbxActionSourceDirective implements SecondaryActionContextStoreSource, OnDestroy {
  private _source = new BehaviorSubject<Maybe<ActionContextStoreSource>>(undefined);
  readonly store$ = this._source.pipe(
    filterMaybe(),
    switchMap((x) => actionContextStoreSourcePipe(x.store$))
  );

  ngOnDestroy(): void {
    this._source.complete();
  }

  @Input('dbxActionSource')
  get source(): Maybe<ActionContextStoreSource> {
    return this._source.value;
  }

  set source(source: Maybe<ActionContextStoreSource>) {
    if (source && !source.store$) {
      throw new Error('Invalid source passed to dbxActionSource.');
    }

    this._source.next(source);
  }
}
