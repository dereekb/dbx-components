import { type CssClassesArray, type Maybe, type UniqueModel } from '@dereekb/util';
import { type DbxValueListItem, type DbxValueListItemConfig } from '../list.view.value';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type Provider, type Type, forwardRef } from '@angular/core';
import { type ObservableOrValue } from '@dereekb/rxjs';

/**
 * A group of DbxValueListItem values, grouped by common data, name, and id.
 */
export interface DbxValueListItemGroup<G, T, I extends DbxValueListItem<T>, H = unknown, F = unknown> extends Omit<DbxValueListItem<any>, 'itemValue' | 'icon'>, Readonly<Required<UniqueModel>> {
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
 * Function that generates an array of DbxValueListItemGroup values from a list of items.
 */
export type DbxValueListViewGroupValuesFunction<G, T, I extends DbxValueListItem<T>, H = unknown, F = unknown> = (items: DbxValueListItemConfig<T, I>[]) => ObservableOrValue<DbxValueListItemGroup<G, T, I, H, F>[]>;

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
 * Interface for a view that renders the items of a DbxList.
 */
export abstract class DbxValueListViewGroupDelegate<G, T, I extends DbxValueListItem<T> = DbxValueListItem<T>, H = unknown, F = unknown> {
  /**
   * Groups all input items into groups.
   */
  abstract readonly groupValues: DbxValueListViewGroupValuesFunction<G, T, I, H, F>;
}

export function defaultDbxValueListViewGroupDelegate<T, I extends DbxValueListItem<T>>(): DbxValueListViewGroupDelegate<any, T, I> {
  const result = {
    groupValues: defaultDbxValueListViewGroupValuesFunction
  };

  return result;
}

// eslint-disable-next-line
export function provideDbxValueListViewGroupDelegate<D extends DbxValueListViewGroupDelegate<any, any, any, any>>(sourceType: Type<D>): Provider[] {
  // use of any here is allowed as typings are not relevant for providers
  return [
    {
      provide: DbxValueListViewGroupDelegate,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}
