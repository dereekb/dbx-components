import { Component, computed, input, model } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { type Maybe } from '@dereekb/util';
import { type CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig } from '../../util';
import { DbxClickToCopyTextComponent, type DbxClickToCopyTextComponentConfig } from './copy.text.component';

/**
 * Text shown in place of a secret {@link DbxClickToCopyFieldComponent} value until it is revealed.
 */
export const DEFAULT_DBX_CLICK_TO_COPY_FIELD_HIDDEN_TEXT = '••••••••••••••••';

/**
 * Configuration object for {@link DbxClickToCopyFieldComponent}.
 *
 * Extends the {@link DbxClickToCopyTextComponentConfig} the field passes to its `dbx-click-to-copy-text`, except `highlighted`, which
 * underlines inline text and does not suit a field. `copyText` defaults to {@link text}.
 *
 * Pass via the `config` input as an alternative to setting individual inputs. Individual inputs take precedence over config values.
 */
export interface DbxClickToCopyFieldComponentConfig extends Omit<DbxClickToCopyTextComponentConfig, 'highlighted'> {
  /**
   * The value shown in the field, and copied unless `copyText` is set.
   */
  readonly text?: Maybe<string>;
  /**
   * Icon shown before the value.
   */
  readonly icon?: Maybe<string>;
  /**
   * Whether to show the value in a monospace font, for urls, ids, keys, and codes.
   */
  readonly monospace?: Maybe<boolean>;
  /**
   * Whether the value is a secret. It is then hidden behind {@link hiddenText} until the user reveals it with the field's show/hide button.
   * Copying always copies the real value.
   */
  readonly secret?: Maybe<boolean>;
  /**
   * Text shown in place of a hidden secret. Defaults to {@link DEFAULT_DBX_CLICK_TO_COPY_FIELD_HIDDEN_TEXT}.
   */
  readonly hiddenText?: Maybe<string>;
}

/**
 * A read-only field that shows a value, such as a url, id, or key, and copies it when clicked or when its copy icon is clicked.
 *
 * Copying is done by a wrapped `dbx-click-to-copy-text`, and the field passes its copy options (`copyText`, `showIcon`, `clickToCopyIcon`,
 * `clickIconToCopyOnly`, and the clipboard snackbar options) through to it. Set `clickIconToCopyOnly` to leave the value selectable.
 *
 * Set `secret` to hide the value until the user reveals it with the field's show/hide button. Bind `[(revealed)]` to follow or control
 * whether the secret is shown, such as to hide the same secret elsewhere on the page.
 *
 * Accepts either individual inputs or a single `config` object. Individual inputs take precedence over config values.
 *
 * @dbxWebComponent
 * @dbxWebSlug click-to-copy-field
 * @dbxWebCategory text
 * @dbxWebRelated click-to-copy-text
 * @dbxWebMinimalExample ```html
 * <dbx-click-to-copy-field [text]="value"></dbx-click-to-copy-field>
 * ```
 *
 * @example
 * ```html
 * <dbx-click-to-copy-field icon="key" [monospace]="true" [text]="clientId"></dbx-click-to-copy-field>
 * <dbx-click-to-copy-field icon="lock" [monospace]="true" [secret]="true" [text]="clientSecret"></dbx-click-to-copy-field>
 * ```
 */
@Component({
  selector: 'dbx-click-to-copy-field',
  template: `
    <dbx-click-to-copy-text [config]="clickToCopyTextConfigSignal()">
      @if (iconSignal()) {
        <mat-icon class="dbx-click-to-copy-field-icon" aria-hidden="true">{{ iconSignal() }}</mat-icon>
      }
      <span class="dbx-click-to-copy-field-text">{{ displayTextSignal() }}</span>
    </dbx-click-to-copy-text>
    @if (secretSignal()) {
      <button type="button" class="dbx-click-to-copy-field-reveal" (click)="toggleRevealed()" [attr.aria-label]="revealed() ? 'Hide value' : 'Show value'" [attr.aria-pressed]="revealed()">
        <mat-icon aria-hidden="true">{{ revealed() ? 'visibility_off' : 'visibility' }}</mat-icon>
      </button>
    }
  `,
  host: {
    class: 'dbx-click-to-copy-field',
    '[class.dbx-click-to-copy-field-monospace]': 'monospaceSignal()',
    '[class.dbx-click-to-copy-field-icon-only]': 'clickToCopyTextConfigSignal().clickIconToCopyOnly'
  },
  imports: [DbxClickToCopyTextComponent, MatIcon]
})
export class DbxClickToCopyFieldComponent {
  readonly config = input<Maybe<DbxClickToCopyFieldComponentConfig>>();
  readonly text = input<Maybe<string>>();
  readonly icon = input<Maybe<string>>();
  readonly monospace = input<Maybe<boolean>>();
  readonly secret = input<Maybe<boolean>>();
  readonly hiddenText = input<Maybe<string>>();

  // passed through to dbx-click-to-copy-text
  readonly copyText = input<Maybe<string>>();
  readonly showIcon = input<Maybe<boolean>>();
  readonly clickToCopyIcon = input<Maybe<string>>();
  readonly clickIconToCopyOnly = input<Maybe<boolean>>();
  readonly clipboardSnackbarMessagesEnabled = input<Maybe<boolean>>();
  readonly clipboardSnackbarMessagesConfig = input<Maybe<CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig>>();

  /**
   * Whether a secret value is shown. Hidden at first.
   */
  readonly revealed = model<boolean>(false);

  readonly textSignal = computed(() => this.text() ?? this.config()?.text);
  readonly iconSignal = computed(() => this.icon() ?? this.config()?.icon);
  readonly monospaceSignal = computed(() => this.monospace() ?? this.config()?.monospace ?? false);
  readonly secretSignal = computed(() => this.secret() ?? this.config()?.secret ?? false);
  readonly hiddenTextSignal = computed(() => this.hiddenText() ?? this.config()?.hiddenText ?? DEFAULT_DBX_CLICK_TO_COPY_FIELD_HIDDEN_TEXT);

  /**
   * The copy options passed to the wrapped `dbx-click-to-copy-text`, which applies its own defaults to the unset ones.
   */
  readonly clickToCopyTextConfigSignal = computed<DbxClickToCopyTextComponentConfig>(() => {
    const config = this.config();

    return {
      copyText: this.copyText() ?? config?.copyText ?? this.textSignal(),
      showIcon: this.showIcon() ?? config?.showIcon,
      clickToCopyIcon: this.clickToCopyIcon() ?? config?.clickToCopyIcon,
      clickIconToCopyOnly: this.clickIconToCopyOnly() ?? config?.clickIconToCopyOnly,
      clipboardSnackbarMessagesEnabled: this.clipboardSnackbarMessagesEnabled() ?? config?.clipboardSnackbarMessagesEnabled,
      clipboardSnackbarMessagesConfig: this.clipboardSnackbarMessagesConfig() ?? config?.clipboardSnackbarMessagesConfig
    };
  });

  readonly displayTextSignal = computed(() => (this.secretSignal() && !this.revealed() ? this.hiddenTextSignal() : this.textSignal()));

  toggleRevealed(): void {
    this.revealed.update((x) => !x);
  }
}
