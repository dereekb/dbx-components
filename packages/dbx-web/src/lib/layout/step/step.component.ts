import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { type Maybe } from '@dereekb/util';

/**
 * Displays a numbered step with optional completion state, header text, and hint.
 *
 * Projects child content into a step section body below the header. When `done` is true,
 * a checkmark icon is shown and the `done` CSS class is applied to the host element.
 *
 * **Note:** This component is currently incomplete and requires additional styling.
 *
 * @example
 * ```html
 * <dbx-step [step]="1" text="Create your account" hint="Fill in all required fields" [done]="accountCreated">
 *   <form>...</form>
 * </dbx-step>
 * ```
 */
// TODO: Incomplete component. Requires styling.
@Component({
  selector: 'dbx-step',
  template: `
    <div class="step-section">
      <div class="step-section-header">
        <span class="step">{{ step() }}.</span>
        @if (done()) {
          <mat-icon class="done-check">done</mat-icon>
        }
        <span class="text">{{ text() }}</span>
        @if (hint()) {
          <p class="hint">{{ hint() }}</p>
        }
      </div>
      <div class="step-section-content">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  host: {
    class: 'dbx-step',
    '[class.done]': 'done()'
  },
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxStepComponent {
  /**
   * Whether this step has been completed. Shows a checkmark icon when true.
   */
  readonly done = input<boolean>();

  /**
   * The step number displayed in the header.
   */
  readonly step = input<number>();

  /**
   * The main label text for this step.
   */
  readonly text = input<Maybe<string>>();

  /**
   * Optional hint text displayed below the step label.
   */
  readonly hint = input<Maybe<string>>();
}
