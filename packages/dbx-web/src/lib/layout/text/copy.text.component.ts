import { Component, computed, type ElementRef, input, viewChild } from '@angular/core';
import { DbxClickToCopyTextDirective } from './copy.text.directive';
import { type Maybe } from '@dereekb/util';
import { type CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig } from '../../util';
import { MatIcon } from '@angular/material/icon';

/**
 * Icon shown by {@link DbxClickToCopyTextComponent} when no icon is configured.
 */
export const DEFAULT_DBX_CLICK_TO_COPY_TEXT_ICON = 'content_copy';

/**
 * Configuration object for {@link DbxClickToCopyTextComponent}.
 *
 * Pass via the `config` input as an alternative to setting individual inputs. Individual inputs take precedence over config values.
 */
export interface DbxClickToCopyTextComponentConfig {
  /**
   * Text to copy. Defaults to the projected content's text.
   */
  readonly copyText?: Maybe<string>;
  /**
   * Whether to show the copy icon. Defaults to true.
   */
  readonly showIcon?: Maybe<boolean>;
  /**
   * Whether to underline the content. Defaults to false.
   */
  readonly highlighted?: Maybe<boolean>;
  /**
   * Snackbar messages shown after copying.
   */
  readonly clipboardSnackbarMessagesConfig?: Maybe<CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig>;
  /**
   * Whether to show a snackbar after copying. Defaults to true.
   */
  readonly clipboardSnackbarMessagesEnabled?: Maybe<boolean>;
  /**
   * The copy icon. Defaults to {@link DEFAULT_DBX_CLICK_TO_COPY_TEXT_ICON}.
   */
  readonly clickToCopyIcon?: Maybe<string>;
  /**
   * Whether only the icon copies, leaving the content selectable. Defaults to false.
   */
  readonly clickIconToCopyOnly?: Maybe<boolean>;
}

/**
 * Wraps projected content with click-to-copy functionality and a copy icon button.
 *
 * Clicking the text or the icon copies the text to the clipboard and optionally shows a snackbar confirmation.
 *
 * Accepts either individual inputs or a single `config` object. Individual inputs take precedence over config values.
 *
 * @dbxWebComponent
 * @dbxWebSlug click-to-copy-text
 * @dbxWebCategory text
 * @dbxWebRelated chip, click-to-copy-field
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-click-to-copy-text>{{ value }}</dbx-click-to-copy-text>
 * ```
 *
 * @example
 * ```html
 * <dbx-click-to-copy-text [copyText]="userId">User {{ userId }}</dbx-click-to-copy-text>
 * ```
 */
@Component({
  selector: 'dbx-click-to-copy-text',
  template: `
    <span
      #content
      [dbxClickToCopyText]="copyTextSignal()"
      [disableCopy]="clickIconToCopyOnlySignal()"
      [highlighted]="highlightedSignal()"
      [clipboardSnackbarMessagesEnabled]="clipboardSnackbarMessagesEnabledSignal()"
      [clipboardSnackbarMessagesConfig]="clipboardSnackbarMessagesConfigSignal()"
      [copyTextFromElement]="contentElementRef()">
      <ng-content></ng-content>
    </span>
    @if (showIconSignal()) {
      <mat-icon class="dbx-click-to-copy-text-icon" (click)="dbxClickToCopyText()?._copyText()">{{ clickToCopyIconSignal() }}</mat-icon>
    }
  `,
  host: {
    class: 'dbx-click-to-copy-text-component'
  },
  imports: [DbxClickToCopyTextDirective, MatIcon]
})
export class DbxClickToCopyTextComponent {
  readonly contentElementRef = viewChild<ElementRef<HTMLElement>>('content');
  readonly dbxClickToCopyText = viewChild<DbxClickToCopyTextDirective>(DbxClickToCopyTextDirective);

  readonly config = input<Maybe<DbxClickToCopyTextComponentConfig>>();
  readonly copyText = input<Maybe<string>>();
  readonly showIcon = input<Maybe<boolean>>();
  readonly highlighted = input<Maybe<boolean>>();
  readonly clipboardSnackbarMessagesConfig = input<Maybe<CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig>>();
  readonly clipboardSnackbarMessagesEnabled = input<Maybe<boolean>>();
  readonly clickToCopyIcon = input<Maybe<string>>();
  readonly clickIconToCopyOnly = input<Maybe<boolean>>();

  readonly copyTextSignal = computed(() => {
    const config = this.config();
    return this.copyText() ?? config?.copyText;
  });
  readonly showIconSignal = computed(() => {
    const config = this.config();
    return this.showIcon() ?? config?.showIcon ?? true;
  });
  readonly highlightedSignal = computed(() => {
    const config = this.config();
    return this.highlighted() ?? config?.highlighted ?? false;
  });
  readonly clipboardSnackbarMessagesConfigSignal = computed(() => {
    const config = this.config();
    return this.clipboardSnackbarMessagesConfig() ?? config?.clipboardSnackbarMessagesConfig;
  });
  readonly clipboardSnackbarMessagesEnabledSignal = computed(() => {
    const config = this.config();
    return this.clipboardSnackbarMessagesEnabled() ?? config?.clipboardSnackbarMessagesEnabled ?? true;
  });
  readonly clickToCopyIconSignal = computed(() => {
    const config = this.config();
    return this.clickToCopyIcon() ?? config?.clickToCopyIcon ?? DEFAULT_DBX_CLICK_TO_COPY_TEXT_ICON;
  });
  readonly clickIconToCopyOnlySignal = computed(() => {
    const config = this.config();
    return this.clickIconToCopyOnly() ?? config?.clickIconToCopyOnly ?? false;
  });
}
