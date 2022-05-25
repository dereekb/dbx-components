import { Component, Input } from '@angular/core';

/**
 * Pre-styled top/title component.
 */
@Component({
  selector: 'app-side-nav-bar-title',
  template: `
    <div class="app-side-nav-bar-title">
      <div class="app-side-nav-bar-title-header">
        <img src="assets/brand/icon.png"/>
        <span>{{ header }}</span>
      </div>
      <ng-content></ng-content>
    </div>
  `,
  styleUrls: ['./side.scss']
})
export class AppSideNavBarTitleComponent {

  @Input()
  header: string;

}
