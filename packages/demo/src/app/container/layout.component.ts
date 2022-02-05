import { ClickableAnchor } from '@dereekb/dbx-core';
import { Component } from '@angular/core';

@Component({
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss']
})
export class AppLayoutComponent {

  readonly landing: ClickableAnchor = {
    ref: 'landing'
  };

  readonly doc: ClickableAnchor = {
    ref: 'doc'
  };

  readonly demo: ClickableAnchor = {
    ref: 'demo'
  };

  readonly github: ClickableAnchor = {
    url: 'https://github.com/dereekb/dbcomponents',
    target: '_blank'
  };

}
