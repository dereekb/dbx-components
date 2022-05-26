import { Component } from '@angular/core';
import { ClickableAnchorLink, ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { DOC_HOME_ROUTE, DOC_ROUTES } from '../doc';

@Component({
  templateUrl: './layout.component.html'
})
export class DocLayoutComponent {
  readonly home: ClickableAnchorLink = DOC_HOME_ROUTE;

  readonly navAnchors: ClickableAnchorLinkTree[] = [this.home, ...DOC_ROUTES];
}
