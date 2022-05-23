import { forwardRef, InjectionToken, Provider, StaticProvider, Type } from "@angular/core";
import { ClickableAnchor, DbxInjectionComponentConfig } from "@dereekb/dbx-core";
import { map, Observable, of } from "rxjs";
import { Maybe } from '@dereekb/util';

export const DBX_VALUE_LIST_VIEW_ITEM = new InjectionToken<unknown>('DbxValueListViewItem');

export interface DbxValueListItem<T> {
  itemValue: T;
  icon?: string;
  disabled?: boolean;
  rippleDisabled?: boolean;
  selected?: boolean;
  anchor?: Maybe<ClickableAnchor>;
}

/**
 * Special type used with values that contain all the items of DbxValueListItem internally.
 */
export type DbxValueAsListItem<T> = T & Omit<DbxValueListItem<DbxValueListItem<T>>, 'itemValue'>;

export interface AbstractDbxValueListViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> extends DbxInjectionComponentConfig<V> {
  mapValuesToItemValues?(values: T[]): Observable<I[]>;
}

export const DEFAULT_DBX_VALUE_LIST_CONFIG_MAP_VALUES = <T, I extends DbxValueListItem<T>>(itemValues: T[]) => of(itemValues.map(itemValue => ({ itemValue })) as I[]);

export type DbxValueListItemConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> = I & {
  config: DbxInjectionComponentConfig<V>;
};

export function mapValuesToValuesListItemConfigObs<T, I extends DbxValueListItem<T>, V = unknown>(listViewConfig: AbstractDbxValueListViewConfig<T, I, V>, itemValues: T[]): Observable<DbxValueListItemConfig<T, I, V>[]> {
  const makeObs = listViewConfig.mapValuesToItemValues ?? DEFAULT_DBX_VALUE_LIST_CONFIG_MAP_VALUES;
  return makeObs(itemValues).pipe(
    map((listItems: I[]) => {
      const listItemConfigs: DbxValueListItemConfig<T, I, V>[] = addConfigToValueListItems<T, I, V>(listViewConfig, listItems);
      return listItemConfigs;
    })
  );
}

/**
 * Adds config to the input value list items.
 * 
 * @param listViewConfig 
 * @param listItems 
 * @returns 
 */
export function addConfigToValueListItems<T, I extends DbxValueListItem<T>, V = unknown>(listViewConfig: AbstractDbxValueListViewConfig<T, I, V>, listItems: I[]): DbxValueListItemConfig<T, I, V>[] {
  const itemConfigs: DbxValueListItemConfig<T, I, V>[] = listItems.map((listItem: I) => {
    const anchor = listItem.anchor;

    listItem.disabled = listItem.disabled || anchor?.disabled;
    (listItem as DbxValueListItemConfig<T, I, V>).config = Object.assign({
      providers: [{
        provide: DBX_VALUE_LIST_VIEW_ITEM,
        useValue: listItem
      }] as StaticProvider[]
    }, listViewConfig);

    return listItem as DbxValueListItemConfig<T, I, V>;
  });

  return itemConfigs;
}

// MARK: ValueListView
export abstract class DbxValueListView<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  readonly abstract items$: Observable<I[]>;
}

export function ProvideDbxValueListView<V extends DbxValueListView<unknown>>(sourceType: Type<V>): Provider[] {
  return [{
    provide: DbxValueListView,
    useExisting: forwardRef(() => sourceType)
  }];
}
