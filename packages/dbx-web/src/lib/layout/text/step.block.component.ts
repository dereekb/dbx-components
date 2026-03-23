import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { MatIconModule } from '@angular/material/icon';
import { type DbxThemeColor } from '../style/style';
import { DbxColorDirective } from '../style/style.color.directive';

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
 * @example
 * ```html
 * <dbx-step-block [step]="1" header="Create Account" hint="Fill in the registration form.">
 *   <p>Enter your email and password to get started.</p>
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
    <div class="dbx-step-block-badge" [dbxColor]="color()">
      @if (icon()) {
        <mat-icon>{{ icon() }}</mat-icon>
      } @else {
        {{ step() }}
      }
    </div>
    <div class="dbx-step-block-content">
      @if (header()) {
        <div class="dbx-step-block-header">
          <span class="dbx-step-block-header-label">{{ header() }}</span>
          <ng-content select="[header]"></ng-content>
        </div>
      }
      @if (hint()) {
        <span class="dbx-step-block-hint">{{ hint() }}</span>
      }
      <ng-content></ng-content>
    </div>
  `,
  host: {
    class: 'dbx-step-block d-block',
    '[class.dbx-step-block-center]': 'center()'
  },
  imports: [MatIconModule, DbxColorDirective],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxStepBlockComponent {
  readonly step = input<number>(1);
  readonly icon = input<Maybe<string>>();
  readonly header = input<Maybe<string>>();
  readonly hint = input<Maybe<string>>();
  readonly color = input<DbxThemeColor>('primary');
  readonly center = input<boolean>(false);
}
