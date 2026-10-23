import { forwardRef, inject, InjectionToken, type Provider, type Signal, signal, type StaticProvider, type Type, type WritableSignal } from '@angular/core';
import { type ClickableAnchor, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { map, type Observable } from 'rxjs';
import { type Configurable, type DecisionFunction, type Maybe, type ModelKeyRef, type UniqueModel } from '@dereekb/util';
import { type DbxValueListViewSeparatorConfig } from './list.view.value.separator';

/**
 * Injection token that provides the {@link DbxValueListItem} a dynamically injected item component was created with.
 *
 * List views keep an item's component while the item's key stays in the list, so this value goes stale once the item updates.
 * Use {@link injectDbxValueListViewItemSignal}, or extend {@link AbstractDbxValueListViewItemComponent}, to render the latest item.
 */
export const DBX_VALUE_LIST_VIEW_ITEM = new InjectionToken<unknown>('DbxValueListViewItem');

/**
 * The item signal of the {@link DbxValueListItemConfigCache} entry each configured list item was set on.
 *
 * Looked up with the injected {@link DBX_VALUE_LIST_VIEW_ITEM} value, which is always the item itself, so the lookup cannot return
 * the signal of a different item that is provided further up the injector tree, such as the item of an outer list.
 */
const DBX_VALUE_LIST_VIEW_ITEM_SIGNALS = new WeakMap<object, Signal<unknown>>();

/**
 * Configuration for {@link injectDbxValueListViewItemSignal}.
 */
export interface InjectDbxValueListViewItemSignalConfig {
  /**
   * Whether to return undefined instead of throwing when no list item is available.
   */
  readonly optional?: Maybe<boolean>;
}

/**
 * Injects a {@link Signal} of the current {@link DbxValueListItem} for a component injected by a list view.
 *
 * List views keep an item's component while the item's key stays in the list and set each update's item on this signal.
 * When the injected {@link DBX_VALUE_LIST_VIEW_ITEM} was not configured by a list view, such as an item provided by hand,
 * the signal holds that item and does not change.
 *
 * Must be called in an injection context.
 *
 * @param config - Optional injection configuration.
 * @returns A signal of the current list item, or undefined if optional and no list item is available.
 *
 * @example
 * ```ts
 * readonly itemSignal = injectDbxValueListViewItemSignal<DbxValueListItem<MyValue>>();
 * readonly nameSignal = computed(() => this.itemSignal().itemValue.name);
 * ```
 */
export function injectDbxValueListViewItemSignal<I extends DbxValueListItem<unknown>>(config?: InjectDbxValueListViewItemSignalConfig & { readonly optional?: Maybe<false> }): Signal<I>;
export function injectDbxValueListViewItemSignal<I extends DbxValueListItem<unknown>>(config: InjectDbxValueListViewItemSignalConfig): Maybe<Signal<I>>;
export function injectDbxValueListViewItemSignal<I extends DbxValueListItem<unknown>>(config?: Maybe<InjectDbxValueListViewItemSignalConfig>): Maybe<Signal<I>> {
  const optional = config?.optional ?? false;
  const item = inject<Maybe<I>>(DBX_VALUE_LIST_VIEW_ITEM, { optional });
  let result: Maybe<Signal<I>>;

  if (item != null) {
    result = (DBX_VALUE_LIST_VIEW_ITEM_SIGNALS.get(item) as Maybe<Signal<I>>) ?? signal(item).asReadonly();
  }

  return result;
}

/**
 * Describes a single item within a value-based list view, including its value, display options, and interaction state.
 */
export interface DbxValueListItem<T, M = unknown> {
  /**
   * The underlying value for this list item.
   *
   * When {@link DbxValueListItem.key} is not set, the value's `key` ({@link ModelKeyRef}) or `id` ({@link UniqueModel})
   * is used as the item's key instead.
   */
  itemValue: T;
  /**
   * Stable key that identifies this item across data updates.
   *
   * List views track items by this key and keep an item's component while the key stays in the list, passing it each
   * update's item through its item signal (see {@link injectDbxValueListViewItemSignal}). The key should identify the item
   * itself, not its position.
   *
   * When not set, the `itemValue`'s `key` or `id` is used. Items without any of these, and items whose key repeats an earlier
   * item's key, are tracked by position and have their component re-created whenever their item value changes.
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
 * @__NO_SIDE_EFFECTS__
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
 * Base configuration for a value list view, defining the component to render each item and a mapping function for transforming raw values into list items.
 */
export interface AbstractDbxValueListViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> extends DbxInjectionComponentConfig<V> {
  mapValuesToItemValues(values: T[]): Observable<I[]>;
  /**
   * @see DbxListViewMetaIconComponent.metaConfig()
   */
  readonly metaConfig?: DbxInjectionComponentConfig<any>;
  /**
   * (Optional) Separator component injected between two neighbouring items when its `showSeparator` function returns
   * true. Separators are evaluated within each group, in display order.
   *
   * Rendered by the list, selection list, and accordion views. The grid view ignores it.
   *
   * @see DbxValueListViewSeparatorConfig
   */
  readonly separatorConfig?: Maybe<DbxValueListViewSeparatorConfig<T, I>>;
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
 * @param itemValue - The raw value to extract a key from.
 * @param index - The item's position index, used as fallback.
 * @returns Key for tracking the item. (string)
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
 * A {@link DbxValueListItem} combined with its injection component configuration, ready for rendering by the list view.
 */
export type DbxValueListItemConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> = I & {
  config: DbxInjectionComponentConfig<V>;
  metaConfig?: DbxInjectionComponentConfig<any>;
};

// MARK: Item Config Cache
/**
 * The injection configs and item signal a {@link DbxValueListItemConfigCache} keeps for one key.
 */
interface DbxValueListItemConfigCacheEntry<T, I extends DbxValueListItem<T>, V> {
  /**
   * The item value the entry was made for. Positional items only keep their entry while their item value stays the same.
   */
  readonly itemValue: T;
  readonly itemSignal: WritableSignal<I>;
  readonly config: DbxInjectionComponentConfig<V>;
  readonly metaConfig?: Maybe<DbxInjectionComponentConfig<any>>;
}

/**
 * Keeps each list item key's injection configs the same across list updates, so list views keep the item's component.
 *
 * List views track their items by key, and dbx-injection keeps its component while each new config is equal to the last one,
 * which does not compare providers. For a key that stays in the list the cache returns the configs it made for the key and sets
 * the new item on the key's item signal, so the kept component renders the latest item (see {@link injectDbxValueListViewItemSignal})
 * instead of the item it was created with.
 *
 * Each key's configs also get their own `init` function, so dbx-injection never finds two keys' configs equal: when a view moves to
 * another key, its component is re-created with that key's item.
 *
 * Items without a key of their own (no {@link DbxValueListItem.key}, and no `key` or `id` on the item value) and items that repeat an
 * earlier item's key are tracked by their position, so their configs are only kept while their item value stays the same.
 */
export class DbxValueListItemConfigCache<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> {
  private _listViewConfig: Maybe<Omit<AbstractDbxValueListViewConfig<T, I, V>, 'mapValuesToItemValues'>>;
  private readonly _entries = new Map<string, DbxValueListItemConfigCacheEntry<T, I, V>>();

  /**
   * Adds the injection configs to each list item, re-using the configs made for each key by the previous call.
   *
   * Also sets the key of each item that has none, or that repeats an earlier item's key, so every item has a unique key.
   * The configs are all made again when the list view config changes.
   *
   * @param listViewConfig - The list view configuration providing injection component config and optional meta config.
   * @param listItems - The list items to augment with configuration.
   * @returns The list items extended with injection component configuration attached.
   */
  addConfigToValueListItems(listViewConfig: Omit<AbstractDbxValueListViewConfig<T, I, V>, 'mapValuesToItemValues'>, listItems: I[]): DbxValueListItemConfig<T, I, V>[] {
    if (listViewConfig !== this._listViewConfig) {
      this._listViewConfig = listViewConfig;
      this._entries.clear();
    }

    const usedKeys = new Set<string>();

    const itemConfigs: DbxValueListItemConfig<T, I, V>[] = listItems.map((listItem: I, i) => {
      const { itemValue, anchor } = listItem;
      const identityKey = (listItem.key as Maybe<string>) ?? (itemValue as Maybe<Partial<ModelKeyRef>>)?.key ?? (itemValue as Maybe<Partial<UniqueModel>>)?.id;
      const isPositional = identityKey == null || usedKeys.has(identityKey);
      let key = identityKey as string;

      if (isPositional) {
        const positionalKey = `${identityKey ?? ''}__i_${i}`;
        key = positionalKey;

        for (let n = 1; usedKeys.has(key); n += 1) {
          key = `${positionalKey}_${n}`;
        }
      }

      usedKeys.add(key);
      (listItem as Configurable<DbxValueListItem<T>>).key = key;
      (listItem as Configurable<DbxValueListItem<T>>).disabled = listItem.disabled || anchor?.disabled;

      let entry = this._entries.get(key);

      if (entry != null && (!isPositional || entry.itemValue === itemValue)) {
        entry.itemSignal.set(listItem);
      } else {
        entry = makeDbxValueListItemConfigCacheEntry(listViewConfig, listItem);
        this._entries.set(key, entry);
      }

      DBX_VALUE_LIST_VIEW_ITEM_SIGNALS.set(listItem, entry.itemSignal.asReadonly());
      (listItem as DbxValueListItemConfig<T, I, V>).config = entry.config;

      // only attach meta config if it is configured
      if (entry.metaConfig) {
        (listItem as DbxValueListItemConfig<T, I, V>).metaConfig = entry.metaConfig;
      }

      return listItem as DbxValueListItemConfig<T, I, V>;
    });

    this._entries.forEach((_, key) => {
      if (!usedKeys.has(key)) {
        this._entries.delete(key);
      }
    });

    return itemConfigs;
  }
}

/**
 * Makes the injection configs and item signal for a list item's key.
 *
 * @param listViewConfig - The list view configuration providing injection component config and optional meta config.
 * @param listItem - The list item to make the entry for.
 * @returns The new cache entry.
 */
function makeDbxValueListItemConfigCacheEntry<T, I extends DbxValueListItem<T>, V>(listViewConfig: Omit<AbstractDbxValueListViewConfig<T, I, V>, 'mapValuesToItemValues'>, listItem: I): DbxValueListItemConfigCacheEntry<T, I, V> {
  const { init, metaConfig: inputMetaConfig } = listViewConfig;
  const itemProvider: StaticProvider = { provide: DBX_VALUE_LIST_VIEW_ITEM, useValue: listItem };

  const config: DbxInjectionComponentConfig<V> = {
    ...listViewConfig,
    providers: [itemProvider, ...(listViewConfig.providers ?? [])],
    init: (instance: V) => init?.(instance)
  };

  let metaConfig: Maybe<DbxInjectionComponentConfig<any>>;

  if (inputMetaConfig) {
    const metaInit = inputMetaConfig.init;

    metaConfig = {
      ...inputMetaConfig,
      providers: [itemProvider, ...(inputMetaConfig.providers ?? [])],
      init: (instance: unknown) => metaInit?.(instance)
    };
  }

  return {
    itemValue: listItem.itemValue,
    // notify on every update, since modifiers change list items in place and mapValuesToItemValues may return the same item objects
    itemSignal: signal(listItem, { equal: () => false }),
    config,
    metaConfig
  };
}

/**
 * Maps raw values into an observable of {@link DbxValueListItemConfig} items, applying the list view config's mapping function and attaching injection configuration.
 *
 * @param listViewConfig - The list view configuration containing the component and optional mapping function.
 * @param itemValues - The raw values to map into configured list items.
 * @param cache - (Optional) cache that keeps each key's configs across calls. See {@link addConfigToValueListItems}.
 * @returns An observable emitting the mapped and configured list item configs.
 *
 * @example
 * ```ts
 * const items$ = mapValuesToValuesListItemConfigObs(listViewConfig, rawValues);
 * ```
 */
export function mapValuesToValuesListItemConfigObs<T, I extends DbxValueListItem<T>, V = unknown>(listViewConfig: AbstractDbxValueListViewConfig<T, I, V>, itemValues: T[], cache?: Maybe<DbxValueListItemConfigCache<T, I, V>>): Observable<DbxValueListItemConfig<T, I, V>[]> {
  return listViewConfig.mapValuesToItemValues(itemValues).pipe(
    map((listItems: I[]) => {
      const listItemConfigs: DbxValueListItemConfig<T, I, V>[] = addConfigToValueListItems<T, I, V>(listViewConfig, listItems, cache);
      return listItemConfigs;
    })
  );
}

/**
 * Adds injection component configuration and meta configuration to each list item, producing fully configured {@link DbxValueListItemConfig} entries ready for rendering.
 *
 * Without a cache every item gets new configs, so a list view re-creates every item's component. Pass the same
 * {@link DbxValueListItemConfigCache} to each call to keep the components of the items whose key stays in the list.
 *
 * @param listViewConfig - The list view configuration providing injection component config and optional meta config.
 * @param listItems - The list items to augment with configuration.
 * @param cache - (Optional) cache that keeps each key's configs across calls.
 * @returns The list items extended with injection component configuration attached.
 */
export function addConfigToValueListItems<T, I extends DbxValueListItem<T>, V = unknown>(listViewConfig: Omit<AbstractDbxValueListViewConfig<T, I, V>, 'mapValuesToItemValues'>, listItems: I[], cache?: Maybe<DbxValueListItemConfigCache<T, I, V>>): DbxValueListItemConfig<T, I, V>[] {
  return (cache ?? new DbxValueListItemConfigCache<T, I, V>()).addConfigToValueListItems(listViewConfig, listItems);
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
 * @param sourceType - The component class type to register as the list view provider.
 * @returns Array of Angular providers that bind the given component to {@link DbxValueListView}
 *
 * @Component ({
 *   providers: provideDbxValueListView(MyValueListViewComponent)
 * })
 * export class MyValueListViewComponent extends DbxValueListView<MyItem> { ... }
 * ```
 *
 * @example
 * ```ts
 */
export function provideDbxValueListView<V extends DbxValueListView<unknown>>(sourceType: Type<V>): Provider[] {
  return [
    {
      provide: DbxValueListView,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}
