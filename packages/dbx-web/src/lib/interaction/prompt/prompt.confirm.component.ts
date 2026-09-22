import { Component, computed, input, output } from '@angular/core';
import { DbxPromptComponent } from './prompt.component';
import { DbxButtonComponent } from '../../button/button.component';
import { DbxButtonSpacerDirective } from '../../button/button.spacer.directive';
import { type Maybe } from '@dereekb/util';
import { type DbxButtonStyle } from '../../button/button';

/**
 * Configuration for the confirmation prompt display.
 */
export interface DbxPromptConfirmConfig {
  readonly title?: string;
  readonly prompt?: string;
  readonly confirmText?: string;
  readonly cancelText?: string;
  /**
   * (Optional) Style for the confirm button.
   *
   * Defaults to {@link DEFAULT_PROMPT_CONFIRM_BUTTON_STYLE}. Set a `color` here to paint the button with an arbitrary
   * {@link DbxColorInput} (including a registered color template) rather than the default palette.
   */
  readonly confirmButtonStyle?: Maybe<DbxButtonStyle>;
  /**
   * (Optional) Style for the cancel button.
   *
   * Defaults to {@link DEFAULT_PROMPT_CANCEL_BUTTON_STYLE}.
   */
  readonly cancelButtonStyle?: Maybe<DbxButtonStyle>;
}

/**
 * Default style for the confirm button.
 */
export const DEFAULT_PROMPT_CONFIRM_BUTTON_STYLE: DbxButtonStyle = { type: 'stroked' };

/**
 * Default style for the cancel button.
 */
export const DEFAULT_PROMPT_CANCEL_BUTTON_STYLE: DbxButtonStyle = { type: 'stroked', color: 'warn' };

/**
 * Renders a confirmation prompt with customizable title, message, confirm, and cancel buttons.
 *
 * @dbxWebComponent
 * @dbxWebSlug prompt-confirm
 * @dbxWebCategory overlay
 * @dbxWebRelated prompt, action-confirm
 * @dbxWebSkillRefs dbx__ref__dbx-app-structure
 * @dbxWebMinimalExample ```html
 * <dbx-prompt-confirm [config]="cfg"></dbx-prompt-confirm>
 * ```
 *
 * @example
 * ```html
 * <dbx-prompt-confirm [config]="{ header: 'Delete?', confirmText: 'Delete', cancelText: 'Cancel' }"></dbx-prompt-confirm>
 * ```
 */
@Component({
  selector: 'dbx-prompt-confirm',
  template: `
    <dbx-prompt [header]="config()?.title" [prompt]="config()?.prompt">
      <ng-content></ng-content>
      <div class="dbx-pt3">
        <dbx-button [buttonStyle]="confirmButtonStyleSignal()" [text]="confirmTextSignal()" (buttonClick)="onConfirm()"></dbx-button>
        <dbx-button-spacer></dbx-button-spacer>
        <dbx-button [buttonStyle]="cancelButtonStyleSignal()" [text]="cancelTextSignal()" (buttonClick)="onCancel()"></dbx-button>
      </div>
    </dbx-prompt>
  `,
  imports: [DbxPromptComponent, DbxButtonComponent, DbxButtonSpacerDirective]
})
export class DbxPromptConfirmComponent {
  readonly config = input<Maybe<DbxPromptConfirmConfig>>({});

  readonly confirmTextSignal = computed(() => this.config()?.confirmText || 'Confirm');
  readonly cancelTextSignal = computed(() => this.config()?.cancelText || 'Cancel');

  readonly confirmButtonStyleSignal = computed(() => this.config()?.confirmButtonStyle ?? DEFAULT_PROMPT_CONFIRM_BUTTON_STYLE);
  readonly cancelButtonStyleSignal = computed(() => this.config()?.cancelButtonStyle ?? DEFAULT_PROMPT_CANCEL_BUTTON_STYLE);

  readonly confirm = output<void>();
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly cancel = output<void>();

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
