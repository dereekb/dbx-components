import { Component } from '@angular/core';
import { ClickableAnchorLink, ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { DOC_INTERACTION_ROOT_ROUTE } from '../modules/interaction/doc.interaction';
import { DOC_LAYOUT_ROOT_ROUTE } from '../modules/layout/doc.layout';
import { DOC_ROUTER_ROOT_ROUTE } from '../modules/router/doc.router';

@Component({
  templateUrl: './layout.component.html'
})
export class DocLayoutComponent {

  readonly home: ClickableAnchorLink = {
    icon: 'home',
    title: 'Docs',
    ref: 'doc.home'
  };

  readonly navAnchors: ClickableAnchorLinkTree[] = [this.home,
    DOC_LAYOUT_ROOT_ROUTE,
    DOC_ROUTER_ROOT_ROUTE,
    DOC_INTERACTION_ROOT_ROUTE, {
    icon: 'text_fields',
    title: 'Text',
    ref: 'doc.text'
  }];

}
