import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { Maybe } from '@dereekb/util';

/**
 * Pre-styled top/title component.
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
