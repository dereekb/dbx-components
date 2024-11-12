import { Directive, EventEmitter, Output } from '@angular/core';
import { MatSelectionListChange } from '@angular/material/list';
import { ListSelectionState, ListSelectionStateItem } from './list.view';
import { AbstractDbxListViewDirective } from './list.view.directive';

export const DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE = '<dbx-selection-list-view [config]="config"></dbx-selection-list-view>';

// MARK: Selection List View
/**
 * Abstract list view that has a pre-built-in selection change event for an Angular Material MatSelectionListChange.
 */
@Directive()
export abstract class AbstractDbxSelectionListViewDirective<T> extends AbstractDbxListViewDirective<T> {
  @Output()
  readonly selectionChange = new EventEmitter<ListSelectionState<T>>();

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
