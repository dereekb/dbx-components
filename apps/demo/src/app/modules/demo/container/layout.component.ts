import { Component, ViewEncapsulation } from '@angular/core';
import { ClickableAnchorLink, ClickableAnchorLinkTree } from '@dereekb/dbx-core';

@Component({
  templateUrl: './layout.component.html',
  styleUrls: ['../demo.scss'],
  encapsulation: ViewEncapsulation.None
})
export class DemoLayoutComponent {

  readonly navAnchors: ClickableAnchorLink[] = [{
    title: 'Home',
    ref: 'demo.home',
    icon: 'home'
  }];

  readonly bottomNavAnchors: ClickableAnchorLinkTree[] = [{
    title: 'Notifications',
    ref: 'demo.notification'
  }, {
    title: 'Settings',
    ref: 'demo.setting'
  }];

}
