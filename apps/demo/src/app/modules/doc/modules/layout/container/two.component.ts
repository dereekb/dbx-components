import { Component } from '@angular/core';
import { SegueRef, ClickableAnchor, ClickableAnchorLinkTree } from '@dereekb/dbx-core';

@Component({
  templateUrl: './two.component.html'
})
export class DocLayoutTwoColumnsComponent {
  showRight = true;

  readonly twoRef: SegueRef = {
    ref: 'doc.layout.two'
  };

  readonly childAnchors: ClickableAnchorLinkTree[] = [
    {
      title: 'Child View',
      ref: 'doc.layout.two.child'
    }
  ];
}
