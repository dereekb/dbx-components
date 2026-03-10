import { type Maybe, maybeModifierMapToFunction, type ModifierFunction } from '@dereekb/util';
import { Directive, inject, input } from '@angular/core';
import { filterMaybe, mapForEach } from '@dereekb/rxjs';
import { distinctUntilChanged, shareReplay, combineLatest, switchMap, map, type Observable, of } from 'rxjs';
import { DbxListView } from './list.view';
import { type AbstractDbxValueListViewConfig, type DbxValueListItem, type DbxValueListItemConfig, type DbxValueListView, mapValuesToValuesListItemConfigObs } from './list.view.value';
import { DbxValueListItemModifier } from './list.view.value.modifier';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

/**
 * Abstract directive that transforms raw list values into configured {@link DbxValueListItemConfig} items, applying any active modifiers.
 * Requires a parent {@link DbxListView} and optionally uses a {@link DbxValueListItemModifier} to modify items before rendering.
 */
@Directive()
export abstract class AbstractDbxValueListViewDirective<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown, C extends AbstractDbxValueListViewConfig<T, I, V> = AbstractDbxValueListViewConfig<T, I, V>> implements DbxValueListView<T, I> {
  readonly dbxListView = inject(DbxListView<T>);
  readonly dbxValueListViewModifier = inject(DbxValueListItemModifier<T, I>, { optional: true });

  readonly config = input.required<C>();

  readonly config$ = toObservable(this.config).pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));
  readonly modifyFn$: Observable<Maybe<ModifierFunction<I>>> = this.dbxValueListViewModifier ? this.dbxValueListViewModifier.modifiers$.pipe(map(maybeModifierMapToFunction)) : of(undefined);

  readonly items$: Observable<DbxValueListItemConfig<T, I>[]> = combineLatest([this.config$, this.dbxListView.values$, this.modifyFn$]).pipe(
    switchMap(([listViewConfig, values, modifyFn]) => mapValuesToValuesListItemConfigObs<T, I, V>(listViewConfig, values).pipe(mapForEach(modifyFn)) as Observable<DbxValueListItemConfig<T, I>[]>),
    shareReplay(1)
  );

  readonly itemsSignal = toSignal(this.items$);

  onClickValue(value: T) {
    this.dbxListView.clickValue?.emit(value);
  }
}
