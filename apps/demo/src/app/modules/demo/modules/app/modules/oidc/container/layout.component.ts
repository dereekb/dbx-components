import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type ClickableAnchorLinkSegueRef } from '@dereekb/dbx-core';
import { DbxNavbarComponent } from '@dereekb/dbx-web';
import { UIView } from '@uirouter/angular';

@Component({
  templateUrl: './layout.component.html',
  imports: [UIView, DbxNavbarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DemoAppOidcLayoutComponent {
  readonly navAnchors: ClickableAnchorLinkSegueRef[] = [
    {
      title: 'My OAuth Clients',
      ref: 'demo.app.oidc.clients'
    },
    {
      title: 'Apps with Access',
      ref: 'demo.app.oidc.grants'
    }
  ];
}
