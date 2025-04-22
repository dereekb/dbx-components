import { forwardRef, InjectionToken, Provider, StaticProvider, Type } from '@angular/core';
import { ClickableAnchor, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { map, Observable, of } from 'rxjs';
import { DecisionFunction, type Maybe } from '@dereekb/util';

export const DBX_VALUE_LIST_VIEW_ITEM = new InjectionToken<unknown>('DbxValueListViewItem');

export interface DbxValueListItem<T, M = unknown> {
  itemValue: T;
  /**
   * Arbitrary meta details available to the meta component.
   */
  meta?: M;
  icon?: string;
  disabled?: boolean;
  rippleDisabled?: boolean;
  selected?: boolean;
  anchor?: Maybe<ClickableAnchor>;
}

export type DbxValueListItemDecisionFunction<T> = DecisionFunction<DbxValueListItem<T>>;

/**
 * Convenience function for mapping a DecisionFunction for a value to a DecisionFunction for a DbxValueListItem with the same value type.
 * @param decisionFunction
 * @returns
 */
export function dbxValueListItemDecisionFunction<T>(decisionFunction: DecisionFunction<T>): DbxValueListItemDecisionFunction<T> {
  return (item) => decisionFunction(item.itemValue);
}

/**
 * Special type used with values that contain all the items of DbxValueListItem internally.
 */
export type DbxValueAsListItem<T> = T & Omit<DbxValueListItem<DbxValueListItem<T>>, 'itemValue'>;

export interface AbstractDbxValueListViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> extends DbxInjectionComponentConfig<V> {
  mapValuesToItemValues?(values: T[]): Observable<I[]>;
  /**
   * @see DbxListViewMetaIconComponent.metaConfig()
   */
  metaConfig?: DbxInjectionComponentConfig<any>;
}

export const DEFAULT_DBX_VALUE_LIST_CONFIG_MAP_VALUES = <T, I extends DbxValueListItem<T>>(itemValues: T[]) => of(itemValues.map((itemValue) => ({ itemValue })) as I[]);

export type DbxValueListItemConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> = I & {
  config: DbxInjectionComponentConfig<V>;
  metaConfig?: DbxInjectionComponentConfig<any>;
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
    (listItem as DbxValueListItemConfig<T, I, V>).config = Object.assign({}, listViewConfig, {
      providers: [
        {
          provide: DBX_VALUE_LIST_VIEW_ITEM,
          useValue: listItem
        },
        ...(listViewConfig.providers ?? [])
      ] as StaticProvider[]
    });

    // only attach meta config if it is configured
    if (listViewConfig.metaConfig) {
      (listItem as DbxValueListItemConfig<T, I, V>).metaConfig = Object.assign({}, listViewConfig.metaConfig, {
        providers: [
          {
            provide: DBX_VALUE_LIST_VIEW_ITEM,
            useValue: listItem
          },
          ...(listViewConfig.metaConfig?.providers ?? [])
        ] as StaticProvider[]
      });
    }

    return listItem as DbxValueListItemConfig<T, I, V>;
  });

  return itemConfigs;
}

// MARK: ValueListView
export abstract class DbxValueListView<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  abstract readonly items$: Observable<I[]>;
}

export function provideDbxValueListView<V extends DbxValueListView<unknown>>(sourceType: Type<V>): Provider[] {
  return [
    {
      provide: DbxValueListView,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}
