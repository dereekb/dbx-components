import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

/**
 * Event emitted when the error icon button is clicked, containing the button's element reference for popover anchoring.
 */
export interface DbxErrorViewButtonEvent {
  /**
   * The element reference of the clicked button, used as the popover origin.
   */
  readonly origin: ElementRef;
}

/**
 * Low-level error view that renders a Material icon button and an optional error message.
 *
 * Emits a {@link DbxErrorViewButtonEvent} when the button is clicked, which is typically used
 * to open an error detail popover. Used internally by {@link DbxErrorComponent}.
 *
 * @example
 * ```html
 * <dbx-error-view icon="warning" [message]="'Something went wrong'" (buttonClick)="onErrorClick($event)"></dbx-error-view>
 * ```
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
  imports: [MatIconModule, MatButtonModule],
  standalone: true
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
