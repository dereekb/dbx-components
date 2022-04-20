import { Component } from '@angular/core';
import { ClickableAnchorLinkSegueRef } from '@dereekb/dbx-core';

@Component({
  templateUrl: './layout.component.html'
})
export class DocAuthLayoutComponent {

  readonly navAnchors: ClickableAnchorLinkSegueRef[] = [{
    title: 'Auth Components',
    ref: 'doc.auth'
  }];

}
