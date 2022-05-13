import { Component } from '@angular/core';
import { ClickableAnchorLinkSegueRef } from '@dereekb/dbx-core';

@Component({
  templateUrl: './layout.component.html'
})
export class DocActionLayoutComponent {

  readonly navAnchors: ClickableAnchorLinkSegueRef[] = [{
    title: 'Form Components',
    ref: 'doc.form'
  }];

}
