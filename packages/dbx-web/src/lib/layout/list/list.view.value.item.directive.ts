import { Directive, inject } from '@angular/core';
import { type DbxValueListItem, DBX_VALUE_LIST_VIEW_ITEM } from './list.view.value';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';

/**
 * Abstract base component for individual list item views. Automatically injects the current {@link DbxValueListItem}
 * via the {@link DBX_VALUE_LIST_VIEW_ITEM} token and provides convenient accessors for item properties.
 *
 * Extend this to create custom item rendering components used within value list views.
 */
@Directive()
export abstract class AbstractDbxValueListViewItemComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  readonly item = inject<I>(DBX_VALUE_LIST_VIEW_ITEM);

  get itemValue(): T {
    return this.item.itemValue;
  }

  get itemIcon(): string | undefined {
    return this.item.icon;
  }

  get itemDisabled(): boolean | undefined {
    return this.item.disabled;
  }

  get itemRippleDisabled(): boolean | undefined {
    return this.item.rippleDisabled;
  }

  get itemSelected(): boolean | undefined {
    return this.item.selected;
  }

  get itemAnchor(): Maybe<ClickableAnchor> | undefined {
    return this.item.anchor;
  }
}
