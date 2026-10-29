import { computed, Directive, type Signal } from '@angular/core';
import { type DbxValueListItem, injectDbxValueListViewItemSignal } from './list.view.value';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';

/**
 * Abstract base component for individual list item views. Automatically injects the current {@link DbxValueListItem}
 * and provides convenient accessors for item properties.
 *
 * List views keep an item's component while the item's key stays in the list and pass it each update's item, so the
 * accessors always return the latest item. Read them from the template, a `computed()` or an `effect()` to update with
 * the item; a value copied from them while the component is created keeps the item the component was created with.
 *
 * Extend this to create custom item rendering components used within value list views.
 */
@Directive()
export abstract class AbstractDbxValueListViewItemComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  /**
   * Signal of the current list item.
   */
  readonly itemSignal: Signal<I> = injectDbxValueListViewItemSignal<I>();

  /**
   * Signal of the current list item's value.
   */
  readonly itemValueSignal: Signal<T> = computed(() => this.itemSignal().itemValue);

  get item(): I {
    return this.itemSignal();
  }

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
