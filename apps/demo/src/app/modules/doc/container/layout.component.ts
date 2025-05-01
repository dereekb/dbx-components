import { Component } from '@angular/core';
import { ClickableAnchorLink, ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { DOC_HOME_ROUTE, DOC_ROUTES } from '../doc';
import { DbxSidenavComponent } from '@dereekb/dbx-web';
import { DbxSetStyleDirective } from '@dereekb/dbx-web';
import { DbxAppContextStateDirective } from '@dereekb/dbx-core';
import { DbxIfSidenavDisplayModeDirective } from '@dereekb/dbx-web';
import { DbxContentBorderDirective } from '@dereekb/dbx-web';
import { DbxSidenavPageComponent } from '@dereekb/dbx-web';
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
