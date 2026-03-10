import { Directive, NgModule, output } from '@angular/core';
import { type MatSelectionListChange } from '@angular/material/list';
import { type ListSelectionState, type ListSelectionStateItem } from './list.view';
import { AbstractDbxListViewDirective } from './list.view.directive';
import { DbxSelectionValueListViewComponent } from './list.view.value.selection.component';

/**
 * Default template string for selection list view components that renders a `dbx-selection-list-view` with a `config` binding.
 */
export const DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE = '<dbx-selection-list-view [config]="config"></dbx-selection-list-view>';

/**
 * Convenience module that imports and exports {@link DbxSelectionValueListViewComponent}.
 */
@NgModule({
  exports: [DbxSelectionValueListViewComponent],
  imports: [DbxSelectionValueListViewComponent]
})
export class DbxSelectionValueListViewComponentImportsModule {}

// MARK: Selection List View
/**
 * Abstract list view directive with built-in selection change support. Converts Angular Material {@link MatSelectionListChange}
 * events into {@link ListSelectionState} emissions. Extend this for list views that need item selection.
 */
@Directive()
export abstract class AbstractDbxSelectionListViewDirective<T> extends AbstractDbxListViewDirective<T> {
  readonly selectionChange = output<ListSelectionState<T>>();

  selectionChanged(selection: ListSelectionState<T>): void {
    this.selectionChange.emit(selection);
  }

  matSelectionChanged(selection: MatSelectionListChange): void {
    const options = selection.source.selectedOptions.selected;
    const items: ListSelectionStateItem<T>[] = options.map((x) => {
      const { value: itemValue, selected, disabled } = x;
      return { itemValue, selected, disabled };
    });

    this.selectionChanged({ items });
  }
}
