import { Component, ElementRef, OnDestroy, OnInit, Type, ViewChild } from "@angular/core";
import { AbstractDbxPickableItemFieldDirective, PickableItemFieldItem } from "./pickable.field.component";

/**
 * Used for picking pre-set values using chips as the presentation.
 */
@Component({
  templateUrl: 'pickable.chip.field.component.html',
  // TODO: styleUrls: ['./generic.scss']
})
export class DbxPickableChipFieldComponent<T> extends AbstractDbxPickableItemFieldDirective<T> {

  itemClicked(item: PickableItemFieldItem<T>): void {
    if (item.selected) {
      this.removeValue(item.display.value);
    } else {
      this.addValue(item.display.value);
    }
  }

}
