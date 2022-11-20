import { Component, ElementRef, ViewChild } from '@angular/core';
import { AbstractFilterPopoverButtonDirective } from './filter.popover.button.directive';

@Component({
  selector: 'dbx-filter-popover-button',
  template: `
    <button #button mat-icon-button (click)="showFilterPopover()" matTooltip="Filter" matTooltipPosition="above">
      <mat-icon>filter_list</mat-icon>
    </button>
  `
})
export class DbxFilterPopoverButtonComponent<F extends object = object> extends AbstractFilterPopoverButtonDirective<F> {
  @ViewChild('button', { read: ElementRef, static: false })
  buttonElement!: ElementRef;

  showFilterPopover(): void {
    const origin = this.buttonElement.nativeElement;
    this.showFilterPopoverAtOrigin(origin);
  }
}
