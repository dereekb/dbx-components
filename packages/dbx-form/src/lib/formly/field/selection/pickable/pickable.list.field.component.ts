import { Component } from "@angular/core";
import { MatSelectionListChange } from "@angular/material/list";
import { AbstractDbxPickableItemFieldDirective, PickableItemFieldItem } from "./pickable.field.component";

/**
 * Used for picking pre-set values using a selection list as the presentation.
 */
@Component({
  templateUrl: 'pickable.list.field.component.html',
  // TODO: styleUrls: ['./generic.scss']
})
export class DbxPickableListFieldComponent<T> extends AbstractDbxPickableItemFieldDirective<T> {

  matSelectionChanged(selection: MatSelectionListChange): void {
    const options = selection.source.selectedOptions.selected;
    const items: { item: PickableItemFieldItem<T>, selected: boolean }[] = options.map(x => {
      const { value, selected, disabled } = x;
      return ({ item: value, selected, disabled });
    });

    this.setValues(items.map(x => x.item.display.value));
  }

}
