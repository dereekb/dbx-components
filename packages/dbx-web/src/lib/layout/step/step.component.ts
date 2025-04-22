import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Maybe } from '@dereekb/util';

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
  readonly done = input<boolean>();
  readonly step = input<number>();
  readonly text = input<Maybe<string>>();
  readonly hint = input<Maybe<string>>();
}
