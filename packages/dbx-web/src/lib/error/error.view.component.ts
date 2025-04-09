import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

export interface DbxErrorViewButtonEvent {
  readonly origin: ElementRef;
}

/**
 * The basic error view. Shows an info button and an error message.
 */
@Component({
  selector: 'dbx-error-view',
  template: `
    <button class="dbx-error-button" [disabled]="buttonDisabled()" #buttonPopoverOrigin mat-icon-button (click)="clickError()">
      <mat-icon>{{ icon() }}</mat-icon>
    </button>
    @if (message()) {
      <span class="dbx-error-message">{{ message() }}</span>
    }
  `,
  host: {
    class: 'dbx-error dbx-warn dbx-b'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule]
})
export class DbxErrorViewComponent {
  readonly icon = input<string>('error');

  readonly message = input<Maybe<string>>();

  /**
   * Whether or not the error button is disabled.
   */
  readonly buttonDisabled = input<Maybe<boolean>>();

  readonly buttonClick = output<DbxErrorViewButtonEvent>();

  readonly buttonOrigin = viewChild.required<ElementRef, ElementRef>('buttonPopoverOrigin', { read: ElementRef });

  clickError() {
    if (!this.buttonDisabled()) {
      this.buttonClick.emit({
        origin: this.buttonOrigin()
      });
    }
  }
}
