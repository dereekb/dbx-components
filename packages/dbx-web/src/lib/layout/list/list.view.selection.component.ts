import { filterMaybe } from '@dereekb/rxjs';
import { BehaviorSubject, combineLatest, map, shareReplay, distinctUntilChanged, Observable, switchMap, of } from 'rxjs';
import { Component, Directive, Inject, InjectionToken, Input, StaticProvider } from '@angular/core';
import { MatSelectionListChange } from '@angular/material/list';
import { DbxInjectedComponentConfig } from '@dereekb/dbx-core';
import { DbxListView, ListSelectionStateItem } from './list.view';
import { Maybe } from '@dereekb/util';

export const DBX_VALUE_LIST_VIEW_ITEM = new InjectionToken<any>('DbxValueListViewItem');

export interface DbxSelectionValueListItem<T> {
  value: T;
  icon?: string;
  selected?: boolean;
  disabled?: boolean;
}

export interface DbxSelectionValueListViewConfig<T, I extends DbxSelectionValueListItem<T> = DbxSelectionValueListItem<T>, V = any> extends DbxInjectedComponentConfig<V> {
  mapValuesToItemValues?(values: T[]): Observable<I[]>;
}


export interface DbxSelectionValueListItemConfig<T> extends DbxSelectionValueListItem<T> {
  config: DbxInjectedComponentConfig;
}

export const DEFAULT_DBX_SELECTION_VALUE_LIST_CONFIG_MAP_VALUES = <T, I extends DbxSelectionValueListItem<T>>(values: T[]) => of(values.map(value => ({ value })) as I[]);

/**
 * Abstract list view that has a pre-built-in selection change event for an Angular Material MatSelectionListChange.
 */
@Component({
  selector: 'dbx-selection-list-view',
  template: `
    <mat-selection-list style="width: 100%" [multiple]="true" (selectionChange)="matSelectionChanged($event)">
    <mat-list-option class="dbx-selection-list-view-item" *ngFor="let item of (items$ | async)" [selected]="item.selected" [disabled]="item.disabled" [value]="item.value" (click)="onClickValue(item.value)">
      <mat-icon matListIcon *ngIf="item.icon">{{ item.icon }}</mat-icon>
      <div><dbx-injected-content [config]="item.config"></dbx-injected-content></div>
    </mat-list-option>
  </mat-selection-list>
  `,
  host: {
    'class': 'dbx-selection-list-view'
  }
})
export class DbxSelectionValueListViewComponent<T, I extends DbxSelectionValueListItem<T> = DbxSelectionValueListItem<T>, V = any> {

  private _config = new BehaviorSubject<Maybe<DbxSelectionValueListViewConfig<T, I, V>>>(undefined);
  readonly config$ = this._config.pipe(filterMaybe(), distinctUntilChanged());

  readonly items$ = combineLatest([this.config$, this.dbxListView.values$]).pipe(
    switchMap(([listViewConfig, values]) => (listViewConfig.mapValuesToItemValues ?? DEFAULT_DBX_SELECTION_VALUE_LIST_CONFIG_MAP_VALUES)(values).pipe(
      map((itemValues) => {
        const items: DbxSelectionValueListItemConfig<T>[] = itemValues.map((itemValue) => {
          return {
            value: itemValue.value,
            icon: itemValue.icon,
            selected: itemValue.selected,
            disabled: itemValue.disabled,
            config: Object.assign({
              providers: [{
                provide: DBX_VALUE_LIST_VIEW_ITEM,
                useValue: itemValue
              }] as StaticProvider[]
            }, listViewConfig)
          }
        });

        return items;
      })
    )),
    shareReplay(1)
  );

  constructor(readonly dbxListView: DbxListView<T>) {
    if (!this.dbxListView.selectionChange) {
      throw new Error('Parent dbxListView to DbxSelectionValueListViewComponent has no selectionChange emitter.');
    }
  }

  @Input()
  set config(config: Maybe<DbxSelectionValueListViewConfig<T, I>>) {
    this._config.next(config);
  }

  onClickValue(value: T) {
    this.dbxListView.clickValue?.next(value);
  }

  matSelectionChanged(selection: MatSelectionListChange): void {
    const options = selection.source.selectedOptions.selected;
    const items: ListSelectionStateItem<T>[] = options.map(x => {
      const { value, selected, disabled } = x;
      return ({ value, selected, disabled });
    });

    this.dbxListView.selectionChange!.next({
      items
    });
  }

}

@Directive()
export abstract class AbstractDbxSelectionValueListViewItemComponent<T> {

  get value() {
    return this.item.value;
  }

  constructor(@Inject(DBX_VALUE_LIST_VIEW_ITEM) readonly item: DbxSelectionValueListItem<T>) { }

}
