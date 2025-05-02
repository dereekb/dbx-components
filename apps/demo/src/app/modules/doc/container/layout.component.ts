import { Component } from '@angular/core';
import { ClickableAnchorLink, ClickableAnchorLinkTree, DbxAppContextStateDirective } from '@dereekb/dbx-core';
import { DOC_HOME_ROUTE, DOC_ROUTES } from '../doc';
import { DbxSidenavComponent, DbxSetStyleDirective, DbxIfSidenavDisplayModeDirective, DbxContentBorderDirective, DbxSidenavPageComponent } from '@dereekb/dbx-web';
import { UIView } from '@uirouter/angular';

@Component({
  templateUrl: './layout.component.html',
  standalone: true,
  imports: [DbxSidenavComponent, DbxSetStyleDirective, DbxAppContextStateDirective, DbxIfSidenavDisplayModeDirective, DbxContentBorderDirective, DbxSidenavPageComponent, UIView]
})
export class DocLayoutComponent {
  readonly home: ClickableAnchorLink = DOC_HOME_ROUTE;

  readonly navAnchors: ClickableAnchorLinkTree[] = [this.home, ...DOC_ROUTES];
}
