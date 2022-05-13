import { Maybe, maybeModifierMapToFunction, ModifierFunction } from "@dereekb/util";
import { OnDestroy, Input, Directive, Optional } from "@angular/core";
import { filterMaybe, mapForEach } from "@dereekb/rxjs";
import { BehaviorSubject, distinctUntilChanged, shareReplay, combineLatest, switchMap, map, Observable, of } from "rxjs";
import { DbxListView } from "./list.view";
import { AbstractDbxValueListViewConfig, DbxValueListItem, DbxValueListItemConfig, DbxValueListView, mapValuesToValuesListItemConfigObs } from "./list.view.value";
import { DbxValueListItemModifier } from "./list.view.value.modifier";

/**
 * Abstract list directive that takes in items and a AbstractDbxValueItemListViewConfig configuration.
 */
@Directive()
export abstract class AbstractDbxValueListViewDirective<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = any, C extends AbstractDbxValueListViewConfig<T, I, V> = AbstractDbxValueListViewConfig<T, I, V>> implements DbxValueListView<T, I>, OnDestroy {

  private _config = new BehaviorSubject<Maybe<C>>(undefined);
  readonly config$ = this._config.pipe(filterMaybe(), distinctUntilChanged());

  readonly modifyFn$: Observable<Maybe<ModifierFunction<I>>> = (this.dbxValueListViewModifier) ?
    this.dbxValueListViewModifier.modifiers$.pipe(map(maybeModifierMapToFunction)) : of(undefined);

  readonly items$: Observable<DbxValueListItemConfig<T, I>[]> = combineLatest([this.config$, this.dbxListView.values$, this.modifyFn$]).pipe(
    switchMap(([listViewConfig, values, modifyFn]) => mapValuesToValuesListItemConfigObs<T, I>(listViewConfig, values).pipe(mapForEach(modifyFn)) as Observable<DbxValueListItemConfig<T, I>[]>),
    shareReplay(1)
  );

  constructor(readonly dbxListView: DbxListView<T>, @Optional() readonly dbxValueListViewModifier: DbxValueListItemModifier<T, I>) { }

  ngOnDestroy(): void {
    this._config.complete();
  }

  @Input()
  set config(config: Maybe<C>) {
    this._config.next(config);
  }

  onClickValue(value: T) {
    this.dbxListView.clickValue?.next(value);
  }

}
