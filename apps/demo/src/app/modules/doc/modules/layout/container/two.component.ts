import { Component } from '@angular/core';
import { SegueRef, ClickableAnchorLinkTree } from '@dereekb/dbx-core';

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
      title: 'Parent View',
      ref: 'doc.layout.two'
    },
    {
      title: 'Child View',
      ref: 'doc.layout.two.child'
    }
  ];
}
