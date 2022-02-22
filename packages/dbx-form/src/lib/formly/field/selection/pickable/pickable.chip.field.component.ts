import { Component } from "@angular/core";
import { AbstractDbxPickableItemFieldDirective, PickableItemFieldItem } from "./pickable.field.directive";

/**
 * Used for picking pre-set values using chips as the presentation.
 */
@Component({
  templateUrl: 'pickable.chip.field.component.html'
})
export class DbxPickableChipListFieldComponent<T> extends AbstractDbxPickableItemFieldDirective<T> {

  itemClicked(item: PickableItemFieldItem<T>): void {
    if (!item.disabled && !this.isReadonlyOrDisabled) {
      if (item.selected) {
        this.removeValue(item.value.value);
      } else {
        this.addValue(item.value.value);
      }
    }
  }

}
