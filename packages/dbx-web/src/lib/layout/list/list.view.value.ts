import { ClickableAnchor } from '@dereekb/dbx-core';
import { InjectionToken, StaticProvider } from "@angular/core";
import { DbxInjectedComponentConfig } from "@dereekb/dbx-core";
import { map, Observable, of } from "rxjs";

export const DBX_VALUE_LIST_VIEW_ITEM = new InjectionToken<any>('DbxValueListViewItem');

export interface DbxValueListItem<T> {
  value: T;   // todo: rename to data
  icon?: string;
  disabled?: boolean;
  selected?: boolean;
  anchor?: ClickableAnchor;
}

export interface AbstractDbxValueListViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = any> extends DbxInjectedComponentConfig<V> {
  mapValuesToItemValues?(values: T[]): Observable<I[]>;
}

export const DEFAULT_DBX_VALUE_LIST_CONFIG_MAP_VALUES = <T, I extends DbxValueListItem<T>>(values: T[]) => of(values.map(value => ({ value })) as I[]);

export interface DbxValueListItemConfig<T> extends DbxValueListItem<T> {
  config: DbxInjectedComponentConfig;
}

export function mapValuesToValuesListItemConfigObs<T>(listViewConfig: AbstractDbxValueListViewConfig<T>, values: T[]): Observable<DbxValueListItemConfig<T>[]> {
  return (listViewConfig.mapValuesToItemValues ?? DEFAULT_DBX_VALUE_LIST_CONFIG_MAP_VALUES)(values).pipe(
    map((itemValues) => {
      const items: DbxValueListItemConfig<T>[] = mapItemValuesToValueListItemConfig(listViewConfig, itemValues);
      return items;
    })
  );
}

export function mapItemValuesToValueListItemConfig<T>(listViewConfig: AbstractDbxValueListViewConfig<T>, itemValues: DbxValueListItem<T>[]): DbxValueListItemConfig<T>[] {
  return itemValues.map((itemValue) => {
    const anchor = itemValue.anchor;
    const disabled = itemValue.disabled || anchor?.disabled;

    return {
      value: itemValue.value,
      icon: itemValue.icon,
      selected: itemValue.selected,
      disabled,
      anchor: itemValue.anchor,
      config: Object.assign({
        providers: [{
          provide: DBX_VALUE_LIST_VIEW_ITEM,
          useValue: itemValue
        }] as StaticProvider[]
      }, listViewConfig)
    }
  });
}

