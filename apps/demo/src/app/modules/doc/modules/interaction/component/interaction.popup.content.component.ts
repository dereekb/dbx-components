import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
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
  imports: [MatButton],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocInteractionExamplePopupContentComponent {
  readonly reopen = input<() => void>();
  readonly shouldClose = output<void>();
}
