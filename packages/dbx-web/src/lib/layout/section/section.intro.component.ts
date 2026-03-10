import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { MatButtonModule } from '@angular/material/button';

/**
 * Displays an introductory message with a call-to-action button. When the button is clicked,
 * the intro is replaced by the projected content. Useful for onboarding or first-time-use flows.
 *
 * @example
 * ```html
 * <dbx-intro-action-section
 *   hint="Welcome! Click below to get started."
 *   action="Get Started"
 *   [showIntro]="isFirstVisit"
 *   (showAction)="onGetStarted()">
 *   <div info>Additional info shown in the intro state.</div>
 *   <p>Main content shown after the action is clicked.</p>
 * </dbx-intro-action-section>
 * ```
 */
@Component({
  selector: 'dbx-intro-action-section',
  template: `
    <div class="dbx-intro-action-section">
      @switch (showIntro()) {
        @case (true) {
          <div class="dbx-intro-action-section-intro">
            <p>{{ hint() }}</p>
            <div>
              <ng-content select="[info]"></ng-content>
            </div>
            <div>
              <button mat-raised-button color="accent" (click)="actionClicked()">{{ action() }}</button>
            </div>
          </div>
        }
        @case (false) {
          <ng-content></ng-content>
        }
      }
    </div>
  `,
  standalone: true,
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxIntroActionSectionComponent {
  readonly hint = input<Maybe<string>>();
  readonly showIntro = input<Maybe<boolean>>(true);
  readonly action = input<Maybe<string>>();

  readonly showAction = output<void>();

  actionClicked() {
    this.showAction.emit();
  }
}
