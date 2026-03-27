import { forwardRef, InjectionToken, type Provider, type StaticProvider, type Type } from '@angular/core';
import { type ClickableAnchor, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { map, type Observable, of } from 'rxjs';
import { type Configurable, type DecisionFunction, type Maybe, type ModelKeyRef, type UniqueModel } from '@dereekb/util';

/**
 * Injection token that provides the current {@link DbxValueListItem} to dynamically injected item components.
 */
export const DBX_VALUE_LIST_VIEW_ITEM = new InjectionToken<unknown>('DbxValueListViewItem');

/**
 * Describes a single item within a value-based list view, including its value, display options, and interaction state.
 */
export interface DbxValueListItem<T, M = unknown> {
  /**
   * The underlying value for this list item.
   *
   * The default trackBy function checks this value for a `key` ({@link ModelKeyRef}) or `id` ({@link UniqueModel})
   * property to use as a stable tracking identity. To override this behavior, set {@link DbxValueListItem.key} explicitly
   * or provide a custom trackBy via the list view directive.
   */
  itemValue: T;
  /**
   * Stable key for tracking this item across data updates.
   *
   * The default trackBy function uses this instead of the item's index
   * or the `itemValue`'s `key`, preventing unnecessary component recreation when
   * the list re-renders.
   */
  key: string;
  /**
   * Arbitrary meta details available to the meta component.
   */
  meta?: M;
  /**
   * Optional icon to display for the item.
   */
  icon?: string;
  /**
   * Whether the item is disabled.
   */
  disabled?: boolean;
  /**
   * Whether the ripple effect is disabled.
   */
  rippleDisabled?: boolean;
  /**
   * Whether the item is selected.
   */
  selected?: boolean;
  /**
   * Optional anchor for the item.
   */
  anchor?: Maybe<ClickableAnchor>;
}

/**
 * A decision function that operates on a {@link DbxValueListItem}, used to determine item-level behavior such as selection or ripple state.
 */
export type DbxValueListItemDecisionFunction<T> = DecisionFunction<DbxValueListItem<T>>;

/**
 * Convenience function for mapping a DecisionFunction for a value to a DecisionFunction for a DbxValueListItem with the same value type.
 *
 * @param decisionFunction
 * @returns
 */
export function dbxValueListItemDecisionFunction<T>(decisionFunction: DecisionFunction<T>): DbxValueListItemDecisionFunction<T> {
  return (item) => decisionFunction(item.itemValue);
}

/**
 * Utility type for values that embed {@link DbxValueListItem} properties directly, avoiding the extra `itemValue` wrapper.
 */
/**
 * Utility type for values that embed {@link DbxValueListItem} properties directly, avoiding the extra `itemValue` wrapper.
 *
 * The `key` property is optional here because it is typically added during the `mapValuesToItemValues` step
 * rather than being present on the raw value.
 */
export type DbxValueAsListItem<T> = T & Omit<DbxValueListItem<DbxValueListItem<T>>, 'itemValue' | 'key'> & { key?: string };

/**
 * Base configuration for a value list view, defining the component to render each item and an optional mapping function for transforming raw values into list items.
 */
export interface AbstractDbxValueListViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> extends DbxInjectionComponentConfig<V> {
  mapValuesToItemValues?(values: T[]): Observable<I[]>;
  /**
   * @see DbxListViewMetaIconComponent.metaConfig()
   */
  metaConfig?: DbxInjectionComponentConfig<any>;
  /**
   * Whether group headers should stick to the top of the scroll container.
   *
   * Defaults to `true` for list, selection list, and grid views, `false` for accordion views.
   */
  readonly stickyHeaders?: boolean;
}

/**
 * Extracts a stable tracking key from an item value by checking for `key` ({@link ModelKeyRef}),
 * `id` ({@link UniqueModel}), or falling back to a prefixed index string.
 *
 * @param itemValue - The raw value to extract a key from
 * @param index - The item's position index, used as fallback
 * @returns A string key for tracking the item
 *
 * @example
 * ```ts
 * const key = dbxValueListItemKeyForItemValue({ key: 'abc' }, 0); // 'abc'
 * const key2 = dbxValueListItemKeyForItemValue({ id: '123' }, 0); // '123'
 * const key3 = dbxValueListItemKeyForItemValue({}, 5); // '__i_5'
 * ```
 */
export function dbxValueListItemKeyForItemValue(itemValue: unknown, index: number): string {
  return (itemValue as Partial<ModelKeyRef>)?.key ?? (itemValue as Partial<UniqueModel>)?.id ?? `__i_${index}`;
}

/**
 * Default mapping function that wraps each raw value into a {@link DbxValueListItem} with `itemValue` and a `key` derived via {@link dbxValueListItemKeyForItemValue}.
 *
 * @param itemValues The raw values to wrap as list items
 * @returns An observable emitting the values wrapped in {@link DbxValueListItem} objects
 */
export const DEFAULT_DBX_VALUE_LIST_CONFIG_MAP_VALUES = <T, I extends DbxValueListItem<T>>(itemValues: T[]) => of(itemValues.map((itemValue, index) => ({ itemValue, key: dbxValueListItemKeyForItemValue(itemValue, index) })) as I[]);

/**
 * A {@link DbxValueListItem} combined with its injection component configuration, ready for rendering by the list view.
 */
export type DbxValueListItemConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> = I & {
  config: DbxInjectionComponentConfig<V>;
  metaConfig?: DbxInjectionComponentConfig<any>;
};

/**
 * Maps raw values into an observable of {@link DbxValueListItemConfig} items, applying the list view config's mapping function and attaching injection configuration.
 *
 * @param listViewConfig The list view configuration containing the component and optional mapping function
 * @param itemValues The raw values to map into configured list items
 * @returns An observable emitting the mapped and configured list item configs
 *
 * @example
 * ```ts
 * const items$ = mapValuesToValuesListItemConfigObs(listViewConfig, rawValues);
 * ```
 */
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
 * Adds injection component configuration and meta configuration to each list item, producing fully configured {@link DbxValueListItemConfig} entries ready for rendering.
 *
 * @param listViewConfig The list view configuration providing injection component config and optional meta config
 * @param listItems The list items to augment with configuration
 * @returns The list items extended with injection component configuration attached
 */
export function addConfigToValueListItems<T, I extends DbxValueListItem<T>, V = unknown>(listViewConfig: AbstractDbxValueListViewConfig<T, I, V>, listItems: I[]): DbxValueListItemConfig<T, I, V>[] {
  const itemConfigs: DbxValueListItemConfig<T, I, V>[] = listItems.map((listItem: I) => {
    const anchor = listItem.anchor;

    (listItem as Configurable<DbxValueListItem<T>>).disabled = listItem.disabled || anchor?.disabled;
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
/**
 * Abstract class representing a view that provides a stream of value list items. Used as an injection token
 * so parent components can access the current list items.
 */
export abstract class DbxValueListView<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  abstract readonly items$: Observable<I[]>;
}

/**
 * Registers a component as a {@link DbxValueListView} provider for dependency injection.
 *
 * @param sourceType The component class type to register as the list view provider
 * @returns An array of Angular providers that bind the given component to {@link DbxValueListView}
 *
 * @example
 * ```ts
 * @Component({
 *   providers: provideDbxValueListView(MyValueListViewComponent)
 * })
 * export class MyValueListViewComponent extends DbxValueListView<MyItem> { ... }
 * ```
 */
export function provideDbxValueListView<V extends DbxValueListView<unknown>>(sourceType: Type<V>): Provider[] {
  return [
    {
      provide: DbxValueListView,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}
