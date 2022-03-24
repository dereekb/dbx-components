import { Component } from '@angular/core';
import { ClickableAnchorLink } from '@dereekb/dbx-core';

@Component({
  templateUrl: './layout.component.html'
})
export class DocRouterLayoutComponent {

  readonly navAnchors: ClickableAnchorLink[] = [{
    title: 'Router Components',
    ref: 'doc.router'
  }];

}
