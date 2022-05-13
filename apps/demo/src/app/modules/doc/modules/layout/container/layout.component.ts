import { Component } from '@angular/core';
import { ClickableAnchorLinkSegueRef } from '@dereekb/dbx-core';

@Component({
  templateUrl: './layout.component.html'
})
export class DocLayoutLayoutComponent {

  readonly navAnchors: ClickableAnchorLinkSegueRef[] = [{
    title: 'Layout Components',
    ref: 'doc.layout'
  }];

}
