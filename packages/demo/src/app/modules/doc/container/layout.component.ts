import { Component } from '@angular/core';
import { ClickableAnchorLink } from '@dereekb/dbx-core';

@Component({
  templateUrl: './layout.component.html'
})
export class DocLayoutComponent {

  readonly navAnchors: ClickableAnchorLink[] = [{
    title: 'Docs',
    ref: 'doc'
  }];

}
