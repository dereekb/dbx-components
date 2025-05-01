import { Component, EventEmitter, Input, Output, OnDestroy } from '@angular/core';
import { MatButton } from '@angular/material/button';

@Component({
    selector: 'dbx-interaction-example-popup-content',
    template: `
    <div>
      <p>Popup Content</p>
      <button mat-raised-button (click)="shouldClose.emit()">Close</button>
    </div>
  `,
    standalone: true,
    imports: [MatButton]
})
export class DocInteractionExamplePopupContentComponent implements OnDestroy {
  @Input()
  reopen?: () => void;

  @Output()
  readonly shouldClose = new EventEmitter<void>();

  ngOnDestroy(): void {
    this.shouldClose.complete();
  }
}
