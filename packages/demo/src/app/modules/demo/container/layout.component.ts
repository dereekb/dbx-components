import { Component, ViewEncapsulation } from '@angular/core';
import { ClickableAnchorLink } from '@dereekb/dbx-core';

@Component({
  templateUrl: './layout.component.html',
  styleUrls: ['../demo.scss'],
  encapsulation: ViewEncapsulation.None
})
export class DemoLayoutComponent {

  readonly navAnchors: ClickableAnchorLink[] = [{
    title: 'Docs',
    ref: 'doc'
  }];

}
