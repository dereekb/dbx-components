import { Component } from '@angular/core';
import { ClickableAnchorLinkSegueRef } from '@dereekb/dbx-core';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DbxSectionPageComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/section/section.page.component';
import { DbxNavbarComponent } from '../../../../../../../../../packages/dbx-web/src/lib/router/layout/navbar/navbar.component';
import { UIView } from '@uirouter/angular';

@Component({
    templateUrl: './layout.component.html',
    standalone: true,
    imports: [DbxContentContainerDirective, DbxSectionPageComponent, DbxNavbarComponent, UIView]
})
export class DocRouterLayoutComponent {
  readonly navAnchors: ClickableAnchorLinkSegueRef[] = [
    {
      title: 'Router Components',
      ref: 'doc.router'
    }
  ];
}
