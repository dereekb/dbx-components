import { Component } from '@angular/core';
import { ClickableAnchorLink } from '@dereekb/dbx-core';

@Component({
  templateUrl: './layout.component.html'
})
export class DocFormLayoutComponent {

  readonly navAnchors: ClickableAnchorLink[] = [{
    title: 'Form Components',
    ref: 'doc.form'
  }];

}
