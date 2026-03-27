import { type CssClassesArray, type Maybe, type UniqueModel } from '@dereekb/util';
import { type DbxValueListItem, type DbxValueListItemConfig } from '../list.view.value';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type Provider, type Type, forwardRef } from '@angular/core';
import { type ObservableOrValue } from '@dereekb/rxjs';

/**
 * A group of DbxValueListItem values, grouped by common data, name, and id.
 */
export interface DbxValueListItemGroup<G, T, I extends DbxValueListItem<T>, H = unknown, F = unknown> extends Omit<DbxValueListItem<unknown>, 'itemValue' | 'icon' | 'key'>, Readonly<Required<UniqueModel>> {
  readonly data: G;
  readonly items: DbxValueListItemConfig<T, I>[];
  /**
   * (Optional) View configuration for the group's header.
   */
  readonly headerConfig?: Maybe<DbxInjectionComponentConfig<H>>;
  /**
   * (Optional) View configuration for the group's header.
   */
  readonly footerConfig?: Maybe<DbxInjectionComponentConfig<F>>;
  /**
   * Whether or not to show the group's items. Defaults to true.
   */
  readonly showGroupItems?: boolean;
  /**
   * Custom CSS classes to apply to all groups.
   */
  readonly cssClasses?: CssClassesArray;
}

/**
 * Function type that partitions a flat list of configured items into an array of {@link DbxValueListItemGroup} values.
 */
export type DbxValueListViewGroupValuesFunction<G, T, I extends DbxValueListItem<T>, H = unknown, F = unknown> = (items: DbxValueListItemConfig<T, I>[]) => ObservableOrValue<DbxValueListItemGroup<G, T, I, H, F>[]>;

/**
 * Default grouping function that places all items into a single unnamed group.
 *
 * @param items The flat list of configured list items to group
 * @returns An array containing a single group with all input items
 */
export const defaultDbxValueListViewGroupValuesFunction = <T, I extends DbxValueListItem<T>>(items: DbxValueListItemConfig<T, I>[]) => {
  const data = {};
  const result: DbxValueListItemGroup<unknown, T, I> = {
    id: '_',
    data,
    items
  };

  return [result];
};

/**
 * Abstract delegate responsible for grouping list items into {@link DbxValueListItemGroup} instances.
 * Provide a custom implementation to control how items are organized into visual groups.
 */
export abstract class DbxValueListViewGroupDelegate<G, T, I extends DbxValueListItem<T> = DbxValueListItem<T>, H = unknown, F = unknown> {
  /**
   * Groups all input items into groups.
   */
  abstract readonly groupValues: DbxValueListViewGroupValuesFunction<G, T, I, H, F>;
}

/**
 * Creates a default {@link DbxValueListViewGroupDelegate} that places all items into a single ungrouped list.
 *
 * @returns A group delegate that places all items into one unnamed group
 *
 * @example
 * ```ts
 * const delegate = defaultDbxValueListViewGroupDelegate<MyItem>();
 * ```
 */
export function defaultDbxValueListViewGroupDelegate<T, I extends DbxValueListItem<T>>(): DbxValueListViewGroupDelegate<unknown, T, I> {
  return {
    groupValues: defaultDbxValueListViewGroupValuesFunction
  };
}

/**
 * Registers a class as a {@link DbxValueListViewGroupDelegate} provider for dependency injection.
 *
 * @param sourceType The class type to register as the group delegate provider
 * @returns An array of Angular providers that bind the given class to {@link DbxValueListViewGroupDelegate}
 *
 * @example
 * ```ts
 * @Directive({
 *   providers: provideDbxValueListViewGroupDelegate(MyGroupDelegate)
 * })
 * export class MyGroupDelegate extends DbxValueListViewGroupDelegate<MyGroup, MyItem> { ... }
 * ```
 */
export function provideDbxValueListViewGroupDelegate<D extends DbxValueListViewGroupDelegate<any, any, any, any>>(sourceType: Type<D>): Provider[] {
  // use of any here is allowed as typings are not relevant for providers
  return [
    {
      provide: DbxValueListViewGroupDelegate,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}
