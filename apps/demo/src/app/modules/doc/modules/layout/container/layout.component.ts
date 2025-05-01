import { Component } from '@angular/core';
import { ClickableAnchorLinkSegueRef } from '@dereekb/dbx-core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DbxSectionPageComponent } from '@dereekb/dbx-web';
import { DbxNavbarComponent } from '@dereekb/dbx-web';
import { UIView } from '@uirouter/angular';

@Component({
  templateUrl: './layout.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DbxSectionPageComponent, DbxNavbarComponent, UIView]
})
export class DocLayoutLayoutComponent {
  readonly navAnchors: ClickableAnchorLinkSegueRef[] = [
    {
      title: 'Layout Components',
      ref: 'doc.layout'
    }
  ];
}
