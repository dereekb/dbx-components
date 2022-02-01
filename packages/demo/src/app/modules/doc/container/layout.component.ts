import { Component } from '@angular/core';
import { ClickableAnchorLink } from '@dereekb/dbx-core';

@Component({
  templateUrl: './layout.component.html'
})
export class DocLayoutComponent {

  readonly navAnchors: ClickableAnchorLink[] = [{
    title: 'Docs',
    ref: 'doc'
  }, {
    title: 'Layout',
    ref: 'doc.layout'
  }, {
    title: 'Router',
    ref: 'doc.router'
  }, {
    title: 'Text',
    ref: 'doc.text'
  }];

}
