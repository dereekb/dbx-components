import { Component } from '@angular/core';

@Component({
  selector: 'app-side-nav-bar-title-content',
  template: `
    <div class="app-side-nav-bar-title-content">
      <ng-content></ng-content>
    </div>
  `,
  styleUrls: ['./side.scss']
})
export class AppSideNavBarTitleContentComponent { }
