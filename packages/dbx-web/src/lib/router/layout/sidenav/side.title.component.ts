import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Displays a branded title header for the side navigation bar, including an app icon image and a header text.
 *
 * @example
 * ```html
 * <app-side-nav-bar-title header="My App">
 *   <span>Subtitle or extra content</span>
 * </app-side-nav-bar-title>
 * ```
 */
@Component({
  selector: 'app-side-nav-bar-title',
  template: `
    <div class="app-side-nav-bar-title">
      <div class="app-side-nav-bar-title-header">
        <img src="assets/brand/icon.png" />
        <span>{{ header() }}</span>
      </div>
      <ng-content></ng-content>
    </div>
  `,
  styleUrls: ['./side.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class AppSideNavBarTitleComponent {
  readonly header = input<Maybe<string>>();
}
