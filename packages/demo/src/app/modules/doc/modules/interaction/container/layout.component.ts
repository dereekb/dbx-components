import { Component } from '@angular/core';
import { ClickableAnchorLink } from '@dereekb/dbx-core';

@Component({
  templateUrl: './layout.component.html'
})
export class DocInteractionLayoutComponent {

  readonly navAnchors: ClickableAnchorLink[] = [{
    title: 'Interaction Components',
    ref: 'doc.interaction'
  }];

}
