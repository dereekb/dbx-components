import { Component, EventEmitter, Input, Output, OnDestroy } from '@angular/core';

@Component({
  selector: 'dbx-interaction-example-popover-content',
  template: `
  <div>
    <p>Popover Content</p>
    <button mat-raised-button (click)="returnNumberValue()">Return Value</button>
    <button mat-raised-button color="warn" (click)="closeWithoutValue()">Close</button>
  </div>
  `
})
export class DocInteractionExamplePopoverContentComponent implements OnDestroy {

  @Output()
  readonly return = new EventEmitter<number>();

  @Output()
  readonly close = new EventEmitter<void>();

  ngOnDestroy(): void {
    this.return.complete();
    this.close.complete();
  }

  returnNumberValue() {
    this.return.next(Math.random() * 1000);
  }

  closeWithoutValue() {
    this.close.next();
  }

}
