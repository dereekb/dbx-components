import { OnDestroy, Input, Directive } from "@angular/core";
import { filterMaybe } from "@dereekb/rxjs";
import { Maybe } from "@dereekb/util";
import { BehaviorSubject, distinctUntilChanged, shareReplay, combineLatest, switchMap, map } from "rxjs";
import { DbxListView } from "./list.view";
import { AbstractDbxValueListViewConfig, DbxValueListItem, mapValuesToValuesListItemConfigObs } from "./list.view.value";

@Directive()
export abstract class AbstractDbxValueListViewDirective<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = any, C extends AbstractDbxValueListViewConfig<T, I, V> = AbstractDbxValueListViewConfig<T, I, V>> implements OnDestroy {

  private _config = new BehaviorSubject<Maybe<C>>(undefined);
  readonly config$ = this._config.pipe(filterMaybe(), distinctUntilChanged());

  readonly items$ = combineLatest([this.config$, this.dbxListView.values$]).pipe(
    switchMap(([listViewConfig, values]) => mapValuesToValuesListItemConfigObs(listViewConfig, values)),
    shareReplay(1)
  );

  constructor(readonly dbxListView: DbxListView<T>) { }

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
