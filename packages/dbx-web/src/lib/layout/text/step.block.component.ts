import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DbxThemeColor } from '../style/style';
import { DbxColorDirective } from '../style/style.color.directive';
import { DbxIconTileComponent } from './icon-tile.component';

/**
 * Configuration object for {@link DbxStepBlockComponent}.
 *
 * Pass via the `config` input as an alternative to setting individual inputs.
 * Individual inputs take precedence over config values.
 *
 * @example
 * ```typescript
 * const stepConfig: DbxStepBlockComponentConfig = {
 *   step: 1,
 *   header: 'Create Account',
 *   hint: 'Fill in the registration form.',
 *   color: 'primary'
 * };
 * ```
 */
export interface DbxStepBlockComponentConfig {
  readonly step?: Maybe<number>;
  readonly icon?: Maybe<string>;
  readonly header?: Maybe<string>;
  readonly hint?: Maybe<string>;
  readonly color?: Maybe<DbxThemeColor>;
  readonly center?: Maybe<boolean>;
}

/**
 * A step-oriented content block that displays a numbered circle badge on the left
 * with header, hint, and projected content on the right.
 *
 * Use the `icon` input to replace the step number with a Material icon.
 * Use the `[header]` content slot for extra header-level content (like `dbx-detail-block`).
 * Use the `color` input to customize the badge color (defaults to `'primary'`).
 *
 * Use the `center` input to vertically center the badge with the content.
 *
 * Accepts either individual inputs or a single `config` object. Individual inputs
 * take precedence over config values when both are provided.
 *
 * @example
 * ```html
 * <dbx-step-block [step]="1" header="Create Account" hint="Fill in the registration form.">
 *   <p>Enter your email and password to get started.</p>
 * </dbx-step-block>
 *
 * <dbx-step-block [config]="stepConfig">
 *   <p>Content using a config object.</p>
 * </dbx-step-block>
 *
 * <dbx-step-block [step]="2" color="accent" header="Custom Header Content">
 *   <span header>Extra header content</span>
 *   <p>Detail content goes here.</p>
 * </dbx-step-block>
 * ```
 */
@Component({
  selector: 'dbx-step-block',
  template: `
    <dbx-icon-tile class="dbx-step-block-badge" [icon]="iconSignal()" [dbxColor]="colorSignal()">
      @if (!iconSignal()) {
        {{ stepSignal() }}
      }
    </dbx-icon-tile>
    <div class="dbx-step-block-content">
      @if (headerSignal()) {
        <div class="dbx-step-block-header">
          <span class="dbx-step-block-header-label">{{ headerSignal() }}</span>
          <ng-content select="[header]"></ng-content>
        </div>
      }
      @if (hintSignal()) {
        <span class="dbx-step-block-hint">{{ hintSignal() }}</span>
      }
      <ng-content></ng-content>
    </div>
  `,
  host: {
    class: 'dbx-step-block d-block',
    '[class.dbx-step-block-center]': 'centerSignal()'
  },
  imports: [DbxIconTileComponent, DbxColorDirective],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxStepBlockComponent {
  readonly config = input<Maybe<DbxStepBlockComponentConfig>>();
  readonly step = input<Maybe<number>>();
  readonly icon = input<Maybe<string>>();
  readonly header = input<Maybe<string>>();
  readonly hint = input<Maybe<string>>();
  readonly color = input<Maybe<DbxThemeColor>>();
  readonly center = input<Maybe<boolean>>();

  readonly stepSignal = computed(() => this.step() ?? this.config()?.step ?? 1);
  readonly iconSignal = computed(() => this.icon() ?? this.config()?.icon);
  readonly headerSignal = computed(() => this.header() ?? this.config()?.header);
  readonly hintSignal = computed(() => this.hint() ?? this.config()?.hint);
  readonly colorSignal = computed(() => this.color() ?? this.config()?.color ?? 'primary');
  readonly centerSignal = computed(() => this.center() ?? this.config()?.center ?? false);
}
