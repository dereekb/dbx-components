import { Component } from '@angular/core';
import { ClickableAnchorLinkSegueRef } from '@dereekb/dbx-core';
import { DbxContentContainerDirective, DbxSectionPageComponent, DbxNavbarComponent } from '@dereekb/dbx-web';
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
