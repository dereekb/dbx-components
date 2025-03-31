import { asObservable, filterMaybe, tapLog } from '@dereekb/rxjs';
import { Directive, input, Input, OnDestroy } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { BehaviorSubject, switchMap } from 'rxjs';
import { SecondaryActionContextStoreSource, ActionContextStoreSource, actionContextStoreSourcePipe } from '../../action.store.source';
import { provideSecondaryActionStoreSource } from '../../action.store.source.provide';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Directive that provides a DbxActionSourceDirective that is passed in.
 */
@Directive({
  selector: '[dbxActionSource]',
  providers: provideSecondaryActionStoreSource(DbxActionSourceDirective),
  standalone: true
})
export class DbxActionSourceDirective implements SecondaryActionContextStoreSource {
  readonly dbxActionSource = input<Maybe<ActionContextStoreSource>>();

  readonly store$ = toObservable(this.dbxActionSource).pipe(
    filterMaybe(),
    switchMap((x) => actionContextStoreSourcePipe(x.store$))
  );
}
