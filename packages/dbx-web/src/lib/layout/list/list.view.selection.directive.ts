import { Directive, EventEmitter, Output } from '@angular/core';
import { MatSelectionListChange } from '@angular/material/list';
import { ListSelectionState, ListSelectionStateItem } from './list.view';
import { AbstractDbxListViewDirective } from './list.view.directive';


/**
 * Abstract list view that has a pre-built-in selection change event for an Angular Material MatSelectionListChange.
 */
@Directive()
export abstract class AbstractSelectionValueListViewDirective<T> extends AbstractDbxListViewDirective<T> {

  @Output()
  selectionChange = new EventEmitter<ListSelectionState<T>>();

  selectionChanged(selection: ListSelectionState<T>): void {
    this.selectionChange.emit(selection);
  }

  matSelectionChanged(selection: MatSelectionListChange): void {
    const options = selection.source.selectedOptions.selected;
    const items: ListSelectionStateItem<T>[] = options.map(x => {
      const { value, selected, disabled } = x;
      return ({ value, selected, disabled });
    });

    this.selectionChanged({ items });
  }

}
