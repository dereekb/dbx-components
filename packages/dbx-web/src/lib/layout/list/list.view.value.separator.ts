import { InjectionToken, type StaticProvider } from '@angular/core';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { type DbxValueListItem } from './list.view.value';

/**
 * Injection token that provides the {@link DbxValueListItemSeparatorContext} to a separator component injected by a
 * {@link DbxValueListViewSeparatorConfig}.
 */
export const DBX_VALUE_LIST_VIEW_ITEM_SEPARATOR = new InjectionToken<DbxValueListItemSeparatorContext<unknown>>('DbxValueListViewItemSeparator');

/**
 * Decides whether a separator is rendered between two neighbouring list items.
 *
 * Called for every adjacent pair within a group, plus once before the group's first item (`previous` is undefined)
 * and once after its last item (`next` is undefined), so a separator can also lead or trail a group. Return `false`
 * when either side is missing to only separate items from each other.
 */
export type DbxValueListItemSeparatorDecisionFunction<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> = (previous: Maybe<I>, next: Maybe<I>) => boolean;

/**
 * Configures a separator component that a value list view injects between two neighbouring items when
 * {@link showSeparator} returns true.
 *
 * The injection config fields (`componentClass`, `providers`, `init`, …) describe the separator component. The
 * component can inject {@link DBX_VALUE_LIST_VIEW_ITEM_SEPARATOR} to read the items it sits between.
 *
 * @example
 * ```ts
 * const separatorConfig: DbxValueListViewSeparatorConfig<Day> = {
 *   componentClass: DayGapComponent,
 *   showSeparator: dbxValueListItemSeparatorDecisionFunction((previous, next) => previous != null && next != null && !isNextDay(previous, next))
 * };
 * ```
 */
export interface DbxValueListViewSeparatorConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, S = unknown> extends DbxInjectionComponentConfig<S> {
  /**
   * Whether to render the separator between the two items.
   */
  readonly showSeparator: DbxValueListItemSeparatorDecisionFunction<T, I>;
}

/**
 * The two neighbouring items a separator is rendered between.
 */
export interface DbxValueListItemSeparatorContext<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  /**
   * The item before the separator. Undefined for a separator that leads a group.
   */
  readonly previous: Maybe<I>;
  /**
   * The item after the separator. Undefined for a separator that trails a group.
   */
  readonly next: Maybe<I>;
}

/**
 * Convenience function for mapping a decision function for two item values to a {@link DbxValueListItemSeparatorDecisionFunction}.
 *
 * @param decisionFunction - Decides whether to separate the two item values. Each value is undefined when that side has no item.
 * @returns A separator decision function that operates on the list items.
 *
 * @example
 * ```ts
 * const showSeparator = dbxValueListItemSeparatorDecisionFunction<Day>((previous, next) => previous != null && next != null && !isNextDay(previous, next));
 * ```
 */
export function dbxValueListItemSeparatorDecisionFunction<T>(decisionFunction: (previous: Maybe<T>, next: Maybe<T>) => boolean): DbxValueListItemSeparatorDecisionFunction<T> {
  return (previous, next) => decisionFunction(previous?.itemValue, next?.itemValue);
}

/**
 * Computes the separators to render around a run of rendered list items.
 *
 * The result has `items.length + 1` entries: entry `i` is the separator rendered before `items[i]`, and the last entry
 * is the separator rendered after the last item. An entry is undefined where no separator is shown. Each separator
 * config is the input config without `showSeparator`, with a {@link DBX_VALUE_LIST_VIEW_ITEM_SEPARATOR} provider added
 * ahead of the config's own providers.
 *
 * Each call returns configs with a fresh `init` wrapper (which still calls the input config's `init`).
 * `dbx-injection` ignores `providers` when comparing configs, so without it a reused separator would keep the neighbour
 * items it was created with; the new `init` makes the separator re-create with its current neighbours.
 *
 * @param items - The rendered items, in display order.
 * @param separatorConfig - The separator configuration. When not provided, no separators are rendered.
 * @returns The separator injection configs for each position around the items.
 *
 * @example
 * ```ts
 * const separators = dbxValueListItemSeparatorConfigs(items, separatorConfig);
 * // separators[0] leads the first item, separators[items.length] trails the last item.
 * ```
 */
export function dbxValueListItemSeparatorConfigs<T, I extends DbxValueListItem<T> = DbxValueListItem<T>>(items: I[], separatorConfig: Maybe<DbxValueListViewSeparatorConfig<T, I>>): Maybe<DbxInjectionComponentConfig>[] {
  let result: Maybe<DbxInjectionComponentConfig>[];

  if (separatorConfig == null) {
    result = [];
  } else {
    const { showSeparator, init, ...injectionConfig } = separatorConfig;
    result = [];

    for (let i = 0; i <= items.length; i += 1) {
      const previous = items[i - 1] as Maybe<I>;
      const next = items[i] as Maybe<I>;
      let separator: Maybe<DbxInjectionComponentConfig>;

      if (showSeparator(previous, next)) {
        const context: DbxValueListItemSeparatorContext<T, I> = { previous, next };
        const providers: StaticProvider[] = [{ provide: DBX_VALUE_LIST_VIEW_ITEM_SEPARATOR, useValue: context }, ...(injectionConfig.providers ?? [])];
        separator = { ...injectionConfig, providers, init: (instance: unknown) => init?.(instance) } as DbxInjectionComponentConfig;
      }

      result.push(separator);
    }
  }

  return result;
}
