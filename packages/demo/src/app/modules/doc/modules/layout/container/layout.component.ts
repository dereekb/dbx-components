import { Component } from '@angular/core';
import { ClickableAnchorLink } from '@dereekb/dbx-core';

@Component({
  templateUrl: './layout.component.html'
})
export class DocLayoutLayoutComponent {

  readonly navAnchors: ClickableAnchorLink[] = [{
    title: 'Layout Components',
    ref: 'doc.layout'
  }];

}
