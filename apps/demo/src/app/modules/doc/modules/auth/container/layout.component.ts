import { Component } from '@angular/core';
import { ClickableAnchorLink } from '@dereekb/dbx-core';

@Component({
  templateUrl: './layout.component.html'
})
export class DocAuthLayoutComponent {

  readonly navAnchors: ClickableAnchorLink[] = [{
    title: 'Auth Components',
    ref: 'doc.auth'
  }];

}
