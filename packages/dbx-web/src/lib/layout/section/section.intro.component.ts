import { Component, computed, input, output } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxButtonComponent } from '../../button/button.component';
import { type DbxButtonStyle } from '../../button/button';

/**
 * Default style for the intro action button.
 */
export const DEFAULT_INTRO_ACTION_SECTION_BUTTON_STYLE: DbxButtonStyle = { type: 'raised', color: 'accent' };

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
              <dbx-button [buttonStyle]="buttonStyleSignal()" [text]="action()" (buttonClick)="actionClicked()"></dbx-button>
            </div>
          </div>
        }
        @case (false) {
          <ng-content></ng-content>
        }
      }
    </div>
  `,
  imports: [DbxButtonComponent]
})
export class DbxIntroActionSectionComponent {
  readonly hint = input<Maybe<string>>();
  readonly showIntro = input<Maybe<boolean>>(true);
  readonly action = input<Maybe<string>>();

  /**
   * (Optional) Style for the action button.
   *
   * Defaults to {@link DEFAULT_INTRO_ACTION_SECTION_BUTTON_STYLE}. Set a `color` here to paint the button with an
   * arbitrary {@link DbxColorInput} (including a registered color template) rather than the default accent palette.
   */
  readonly buttonStyle = input<Maybe<DbxButtonStyle>>();

  readonly buttonStyleSignal = computed(() => this.buttonStyle() ?? DEFAULT_INTRO_ACTION_SECTION_BUTTON_STYLE);

  readonly showAction = output<void>();

  actionClicked() {
    this.showAction.emit();
  }
}
