import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { MatButtonModule } from '@angular/material/button';

/**
 * Displays an introductory message with a call-to-action button. When the button is clicked,
 * the intro is replaced by the projected content. Useful for onboarding or first-time-use flows.
 *
 * @dbxWebComponent
 * @dbxWebSlug intro-action-section
 * @dbxWebCategory feedback
 * @dbxWebRelated section, list-empty-content
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-intro-action-section hint="Welcome" action="Start"><p>Body</p></dbx-intro-action-section>
 * ```
 *
 * @example
 * ```html
 * <dbx-intro-action-section
 *   hint="Welcome! Click below to get started."
 *   action="Get Started"
 *   [showIntro]="!hasOnboarded"
 *   (showAction)="markOnboarded()">
 *   <p>Main content shown after the action.</p>
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
