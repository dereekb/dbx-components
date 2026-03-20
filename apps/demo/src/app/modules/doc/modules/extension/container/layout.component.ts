import { Component, ChangeDetectionStrategy } from '@angular/core';
import { type ClickableAnchorLinkSegueRef } from '@dereekb/dbx-core';
import { DbxContentContainerDirective, DbxSectionPageComponent, DbxNavbarComponent } from '@dereekb/dbx-web';
import { UIView } from '@uirouter/angular';

@Component({
  templateUrl: './layout.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DbxSectionPageComponent, DbxNavbarComponent, UIView],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionLayoutComponent {
  readonly navAnchors: ClickableAnchorLinkSegueRef[] = [
    {
      title: 'Extensions',
      ref: 'doc.extension'
    }
  ];
}
