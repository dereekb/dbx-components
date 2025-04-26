import { MatButtonModule } from '@angular/material/button';
import { ClickableAnchorLink } from '@dereekb/dbx-core';
import { DbxStyleLayoutModule, DbxSpacerDirective, DbxButtonSpacerDirective, DbxAnchorComponent, DbxContentLayoutModule } from '@dereekb/dbx-web';
import { Component } from '@angular/core';
import { DbxAppContextStateDirective } from '@dereekb/dbx-core';

@Component({
  templateUrl: './layout.component.html',
  imports: [DbxStyleLayoutModule, DbxSpacerDirective, DbxButtonSpacerDirective, DbxAnchorComponent, MatButtonModule, DbxContentLayoutModule, DbxAppContextStateDirective],
  standalone: true
})
export class LandingLayoutComponent {

  readonly docsAnchor: ClickableAnchorLink = {
    title: 'Docs',
    url: 'https://components.dereekb.com/landing'
  };

  readonly demoAnchor: ClickableAnchorLink = {
    title: 'Demo',
    url: 'https://components.dereekb.com/demo'
  };

}
