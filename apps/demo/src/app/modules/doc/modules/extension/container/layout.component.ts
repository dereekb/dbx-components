import { Component } from '@angular/core';
import { ClickableAnchorLinkSegueRef } from '@dereekb/dbx-core';

@Component({
  templateUrl: './layout.component.html'
})
export class DocExtensionLayoutComponent {
  readonly navAnchors: ClickableAnchorLinkSegueRef[] = [
    {
      title: 'Extensions',
      ref: 'doc.extension'
    }
  ];
}
