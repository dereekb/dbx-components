import { type Maybe } from '@dereekb/util';

/**
 * A selected list item, identified by its list item key.
 *
 * The key is the {@link DbxValueListItem.key} of the item, which list views keep stable across updates.
 */
export interface DbxListSingleSelectionEntry<T> {
  /**
   * The list item key of the selected item.
   */
  readonly key: string;
  /**
   * The item value at the time it was selected.
   */
  readonly value: T;
}

/**
 * Emitted when the selection in a {@link DbxListSingleSelectionStore} changes.
 */
export interface DbxListSingleSelectionChange<T> {
  /**
   * The newly selected entry, if any.
   */
  readonly selected: Maybe<DbxListSingleSelectionEntry<T>>;
  /**
   * The entry that was selected before this change, if any.
   */
  readonly previous: Maybe<DbxListSingleSelectionEntry<T>>;
}

/**
 * Configuration for a single-selection list.
 */
export interface DbxListSingleSelectionConfig {
  /**
   * Whether clicking the selected item deselects it.
   *
   * Defaults to false.
   */
  readonly allowDeselect?: Maybe<boolean>;
}
