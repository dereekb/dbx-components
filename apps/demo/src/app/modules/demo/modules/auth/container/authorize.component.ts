import { Component } from '@angular/core';
import { SimpleLoadingContext } from '@dereekb/rxjs';

@Component({
  templateUrl: './authorize.component.html'
})
export class DemoAuthAuthorizeComponent {
  readonly context = new SimpleLoadingContext(true);
}
