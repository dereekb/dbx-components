import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type ClickableAnchorLinkSegueRef } from '@dereekb/dbx-core';
import { DbxContentContainerDirective, DbxSectionPageComponent, DbxNavbarComponent } from '@dereekb/dbx-web';
import { UIView } from '@uirouter/angular';

@Component({
  templateUrl: './layout.component.html',
  imports: [DbxContentContainerDirective, DbxSectionPageComponent, DbxNavbarComponent, UIView]
})
export class DocExamplesLayoutComponent {
  readonly navAnchors: ClickableAnchorLinkSegueRef[] = [
    {
      title: 'Examples',
      ref: 'doc.examples'
    }
  ];
}
