import { ClickableAnchor, ClickableAnchorLink } from '@dereekb/dbx-core';
import { Component } from '@angular/core';

@Component({
  templateUrl: './layout.component.html',
  styleUrls: ['../app.scss']
})
export class AppLayoutComponent {

  readonly landing: ClickableAnchor = {
    ref: 'landing'
  };

  readonly doc: ClickableAnchor = {
    ref: 'doc'
  };

}
