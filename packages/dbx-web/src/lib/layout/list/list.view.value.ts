import { ClickableAnchor } from '@dereekb/dbx-core';
import { InjectionToken, StaticProvider } from "@angular/core";
import { DbxInjectionComponentConfig } from "@dereekb/dbx-core";
import { map, Observable, of } from "rxjs";

export const DBX_VALUE_LIST_VIEW_ITEM = new InjectionToken<any>('DbxValueListViewItem');

export interface DbxValueListItem<T> {
  itemValue: T;   // todo: rename to itemValue
  icon?: string;
  disabled?: boolean;
  selected?: boolean;
  anchor?: ClickableAnchor;
}

/**
 * Special type used with values that contain all the items of DbxValueListItem internally.
 */
export type DbxValueAsListItem<T> = T & Omit<DbxValueListItem<DbxValueListItem<T>>, 'itemValue'>;

export interface AbstractDbxValueListViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = any> extends DbxInjectionComponentConfig<V> {
  mapValuesToItemValues?(values: T[]): Observable<I[]>;
}

export const DEFAULT_DBX_VALUE_LIST_CONFIG_MAP_VALUES = <T, I extends DbxValueListItem<T>>(itemValues: T[]) => of(itemValues.map(itemValue => ({ itemValue })) as I[]);

export interface DbxValueListItemConfig<T> extends DbxValueListItem<T> {
  config: DbxInjectionComponentConfig;
}

export function mapValuesToValuesListItemConfigObs<T>(listViewConfig: AbstractDbxValueListViewConfig<T>, itemValues: T[]): Observable<DbxValueListItemConfig<T>[]> {
  return (listViewConfig.mapValuesToItemValues ?? DEFAULT_DBX_VALUE_LIST_CONFIG_MAP_VALUES)(itemValues).pipe(
    map((listItems) => {
      const listItemConfigs: DbxValueListItemConfig<T>[] = mapItemValuesToValueListItemConfig(listViewConfig, listItems);
      return listItemConfigs;
    })
  );
}

export function mapItemValuesToValueListItemConfig<T>(listViewConfig: AbstractDbxValueListViewConfig<T>, listItmes: DbxValueListItem<T>[]): DbxValueListItemConfig<T>[] {
  return listItmes.map((listItem) => {
    const anchor = listItem.anchor;
    const disabled = listItem.disabled || anchor?.disabled;

    return {
      itemValue: listItem.itemValue,
      icon: listItem.icon,
      selected: listItem.selected,
      disabled,
      anchor: listItem.anchor,
      config: Object.assign({
        providers: [{
          provide: DBX_VALUE_LIST_VIEW_ITEM,
          useValue: listItem
        }] as StaticProvider[]
      }, listViewConfig)
    }
  });
}
