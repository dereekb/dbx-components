import { ClickableAnchor } from '@dereekb/dbx-core';
import { Component } from '@angular/core';

@Component({
  templateUrl: './layout.component.html'
})
export class AppLayoutComponent {

  readonly homeAnchor: ClickableAnchor = {
    ref: 'public'
  };

}
