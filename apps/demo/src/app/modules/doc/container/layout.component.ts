import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type ClickableAnchorLink, type ClickableAnchorLinkTree, DbxAppContextStateDirective } from '@dereekb/dbx-core';
import { DOC_HOME_ROUTE, DOC_ROUTES } from '../doc';
import { DbxSidenavComponent, DbxIfSidenavDisplayModeDirective, DbxContentBorderDirective, DbxSidenavPageComponent, DbxWebPageTitleInfoDirective, type DbxWebPageTitleInfoConfig } from '@dereekb/dbx-web';
import { UIView } from '@uirouter/angular';

@Component({
  templateUrl: './layout.component.html',
  standalone: true,
  imports: [DbxSidenavComponent, DbxAppContextStateDirective, DbxIfSidenavDisplayModeDirective, DbxContentBorderDirective, DbxSidenavPageComponent, UIView, DbxWebPageTitleInfoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocLayoutComponent {
  readonly home: ClickableAnchorLink = DOC_HOME_ROUTE;

  readonly navAnchors: ClickableAnchorLinkTree[] = [this.home, ...DOC_ROUTES];

  readonly pageTitleInfo: DbxWebPageTitleInfoConfig = { title: 'Docs', description: 'dbx-components docs and examples' };
}
