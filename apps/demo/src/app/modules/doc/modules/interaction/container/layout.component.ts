import { Component } from '@angular/core';
import { ClickableAnchorLinkSegueRef } from '@dereekb/dbx-core';

@Component({
  templateUrl: './layout.component.html'
})
export class DocInteractionLayoutComponent {
  readonly navAnchors: ClickableAnchorLinkSegueRef[] = [
    {
      title: 'Interaction Components',
      ref: 'doc.interaction'
    }
  ];
}
