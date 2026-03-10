import { type Type } from '@angular/core';
import { type PrimativeKey, type SortCompareFunction, type CssClassesArray } from '@dereekb/util';
import { type DbxValueListItem, type DbxValueListItemConfig } from '../list.view.value';

/**
 * Describes the display data for a title-based list group, including title text, optional icon, and hint.
 */
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

/**
 * Delegate interface for grouping list items by a key value and producing titled group headers. Determines which group
 * each item belongs to and generates the display data for each group's header.
 */
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
   * Custom footer component class to inject, if applicable.
   */
  readonly footerComponentClass?: Type<unknown>;
  /**
   * (Optional) CSS classes to apply to the group.
   */
  readonly cssClasses?: CssClassesArray;
}
