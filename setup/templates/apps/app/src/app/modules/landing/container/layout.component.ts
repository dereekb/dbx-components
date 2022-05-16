import { ClickableAnchorLink } from '@dereekb/dbx-core';
import { Component } from '@angular/core';

@Component({
  templateUrl: './layout.component.html'
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
