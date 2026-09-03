import { Component, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';

@Component({
  selector: 'doc-interaction-example-popup-content',
  template: `
    <div>
      <p>Popup Content</p>
      <button mat-raised-button (click)="shouldClose.emit()">Close</button>
    </div>
  `,
  imports: [MatButton]
})
export class DocInteractionExamplePopupContentComponent {
  readonly reopen = input<() => void>();
  readonly shouldClose = output<void>();
}
