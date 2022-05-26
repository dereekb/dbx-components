import { Component } from '@angular/core';
import { ClickableAnchorLinkSegueRef } from '@dereekb/dbx-core';

@Component({
  templateUrl: './layout.component.html'
})
export class DocRouterLayoutComponent {
  readonly navAnchors: ClickableAnchorLinkSegueRef[] = [
    {
      title: 'Router Components',
      ref: 'doc.router'
    }
  ];
}
