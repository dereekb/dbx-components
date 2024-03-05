import { Type } from '@angular/core';
import { PrimativeKey, SortCompareFunction, CssClassesArray } from '@dereekb/util';
import { DbxValueListItem, DbxValueListItemConfig } from './list.view.value';

export interface DbxListTitleGroupData<O extends PrimativeKey> {
  /**
   * Data Value. Should generally be defined, but can be null if the group is a default group.
   */
  readonly value: O;
  /**
   * Optional icon to show at the left.
   */
  readonly icon?: string;
  readonly title: string;
  readonly hint?: string;
  /**
   * Custom CSS classes to apply only to this group.
   */
  readonly cssClasses?: CssClassesArray;
}

export interface DbxListTitleGroupTitleDelegate<T, O extends PrimativeKey, D extends DbxListTitleGroupData<O> = DbxListTitleGroupData<O>, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  /**
   * Returns a key value for the input item. If the item does not belong to a group, returns undefined.
   *
   * @param item
   * @returns
   */
  readonly groupValueForItem: (item: DbxValueListItemConfig<T, I>) => O;
  /**
   * Converts a key value to a DbxListTitleGroupData for a group.
   *
   * @param value
   * @returns
   */
  readonly dataForGroupValue: (value: O, items: DbxValueListItemConfig<T, I>[]) => D;
  /**
   * (Optional) sort function for sorting groups by their data.
   */
  readonly sortGroupsByData?: SortCompareFunction<D>;
  /**
   * Custom header component class to inject.
   *
   * DbxListTitleGroupHeaderComponent is injected by default.
   */
  readonly headerComponentClass?: Type<unknown>;
  /**
   * (Optional) CSS classes to apply to the group.
   */
  readonly cssClasses?: CssClassesArray;
}
