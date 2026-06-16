import { type DbxValueListItem } from '@dereekb/dbx-web';
import { type PickableValueFieldDisplayValue } from './pickable';

/**
 * A list item wrapping a {@link PickableValueFieldDisplayValue} with selection state.
 */
export type PickableItemFieldItem<T, M = unknown> = DbxValueListItem<PickableValueFieldDisplayValue<T, M>>;

/**
 * Sort function for ordering pickable items before display.
 */
export type PickableItemFieldItemSortFn<T, M = unknown> = (items: PickableItemFieldItem<T, M>[]) => PickableItemFieldItem<T, M>[];
