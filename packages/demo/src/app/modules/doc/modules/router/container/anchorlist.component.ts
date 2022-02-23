import { DOC_LAYOUT_ROOT_ROUTE } from './../../layout/doc.layout';
import { Component } from '@angular/core';
import { ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { DOC_ROUTER_ROOT_ROUTE } from '../doc.router';

@Component({
  templateUrl: './anchorlist.component.html'
})
export class DocRouterAnchorListComponent {

  anchors: ClickableAnchorLinkTree[] = [
    DOC_LAYOUT_ROOT_ROUTE,
    DOC_ROUTER_ROOT_ROUTE,
  ];

}
