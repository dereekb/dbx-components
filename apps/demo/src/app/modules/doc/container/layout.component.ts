import { Component } from '@angular/core';
import { ClickableAnchorLink, ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { DOC_HOME_ROUTE, DOC_ROUTES } from '../doc';
import { DbxSidenavComponent } from '../../../../../../../packages/dbx-web/src/lib/router/layout/sidenav/sidenav.component';
import { DbxSetStyleDirective } from '../../../../../../../packages/dbx-web/src/lib/layout/style/style.set.directive';
import { DbxAppContextStateDirective } from '../../../../../../../packages/dbx-core/src/lib/context/context.directive';
import { DbxIfSidenavDisplayModeDirective } from '../../../../../../../packages/dbx-web/src/lib/router/layout/sidenav/sidenav.ifdisplaymode.directive';
import { DbxContentBorderDirective } from '../../../../../../../packages/dbx-web/src/lib/layout/content/content.border.directive';
import { DbxSidenavPageComponent } from '../../../../../../../packages/dbx-web/src/lib/router/layout/sidenav/sidenav.page.component';
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
