import { Component } from '@angular/core';
import { SimpleLoadingContext } from '@dereekb/rxjs';
import { DbxLoadingComponent } from '@dereekb/dbx-web';
import { MatButton } from '@angular/material/button';
import { UISref } from '@uirouter/angular';

@Component({
  templateUrl: './authorize.component.html',
  standalone: true,
  imports: [DbxLoadingComponent, MatButton, UISref]
})
export class DemoAuthAuthorizeComponent {
  readonly context = new SimpleLoadingContext(true);
}
