import { Component, output, ChangeDetectionStrategy } from '@angular/core';
import { MatButton } from '@angular/material/button';

@Component({
  selector: 'doc-interaction-example-popover-content',
  template: `
    <div>
      <p>Popover Content</p>
      <button mat-raised-button (click)="returnNumberValue()">Return Value</button>
      <button mat-raised-button color="warn" (click)="closeWithoutValue()">Close</button>
    </div>
  `,
  standalone: true,
  imports: [MatButton],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocInteractionExamplePopoverContentComponent {
  readonly return = output<number>();
  readonly closePopover = output<void>();

  returnNumberValue() {
    this.return.emit(Math.random() * 1000);
  }

  closeWithoutValue() {
    this.closePopover.emit();
  }
}
