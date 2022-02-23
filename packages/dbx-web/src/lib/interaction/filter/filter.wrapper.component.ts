import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Used for adding a reset and filter button to a form.
 */
@Component({
  selector: 'dbx-filter-wrapper',
  templateUrl: './filter.wrapper.component.html'
})
export class DbxFilterWrapperComponent {

  @Input()
  modified?: boolean;

  @Output()
  readonly applyFilter = new EventEmitter();

  @Output()
  readonly resetFilter = new EventEmitter();

  filterClicked(): void {
    this.applyFilter.emit();
  }

  resetClicked(): void {
    this.resetFilter.emit();
  }

}
